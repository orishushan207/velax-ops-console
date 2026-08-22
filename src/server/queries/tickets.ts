import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from './sessions';

export interface TicketListRow {
  id: string;
  reference: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  source: string;
  clubId: string | null;
  clubName: string | null;
  stationId: string | null;
  stationCode: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
  downtimeMinutes: number;
  repairCost: number;
  refundIssuedAmount: number;
  /** דקות שנותרו עד הפרת SLA. שלילי = כבר הופר. null = נפתר. */
  slaMinutesRemaining: number | null;
}

export interface TicketFilters {
  status?: string;
  severity?: string;
  category?: string;
  club?: string;
  assignee?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listTickets(user: CurrentUser, filters: TicketFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? 30);
  const offset = (page - 1) * pageSize;

  const conditions = [sql`t.deleted_at IS NULL`, clubScopeSql(user, 't.club_id')];

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'open') {
      conditions.push(sql`t.status NOT IN ('resolved','closed')`);
    } else if (filters.status === 'breached') {
      conditions.push(sql`(t.response_breached OR t.resolution_breached)`);
    } else {
      conditions.push(sql`t.status = ${filters.status}`);
    }
  }
  if (filters.severity && filters.severity !== 'all') {
    conditions.push(sql`t.severity = ${filters.severity}`);
  }
  if (filters.category && filters.category !== 'all') {
    conditions.push(sql`t.category = ${filters.category}`);
  }
  if (filters.club && filters.club !== 'all') conditions.push(sql`t.club_id = ${filters.club}::uuid`);
  if (filters.assignee && filters.assignee !== 'all') {
    conditions.push(
      filters.assignee === 'unassigned'
        ? sql`t.assignee_id IS NULL`
        : sql`t.assignee_id = ${filters.assignee}::uuid`,
    );
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(sql`(t.reference ILIKE ${like} OR t.title ILIKE ${like})`);
  }

  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM support_tickets t WHERE ${where}
  `);
  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);

  const rows = await db.execute(sql`
    SELECT
      t.*, c.name AS club_name, st.code AS station_code, d.device_id AS device_label,
      u.full_name AS assignee_name,
      CASE WHEN t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (t.resolution_due_at - now())) / 60
        ELSE NULL END AS sla_minutes_remaining
    FROM support_tickets t
    LEFT JOIN clubs c ON c.id = t.club_id
    LEFT JOIN stations st ON st.id = t.station_id
    LEFT JOIN devices d ON d.id = t.device_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE ${where}
    ORDER BY
      CASE t.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items: TicketListRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      reference: String(row.reference),
      title: String(row.title),
      category: String(row.category),
      severity: String(row.severity),
      status: String(row.status),
      source: String(row.source),
      clubId: row.club_id ? String(row.club_id) : null,
      clubName: row.club_name ? String(row.club_name) : null,
      stationId: row.station_id ? String(row.station_id) : null,
      stationCode: row.station_code ? String(row.station_code) : null,
      deviceId: row.device_id ? String(row.device_id) : null,
      deviceLabel: row.device_label ? String(row.device_label) : null,
      assigneeId: row.assignee_id ? String(row.assignee_id) : null,
      assigneeName: row.assignee_name ? String(row.assignee_name) : null,
      createdAt: new Date(row.created_at as string),
      responseDueAt: row.response_due_at ? new Date(row.response_due_at as string) : null,
      resolutionDueAt: row.resolution_due_at ? new Date(row.resolution_due_at as string) : null,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
      responseBreached: Boolean(row.response_breached),
      resolutionBreached: Boolean(row.resolution_breached),
      downtimeMinutes: Number(row.downtime_minutes ?? 0),
      repairCost: round2(Number(row.repair_cost ?? 0)),
      refundIssuedAmount: round2(Number(row.refund_issued_amount ?? 0)),
      slaMinutesRemaining:
        row.sla_minutes_remaining === null ? null : Math.round(Number(row.sla_minutes_remaining)),
    };
  });

  return { items, total, page, pageSize };
}

export async function getTicketStats(user: CurrentUser) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE t.status NOT IN ('resolved','closed'))::int AS open_count,
      COUNT(*) FILTER (WHERE t.status NOT IN ('resolved','closed') AND t.severity = 'critical')::int AS critical_count,
      COUNT(*) FILTER (WHERE t.assignee_id IS NULL AND t.status NOT IN ('resolved','closed'))::int AS unassigned_count,
      COUNT(*) FILTER (WHERE (t.response_breached OR t.resolution_breached))::int AS breached_count,
      COUNT(*) FILTER (
        WHERE t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL
          AND t.resolution_due_at < now() + interval '4 hours'
          AND t.status NOT IN ('resolved','closed')
      )::int AS at_risk_count,
      COALESCE(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
        FILTER (WHERE t.resolved_at >= now() - interval '30 days'), NULL)::numeric AS mttr_hours,
      COALESCE(SUM(t.downtime_minutes) FILTER (WHERE t.created_at >= now() - interval '30 days'), 0)::int AS downtime_30d,
      COALESCE(SUM(t.repair_cost) FILTER (WHERE t.created_at >= now() - interval '30 days'), 0)::numeric AS repair_cost_30d
    FROM support_tickets t
    WHERE t.deleted_at IS NULL AND ${clubScopeSql(user, 't.club_id')}
  `);
  const r = (rows.rows[0] ?? {}) as Record<string, unknown>;
  return {
    openCount: Number(r.open_count ?? 0),
    criticalCount: Number(r.critical_count ?? 0),
    unassignedCount: Number(r.unassigned_count ?? 0),
    breachedCount: Number(r.breached_count ?? 0),
    atRiskCount: Number(r.at_risk_count ?? 0),
    mttrHours: r.mttr_hours === null ? null : round2(Number(r.mttr_hours)),
    downtime30d: Number(r.downtime_30d ?? 0),
    repairCost30d: round2(Number(r.repair_cost_30d ?? 0)),
  };
}

export async function getTicketDetail(ticketId: string, user: CurrentUser) {
  const rows = await db.execute(sql`
    SELECT t.*, c.name AS club_name, st.code AS station_code,
           d.device_id AS device_label, s.reference AS session_reference,
           u.full_name AS assignee_name, rep.full_name AS reporter_name,
           sp.name_he AS sla_policy_name,
           rd.device_id AS replacement_device_label
    FROM support_tickets t
    LEFT JOIN clubs c ON c.id = t.club_id
    LEFT JOIN stations st ON st.id = t.station_id
    LEFT JOIN devices d ON d.id = t.device_id
    LEFT JOIN devices rd ON rd.id = t.replacement_device_id
    LEFT JOIN sessions s ON s.id = t.session_id
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users rep ON rep.id = t.reported_by_user_id
    LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
    WHERE t.id = ${ticketId}::uuid AND t.deleted_at IS NULL
      AND ${clubScopeSql(user, 't.club_id')}
    LIMIT 1
  `);
  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const events = await db.execute(sql`
    SELECT e.*, u.full_name AS actor_name FROM ticket_events e
    LEFT JOIN users u ON u.id = e.actor_user_id
    WHERE e.ticket_id = ${ticketId}::uuid ORDER BY e.occurred_at ASC
  `);

  const parts = await db.execute(sql`
    SELECT m.*, i.name_he AS item_name, i.sku FROM inventory_movements m
    JOIN inventory_items i ON i.id = m.item_id
    WHERE m.ticket_id = ${ticketId}::uuid ORDER BY m.occurred_at DESC
  `);

  return {
    ticket: row,
    events: events.rows as Record<string, unknown>[],
    parts: parts.rows as Record<string, unknown>[],
  };
}

export async function listTechnicians() {
  const rows = await db.execute(sql`
    SELECT u.id, u.full_name, sp.is_field_technician
    FROM users u
    JOIN staff_profiles sp ON sp.user_id = u.id
    WHERE u.deleted_at IS NULL AND u.status = 'active' AND u.is_staff = true
    ORDER BY sp.is_field_technician DESC, u.full_name
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.full_name),
      isTechnician: Boolean(row.is_field_technician),
    };
  });
}
