import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { CurrentUser } from '@/server/auth/session';
import { getSettings } from '@/server/settings/service';

/**
 * מרכז פעילות בזמן אמת — סעיף 7 בהנחיות.
 *
 * המסך מציג את מה שקורה עכשיו: סשנים פעילים, סשנים ששולמו ולא התחילו,
 * מכונות מנותקות, עמדות מושבתות ותקלות קריטיות.
 */

function scope(user: CurrentUser, column: string) {
  if (user.isGlobal) return sql`TRUE`;
  const ids = user.clubIds ?? [];
  if (ids.length === 0) return sql`FALSE`;
  return sql`${sql.raw(column)} IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

export interface LiveSession {
  id: string;
  reference: string;
  status: string;
  clubName: string;
  clubId: string;
  stationCode: string;
  stationId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  playerName: string;
  isGuest: boolean;
  playerCount: number;
  startedAt: Date | null;
  scheduledMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  amountGross: number;
  paymentStatus: string | null;
  connectivity: string | null;
  batteryPct: number | null;
  estimatedBallsRemaining: number | null;
  programName: string | null;
  lastErrorCode: string | null;
}

export async function getLiveSessions(user: CurrentUser): Promise<LiveSession[]> {
  const rows = await db.execute(sql`
    SELECT
      s.id, s.reference, s.status, s.started_at, s.scheduled_minutes, s.paused_minutes,
      s.amount_gross, s.player_count, s.is_guest, s.guest_name,
      c.id AS club_id, c.name AS club_name,
      st.id AS station_id, st.code AS station_code,
      d.id AS device_id, d.device_id AS device_label, d.connectivity, d.battery_pct,
      d.estimated_balls_remaining,
      u.full_name AS player_name,
      p.status AS payment_status,
      pv.description AS program_name,
      (SELECT t.error_code FROM device_telemetry t
        WHERE t.device_id = d.id AND t.error_code IS NOT NULL
        ORDER BY t.recorded_at DESC LIMIT 1) AS last_error_code
    FROM sessions s
    JOIN clubs c ON c.id = s.club_id
    JOIN stations st ON st.id = s.station_id
    LEFT JOIN devices d ON d.id = s.device_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN payments p ON p.session_id = s.id
    LEFT JOIN program_versions pv ON pv.id = s.program_version_id
    WHERE s.status IN ('active','paused','connecting','authorized')
      AND s.deleted_at IS NULL
      AND ${scope(user, 's.club_id')}
    ORDER BY s.started_at DESC NULLS LAST
  `);

  const now = Date.now();
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const startedAt = row.started_at ? new Date(row.started_at as string) : null;
    const scheduledMinutes = Number(row.scheduled_minutes ?? 60);
    const pausedMinutes = Number(row.paused_minutes ?? 0);
    const elapsed = startedAt
      ? Math.max(0, Math.floor((now - startedAt.getTime()) / 60000) - pausedMinutes)
      : 0;
    return {
      id: String(row.id),
      reference: String(row.reference),
      status: String(row.status),
      clubId: String(row.club_id),
      clubName: String(row.club_name),
      stationId: String(row.station_id),
      stationCode: String(row.station_code),
      deviceId: row.device_id ? String(row.device_id) : null,
      deviceLabel: row.device_label ? String(row.device_label) : null,
      playerName: row.is_guest
        ? (row.guest_name ? `${row.guest_name} (אורח)` : 'אורח')
        : String(row.player_name ?? '—'),
      isGuest: Boolean(row.is_guest),
      playerCount: Number(row.player_count ?? 1),
      startedAt,
      scheduledMinutes,
      elapsedMinutes: elapsed,
      remainingMinutes: Math.max(0, scheduledMinutes - elapsed),
      amountGross: Number(row.amount_gross ?? 0),
      paymentStatus: row.payment_status ? String(row.payment_status) : null,
      connectivity: row.connectivity ? String(row.connectivity) : null,
      batteryPct: row.battery_pct === null ? null : Number(row.battery_pct),
      estimatedBallsRemaining:
        row.estimated_balls_remaining === null ? null : Number(row.estimated_balls_remaining),
      programName: row.program_name ? String(row.program_name) : null,
      lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    };
  });
}

export interface LiveAlert {
  kind: 'paid_not_started' | 'device_offline' | 'station_suspended' | 'critical_ticket' | 'battery_low';
  id: string;
  title: string;
  detail: string;
  href: string;
  minutesAgo: number | null;
  severity: 'critical' | 'warning';
}

/** התראות תפעוליות פתוחות ברגע זה */
export async function getLiveAlerts(user: CurrentUser): Promise<LiveAlert[]> {
  const settings = await getSettings();
  const offlineMinutes = settings.num('ops.device_offline_alert_minutes', 10);
  const notStartedMinutes = settings.num('ops.paid_not_started_alert_minutes', 10);
  const batteryThreshold = settings.num('ops.battery_low_threshold_pct', 0.2) * 100;

  const alerts: LiveAlert[] = [];

  // סשנים ששולמו ולא התחילו
  const stuck = await db.execute(sql`
    SELECT s.id, s.reference, s.created_at, c.name AS club_name, st.code AS station_code
    FROM sessions s
    JOIN clubs c ON c.id = s.club_id
    JOIN stations st ON st.id = s.station_id
    WHERE s.status IN ('paid','authorized','connecting')
      AND s.created_at < now() - (${notStartedMinutes}::int * interval '1 minute')
      AND s.deleted_at IS NULL AND ${scope(user, 's.club_id')}
    ORDER BY s.created_at
  `);
  for (const r of stuck.rows as Record<string, unknown>[]) {
    const created = new Date(r.created_at as string);
    alerts.push({
      kind: 'paid_not_started',
      id: String(r.id),
      title: `סשן ${r.reference} שולם ולא התחיל`,
      detail: `${r.club_name} · ${r.station_code}`,
      href: `/sessions/${r.id}`,
      minutesAgo: Math.floor((Date.now() - created.getTime()) / 60000),
      severity: 'critical',
    });
  }

  // מכונות מנותקות
  const offline = await db.execute(sql`
    SELECT d.id, d.device_id, d.last_seen_at, d.battery_pct,
           c.name AS club_name, st.code AS station_code
    FROM devices d
    LEFT JOIN clubs c ON c.id = d.current_club_id
    LEFT JOIN stations st ON st.id = d.current_station_id
    WHERE d.status IN ('active','maintenance')
      AND d.deleted_at IS NULL
      AND (d.connectivity = 'offline'
           OR d.last_seen_at < now() - (${offlineMinutes}::int * interval '1 minute'))
      AND ${scope(user, 'd.current_club_id')}
    ORDER BY d.last_seen_at NULLS FIRST
  `);
  for (const r of offline.rows as Record<string, unknown>[]) {
    const lastSeen = r.last_seen_at ? new Date(r.last_seen_at as string) : null;
    alerts.push({
      kind: 'device_offline',
      id: String(r.id),
      title: `מכונה ${r.device_id} מנותקת`,
      detail: `${r.club_name ?? 'ללא מועדון'} · ${r.station_code ?? 'ללא עמדה'}`,
      href: `/stations/devices/${r.id}`,
      minutesAgo: lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : null,
      severity: 'critical',
    });
  }

  // סוללה נמוכה
  const battery = await db.execute(sql`
    SELECT d.id, d.device_id, d.battery_pct, c.name AS club_name, st.code AS station_code
    FROM devices d
    LEFT JOIN clubs c ON c.id = d.current_club_id
    LEFT JOIN stations st ON st.id = d.current_station_id
    WHERE d.status = 'active' AND d.deleted_at IS NULL
      AND d.battery_pct IS NOT NULL AND d.battery_pct < ${batteryThreshold}::int
      AND ${scope(user, 'd.current_club_id')}
    ORDER BY d.battery_pct
  `);
  for (const r of battery.rows as Record<string, unknown>[]) {
    alerts.push({
      kind: 'battery_low',
      id: String(r.id),
      title: `סוללה נמוכה — ${r.device_id} (${r.battery_pct}%)`,
      detail: `${r.club_name ?? ''} · ${r.station_code ?? ''}`,
      href: `/stations/devices/${r.id}`,
      minutesAgo: null,
      severity: 'warning',
    });
  }

  // עמדות מושבתות
  const suspended = await db.execute(sql`
    SELECT st.id, st.code, st.suspended_reason, st.suspended_at, c.name AS club_name
    FROM stations st JOIN clubs c ON c.id = st.club_id
    WHERE st.status = 'suspended' AND st.deleted_at IS NULL AND ${scope(user, 'st.club_id')}
  `);
  for (const r of suspended.rows as Record<string, unknown>[]) {
    const at = r.suspended_at ? new Date(r.suspended_at as string) : null;
    alerts.push({
      kind: 'station_suspended',
      id: String(r.id),
      title: `עמדה ${r.code} מושבתת`,
      detail: `${r.club_name} · ${r.suspended_reason ?? 'ללא סיבה מתועדת'}`,
      href: `/stations/${r.id}`,
      minutesAgo: at ? Math.floor((Date.now() - at.getTime()) / 60000) : null,
      severity: 'critical',
    });
  }

  // תקלות קריטיות פתוחות
  const tickets = await db.execute(sql`
    SELECT t.id, t.reference, t.title, t.created_at, t.resolution_due_at, c.name AS club_name
    FROM support_tickets t LEFT JOIN clubs c ON c.id = t.club_id
    WHERE t.severity = 'critical' AND t.status NOT IN ('resolved','closed')
      AND t.deleted_at IS NULL AND ${scope(user, 't.club_id')}
    ORDER BY t.created_at
  `);
  for (const r of tickets.rows as Record<string, unknown>[]) {
    const created = new Date(r.created_at as string);
    alerts.push({
      kind: 'critical_ticket',
      id: String(r.id),
      title: `תקלה קריטית ${r.reference}`,
      detail: `${r.title} · ${r.club_name ?? ''}`,
      href: `/tickets/${r.id}`,
      minutesAgo: Math.floor((Date.now() - created.getTime()) / 60000),
      severity: 'critical',
    });
  }

  return alerts;
}

export interface LiveStationState {
  id: string;
  code: string;
  clubName: string;
  status: string;
  deviceLabel: string | null;
  connectivity: string | null;
  batteryPct: number | null;
  activeSessionRef: string | null;
  todayHours: number;
  todaySessions: number;
}

/** מצב כל העמדות ברשת ברגע זה */
export async function getLiveStations(user: CurrentUser): Promise<LiveStationState[]> {
  const rows = await db.execute(sql`
    SELECT
      st.id, st.code, st.status, c.name AS club_name,
      d.device_id AS device_label, d.connectivity, d.battery_pct,
      (SELECT s.reference FROM sessions s
        WHERE s.station_id = st.id AND s.status IN ('active','paused') LIMIT 1) AS active_ref,
      COALESCE((SELECT SUM(COALESCE(s.actual_minutes, s.scheduled_minutes))
        FROM sessions s WHERE s.station_id = st.id
          AND s.started_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem')
          AND s.status IN ('completed','active','paused','partially_refunded')), 0)::numeric / 60 AS today_hours,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.station_id = st.id
        AND s.started_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem')
        AND s.status IN ('completed','active','paused','partially_refunded')) AS today_sessions
    FROM stations st
    JOIN clubs c ON c.id = st.club_id
    LEFT JOIN devices d ON d.current_station_id = st.id
    WHERE st.deleted_at IS NULL AND st.status <> 'decommissioned'
      AND ${scope(user, 'st.club_id')}
    ORDER BY c.name, st.code
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      code: String(row.code),
      clubName: String(row.club_name),
      status: String(row.status),
      deviceLabel: row.device_label ? String(row.device_label) : null,
      connectivity: row.connectivity ? String(row.connectivity) : null,
      batteryPct: row.battery_pct === null ? null : Number(row.battery_pct),
      activeSessionRef: row.active_ref ? String(row.active_ref) : null,
      todayHours: Number(row.today_hours ?? 0),
      todaySessions: Number(row.today_sessions ?? 0),
    };
  });
}
