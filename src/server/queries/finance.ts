import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from './sessions';

export interface PaymentListRow {
  id: string;
  reference: string;
  sessionId: string | null;
  sessionReference: string | null;
  status: string;
  method: string;
  amountGross: number;
  amountNet: number;
  vatAmount: number;
  processingFee: number;
  refundedAmount: number;
  provider: string;
  providerTransactionId: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  clubName: string | null;
  clubId: string | null;
  playerName: string | null;
  capturedAt: Date | null;
  createdAt: Date;
}

export async function listPayments(
  user: CurrentUser,
  filters: { status?: string; club?: string; method?: string; q?: string; from?: Date; to?: Date; page?: number },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const conditions = [sql`p.deleted_at IS NULL`, clubScopeSql(user, 'p.club_id')];
  if (filters.status && filters.status !== 'all') conditions.push(sql`p.status = ${filters.status}`);
  if (filters.club && filters.club !== 'all') conditions.push(sql`p.club_id = ${filters.club}::uuid`);
  if (filters.method && filters.method !== 'all') conditions.push(sql`p.method = ${filters.method}`);
  if (filters.from) conditions.push(sql`p.created_at >= ${filters.from}`);
  if (filters.to) conditions.push(sql`p.created_at < ${filters.to}`);
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(
      sql`(p.reference ILIKE ${like} OR p.provider_transaction_id ILIKE ${like} OR s.reference ILIKE ${like})`,
    );
  }
  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM payments p
    LEFT JOIN sessions s ON s.id = p.session_id WHERE ${where}
  `);
  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);

  const rows = await db.execute(sql`
    SELECT p.*, s.reference AS session_reference, c.name AS club_name,
      COALESCE(u.full_name, s.guest_name) AS player_name,
      COALESCE((SELECT SUM(r.amount_gross) FROM refunds r
        WHERE r.payment_id = p.id AND r.status = 'completed'), 0)::numeric AS refunded_amount
    FROM payments p
    LEFT JOIN sessions s ON s.id = p.session_id
    LEFT JOIN clubs c ON c.id = p.club_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE ${where}
    ORDER BY p.created_at DESC LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items: PaymentListRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      reference: String(row.reference),
      sessionId: row.session_id ? String(row.session_id) : null,
      sessionReference: row.session_reference ? String(row.session_reference) : null,
      status: String(row.status),
      method: String(row.method),
      amountGross: round2(Number(row.amount_gross ?? 0)),
      amountNet: round2(Number(row.amount_net ?? 0)),
      vatAmount: round2(Number(row.vat_amount ?? 0)),
      processingFee: round2(Number(row.processing_fee ?? 0)),
      refundedAmount: round2(Number(row.refunded_amount ?? 0)),
      provider: String(row.provider),
      providerTransactionId: row.provider_transaction_id
        ? String(row.provider_transaction_id)
        : null,
      cardBrand: row.card_brand ? String(row.card_brand) : null,
      cardLast4: row.card_last4 ? String(row.card_last4) : null,
      clubId: row.club_id ? String(row.club_id) : null,
      clubName: row.club_name ? String(row.club_name) : null,
      playerName: row.player_name ? String(row.player_name) : null,
      capturedAt: row.captured_at ? new Date(row.captured_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  });

  return { items, total, page, pageSize };
}

export interface RefundListRow {
  id: string;
  reference: string;
  sessionId: string | null;
  sessionReference: string | null;
  amountGross: number;
  amountNet: number;
  refundType: string;
  destination: string;
  status: string;
  reason: string;
  reasonNote: string;
  isAutomatic: boolean;
  requestedByName: string | null;
  approvedByName: string | null;
  clubName: string | null;
  clubId: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export async function listRefunds(
  user: CurrentUser,
  filters: { status?: string; reason?: string; club?: string; from?: Date; to?: Date; page?: number },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const conditions = [
    sql`r.deleted_at IS NULL`,
    sql`(p.club_id IS NULL OR ${clubScopeSql(user, 'p.club_id')})`,
  ];
  if (filters.status && filters.status !== 'all') conditions.push(sql`r.status = ${filters.status}`);
  if (filters.reason && filters.reason !== 'all') conditions.push(sql`r.reason = ${filters.reason}`);
  if (filters.club && filters.club !== 'all') conditions.push(sql`p.club_id = ${filters.club}::uuid`);
  if (filters.from) conditions.push(sql`r.created_at >= ${filters.from}`);
  if (filters.to) conditions.push(sql`r.created_at < ${filters.to}`);
  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM refunds r
    JOIN payments p ON p.id = r.payment_id WHERE ${where}
  `);
  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);

  const rows = await db.execute(sql`
    SELECT r.*, s.reference AS session_reference, c.name AS club_name, p.club_id,
           req.full_name AS requested_by_name, app.full_name AS approved_by_name
    FROM refunds r
    JOIN payments p ON p.id = r.payment_id
    LEFT JOIN sessions s ON s.id = r.session_id
    LEFT JOIN clubs c ON c.id = p.club_id
    LEFT JOIN users req ON req.id = r.requested_by
    LEFT JOIN users app ON app.id = r.approved_by
    WHERE ${where}
    ORDER BY r.created_at DESC LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items: RefundListRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      reference: String(row.reference),
      sessionId: row.session_id ? String(row.session_id) : null,
      sessionReference: row.session_reference ? String(row.session_reference) : null,
      amountGross: round2(Number(row.amount_gross ?? 0)),
      amountNet: round2(Number(row.amount_net ?? 0)),
      refundType: String(row.refund_type),
      destination: String(row.destination),
      status: String(row.status),
      reason: String(row.reason),
      reasonNote: String(row.reason_note ?? ''),
      isAutomatic: Boolean(row.is_automatic),
      requestedByName: row.requested_by_name ? String(row.requested_by_name) : null,
      approvedByName: row.approved_by_name ? String(row.approved_by_name) : null,
      clubId: row.club_id ? String(row.club_id) : null,
      clubName: row.club_name ? String(row.club_name) : null,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  });

  return { items, total, page, pageSize };
}

export async function getPaymentStats(user: CurrentUser, from: Date, to: Date) {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE p.status = 'captured')::int AS captured_count,
      COUNT(*) FILTER (WHERE p.status = 'failed')::int AS failed_count,
      COALESCE(SUM(p.amount_gross) FILTER (WHERE p.status IN ('captured','partially_refunded')), 0)::numeric AS gross,
      COALESCE(SUM(p.amount_net) FILTER (WHERE p.status IN ('captured','partially_refunded')), 0)::numeric AS net,
      COALESCE(SUM(p.vat_amount) FILTER (WHERE p.status IN ('captured','partially_refunded')), 0)::numeric AS vat,
      COALESCE(SUM(p.processing_fee) FILTER (WHERE p.status IN ('captured','partially_refunded','refunded')), 0)::numeric AS fees
    FROM payments p
    WHERE p.deleted_at IS NULL AND p.created_at >= ${from} AND p.created_at < ${to}
      AND ${clubScopeSql(user, 'p.club_id')}
  `);
  const r = (rows.rows[0] ?? {}) as Record<string, unknown>;

  const refundRows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS refund_count,
      COALESCE(SUM(r.amount_gross) FILTER (WHERE r.status = 'completed'), 0)::numeric AS refunded_gross,
      COALESCE(SUM(r.amount_gross) FILTER (WHERE r.status = 'pending_approval'), 0)::numeric AS pending_gross,
      COUNT(*) FILTER (WHERE r.status = 'pending_approval')::int AS pending_count,
      COUNT(*) FILTER (WHERE r.is_automatic)::int AS automatic_count
    FROM refunds r JOIN payments p ON p.id = r.payment_id
    WHERE r.deleted_at IS NULL AND r.created_at >= ${from} AND r.created_at < ${to}
      AND ${clubScopeSql(user, 'p.club_id')}
  `);
  const rf = (refundRows.rows[0] ?? {}) as Record<string, unknown>;

  const chargebackRows = await db.execute(sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_gross), 0)::numeric AS amount
    FROM chargebacks WHERE opened_at >= ${from} AND opened_at < ${to}
  `);
  const cb = (chargebackRows.rows[0] ?? {}) as Record<string, unknown>;

  return {
    capturedCount: Number(r.captured_count ?? 0),
    failedCount: Number(r.failed_count ?? 0),
    grossRevenue: round2(Number(r.gross ?? 0)),
    netRevenue: round2(Number(r.net ?? 0)),
    vatAmount: round2(Number(r.vat ?? 0)),
    processingFees: round2(Number(r.fees ?? 0)),
    refundCount: Number(rf.refund_count ?? 0),
    refundedGross: round2(Number(rf.refunded_gross ?? 0)),
    pendingRefundGross: round2(Number(rf.pending_gross ?? 0)),
    pendingRefundCount: Number(rf.pending_count ?? 0),
    automaticRefundCount: Number(rf.automatic_count ?? 0),
    chargebackCount: Number(cb.count ?? 0),
    chargebackAmount: round2(Number(cb.amount ?? 0)),
  };
}

/** התפלגות סיבות זיכוי — לניתוח שורש הבעיה */
export async function getRefundReasonBreakdown(user: CurrentUser, from: Date, to: Date) {
  const rows = await db.execute(sql`
    SELECT r.reason, COUNT(*)::int AS count, COALESCE(SUM(r.amount_gross), 0)::numeric AS amount
    FROM refunds r JOIN payments p ON p.id = r.payment_id
    WHERE r.deleted_at IS NULL AND r.created_at >= ${from} AND r.created_at < ${to}
      AND ${clubScopeSql(user, 'p.club_id')}
    GROUP BY 1 ORDER BY count DESC
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      reason: String(row.reason),
      count: Number(row.count),
      amount: round2(Number(row.amount ?? 0)),
    };
  });
}

/** מועדונים עם שיעור זיכויים חריג — התראת Fraud/Quality */
export async function getRefundAnomalies(user: CurrentUser, thresholdPct: number) {
  const rows = await db.execute(sql`
    SELECT
      c.id, c.name,
      COUNT(DISTINCT s.id) FILTER (WHERE s.amount_gross > 0)::int AS paid_sessions,
      COUNT(DISTINCT s.id) FILTER (WHERE s.refunded_amount > 0)::int AS refunded_sessions
    FROM clubs c
    LEFT JOIN sessions s ON s.club_id = c.id AND s.created_at >= now() - interval '30 days'
      AND s.deleted_at IS NULL
    WHERE c.deleted_at IS NULL AND ${clubScopeSql(user, 'c.id')}
    GROUP BY c.id, c.name
    HAVING COUNT(DISTINCT s.id) FILTER (WHERE s.amount_gross > 0) > 5
  `);

  return rows.rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      const paid = Number(row.paid_sessions ?? 0);
      const refunded = Number(row.refunded_sessions ?? 0);
      return {
        clubId: String(row.id),
        clubName: String(row.name),
        paidSessions: paid,
        refundedSessions: refunded,
        rate: paid > 0 ? refunded / paid : 0,
      };
    })
    .filter((c) => c.rate > thresholdPct)
    .sort((a, b) => b.rate - a.rate);
}

/** סדרת הכנסות יומית לתרשים בדף התשלומים */
export async function getPaymentSeries(user: CurrentUser, from: Date, to: Date) {
  // הזיכויים מקובצים ב־CTE נפרד ולא בתת־שאילתה מתואמת:
  // תת־שאילתה שמפנה ל־p.created_at בתוך GROUP BY אינה חוקית ב־Postgres.
  const rows = await db.execute(sql`
    WITH daily_payments AS (
      SELECT
        date_trunc('day', p.created_at AT TIME ZONE 'Asia/Jerusalem') AS bucket,
        COALESCE(SUM(p.amount_net) FILTER (WHERE p.status IN ('captured','partially_refunded')), 0)::numeric AS net,
        COALESCE(SUM(p.processing_fee), 0)::numeric AS fees
      FROM payments p
      WHERE p.deleted_at IS NULL AND p.created_at >= ${from} AND p.created_at < ${to}
        AND ${clubScopeSql(user, 'p.club_id')}
      GROUP BY 1
    ),
    daily_refunds AS (
      SELECT
        date_trunc('day', r.created_at AT TIME ZONE 'Asia/Jerusalem') AS bucket,
        COALESCE(SUM(r.amount_gross), 0)::numeric AS refunds
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      WHERE r.status = 'completed' AND r.deleted_at IS NULL
        AND r.created_at >= ${from} AND r.created_at < ${to}
        AND ${clubScopeSql(user, 'p.club_id')}
      GROUP BY 1
    )
    SELECT
      COALESCE(dp.bucket, dr.bucket) AS bucket,
      COALESCE(dp.net, 0) AS net,
      COALESCE(dp.fees, 0) AS fees,
      COALESCE(dr.refunds, 0) AS refunds
    FROM daily_payments dp
    FULL OUTER JOIN daily_refunds dr ON dr.bucket = dp.bucket
    ORDER BY 1
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
      net: round2(Number(row.net ?? 0)),
      fees: round2(Number(row.fees ?? 0)),
      refunds: round2(Number(row.refunds ?? 0)),
    };
  });
}
