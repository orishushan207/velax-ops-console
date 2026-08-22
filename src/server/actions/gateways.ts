'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { stationGateways, stations } from '@/db/schema';
import { writeAudit } from '@/server/audit';
import { generateToken, hashToken } from '@/server/auth/crypto';
import { assertClubAccess } from '@/server/auth/guard';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  zodFieldErrors,
  type ActionResult,
} from './_helpers';

/**
 * ניהול שערי BLE בעמדות.
 *
 * ⚠ מפתח השער נוצר כאן, מוצג **פעם אחת בלבד**, ונשמר כ־hash. הוא אינו
 * ניתן לשחזור. מפתח שאבד מחייב סבב מפתח, וזו התנהגות מכוונת: מפתח
 * שניתן לשלוף מהמסד הוא מפתח שדליפת המסד חושפת.
 *
 * ⚠ המפתח מעניק שליטה על מכונה — הפעלה ועצירה. הרשאתו נפרדת ומסווגת
 * כרגישה.
 */

const gatewaySchema = z.object({
  stationId: z.string().uuid('נא לבחור עמדה'),
  gatewayId: z
    .string()
    .trim()
    .min(3, 'מזהה קצר מדי')
    .max(64)
    .regex(/^[A-Z0-9-]+$/, 'מזהה באותיות לטיניות גדולות, ספרות ומקפים בלבד'),
  hardwareModel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** רישום שער חדש. מחזיר את המפתח פעם אחת. */
export async function registerGatewayAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; gatewayKey: string }>> {
  return withPermission('devices.register', async (ctx) => {
    const parsed = gatewaySchema.safeParse({
      stationId: formString(formData, 'stationId'),
      gatewayId: formString(formData, 'gatewayId').toUpperCase(),
      hardwareModel: formString(formData, 'hardwareModel'),
    });
    if (!parsed.success) {
      return actionError('נא לתקן את השדות המסומנים', zodFieldErrors(parsed.error));
    }
    const v = parsed.data;

    const [station] = await db
      .select({ id: stations.id, code: stations.code, clubId: stations.clubId })
      .from(stations)
      .where(and(eq(stations.id, v.stationId), isNull(stations.deletedAt)))
      .limit(1);
    if (!station) return actionError('העמדה לא נמצאה');
    assertClubAccess(ctx.user, station.clubId);

    const [dup] = await db
      .select({ id: stationGateways.id })
      .from(stationGateways)
      .where(eq(stationGateways.gatewayId, v.gatewayId))
      .limit(1);
    if (dup) return actionError('מזהה השער כבר קיים', { gatewayId: 'מזהה תפוס' });

    // ⚠ 32 בתים. המפתח קיים בזיכרון רק כאן ובתשובה למשתמש.
    const gatewayKey = generateToken(32);

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(stationGateways)
        .values({
          stationId: v.stationId,
          gatewayId: v.gatewayId,
          keyHash: hashToken(gatewayKey),
          keyRotatedAt: new Date(),
          hardwareModel: v.hardwareModel,
          status: 'provisioned',
        })
        .returning({ id: stationGateways.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'gateway.register',
          entityType: 'station_gateway',
          entityId: row!.id,
          entityLabel: `${v.gatewayId} · ${station.code}`,
          clubId: station.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          // ⚠ המפתח עצמו לעולם אינו נרשם ביומן
          after: { gatewayId: v.gatewayId, station: station.code, model: v.hardwareModel },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return row!.id;
    });

    revalidate('/stations', `/stations/${v.stationId}`);
    return actionOk({ id, gatewayKey }, `השער ${v.gatewayId} נרשם`);
  });
}

/**
 * סבב מפתח לשער קיים.
 *
 * ⚠ המפתח הקודם מפסיק לעבוד מיידית. יש להזין את החדש בשער לפני שהוא
 * יוכל לחזור לתקשר.
 */
export async function rotateGatewayKeyAction(
  gatewayRowId: string,
  reason: string,
): Promise<ActionResult<{ gatewayKey: string }>> {
  return withPermission('devices.firmware', async (ctx) => {
    const parsedReason = z
      .string()
      .trim()
      .min(5, 'נא לפרט סיבה של 5 תווים לפחות')
      .safeParse(reason);
    if (!parsedReason.success) {
      return actionError(parsedReason.error.issues[0]?.message ?? 'סיבה אינה תקינה');
    }

    const [row] = await db
      .select({
        id: stationGateways.id,
        gatewayId: stationGateways.gatewayId,
        stationId: stationGateways.stationId,
        clubId: stations.clubId,
      })
      .from(stationGateways)
      .innerJoin(stations, eq(stations.id, stationGateways.stationId))
      .where(and(eq(stationGateways.id, gatewayRowId), isNull(stationGateways.deletedAt)))
      .limit(1);
    if (!row) return actionError('השער לא נמצא');
    assertClubAccess(ctx.user, row.clubId);

    const gatewayKey = generateToken(32);

    await db.transaction(async (tx) => {
      await tx
        .update(stationGateways)
        .set({
          keyHash: hashToken(gatewayKey),
          keyRotatedAt: new Date(),
          status: 'provisioned',
          bleConnected: false,
        })
        .where(eq(stationGateways.id, gatewayRowId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'gateway.rotate_key',
          entityType: 'station_gateway',
          entityId: gatewayRowId,
          entityLabel: row.gatewayId,
          clubId: row.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          reason: parsedReason.data,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/${row.stationId}`);
    return actionOk({ gatewayKey }, 'מפתח השער הוחלף. המפתח הקודם אינו תקף עוד.');
  });
}
