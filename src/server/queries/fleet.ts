import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from './sessions';

export interface StationListRow {
  id: string;
  code: string;
  name: string;
  clubId: string;
  clubName: string;
  region: string;
  stationType: string;
  status: string;
  deviceUuid: string | null;
  deviceLabel: string | null;
  connectivity: string | null;
  batteryPct: number | null;
  installedAt: Date | null;
  installedCost: number;
  hours30d: number;
  sessions30d: number;
  hoursPerDay: number | null;
  openTickets: number;
  downtimeMinutes30d: number;
  uptimePct: number | null;
}

export async function listStations(user: CurrentUser): Promise<StationListRow[]> {
  const rows = await db.execute(sql`
    SELECT
      st.id, st.code, st.name, st.station_type, st.status, st.installed_at, st.installed_cost,
      c.id AS club_id, c.name AS club_name, c.region,
      d.id AS device_uuid, d.device_id AS device_label, d.connectivity, d.battery_pct,
      COALESCE((SELECT SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)) FROM sessions s
        WHERE s.station_id = st.id AND s.started_at >= now() - interval '30 days'
          AND s.status IN ('completed','active','paused','partially_refunded')
          AND s.refunded_amount < s.amount_gross), 0)::numeric / 60 AS hours_30d,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.station_id = st.id
        AND s.started_at >= now() - interval '30 days'
        AND s.status IN ('completed','active','paused','partially_refunded')) AS sessions_30d,
      (SELECT COUNT(*)::int FROM support_tickets t WHERE t.station_id = st.id
        AND t.status NOT IN ('resolved','closed') AND t.deleted_at IS NULL) AS open_tickets,
      COALESCE((SELECT SUM(t.downtime_minutes) FROM support_tickets t
        WHERE t.station_id = st.id AND t.created_at >= now() - interval '30 days'), 0)::int AS downtime_30d
    FROM stations st
    JOIN clubs c ON c.id = st.club_id
    LEFT JOIN devices d ON d.current_station_id = st.id AND d.deleted_at IS NULL
    WHERE st.deleted_at IS NULL AND ${clubScopeSql(user, 'st.club_id')}
    ORDER BY c.name, st.code
  `);

  const plannedMinutes = 30 * 12 * 60;
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const hours = round2(Number(row.hours_30d ?? 0));
    const downtime = Number(row.downtime_30d ?? 0);
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      clubId: String(row.club_id),
      clubName: String(row.club_name),
      region: String(row.region),
      stationType: String(row.station_type),
      status: String(row.status),
      deviceUuid: row.device_uuid ? String(row.device_uuid) : null,
      deviceLabel: row.device_label ? String(row.device_label) : null,
      connectivity: row.connectivity ? String(row.connectivity) : null,
      batteryPct: row.battery_pct === null ? null : Number(row.battery_pct),
      installedAt: row.installed_at ? new Date(row.installed_at as string) : null,
      installedCost: Number(row.installed_cost ?? 0),
      hours30d: hours,
      sessions30d: Number(row.sessions_30d ?? 0),
      hoursPerDay: round2(hours / 30),
      openTickets: Number(row.open_tickets ?? 0),
      downtimeMinutes30d: downtime,
      uptimePct: Math.max(0, 1 - downtime / plannedMinutes),
    };
  });
}

export interface DeviceListRow {
  id: string;
  deviceId: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string | null;
  isBelowMinimumFirmware: boolean;
  status: string;
  connectivity: string;
  isSpare: boolean;
  batteryPct: number | null;
  operatingHours: number;
  ballCount: number;
  clubId: string | null;
  clubName: string | null;
  stationId: string | null;
  stationCode: string | null;
  lastSeenAt: Date | null;
  nextServiceDue: string | null;
  warrantyUntil: string | null;
  openTickets: number;
}

export async function listDevices(user: CurrentUser): Promise<DeviceListRow[]> {
  const rows = await db.execute(sql`
    WITH min_fw AS (
      SELECT version FROM firmware_versions WHERE is_minimum_required = true
      ORDER BY released_at DESC LIMIT 1
    )
    SELECT
      d.*, fv.version AS firmware_version,
      c.id AS club_uuid, c.name AS club_name,
      st.id AS station_uuid, st.code AS station_code,
      (SELECT version FROM min_fw) AS min_firmware,
      (SELECT COUNT(*)::int FROM support_tickets t WHERE t.device_id = d.id
        AND t.status NOT IN ('resolved','closed') AND t.deleted_at IS NULL) AS open_tickets
    FROM devices d
    LEFT JOIN firmware_versions fv ON fv.id = d.firmware_version_id
    LEFT JOIN clubs c ON c.id = d.current_club_id
    LEFT JOIN stations st ON st.id = d.current_station_id
    WHERE d.deleted_at IS NULL
      AND (d.current_club_id IS NULL OR ${clubScopeSql(user, 'd.current_club_id')})
    ORDER BY d.device_id
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const fw = row.firmware_version ? String(row.firmware_version) : null;
    const minFw = row.min_firmware ? String(row.min_firmware) : null;
    return {
      id: String(row.id),
      deviceId: String(row.device_id),
      serialNumber: String(row.serial_number),
      model: String(row.model),
      firmwareVersion: fw,
      isBelowMinimumFirmware: Boolean(fw && minFw && fw < minFw),
      status: String(row.status),
      connectivity: String(row.connectivity ?? 'unknown'),
      isSpare: Boolean(row.is_spare),
      batteryPct: row.battery_pct === null ? null : Number(row.battery_pct),
      operatingHours: round2(Number(row.operating_hours ?? 0)),
      ballCount: Number(row.ball_count ?? 0),
      clubId: row.club_uuid ? String(row.club_uuid) : null,
      clubName: row.club_name ? String(row.club_name) : null,
      stationId: row.station_uuid ? String(row.station_uuid) : null,
      stationCode: row.station_code ? String(row.station_code) : null,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string) : null,
      nextServiceDue: row.next_service_due ? String(row.next_service_due) : null,
      warrantyUntil: row.warranty_until ? String(row.warranty_until) : null,
      openTickets: Number(row.open_tickets ?? 0),
    };
  });
}

export async function getStationDetail(stationId: string, user: CurrentUser) {
  const rows = await db.execute(sql`
    SELECT st.*, c.name AS club_name, c.id AS club_uuid, c.region,
           d.id AS device_uuid, d.device_id AS device_label, d.serial_number,
           d.connectivity, d.battery_pct, d.status AS device_status,
           u.full_name AS suspended_by_name
    FROM stations st
    JOIN clubs c ON c.id = st.club_id
    LEFT JOIN devices d ON d.current_station_id = st.id AND d.deleted_at IS NULL
    LEFT JOIN users u ON u.id = st.suspended_by
    WHERE st.id = ${stationId}::uuid AND st.deleted_at IS NULL
      AND ${clubScopeSql(user, 'st.club_id')}
    LIMIT 1
  `);
  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const [assignments, tickets, maintenance, usage, recentSessions] = await Promise.all([
    db.execute(sql`
      SELECT da.*, d.device_id AS device_label, u.full_name AS assigned_by_name
      FROM device_assignments da
      JOIN devices d ON d.id = da.device_id
      LEFT JOIN users u ON u.id = da.assigned_by
      WHERE da.station_id = ${stationId}::uuid ORDER BY da.assigned_at DESC
    `),
    db.execute(sql`
      SELECT * FROM support_tickets WHERE station_id = ${stationId}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT mt.*, mp.name_he AS plan_name FROM maintenance_tasks mt
      LEFT JOIN maintenance_plans mp ON mp.id = mt.plan_id
      WHERE mt.station_id = ${stationId}::uuid AND mt.deleted_at IS NULL
      ORDER BY mt.due_on DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT date_trunc('day', s.started_at AT TIME ZONE 'Asia/Jerusalem') AS bucket,
             COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric / 60 AS hours,
             COUNT(*)::int AS sessions
      FROM sessions s
      WHERE s.station_id = ${stationId}::uuid AND s.started_at >= now() - interval '60 days'
        AND s.status IN ('completed','active','paused','partially_refunded')
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT s.id, s.reference, s.status, s.started_at, s.amount_gross,
             COALESCE(u.full_name, s.guest_name, 'אורח') AS player_name
      FROM sessions s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.station_id = ${stationId}::uuid AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC LIMIT 15
    `),
  ]);

  return {
    station: row,
    assignments: assignments.rows as Record<string, unknown>[],
    tickets: tickets.rows as Record<string, unknown>[],
    maintenance: maintenance.rows as Record<string, unknown>[],
    usage: usage.rows.map((r) => {
      const u = r as Record<string, string>;
      const d = new Date(u.bucket as string);
      return {
        label: new Intl.DateTimeFormat('he-IL', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Asia/Jerusalem',
        }).format(d),
        hours: round2(Number(u.hours ?? 0)),
        sessions: Number(u.sessions ?? 0),
      };
    }),
    recentSessions: recentSessions.rows as Record<string, unknown>[],
  };
}

export async function getDeviceDetail(deviceId: string, user: CurrentUser) {
  const rows = await db.execute(sql`
    SELECT d.*, fv.version AS firmware_version, fv.channel AS firmware_channel,
           c.id AS club_uuid, c.name AS club_name,
           st.id AS station_uuid, st.code AS station_code,
           sup.name AS supplier_name,
           qu.full_name AS quarantined_by_name
    FROM devices d
    LEFT JOIN firmware_versions fv ON fv.id = d.firmware_version_id
    LEFT JOIN clubs c ON c.id = d.current_club_id
    LEFT JOIN stations st ON st.id = d.current_station_id
    LEFT JOIN suppliers sup ON sup.id = d.supplier_id
    LEFT JOIN users qu ON qu.id = d.quarantined_by
    WHERE d.id = ${deviceId}::uuid AND d.deleted_at IS NULL
      AND (d.current_club_id IS NULL OR ${clubScopeSql(user, 'd.current_club_id')})
    LIMIT 1
  `);
  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const [assignments, firmwareHistory, tickets, telemetry, maintenance] = await Promise.all([
    db.execute(sql`
      SELECT da.*, st.code AS station_code, c.name AS club_name, u.full_name AS assigned_by_name
      FROM device_assignments da
      LEFT JOIN stations st ON st.id = da.station_id
      LEFT JOIN clubs c ON c.id = da.club_id
      LEFT JOIN users u ON u.id = da.assigned_by
      WHERE da.device_id = ${deviceId}::uuid ORDER BY da.assigned_at DESC
    `),
    db.execute(sql`
      SELECT h.*, ffrom.version AS from_version, fto.version AS to_version, u.full_name AS performed_by_name
      FROM device_firmware_history h
      LEFT JOIN firmware_versions ffrom ON ffrom.id = h.from_version_id
      LEFT JOIN firmware_versions fto ON fto.id = h.to_version_id
      LEFT JOIN users u ON u.id = h.performed_by
      WHERE h.device_id = ${deviceId}::uuid ORDER BY h.performed_at DESC
    `),
    db.execute(sql`
      SELECT * FROM support_tickets WHERE device_id = ${deviceId}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT * FROM device_telemetry WHERE device_id = ${deviceId}::uuid
      ORDER BY recorded_at DESC LIMIT 50
    `),
    db.execute(sql`
      SELECT mt.*, mp.name_he AS plan_name FROM maintenance_tasks mt
      LEFT JOIN maintenance_plans mp ON mp.id = mt.plan_id
      WHERE mt.device_id = ${deviceId}::uuid AND mt.deleted_at IS NULL
      ORDER BY mt.due_on DESC LIMIT 20
    `),
  ]);

  return {
    device: row,
    assignments: assignments.rows as Record<string, unknown>[],
    firmwareHistory: firmwareHistory.rows as Record<string, unknown>[],
    tickets: tickets.rows as Record<string, unknown>[],
    telemetry: telemetry.rows as Record<string, unknown>[],
    maintenance: maintenance.rows as Record<string, unknown>[],
  };
}

export async function listFirmwareVersions() {
  const rows = await db.execute(sql`
    SELECT * FROM firmware_versions ORDER BY released_at DESC NULLS LAST
  `);
  return rows.rows as Record<string, unknown>[];
}
