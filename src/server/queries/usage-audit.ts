import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { CurrentUser } from '@/server/auth/session';
import {
  DEFAULT_DRAIN_MODEL,
  reconcileUsage,
  type BatteryReading,
  type PaidUsageWindow,
} from '@/lib/pusun/usage-reconciliation';
import { clubScopeSql } from './sessions';

/**
 * שימוש בלתי מוסבר לפי עמדה.
 *
 * ⚠ הערכת תחתון בלבד. ראה usage-reconciliation.ts להסבר מדוע הסוללה היא
 * האות היחיד הזמין, ומדוע התוצאה אינה מדידה מלאה.
 */

export interface StationUsageAudit {
  stationId: string;
  stationCode: string;
  stationName: string;
  clubName: string;
  deviceId: string | null;
  readingCount: number;
  flaggedIntervals: number;
  unexplainedHours: number;
  paidHours: number;
  /** יחס השימוש הבלתי מוסבר מתוך סך השימוש המשוער */
  unexplainedShare: number | null;
}

export async function auditStationUsage(
  user: CurrentUser,
  days = 30,
): Promise<StationUsageAudit[]> {
  const stations = await db.execute(sql`
    SELECT s.id, s.code, s.name, c.name AS club_name, d.device_id, d.id AS device_uuid
    FROM stations s
    JOIN clubs c ON c.id = s.club_id
    LEFT JOIN devices d ON d.current_station_id = s.id AND d.deleted_at IS NULL
    WHERE s.deleted_at IS NULL AND ${clubScopeSql(user, 's.club_id')}
    ORDER BY c.name, s.code
  `);

  const results: StationUsageAudit[] = [];

  for (const raw of stations.rows as Record<string, string | null>[]) {
    const deviceUuid = raw.device_uuid;

    let readings: BatteryReading[] = [];
    let paidWindows: PaidUsageWindow[] = [];

    if (deviceUuid) {
      const t = await db.execute(sql`
        SELECT recorded_at, battery_pct
        FROM device_telemetry
        WHERE device_id = ${deviceUuid}
          AND battery_pct IS NOT NULL
          AND recorded_at >= now() - (${days}::int * interval '1 day')
        ORDER BY recorded_at
      `);
      readings = (t.rows as { recorded_at: string; battery_pct: number }[]).map((r) => ({
        recordedAt: new Date(r.recorded_at),
        batteryPct: Number(r.battery_pct),
      }));

      // ⚠ רק סשנים ששולמו בפועל נחשבים כמסבירים צריכה. סשן שזוכה
      // במלואו אינו הכנסה, אך הוא כן הסבר פיזי לצריכת הסוללה.
      const p = await db.execute(sql`
        SELECT started_at, ended_at, COALESCE(actual_minutes, 0) AS minutes
        FROM sessions
        WHERE station_id = ${raw.id}
          AND started_at IS NOT NULL AND ended_at IS NOT NULL
          AND status IN ('completed','partially_refunded','fully_refunded','interrupted')
          AND started_at >= now() - (${days}::int * interval '1 day')
          AND deleted_at IS NULL
      `);
      paidWindows = (p.rows as { started_at: string; ended_at: string; minutes: number }[]).map(
        (r) => ({
          from: new Date(r.started_at),
          to: new Date(r.ended_at),
          activeMinutes: Number(r.minutes),
        }),
      );
    }

    const result = reconcileUsage(readings, paidWindows, DEFAULT_DRAIN_MODEL);
    const paidHours = paidWindows.reduce((s, w) => s + w.activeMinutes / 60, 0);
    const total = paidHours + result.totalUnexplainedHours;

    results.push({
      stationId: String(raw.id),
      stationCode: String(raw.code),
      stationName: String(raw.name),
      clubName: String(raw.club_name),
      deviceId: raw.device_id ?? null,
      readingCount: readings.length,
      flaggedIntervals: result.flaggedCount,
      unexplainedHours: result.totalUnexplainedHours,
      paidHours,
      unexplainedShare: total > 0 ? result.totalUnexplainedHours / total : null,
    });
  }

  return results;
}
