import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from './sessions';

export interface ClubListRow {
  id: string;
  code: string;
  name: string;
  region: string;
  city: string;
  status: string;
  primaryContact: string | null;
  courtCount: number;
  stationCount: number;
  joinedAt: string | null;
  pricingModel: string | null;
  setupFee: number;
  monthlyRetainer: number;
  linkedCourtRevenue: number;
  paidHours: number;
  uptimePct: number | null;
  openTickets: number;
  earnBackProgressPct: number | null;
  earnBackStatus: string | null;
  healthScore: number | null;
  renewalDate: string | null;
}

export async function listClubs(user: CurrentUser, days = 30): Promise<ClubListRow[]> {
  const rows = await db.execute(sql`
    WITH since AS (SELECT now() - (${days}::int * interval '1 day') AS d)
    SELECT
      c.id, c.code, c.name, c.region, c.city, c.status, c.court_count,
      c.joined_at, c.health_score,
      (SELECT cc.full_name FROM club_contacts cc
        WHERE cc.club_id = c.id AND cc.is_primary AND cc.deleted_at IS NULL LIMIT 1) AS primary_contact,
      (SELECT COUNT(*)::int FROM stations st
        WHERE st.club_id = c.id AND st.deleted_at IS NULL AND st.status <> 'decommissioned') AS station_count,
      ct.pricing_model, ct.setup_fee, ct.monthly_retainer, ct.renewal_date,
      COALESCE((SELECT SUM(b.revenue_net) FROM court_bookings b
        WHERE b.club_id = c.id AND b.session_id IS NOT NULL
          AND b.starts_at >= (SELECT d FROM since) AND b.is_cancelled = false), 0)::numeric AS linked_revenue,
      COALESCE((SELECT SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)) FROM sessions s
        WHERE s.club_id = c.id AND s.started_at >= (SELECT d FROM since)
          AND s.status IN ('completed','active','paused','partially_refunded')
          AND s.refunded_amount < s.amount_gross), 0)::numeric / 60 AS paid_hours,
      (SELECT COUNT(*)::int FROM support_tickets t
        WHERE t.club_id = c.id AND t.status NOT IN ('resolved','closed') AND t.deleted_at IS NULL) AS open_tickets,
      COALESCE((SELECT SUM(t.downtime_minutes) FROM support_tickets t
        WHERE t.club_id = c.id AND t.created_at >= (SELECT d FROM since)), 0)::int AS downtime_minutes,
      a.status AS earn_back_status,
      a.entry_price AS eb_entry_price,
      a.verified_revenue AS eb_verified_revenue
    FROM clubs c
    LEFT JOIN LATERAL (
      SELECT * FROM club_contracts cc2
      WHERE cc2.club_id = c.id AND cc2.deleted_at IS NULL
      ORDER BY cc2.starts_on DESC LIMIT 1
    ) ct ON TRUE
    LEFT JOIN LATERAL (
      SELECT * FROM earn_back_agreements a2
      WHERE a2.club_id = c.id AND a2.deleted_at IS NULL
      ORDER BY a2.starts_on DESC LIMIT 1
    ) a ON TRUE
    WHERE c.deleted_at IS NULL AND ${clubScopeSql(user, 'c.id')}
    ORDER BY c.name
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const stationCount = Number(row.station_count ?? 0);
    const downtimeMinutes = Number(row.downtime_minutes ?? 0);
    const plannedMinutes = stationCount * days * 12 * 60;
    const entryPrice = Number(row.eb_entry_price ?? 0);
    const verified = Number(row.eb_verified_revenue ?? 0);
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      region: String(row.region),
      city: String(row.city),
      status: String(row.status),
      primaryContact: row.primary_contact ? String(row.primary_contact) : null,
      courtCount: Number(row.court_count ?? 0),
      stationCount,
      joinedAt: row.joined_at ? String(row.joined_at) : null,
      pricingModel: row.pricing_model ? String(row.pricing_model) : null,
      setupFee: Number(row.setup_fee ?? 0),
      monthlyRetainer: Number(row.monthly_retainer ?? 0),
      linkedCourtRevenue: round2(Number(row.linked_revenue ?? 0)),
      paidHours: round2(Number(row.paid_hours ?? 0)),
      uptimePct: plannedMinutes > 0 ? Math.max(0, 1 - downtimeMinutes / plannedMinutes) : null,
      openTickets: Number(row.open_tickets ?? 0),
      earnBackProgressPct: entryPrice > 0 ? Math.min(1, verified / entryPrice) : null,
      earnBackStatus: row.earn_back_status ? String(row.earn_back_status) : null,
      healthScore: row.health_score === null ? null : Number(row.health_score),
      renewalDate: row.renewal_date ? String(row.renewal_date) : null,
    };
  });
}

export interface ClubDetail {
  id: string;
  code: string;
  name: string;
  region: string;
  city: string;
  address: string | null;
  status: string;
  courtCount: number;
  joinedAt: string | null;
  offPeakStart: string;
  offPeakEnd: string;
  offPeakDays: number[];
  healthScore: number | null;
  healthScoreAt: Date | null;
  healthScoreBreakdown: Record<string, number> | null;
  accountManagerName: string | null;
  notes: string | null;
  isDemo: boolean;
}

export async function getClubDetail(clubId: string, user: CurrentUser): Promise<ClubDetail | null> {
  const rows = await db.execute(sql`
    SELECT c.*, u.full_name AS account_manager_name
    FROM clubs c LEFT JOIN users u ON u.id = c.account_manager_id
    WHERE c.id = ${clubId}::uuid AND c.deleted_at IS NULL AND ${clubScopeSql(user, 'c.id')}
    LIMIT 1
  `);
  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    region: String(row.region),
    city: String(row.city),
    address: row.address ? String(row.address) : null,
    status: String(row.status),
    courtCount: Number(row.court_count ?? 0),
    joinedAt: row.joined_at ? String(row.joined_at) : null,
    offPeakStart: String(row.off_peak_start ?? '08:00'),
    offPeakEnd: String(row.off_peak_end ?? '16:00'),
    offPeakDays: (row.off_peak_days as number[]) ?? [],
    healthScore: row.health_score === null ? null : Number(row.health_score),
    healthScoreAt: row.health_score_at ? new Date(row.health_score_at as string) : null,
    healthScoreBreakdown: (row.health_score_breakdown as Record<string, number>) ?? null,
    accountManagerName: row.account_manager_name ? String(row.account_manager_name) : null,
    notes: row.notes ? String(row.notes) : null,
    isDemo: Boolean(row.is_demo),
  };
}

/** כל הנתונים הנלווים לעמוד המועדון, בשאילתה אחת לכל טאב */
export async function getClubRelated(clubId: string) {
  const [
    contacts,
    contracts,
    stations,
    devices,
    hours,
    courts,
    tickets,
    maintenance,
    earnBack,
    checklists,
    tasks,
    audit,
  ] = await Promise.all([
    db.execute(sql`
      SELECT * FROM club_contacts WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
      ORDER BY is_primary DESC, full_name
    `),
    db.execute(sql`
      SELECT * FROM club_contracts WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
      ORDER BY starts_on DESC
    `),
    db.execute(sql`
      SELECT st.*, d.device_id AS device_label, d.id AS device_uuid, d.connectivity, d.battery_pct,
        COALESCE((SELECT SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)) FROM sessions s
          WHERE s.station_id = st.id AND s.started_at >= now() - interval '30 days'
            AND s.status IN ('completed','active','paused','partially_refunded')), 0)::numeric / 60 AS hours_30d
      FROM stations st
      LEFT JOIN devices d ON d.current_station_id = st.id
      WHERE st.club_id = ${clubId}::uuid AND st.deleted_at IS NULL
      ORDER BY st.code
    `),
    db.execute(sql`
      SELECT d.*, fv.version AS firmware_version FROM devices d
      LEFT JOIN firmware_versions fv ON fv.id = d.firmware_version_id
      WHERE d.current_club_id = ${clubId}::uuid AND d.deleted_at IS NULL ORDER BY d.device_id
    `),
    db.execute(sql`
      SELECT * FROM club_operating_hours WHERE club_id = ${clubId}::uuid ORDER BY day_of_week
    `),
    db.execute(sql`
      SELECT * FROM courts WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL ORDER BY name
    `),
    db.execute(sql`
      SELECT t.*, u.full_name AS assignee_name FROM support_tickets t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.club_id = ${clubId}::uuid AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC LIMIT 40
    `),
    db.execute(sql`
      SELECT mt.*, mp.name_he AS plan_name FROM maintenance_tasks mt
      LEFT JOIN maintenance_plans mp ON mp.id = mt.plan_id
      WHERE mt.club_id = ${clubId}::uuid AND mt.deleted_at IS NULL
      ORDER BY mt.due_on DESC LIMIT 30
    `),
    db.execute(sql`
      SELECT * FROM earn_back_agreements WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
      ORDER BY starts_on DESC
    `),
    db.execute(sql`
      SELECT cs.*, ch.name_he AS checklist_name FROM checklist_submissions cs
      JOIN checklists ch ON ch.id = cs.checklist_id
      WHERE cs.club_id = ${clubId}::uuid ORDER BY cs.for_date DESC LIMIT 30
    `),
    db.execute(sql`
      SELECT t.*, u.full_name AS assignee_name FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.club_id = ${clubId}::uuid AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT a.*, u.full_name AS actor FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.club_id = ${clubId}::uuid ORDER BY a.occurred_at DESC LIMIT 40
    `),
  ]);

  return {
    contacts: contacts.rows as Record<string, unknown>[],
    contracts: contracts.rows as Record<string, unknown>[],
    stations: stations.rows as Record<string, unknown>[],
    devices: devices.rows as Record<string, unknown>[],
    hours: hours.rows as Record<string, unknown>[],
    courts: courts.rows as Record<string, unknown>[],
    tickets: tickets.rows as Record<string, unknown>[],
    maintenance: maintenance.rows as Record<string, unknown>[],
    earnBack: earnBack.rows as Record<string, unknown>[],
    checklists: checklists.rows as Record<string, unknown>[],
    tasks: tasks.rows as Record<string, unknown>[],
    audit: audit.rows as Record<string, unknown>[],
  };
}

/** מגמת שימוש והכנסה למועדון */
export async function getClubUsageSeries(clubId: string, days = 60) {
  const rows = await db.execute(sql`
    SELECT
      date_trunc('day', s.started_at AT TIME ZONE 'Asia/Jerusalem') AS bucket,
      COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric / 60 AS hours,
      COALESCE(SUM(s.amount_net - (s.refunded_amount / (1 + s.vat_rate_applied))), 0)::numeric AS revenue,
      COUNT(*)::int AS sessions
    FROM sessions s
    WHERE s.club_id = ${clubId}::uuid
      AND s.started_at >= now() - (${days}::int * interval '1 day')
      AND s.status IN ('completed','active','paused','partially_refunded')
      AND s.refunded_amount < s.amount_gross
    GROUP BY 1 ORDER BY 1
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, string>;
    const d = new Date(row.bucket as string);
    return {
      label: new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Jerusalem',
      }).format(d),
      hours: round2(Number(row.hours ?? 0)),
      revenue: round2(Number(row.revenue ?? 0)),
      sessions: Number(row.sessions ?? 0),
    };
  });
}

/**
 * רשימת מועדונים לבחירה בטפסים.
 * מוגבלת להיקף הגישה של המשתמש — משתמש שמשויך למועדונים ספציפיים
 * לא יוכל לשייך עמדה או שחקן למועדון שאינו שלו.
 */
export async function listClubOptions(
  user: CurrentUser,
): Promise<{ value: string; label: string }[]> {
  const rows = await db.execute(sql`
    SELECT c.id, c.code, c.name
    FROM clubs c
    WHERE c.deleted_at IS NULL AND ${clubScopeSql(user, 'c.id')}
    ORDER BY c.name
  `);
  return (rows.rows as { id: string; code: string; name: string }[]).map((r) => ({
    value: r.id,
    label: `${r.name} · ${r.code}`,
  }));
}
