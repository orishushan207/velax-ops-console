import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { devices, stationGateways, stations } from '@/db/schema';
import { hashToken } from '@/server/auth/crypto';
import { readBearerToken } from './auth';

/**
 * אימות שער BLE קבוע.
 *
 * ⚠ שונה מאימות האפליקציה: לשער אין סשן ואין משתמש. הוא מזדהה במפתח
 * ארוך־טווח ששויך לעמדה, ולכן זו הרשאה רחבה יותר — היא אינה מוגבלת
 * לסשן יחיד. מכאן שהמפתח נשמר כ־hash ומוצג פעם אחת בלבד.
 *
 * ⚠ השער משויך לעמדה ולא למכונה. המכונה הנוכחית נגזרת בזמן אמת, כדי
 * שהחלפת מכונה בעמדה לא תדרוש הגדרה מחדש של השער.
 */

export interface GatewayContext {
  gatewayRowId: string;
  gatewayId: string;
  stationId: string;
  stationCode: string;
  clubId: string;
  status: string;
  /** המכונה המשויכת לעמדה כרגע. null = אין מכונה. */
  deviceUuid: string | null;
  deviceId: string | null;
}

export type GatewayAuthResult =
  | { ok: true; gateway: GatewayContext }
  | { ok: false; reason: 'missing_key' | 'invalid_key' | 'retired' };

export async function authenticateGateway(request: Request): Promise<GatewayAuthResult> {
  const key = readBearerToken(request);
  if (!key) return { ok: false, reason: 'missing_key' };

  const [row] = await db
    .select({
      id: stationGateways.id,
      gatewayId: stationGateways.gatewayId,
      status: stationGateways.status,
      stationId: stations.id,
      stationCode: stations.code,
      clubId: stations.clubId,
      deviceUuid: devices.id,
      deviceId: devices.deviceId,
    })
    .from(stationGateways)
    .innerJoin(stations, eq(stations.id, stationGateways.stationId))
    .leftJoin(
      devices,
      and(eq(devices.currentStationId, stations.id), isNull(devices.deletedAt)),
    )
    .where(and(eq(stationGateways.keyHash, hashToken(key)), isNull(stationGateways.deletedAt)))
    .limit(1);

  if (!row) return { ok: false, reason: 'invalid_key' };
  if (row.status === 'retired') return { ok: false, reason: 'retired' };

  return {
    ok: true,
    gateway: {
      gatewayRowId: row.id,
      gatewayId: row.gatewayId,
      stationId: row.stationId,
      stationCode: row.stationCode,
      clubId: row.clubId,
      status: row.status,
      deviceUuid: row.deviceUuid,
      deviceId: row.deviceId,
    },
  };
}

/**
 * מעדכן את סימני החיים של השער.
 *
 * ⚠ נקרא בכל בקשה. שער שאינו מדווח הוא שער מנותק, ובלי החותמת הזו אין
 * דרך להבחין בין "אין פקודות" לבין "השער מת".
 */
export async function touchGateway(
  gatewayRowId: string,
  info: { ipAddress?: string | null; bleConnected?: boolean; firmwareVersion?: string | null },
): Promise<void> {
  await db
    .update(stationGateways)
    .set({
      lastSeenAt: sql`now()`,
      status: 'active',
      lastIpAddress: info.ipAddress ?? null,
      ...(info.bleConnected !== undefined ? { bleConnected: info.bleConnected } : {}),
      ...(info.firmwareVersion ? { firmwareVersion: info.firmwareVersion } : {}),
    })
    .where(eq(stationGateways.id, gatewayRowId));
}
