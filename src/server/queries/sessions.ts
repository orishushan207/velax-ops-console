import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';

export function clubScopeSql(user: CurrentUser, column: string) {
  if (user.isGlobal) return sql`TRUE`;
  const ids = user.clubIds ?? [];
  if (ids.length === 0) return sql`FALSE`;
  return sql`${sql.raw(column)} IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

export interface SessionListFilters {
  status?: string;
  club?: string;
  station?: string;
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface SessionListRow {
  id: string;
  reference: string;
  status: string;
  clubId: string;
  clubName: string;
  stationId: string;
  stationCode: string;
  playerName: string;
  isGuest: boolean;
  playerCount: number;
  startedAt: Date | null;
  createdAt: Date;
  actualMinutes: number | null;
  scheduledMinutes: number;
  amountGross: number;
  refundedAmount: number;
  peakWindow: string | null;
  paymentStatus: string | null;
  hasTicket: boolean;
}

export async function listSessions(user: CurrentUser, filters: SessionListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? 30);
  const offset = (page - 1) * pageSize;

  const conditions = [
    sql`s.deleted_at IS NULL`,
    clubScopeSql(user, 's.club_id'),
  ];

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'open') {
      conditions.push(sql`s.status IN ('active','paused','connecting','authorized','paid')`);
    } else if (filters.status === 'paid') {
      conditions.push(
        sql`s.status IN ('active','paused','completed','partially_refunded') AND s.amount_gross > 0 AND s.refunded_amount < s.amount_gross`,
      );
    } else {
      conditions.push(sql`s.status = ${filters.status}`);
    }
  }
  if (filters.club && filters.club !== 'all') conditions.push(sql`s.club_id = ${filters.club}::uuid`);
  if (filters.station && filters.station !== 'all') {
    conditions.push(sql`s.station_id = ${filters.station}::uuid`);
  }
  if (filters.from) conditions.push(sql`s.created_at >= ${filters.from}`);
  if (filters.to) conditions.push(sql`s.created_at < ${filters.to}`);
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(
      sql`(s.reference ILIKE ${like} OR s.guest_phone ILIKE ${like} OR u.full_name ILIKE ${like})`,
    );
  }

  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE ${where}
  `);
  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);

  const rows = await db.execute(sql`
    SELECT
      s.id, s.reference, s.status, s.started_at, s.created_at, s.actual_minutes,
      s.scheduled_minutes, s.amount_gross, s.refunded_amount, s.peak_window,
      s.player_count, s.is_guest, s.guest_name,
      c.id AS club_id, c.name AS club_name,
      st.id AS station_id, st.code AS station_code,
      u.full_name AS player_name,
      p.status AS payment_status,
      EXISTS (SELECT 1 FROM support_tickets t WHERE t.session_id = s.id) AS has_ticket
    FROM sessions s
    JOIN clubs c ON c.id = s.club_id
    JOIN stations st ON st.id = s.station_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN payments p ON p.session_id = s.id
    WHERE ${where}
    ORDER BY s.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items: SessionListRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      reference: String(row.reference),
      status: String(row.status),
      clubId: String(row.club_id),
      clubName: String(row.club_name),
      stationId: String(row.station_id),
      stationCode: String(row.station_code),
      playerName: row.is_guest
        ? `${row.guest_name ?? 'אורח'} (אורח)`
        : String(row.player_name ?? '—'),
      isGuest: Boolean(row.is_guest),
      playerCount: Number(row.player_count ?? 1),
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      createdAt: new Date(row.created_at as string),
      actualMinutes: row.actual_minutes === null ? null : Number(row.actual_minutes),
      scheduledMinutes: Number(row.scheduled_minutes ?? 60),
      amountGross: Number(row.amount_gross ?? 0),
      refundedAmount: Number(row.refunded_amount ?? 0),
      peakWindow: row.peak_window ? String(row.peak_window) : null,
      paymentStatus: row.payment_status ? String(row.payment_status) : null,
      hasTicket: Boolean(row.has_ticket),
    };
  });

  return { items, total, page, pageSize };
}

export interface SessionDetail {
  id: string;
  reference: string;
  status: string;
  clubId: string;
  clubName: string;
  stationId: string;
  stationCode: string;
  deviceId: string | null;
  deviceLabel: string | null;
  deviceSerial: string | null;
  userId: string | null;
  playerName: string;
  playerPhone: string | null;
  isGuest: boolean;
  playerCount: number;
  level: string | null;
  programName: string | null;
  scheduledStartAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  actualMinutes: number | null;
  scheduledMinutes: number;
  pausedMinutes: number;
  peakWindow: string | null;
  listPriceGross: number;
  discountAmount: number;
  amountGross: number;
  vatAmount: number;
  /** השיעור שהוחל בפועל על הסשן, לא ההגדרה הנוכחית */
  vatRateApplied: number;
  amountNet: number;
  refundedAmount: number;
  estimatedBalls: number | null;
  startedWithoutStaffHelp: boolean | null;
  failureReason: string | null;
  endReason: string | null;
  purchaseChannel: string;
  coachId: string | null;
  coachName: string | null;
  referralCode: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  xpAwarded: number;
  rewardsPointsAwarded: number;
  createdAt: Date;
  isDemo: boolean;
}

export async function getSessionDetail(
  sessionId: string,
  user: CurrentUser,
): Promise<SessionDetail | null> {
  const rows = await db.execute(sql`
    SELECT
      s.*, c.name AS club_name, st.code AS station_code,
      d.device_id AS device_label, d.serial_number AS device_serial,
      u.full_name AS player_name, u.phone AS player_phone,
      pv.description AS program_name,
      co.display_name AS coach_name
    FROM sessions s
    JOIN clubs c ON c.id = s.club_id
    JOIN stations st ON st.id = s.station_id
    LEFT JOIN devices d ON d.id = s.device_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN program_versions pv ON pv.id = s.program_version_id
    LEFT JOIN coaches co ON co.id = s.coach_id
    WHERE s.id = ${sessionId}::uuid AND s.deleted_at IS NULL
      AND ${clubScopeSql(user, 's.club_id')}
    LIMIT 1
  `);

  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

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
    deviceSerial: row.device_serial ? String(row.device_serial) : null,
    userId: row.user_id ? String(row.user_id) : null,
    playerName: row.is_guest
      ? `${row.guest_name ?? 'אורח'} (אורח)`
      : String(row.player_name ?? '—'),
    playerPhone: row.is_guest
      ? (row.guest_phone ? String(row.guest_phone) : null)
      : (row.player_phone ? String(row.player_phone) : null),
    isGuest: Boolean(row.is_guest),
    playerCount: Number(row.player_count ?? 1),
    level: row.level ? String(row.level) : null,
    programName: row.program_name ? String(row.program_name) : null,
    scheduledStartAt: row.scheduled_start_at ? new Date(row.scheduled_start_at as string) : null,
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    endedAt: row.ended_at ? new Date(row.ended_at as string) : null,
    actualMinutes: row.actual_minutes === null ? null : Number(row.actual_minutes),
    scheduledMinutes: Number(row.scheduled_minutes ?? 60),
    pausedMinutes: Number(row.paused_minutes ?? 0),
    peakWindow: row.peak_window ? String(row.peak_window) : null,
    listPriceGross: Number(row.list_price_gross ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    amountGross: Number(row.amount_gross ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    vatRateApplied: Number(row.vat_rate_applied ?? 0.18),
    amountNet: Number(row.amount_net ?? 0),
    refundedAmount: Number(row.refunded_amount ?? 0),
    estimatedBalls: row.estimated_balls === null ? null : Number(row.estimated_balls),
    startedWithoutStaffHelp:
      row.started_without_staff_help === null ? null : Boolean(row.started_without_staff_help),
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    endReason: row.end_reason ? String(row.end_reason) : null,
    purchaseChannel: String(row.purchase_channel ?? 'station_qr'),
    coachId: row.coach_id ? String(row.coach_id) : null,
    coachName: row.coach_name ? String(row.coach_name) : null,
    referralCode: row.referral_code ? String(row.referral_code) : null,
    utmSource: row.utm_source ? String(row.utm_source) : null,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : null,
    xpAwarded: Number(row.xp_awarded ?? 0),
    rewardsPointsAwarded: Number(row.rewards_points_awarded ?? 0),
    createdAt: new Date(row.created_at as string),
    isDemo: Boolean(row.is_demo),
  };
}

export interface SessionTimelineEvent {
  id: string;
  eventType: string;
  occurredAt: Date;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  source: string;
  message: string | null;
}

export async function getSessionTimeline(sessionId: string): Promise<SessionTimelineEvent[]> {
  const rows = await db.execute(sql`
    SELECT e.id, e.event_type, e.occurred_at, e.from_status, e.to_status,
           e.source, e.message, u.full_name AS actor_name
    FROM session_events e
    LEFT JOIN users u ON u.id = e.actor_user_id
    WHERE e.session_id = ${sessionId}::uuid
    ORDER BY e.occurred_at ASC
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      eventType: String(row.event_type),
      occurredAt: new Date(row.occurred_at as string),
      fromStatus: row.from_status ? String(row.from_status) : null,
      toStatus: row.to_status ? String(row.to_status) : null,
      actorName: row.actor_name ? String(row.actor_name) : null,
      source: String(row.source ?? 'system'),
      message: row.message ? String(row.message) : null,
    };
  });
}

export interface SessionFinancials {
  payment: {
    id: string;
    reference: string;
    status: string;
    method: string;
    amountGross: number;
    amountNet: number;
    vatAmount: number;
    processingFee: number;
    provider: string;
    providerTransactionId: string | null;
    cardLast4: string | null;
    cardBrand: string | null;
    capturedAt: Date | null;
  } | null;
  refunds: {
    id: string;
    reference: string;
    amountGross: number;
    refundType: string;
    destination: string;
    status: string;
    reason: string;
    reasonNote: string;
    requestedByName: string | null;
    approvedByName: string | null;
    isAutomatic: boolean;
    processedAt: Date | null;
  }[];
  linkedBookings: {
    id: string;
    courtName: string | null;
    linkType: string;
    revenueNet: number;
    durationMinutes: number;
    startsAt: Date;
  }[];
  tickets: { id: string; reference: string; title: string; status: string; severity: string }[];
}

export async function getSessionFinancials(sessionId: string): Promise<SessionFinancials> {
  const paymentRows = await db.execute(sql`
    SELECT * FROM payments WHERE session_id = ${sessionId}::uuid AND deleted_at IS NULL LIMIT 1
  `);
  const p = paymentRows.rows[0] as Record<string, unknown> | undefined;

  const refundRows = await db.execute(sql`
    SELECT r.*, req.full_name AS requested_by_name, app.full_name AS approved_by_name
    FROM refunds r
    LEFT JOIN users req ON req.id = r.requested_by
    LEFT JOIN users app ON app.id = r.approved_by
    WHERE r.session_id = ${sessionId}::uuid AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `);

  const bookingRows = await db.execute(sql`
    SELECT b.id, b.link_type, b.revenue_net, b.duration_minutes, b.starts_at, ct.name AS court_name
    FROM court_bookings b LEFT JOIN courts ct ON ct.id = b.court_id
    WHERE b.session_id = ${sessionId}::uuid AND b.deleted_at IS NULL
  `);

  const ticketRows = await db.execute(sql`
    SELECT id, reference, title, status, severity FROM support_tickets
    WHERE session_id = ${sessionId}::uuid AND deleted_at IS NULL
  `);

  return {
    payment: p
      ? {
          id: String(p.id),
          reference: String(p.reference),
          status: String(p.status),
          method: String(p.method),
          amountGross: Number(p.amount_gross ?? 0),
          amountNet: Number(p.amount_net ?? 0),
          vatAmount: Number(p.vat_amount ?? 0),
          processingFee: Number(p.processing_fee ?? 0),
          provider: String(p.provider),
          providerTransactionId: p.provider_transaction_id
            ? String(p.provider_transaction_id)
            : null,
          cardLast4: p.card_last4 ? String(p.card_last4) : null,
          cardBrand: p.card_brand ? String(p.card_brand) : null,
          capturedAt: p.captured_at ? new Date(p.captured_at as string) : null,
        }
      : null,
    refunds: refundRows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        reference: String(row.reference),
        amountGross: Number(row.amount_gross ?? 0),
        refundType: String(row.refund_type),
        destination: String(row.destination),
        status: String(row.status),
        reason: String(row.reason),
        reasonNote: String(row.reason_note ?? ''),
        requestedByName: row.requested_by_name ? String(row.requested_by_name) : null,
        approvedByName: row.approved_by_name ? String(row.approved_by_name) : null,
        isAutomatic: Boolean(row.is_automatic),
        processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      };
    }),
    linkedBookings: bookingRows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        courtName: row.court_name ? String(row.court_name) : null,
        linkType: String(row.link_type),
        revenueNet: round2(Number(row.revenue_net ?? 0)),
        durationMinutes: Number(row.duration_minutes ?? 0),
        startsAt: new Date(row.starts_at as string),
      };
    }),
    tickets: ticketRows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        reference: String(row.reference),
        title: String(row.title),
        status: String(row.status),
        severity: String(row.severity),
      };
    }),
  };
}
