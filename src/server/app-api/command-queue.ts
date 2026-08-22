import 'server-only';
import { and, asc, desc, eq, lte, or, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '@/db/client';
import { deviceCommands } from '@/db/schema';

/**
 * תור הפקודות מהענן אל המכונה, דרך אפליקציית הטלפון.
 *
 * ⚠ פקודה כאן היא **בקשה**, לא פעולה. היא מגיעה למכונה רק כשטלפון מחובר
 * אליה ב־BLE ואוסף אותה. "עצור" אינו עצירה מיידית.
 *
 * ⚠ לכל פקודה יש תפוגה. פקודה שנאספת מאוחר מדי מסוכנת: "התחל" שנשלח
 * לפני עשרים דקות והגיע עכשיו יפעיל מכונה שאיש אינו עומד לידה.
 */

/** ברירות מחדל לתפוגה, בשניות. פקודות בטיחות חיות ארוך יותר. */
export const COMMAND_TTL_SECONDS: Record<string, number> = {
  stop: 900,
  force_stop: 900,
  lock: 900,
  unlock: 300,
  start: 120,
  pause: 300,
  resume: 300,
  apply_settings: 300,
  ping: 60,
};
const DEFAULT_TTL_SECONDS = 300;

/**
 * עדיפות איסוף. גבוה יותר נאסף קודם.
 * ⚠ עצירה חייבת לעקוף כל דבר אחר שממתין בתור.
 */
export const COMMAND_PRIORITY: Record<string, number> = {
  force_stop: 100,
  stop: 90,
  lock: 80,
  pause: 50,
  unlock: 40,
  apply_settings: 20,
  resume: 20,
  start: 10,
  ping: 0,
};

export interface EnqueueInput {
  deviceUuid: string;
  sessionId?: string | null;
  command: string;
  payload?: Record<string, unknown> | null;
  issuedBy?: string | null;
  reason?: string | null;
  ttlSeconds?: number;
}

export async function enqueueCommand(
  input: EnqueueInput,
  tx: DbOrTx = db,
): Promise<{ id: string; expiresAt: Date }> {
  const ttl = input.ttlSeconds ?? COMMAND_TTL_SECONDS[input.command] ?? DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const [row] = await tx
    .insert(deviceCommands)
    .values({
      deviceId: input.deviceUuid,
      sessionId: input.sessionId ?? null,
      command: input.command,
      payload: input.payload ?? null,
      priority: COMMAND_PRIORITY[input.command] ?? 0,
      issuedBy: input.issuedBy ?? null,
      reason: input.reason ?? null,
      expiresAt,
    })
    .returning({ id: deviceCommands.id, expiresAt: deviceCommands.expiresAt });

  return { id: row!.id, expiresAt: row!.expiresAt };
}

export interface PendingCommand {
  id: string;
  command: string;
  payload: Record<string, unknown> | null;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * מוסר לאפליקציה את הפקודות הממתינות ומסמן אותן כנאספו.
 *
 * ⚠ פקודות שפג תוקפן מסומנות ואינן נמסרות. הסימון נעשה כאן ולא בעבודת
 * רקע, כדי שתור לא ייתקע גם אם אין מתזמן פעיל.
 *
 * ⚠ הכול בטרנזקציה אחת: שתי בקשות מקבילות מאותה אפליקציה לא יקבלו את
 * אותה פקודה פעמיים.
 */
export async function fetchPendingCommands(
  deviceUuid: string,
  limit = 20,
): Promise<PendingCommand[]> {
  return db.transaction(async (tx) => {
    await tx
      .update(deviceCommands)
      .set({ status: 'expired' })
      .where(
        and(
          eq(deviceCommands.deviceId, deviceUuid),
          eq(deviceCommands.status, 'pending'),
          lte(deviceCommands.expiresAt, new Date()),
        ),
      );

    const rows = await tx
      .select({
        id: deviceCommands.id,
        command: deviceCommands.command,
        payload: deviceCommands.payload,
        issuedAt: deviceCommands.issuedAt,
        expiresAt: deviceCommands.expiresAt,
      })
      .from(deviceCommands)
      .where(and(eq(deviceCommands.deviceId, deviceUuid), eq(deviceCommands.status, 'pending')))
      .orderBy(desc(deviceCommands.priority), asc(deviceCommands.issuedAt))
      .limit(limit);

    if (rows.length > 0) {
      await tx
        .update(deviceCommands)
        .set({ status: 'fetched', fetchedAt: new Date() })
        .where(
          and(
            eq(deviceCommands.deviceId, deviceUuid),
            eq(deviceCommands.status, 'pending'),
            sql`${deviceCommands.id} IN ${rows.map((r) => r.id)}`,
          ),
        );
    }

    return rows.map((r) => ({
      id: r.id,
      command: r.command,
      payload: r.payload,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
    }));
  });
}

/**
 * רושם את תוצאת הפקודה כפי שדווחה מהמכונה.
 *
 * ⚠ מקבל רק פקודות של אותו מכשיר, כדי שאפליקציה לא תוכל לסמן פקודות
 * של מכשיר אחר כבוצעו.
 */
export async function acknowledgeCommand(
  deviceUuid: string,
  commandId: string,
  outcome: { success: boolean; failureReason?: string | null },
): Promise<boolean> {
  const result = await db
    .update(deviceCommands)
    .set({
      status: outcome.success ? 'acknowledged' : 'failed',
      acknowledgedAt: new Date(),
      failureReason: outcome.success ? null : (outcome.failureReason ?? 'לא צוינה סיבה'),
    })
    .where(
      and(
        eq(deviceCommands.id, commandId),
        eq(deviceCommands.deviceId, deviceUuid),
        or(eq(deviceCommands.status, 'fetched'), eq(deviceCommands.status, 'pending')),
      ),
    )
    .returning({ id: deviceCommands.id });

  return result.length > 0;
}

/** מבטל פקודות ממתינות של סשן — למשל כשהסשן הסתיים */
export async function cancelSessionCommands(
  sessionId: string,
  reason: string,
  tx: DbOrTx = db,
): Promise<number> {
  const result = await tx
    .update(deviceCommands)
    .set({ status: 'cancelled', failureReason: reason })
    .where(
      and(
        eq(deviceCommands.sessionId, sessionId),
        or(eq(deviceCommands.status, 'pending'), eq(deviceCommands.status, 'fetched')),
      ),
    )
    .returning({ id: deviceCommands.id });
  return result.length;
}
