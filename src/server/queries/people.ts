import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from './sessions';

export interface PlayerListRow {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  level: string;
  membershipTier: string;
  preferredClubId: string | null;
  preferredClubName: string | null;
  dominantHand: string;
  joinedAt: Date;
  sessionCount: number;
  paidMinutes: number;
  totalSpentNet: number;
  refundedTotal: number;
  lastSessionAt: Date | null;
  xpTotal: number;
  streakWeeks: number;
  riskFlags: string[];
  coachName: string | null;
}

export async function listPlayers(
  user: CurrentUser,
  filters: { q?: string; level?: string; status?: string; club?: string; page?: number },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  const conditions = [sql`u.is_player = true`, sql`u.deleted_at IS NULL`];
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(sql`(u.full_name ILIKE ${like} OR u.phone ILIKE ${like} OR u.email ILIKE ${like})`);
  }
  if (filters.level && filters.level !== 'all') conditions.push(sql`p.level = ${filters.level}`);
  if (filters.status && filters.status !== 'all') conditions.push(sql`u.status = ${filters.status}`);
  if (filters.club && filters.club !== 'all') {
    conditions.push(sql`p.preferred_club_id = ${filters.club}::uuid`);
  }
  // מנהל מועדון רואה רק שחקנים שהתאמנו במועדונים שלו
  if (!user.isGlobal) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM sessions s WHERE s.user_id = u.id AND ${clubScopeSql(user, 's.club_id')}
    )`);
  }
  const where = sql.join(conditions, sql` AND `);

  const countRows = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM users u
    JOIN player_profiles p ON p.user_id = u.id WHERE ${where}
  `);
  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);

  const rows = await db.execute(sql`
    SELECT
      u.id, u.full_name, u.phone, u.email, u.status, u.created_at,
      p.level, p.membership_tier, p.dominant_hand, p.risk_flags, p.preferred_club_id,
      c.name AS club_name,
      co.display_name AS coach_name,
      ra.xp_total, ra.current_streak_weeks,
      COALESCE(agg.session_count, 0)::int AS session_count,
      COALESCE(agg.paid_minutes, 0)::numeric AS paid_minutes,
      COALESCE(agg.total_net, 0)::numeric AS total_net,
      COALESCE(agg.refunded, 0)::numeric AS refunded,
      agg.last_session_at
    FROM users u
    JOIN player_profiles p ON p.user_id = u.id
    LEFT JOIN clubs c ON c.id = p.preferred_club_id
    LEFT JOIN coaches co ON co.id = p.referred_by_coach_id
    LEFT JOIN rewards_accounts ra ON ra.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS session_count,
        SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)) AS paid_minutes,
        SUM(s.amount_net) AS total_net,
        SUM(s.refunded_amount) AS refunded,
        MAX(s.started_at) AS last_session_at
      FROM sessions s
      WHERE s.user_id = u.id AND s.deleted_at IS NULL
        AND s.status IN ('completed','active','paused','partially_refunded')
    ) agg ON TRUE
    WHERE ${where}
    ORDER BY agg.last_session_at DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items: PlayerListRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      userId: String(row.id),
      fullName: String(row.full_name),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      status: String(row.status),
      level: String(row.level),
      membershipTier: String(row.membership_tier),
      preferredClubId: row.preferred_club_id ? String(row.preferred_club_id) : null,
      preferredClubName: row.club_name ? String(row.club_name) : null,
      dominantHand: String(row.dominant_hand),
      joinedAt: new Date(row.created_at as string),
      sessionCount: Number(row.session_count ?? 0),
      paidMinutes: Number(row.paid_minutes ?? 0),
      totalSpentNet: round2(Number(row.total_net ?? 0)),
      refundedTotal: round2(Number(row.refunded ?? 0)),
      lastSessionAt: row.last_session_at ? new Date(row.last_session_at as string) : null,
      xpTotal: Number(row.xp_total ?? 0),
      streakWeeks: Number(row.current_streak_weeks ?? 0),
      riskFlags: (row.risk_flags as string[]) ?? [],
      coachName: row.coach_name ? String(row.coach_name) : null,
    };
  });

  return { items, total, page, pageSize };
}

export async function getPlayerDetail(userId: string, user: CurrentUser) {
  const scopeOk = user.isGlobal
    ? sql`TRUE`
    : sql`EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND ${clubScopeSql(user, 's.club_id')})`;

  const rows = await db.execute(sql`
    SELECT u.*, p.*, c.name AS club_name, co.display_name AS coach_name,
           ra.xp_total, ra.points_balance, ra.current_streak_weeks, ra.longest_streak_weeks,
           ra.tier AS rewards_tier, ra.badges,
           cw.balance AS wallet_balance
    FROM users u
    JOIN player_profiles p ON p.user_id = u.id
    LEFT JOIN clubs c ON c.id = p.preferred_club_id
    LEFT JOIN coaches co ON co.id = p.referred_by_coach_id
    LEFT JOIN rewards_accounts ra ON ra.user_id = u.id
    LEFT JOIN credit_wallets cw ON cw.user_id = u.id
    WHERE u.id = ${userId}::uuid AND u.deleted_at IS NULL AND ${scopeOk}
    LIMIT 1
  `);
  const player = rows.rows[0] as Record<string, unknown> | undefined;
  if (!player) return null;

  const [sessions, payments, refunds, rewards, consents, tickets] = await Promise.all([
    db.execute(sql`
      SELECT s.id, s.reference, s.status, s.started_at, s.actual_minutes, s.scheduled_minutes,
             s.amount_gross, s.refunded_amount, s.peak_window,
             c.name AS club_name, st.code AS station_code
      FROM sessions s
      JOIN clubs c ON c.id = s.club_id JOIN stations st ON st.id = s.station_id
      WHERE s.user_id = ${userId}::uuid AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC LIMIT 25
    `),
    db.execute(sql`
      SELECT p.reference, p.amount_gross, p.status, p.method, p.captured_at
      FROM payments p WHERE p.user_id = ${userId}::uuid AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT r.reference, r.amount_gross, r.reason, r.reason_note, r.status, r.processed_at
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      WHERE p.user_id = ${userId}::uuid AND r.deleted_at IS NULL
      ORDER BY r.created_at DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT rt.* FROM rewards_transactions rt
      JOIN rewards_accounts ra ON ra.id = rt.account_id
      WHERE ra.user_id = ${userId}::uuid ORDER BY rt.created_at DESC LIMIT 20
    `),
    db.execute(sql`
      SELECT * FROM consents WHERE user_id = ${userId}::uuid ORDER BY granted_at DESC
    `),
    db.execute(sql`
      SELECT t.id, t.reference, t.title, t.status, t.severity, t.created_at
      FROM support_tickets t WHERE t.reported_by_user_id = ${userId}::uuid AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC LIMIT 10
    `),
  ]);

  return {
    player,
    sessions: sessions.rows as Record<string, unknown>[],
    payments: payments.rows as Record<string, unknown>[],
    refunds: refunds.rows as Record<string, unknown>[],
    rewards: rewards.rows as Record<string, unknown>[],
    consents: consents.rows as Record<string, unknown>[],
    tickets: tickets.rows as Record<string, unknown>[],
  };
}

export interface CoachListRow {
  id: string;
  displayName: string;
  verification: string;
  referralCode: string;
  homeClubId: string | null;
  homeClubName: string | null;
  rating: number | null;
  ratingCount: number;
  attributedUsers: number;
  attributedSessions: number;
  programsCreated: number;
  homeworkAssigned: number;
  commissionAccrued: number;
  commissionPaid: number;
  commissionPayable: number;
}

export async function listCoaches(): Promise<CoachListRow[]> {
  const rows = await db.execute(sql`
    SELECT
      co.*, c.name AS club_name,
      (SELECT COUNT(DISTINCT ca.user_id)::int FROM coach_attributions ca
        WHERE ca.coach_id = co.id AND NOT ca.is_rejected) AS attributed_users,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.coach_id = co.id AND s.deleted_at IS NULL) AS attributed_sessions,
      (SELECT COUNT(*)::int FROM programs p WHERE p.created_by_coach_id = co.id AND p.deleted_at IS NULL) AS programs_created,
      (SELECT COUNT(*)::int FROM homework_assignments h WHERE h.coach_id = co.id AND h.deleted_at IS NULL) AS homework_assigned,
      COALESCE((SELECT SUM(cc.commission_amount) FROM coach_commissions cc
        WHERE cc.coach_id = co.id), 0)::numeric AS commission_accrued,
      COALESCE((SELECT SUM(cc.commission_amount) FROM coach_commissions cc
        WHERE cc.coach_id = co.id AND cc.status = 'paid'), 0)::numeric AS commission_paid,
      COALESCE((SELECT SUM(cc.commission_amount) FROM coach_commissions cc
        WHERE cc.coach_id = co.id AND cc.status IN ('accrued','holding_period','approved')), 0)::numeric AS commission_payable
    FROM coaches co
    LEFT JOIN clubs c ON c.id = co.home_club_id
    WHERE co.deleted_at IS NULL
    ORDER BY co.display_name
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      displayName: String(row.display_name),
      verification: String(row.verification),
      referralCode: String(row.referral_code),
      homeClubId: row.home_club_id ? String(row.home_club_id) : null,
      homeClubName: row.club_name ? String(row.club_name) : null,
      rating: row.rating === null ? null : Number(row.rating),
      ratingCount: Number(row.rating_count ?? 0),
      attributedUsers: Number(row.attributed_users ?? 0),
      attributedSessions: Number(row.attributed_sessions ?? 0),
      programsCreated: Number(row.programs_created ?? 0),
      homeworkAssigned: Number(row.homework_assigned ?? 0),
      commissionAccrued: round2(Number(row.commission_accrued ?? 0)),
      commissionPaid: round2(Number(row.commission_paid ?? 0)),
      commissionPayable: round2(Number(row.commission_payable ?? 0)),
    };
  });
}

export async function getCoachDetail(coachId: string) {
  const rows = await db.execute(sql`
    SELECT co.*, u.full_name, u.email, u.phone, c.name AS club_name
    FROM coaches co
    JOIN users u ON u.id = co.user_id
    LEFT JOIN clubs c ON c.id = co.home_club_id
    WHERE co.id = ${coachId}::uuid AND co.deleted_at IS NULL LIMIT 1
  `);
  const coach = rows.rows[0] as Record<string, unknown> | undefined;
  if (!coach) return null;

  const [commissions, attributions, programs, homework] = await Promise.all([
    db.execute(sql`
      SELECT cc.*, s.reference AS session_reference, u.full_name AS approver_name
      FROM coach_commissions cc
      LEFT JOIN sessions s ON s.id = cc.session_id
      LEFT JOIN users u ON u.id = cc.approved_by
      WHERE cc.coach_id = ${coachId}::uuid ORDER BY cc.accrued_at DESC LIMIT 40
    `),
    db.execute(sql`
      SELECT ca.*, u.full_name AS user_name FROM coach_attributions ca
      JOIN users u ON u.id = ca.user_id
      WHERE ca.coach_id = ${coachId}::uuid ORDER BY ca.attributed_at DESC LIMIT 40
    `),
    db.execute(sql`
      SELECT p.*, pv.status AS version_status, pv.level, pv.usage_count, pv.avg_rating
      FROM programs p
      LEFT JOIN program_versions pv ON pv.id = p.current_version_id
      WHERE p.created_by_coach_id = ${coachId}::uuid AND p.deleted_at IS NULL
    `),
    db.execute(sql`
      SELECT h.*, u.full_name AS user_name FROM homework_assignments h
      JOIN users u ON u.id = h.user_id
      WHERE h.coach_id = ${coachId}::uuid AND h.deleted_at IS NULL
      ORDER BY h.created_at DESC LIMIT 20
    `),
  ]);

  return {
    coach,
    commissions: commissions.rows as Record<string, unknown>[],
    attributions: attributions.rows as Record<string, unknown>[],
    programs: programs.rows as Record<string, unknown>[],
    homework: homework.rows as Record<string, unknown>[],
  };
}
