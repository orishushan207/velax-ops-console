'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  deviceAssignments,
  deviceFirmwareHistory,
  devices,
  firmwareVersions,
  stations,
} from '@/db/schema';
import { writeAudit } from '@/server/audit';
import { encryptSecret, generateToken } from '@/server/auth/crypto';
import { assertClubAccess } from '@/server/auth/guard';
import { getDeviceProvider } from '@/server/providers';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  type ActionResult,
} from './_helpers';

/**
 * פעולות ניהול צי — סעיף 9 בהנחיות.
 *
 * ⚠ מפתח ההרשאה של המכשיר (auth_key) נוצר כאן ומוצפן מיד.
 * הוא אינו מוחזר מאף פונקציה ואינו נשלח ללקוח בשום מצב.
 */

const reasonSchema = z.string().trim().min(5, 'נא לפרט סיבה של 5 תווים לפחות');

async function loadDevice(deviceId: string) {
  const [row] = await db
    .select({
      id: devices.id,
      deviceId: devices.deviceId,
      serialNumber: devices.serialNumber,
      status: devices.status,
      currentClubId: devices.currentClubId,
      currentStationId: devices.currentStationId,
      firmwareVersionId: devices.firmwareVersionId,
      isSpare: devices.isSpare,
    })
    .from(devices)
    .where(and(eq(devices.id, deviceId), isNull(devices.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** רישום מכשיר חדש */
export async function registerDeviceAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('devices.register', async (ctx) => {
    const schema = z.object({
      deviceId: z.string().trim().min(3, 'Device ID קצר מדי').max(64),
      serialNumber: z.string().trim().min(3, 'מספר סידורי קצר מדי').max(80),
      model: z.string().trim().min(1, 'נא לציין דגם'),
      hardwareVersion: z.string().trim().optional(),
      purchaseCost: z.string().optional(),
      isSpare: z.boolean(),
    });

    const parsed = schema.safeParse({
      deviceId: formString(formData, 'deviceId'),
      serialNumber: formString(formData, 'serialNumber'),
      model: formString(formData, 'model') || 'PT-9001 · VELA-X ELITE',
      hardwareVersion: formString(formData, 'hardwareVersion') || undefined,
      purchaseCost: formString(formData, 'purchaseCost') || undefined,
      isSpare: formData.get('isSpare') === 'on',
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    const existing = await db
      .select({ id: devices.id })
      .from(devices)
      .where(eq(devices.deviceId, parsed.data.deviceId))
      .limit(1);
    if (existing.length > 0) {
      return actionError('Device ID כבר קיים במערכת', { deviceId: 'מזהה תפוס' });
    }

    const newId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(devices)
        .values({
          deviceId: parsed.data.deviceId,
          serialNumber: parsed.data.serialNumber,
          model: parsed.data.model,
          hardwareVersion: parsed.data.hardwareVersion ?? null,
          status: 'in_stock',
          isAuthorized: true,
          authorizedAt: new Date(),
          // המפתח נוצר ומוצפן מיד. אינו מוחזר לעולם.
          authKeyEncrypted: encryptSecret(generateToken(32)),
          authKeyRotatedAt: new Date(),
          isSpare: parsed.data.isSpare,
          connectivity: 'unknown',
          purchaseCost: parsed.data.purchaseCost ?? '0',
          qrCodeToken: generateToken(16),
        })
        .returning({ id: devices.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'device.register',
          entityType: 'device',
          entityId: row!.id,
          entityLabel: parsed.data.deviceId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: {
            deviceId: parsed.data.deviceId,
            serialNumber: parsed.data.serialNumber,
            model: parsed.data.model,
          },
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );

      return row!.id;
    });

    revalidate('/stations', '/stations/devices');
    return actionOk({ id: newId }, 'המכשיר נרשם במלאי');
  });
}

/** שיוך או העברת מכשיר לעמדה */
export async function assignDeviceAction(
  deviceId: string,
  stationId: string | null,
  reason: string,
): Promise<ActionResult> {
  return withPermission('devices.assign', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    let targetClubId: string | null = null;
    let targetCode: string | null = null;
    if (stationId) {
      const [station] = await db
        .select({ id: stations.id, code: stations.code, clubId: stations.clubId })
        .from(stations)
        .where(and(eq(stations.id, stationId), isNull(stations.deletedAt)))
        .limit(1);
      if (!station) return actionError('העמדה לא נמצאה');
      assertClubAccess(ctx.user, station.clubId);
      targetClubId = station.clubId;
      targetCode = station.code;

      // עמדה יכולה להחזיק מכשיר אחד בלבד
      const [occupied] = await db
        .select({ id: devices.id, deviceId: devices.deviceId })
        .from(devices)
        .where(and(eq(devices.currentStationId, stationId), isNull(devices.deletedAt)))
        .limit(1);
      if (occupied && occupied.id !== deviceId) {
        return actionError(
          `בעמדה ${station.code} כבר מוצבת מכונה (${occupied.deviceId}). יש לשחרר אותה קודם.`,
        );
      }
    }

    await db.transaction(async (tx) => {
      // סוגרים את השיוך הקודם
      if (device.currentStationId) {
        await tx
          .update(deviceAssignments)
          .set({ unassignedAt: new Date() })
          .where(
            and(
              eq(deviceAssignments.deviceId, deviceId),
              isNull(deviceAssignments.unassignedAt),
            ),
          );
      }

      await tx
        .update(devices)
        .set({
          currentStationId: stationId,
          currentClubId: targetClubId,
          status: stationId ? 'active' : 'in_stock',
        })
        .where(eq(devices.id, deviceId));

      if (stationId) {
        await tx.insert(deviceAssignments).values({
          deviceId,
          stationId,
          clubId: targetClubId,
          reason: device.currentStationId ? 'transfer' : 'initial_install',
          assignedBy: ctx.user.id,
          notes: parsed.data,
        });
      }

      await writeAudit(
        {
          action: 'update',
          actionKey: stationId ? 'device.assign' : 'device.unassign',
          entityType: 'device',
          entityId: deviceId,
          entityLabel: device.deviceId,
          clubId: targetClubId ?? device.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { stationId: device.currentStationId, clubId: device.currentClubId },
          after: { stationId, clubId: targetClubId, stationCode: targetCode },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/devices/${deviceId}`, '/live');
    return actionOk(
      undefined,
      stationId ? `המכשיר שויך לעמדה ${targetCode}` : 'המכשיר הוחזר למלאי',
    );
  });
}

/** בידוד מכשיר חשוד או השבתתו */
export async function quarantineDeviceAction(
  deviceId: string,
  reason: string,
): Promise<ActionResult> {
  return withPermission('devices.quarantine', async (ctx) => {
    const parsed = z
      .string()
      .trim()
      .min(10, 'בידוד מכשיר דורש פירוט של 10 תווים לפחות')
      .safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    await db.transaction(async (tx) => {
      await tx
        .update(devices)
        .set({
          status: 'quarantined',
          isAuthorized: false,
          quarantineReason: parsed.data,
          quarantinedBy: ctx.user.id,
          quarantinedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));

      await writeAudit(
        {
          action: 'device_command',
          actionKey: 'device.quarantine',
          entityType: 'device',
          entityId: deviceId,
          entityLabel: device.deviceId,
          clubId: device.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: device.status, isAuthorized: true },
          after: { status: 'quarantined', isAuthorized: false },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/devices/${deviceId}`, '/live');
    return actionOk(undefined, 'המכשיר בודד ואינו מורשה לפעול');
  });
}

/** החזרת מכשיר מבידוד */
export async function releaseDeviceAction(
  deviceId: string,
  reason: string,
): Promise<ActionResult> {
  return withPermission('devices.quarantine', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    await db.transaction(async (tx) => {
      await tx
        .update(devices)
        .set({
          status: device.currentStationId ? 'active' : 'in_stock',
          isAuthorized: true,
          quarantineReason: null,
          quarantinedBy: null,
          quarantinedAt: null,
        })
        .where(eq(devices.id, deviceId));

      await writeAudit(
        {
          action: 'device_command',
          actionKey: 'device.release',
          entityType: 'device',
          entityId: deviceId,
          entityLabel: device.deviceId,
          clubId: device.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: 'quarantined' },
          after: { status: device.currentStationId ? 'active' : 'in_stock' },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/devices/${deviceId}`);
    return actionOk(undefined, 'המכשיר הוחזר לפעילות');
  });
}

/** עדכון Firmware או Rollback */
export async function updateFirmwareAction(
  deviceId: string,
  targetVersionId: string,
  reason: string,
  isRollback = false,
): Promise<ActionResult> {
  return withPermission('devices.firmware', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    const [target] = await db
      .select({ id: firmwareVersions.id, version: firmwareVersions.version, channel: firmwareVersions.channel })
      .from(firmwareVersions)
      .where(eq(firmwareVersions.id, targetVersionId))
      .limit(1);
    if (!target) return actionError('גרסת ה־Firmware לא נמצאה');

    if (target.channel !== 'stable' && !isRollback) {
      return actionError(
        `גרסה בערוץ ${target.channel} אינה מיועדת לעמדות בייצור. אם זו כוונתך, בצע זאת דרך מכשיר בדיקה.`,
      );
    }

    const provider = getDeviceProvider();
    const result = await provider.sendCommand({
      deviceId: device.deviceId,
      command: isRollback ? 'firmware_rollback' : 'firmware_update',
      params: { version: target.version },
    });

    await db.transaction(async (tx) => {
      await tx.insert(deviceFirmwareHistory).values({
        deviceId,
        fromVersionId: device.firmwareVersionId,
        toVersionId: target.id,
        isRollback,
        succeeded: result.ok,
        errorMessage: result.ok ? null : (result.errorMessage ?? 'הפקודה נכשלה'),
        performedBy: ctx.user.id,
      });

      if (result.ok) {
        await tx
          .update(devices)
          .set({ firmwareVersionId: target.id })
          .where(eq(devices.id, deviceId));
      }

      await writeAudit(
        {
          action: 'device_command',
          actionKey: isRollback ? 'device.firmware_rollback' : 'device.firmware_update',
          entityType: 'device',
          entityId: deviceId,
          entityLabel: device.deviceId,
          clubId: device.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { firmwareVersionId: device.firmwareVersionId },
          after: { firmwareVersionId: target.id, version: target.version },
          reason: parsed.data,
          succeeded: result.ok,
          errorMessage: result.ok ? null : (result.errorMessage ?? null),
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate(`/stations/devices/${deviceId}`, '/stations');
    if (!result.ok) return actionError(`עדכון ה־Firmware נכשל: ${result.errorMessage ?? ''}`);
    return actionOk(
      undefined,
      `${isRollback ? 'Rollback' : 'עדכון'} ל־${target.version} בוצע. ⚠ שכבת ה־BLE במצב Mock — לא בוצעה פקודה אמיתית למכשיר.`,
    );
  });
}

/** גריעת מכשיר */
export async function retireDeviceAction(
  deviceId: string,
  reason: string,
  outcome: 'retired' | 'lost',
): Promise<ActionResult> {
  return withPermission('devices.retire', async (ctx) => {
    const parsed = z
      .string()
      .trim()
      .min(10, 'גריעת מכשיר דורשת פירוט של 10 תווים לפחות')
      .safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    await db.transaction(async (tx) => {
      if (device.currentStationId) {
        await tx
          .update(deviceAssignments)
          .set({ unassignedAt: new Date() })
          .where(
            and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)),
          );
      }

      await tx
        .update(devices)
        .set({
          status: outcome,
          isAuthorized: false,
          retiredReason: parsed.data,
          currentStationId: null,
          currentClubId: null,
        })
        .where(eq(devices.id, deviceId));

      await writeAudit(
        {
          action: 'soft_delete',
          actionKey: `device.${outcome}`,
          entityType: 'device',
          entityId: deviceId,
          entityLabel: device.deviceId,
          clubId: device.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: device.status },
          after: { status: outcome },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/devices/${deviceId}`);
    return actionOk(undefined, outcome === 'lost' ? 'המכשיר סומן כאבוד' : 'המכשיר נגרע');
  });
}

/** משיכת טלמטריה עדכנית מהמכשיר */
export async function pingDeviceAction(deviceId: string): Promise<ActionResult> {
  return withPermission('devices.telemetry', async (ctx) => {
    const device = await loadDevice(deviceId);
    if (!device) return actionError('המכשיר לא נמצא');
    if (device.currentClubId) assertClubAccess(ctx.user, device.currentClubId);

    const provider = getDeviceProvider();
    const result = await provider.fetchTelemetry(device.deviceId);
    if (!result.ok) return actionError('משיכת הטלמטריה נכשלה');

    const data = result.data ?? {};
    await db.execute(sql`
      INSERT INTO device_telemetry (device_id, battery_pct, connectivity, rssi, balls_fired, motor_temp_c, raw)
      VALUES (
        ${deviceId}::uuid,
        ${Number(data.batteryPct ?? 0)},
        'online',
        ${Number(data.rssi ?? 0)},
        ${Number(data.ballsFired ?? 0)},
        ${Number(data.motorTempC ?? 0)},
        ${JSON.stringify(data)}::jsonb
      )
    `);

    await db
      .update(devices)
      .set({
        batteryPct: Number(data.batteryPct ?? 0),
        connectivity: 'online',
        lastSeenAt: new Date(),
      })
      .where(eq(devices.id, deviceId));

    revalidate(`/stations/devices/${deviceId}`);
    return actionOk(
      undefined,
      'הטלמטריה עודכנה. ⚠ שכבת ה־BLE במצב Mock — הנתונים נוצרו על ידי ספק מדומה.',
    );
  });
}
