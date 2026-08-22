import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { devices, sessions } from '@/db/schema';
import { hashToken } from '@/server/auth/crypto';

/**
 * אימות בקשות מאפליקציית הטלפון.
 *
 * ⚠ זהו גבול אמון חיצוני. האפליקציה רצה על מכשיר של משתמש קצה, ולכן כל
 * מה שמגיע ממנה הוא קלט לא מהימן — כולל מזהי מכשיר וסשן.
 *
 * ⚠ הטוקן נשלח כ־Bearer ונשמר במסד כ־hash בלבד. הוא אינו נכתב ליומן,
 * אינו מוחזר בתשובה, ואינו מופיע בהודעות שגיאה.
 */

export interface AppSessionContext {
  sessionId: string;
  sessionReference: string;
  status: string;
  clubId: string;
  stationId: string;
  deviceId: string | null;
  userId: string | null;
  drillVersionId: string | null;
  scheduledMinutes: number;
}

export type AuthFailure =
  | { reason: 'missing_token' }
  | { reason: 'invalid_token' }
  | { reason: 'expired_token' };

export type AppAuthResult =
  | { ok: true; session: AppSessionContext }
  | { ok: false; failure: AuthFailure };

/** קורא את הטוקן מכותרת Authorization, בלי לחשוף אותו הלאה */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * מאמת טוקן סשן ומחזיר את הקשר הסשן.
 *
 * ⚠ ההשוואה נעשית על ה־hash, ולכן דליפת המסד אינה מאפשרת התחזות.
 * ⚠ תוקף נבדק במסד ולא בקוד, כדי שלא יהיה תלוי בשעון של השרת האפליקטיבי.
 */
export async function authenticateSession(request: Request): Promise<AppAuthResult> {
  const token = readBearerToken(request);
  if (!token) return { ok: false, failure: { reason: 'missing_token' } };

  const [row] = await db
    .select({
      id: sessions.id,
      reference: sessions.reference,
      status: sessions.status,
      clubId: sessions.clubId,
      stationId: sessions.stationId,
      deviceId: sessions.deviceId,
      userId: sessions.userId,
      drillVersionId: sessions.drillVersionId,
      scheduledMinutes: sessions.scheduledMinutes,
      tokenExpiresAt: sessions.tokenExpiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.sessionTokenHash, hashToken(token)), isNull(sessions.deletedAt)))
    .limit(1);

  if (!row) return { ok: false, failure: { reason: 'invalid_token' } };

  if (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() <= Date.now()) {
    return { ok: false, failure: { reason: 'expired_token' } };
  }

  return {
    ok: true,
    session: {
      sessionId: row.id,
      sessionReference: row.reference,
      status: row.status,
      clubId: row.clubId,
      stationId: row.stationId,
      deviceId: row.deviceId,
      userId: row.userId,
      drillVersionId: row.drillVersionId,
      scheduledMinutes: row.scheduledMinutes,
    },
  };
}

/**
 * מוודא שהמכשיר שהאפליקציה מדווחת עליו הוא זה שמשויך לסשן.
 *
 * ⚠ בלי הבדיקה הזו אפליקציה יכולה לדווח טלמטריה או למשוך פקודות של
 * מכשיר אחר, רק בכך שתציין מזהה אחר.
 */
export async function resolveDeviceForSession(
  session: AppSessionContext,
  claimedDeviceId: string,
): Promise<{ ok: true; deviceUuid: string } | { ok: false; reason: string }> {
  const [device] = await db
    .select({ id: devices.id, deviceId: devices.deviceId, isAuthorized: devices.isAuthorized })
    .from(devices)
    .where(and(eq(devices.deviceId, claimedDeviceId), isNull(devices.deletedAt)))
    .limit(1);

  if (!device) return { ok: false, reason: 'המכשיר אינו רשום' };
  if (!device.isAuthorized) return { ok: false, reason: 'המכשיר אינו מורשה' };

  if (session.deviceId && session.deviceId !== device.id) {
    return { ok: false, reason: 'המכשיר אינו משויך לסשן זה' };
  }

  return { ok: true, deviceUuid: device.id };
}

/** סשנים שבהם האפליקציה רשאית לפעול על המכונה */
const OPERABLE_STATUSES = new Set(['paid', 'authorized', 'connecting', 'active', 'paused']);

export function isOperable(status: string): boolean {
  return OPERABLE_STATUSES.has(status);
}
