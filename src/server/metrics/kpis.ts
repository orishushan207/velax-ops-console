import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { computeContribution, round2 } from '@/lib/money';
import { safeDivide } from '@/lib/utils';
import { getSettings, type Scenario } from '@/server/settings/service';

/**
 * מנוע חישוב ה־KPI.
 *
 * כל שאילתה כאן מכבדת את הגדרות ה־Metric Dictionary:
 *  • "סשן בתשלום" = הופעל, שולם, ולא זוכה במלואו.
 *  • הכנסה ברוטו והכנסה נטו הן שני שדות שונים ולעולם לא מעורבבות.
 *  • תרומה אינה רווח.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export interface MetricScope {
  range: DateRange;
  /** null = כל הרשת */
  clubIds?: string[] | null;
  stationId?: string | null;
  region?: string | null;
  scenario?: Scenario;
}

/** תנאי SQL של "סשן בתשלום" — מקור אמת יחיד */
const PAID_SESSION_CONDITION = sql`
  s.status IN ('active','paused','completed','partially_refunded')
  AND s.amount_gross > 0
  AND s.refunded_amount < s.amount_gross
  AND s.deleted_at IS NULL
`;

function clubFilter(clubIds?: string[] | null) {
  if (!clubIds) return sql`TRUE`;
  if (clubIds.length === 0) return sql`FALSE`;
  return sql`s.club_id IN (${sql.join(clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

function stationFilter(stationId?: string | null) {
  return stationId ? sql`s.station_id = ${stationId}::uuid` : sql`TRUE`;
}

export interface CoreVolumeMetrics {
  paidSessions: number;
  completedSessions: number;
  failedToStartSessions: number;
  totalPaidMinutes: number;
  totalPaidHours: number;
  grossRevenue: number;
  vatAmount: number;
  netRevenue: number;
  refundedAmount: number;
  uniqueUsers: number;
  newUsers: number;
  returningUsers: number;
  offPeakHours: number;
  avgSessionMinutes: number;
}

/**
 * נפח והכנסות בתקופה.
 * refundedAmount מנוכה מההכנסה — סשן שזוכה במלואו כבר לא נספר כלל.
 */
export async function getCoreVolume(scope: MetricScope): Promise<CoreVolumeMetrics> {
  const { from, to } = scope.range;
  const rows = await db.execute(sql`
    WITH paid AS (
      SELECT
        s.id, s.user_id, s.guest_phone, s.actual_minutes, s.scheduled_minutes,
        s.amount_gross, s.amount_net, s.vat_amount, s.refunded_amount,
        s.peak_window, s.status, s.started_at
      FROM sessions s
      WHERE s.started_at >= ${from} AND s.started_at < ${to}
        AND ${PAID_SESSION_CONDITION}
        AND ${clubFilter(scope.clubIds)}
        AND ${stationFilter(scope.stationId)}
    ),
    all_in_range AS (
      SELECT s.id, s.status
      FROM sessions s
      WHERE s.created_at >= ${from} AND s.created_at < ${to}
        AND s.deleted_at IS NULL
        AND ${clubFilter(scope.clubIds)}
        AND ${stationFilter(scope.stationId)}
    ),
    first_session AS (
      SELECT
        COALESCE(s.user_id::text, s.guest_phone) AS identity,
        MIN(s.started_at) AS first_at
      FROM sessions s
      WHERE ${PAID_SESSION_CONDITION}
        AND COALESCE(s.user_id::text, s.guest_phone) IS NOT NULL
      GROUP BY 1
    )
    SELECT
      (SELECT COUNT(*) FROM paid)::int AS paid_sessions,
      (SELECT COUNT(*) FROM paid WHERE status = 'completed')::int AS completed_sessions,
      (SELECT COUNT(*) FROM all_in_range WHERE status = 'failed_to_start')::int AS failed_sessions,
      COALESCE((SELECT SUM(COALESCE(actual_minutes, scheduled_minutes)) FROM paid), 0)::numeric AS total_minutes,
      COALESCE((SELECT SUM(amount_gross) FROM paid), 0)::numeric AS gross_revenue,
      COALESCE((SELECT SUM(vat_amount) FROM paid), 0)::numeric AS vat_amount,
      COALESCE((SELECT SUM(amount_net) FROM paid), 0)::numeric AS net_revenue,
      COALESCE((SELECT SUM(refunded_amount) FROM paid), 0)::numeric AS refunded_amount,
      (SELECT COUNT(DISTINCT COALESCE(user_id::text, guest_phone)) FROM paid)::int AS unique_users,
      (SELECT COUNT(*) FROM first_session f
        WHERE f.first_at >= ${from} AND f.first_at < ${to})::int AS new_users,
      COALESCE((SELECT SUM(COALESCE(actual_minutes, scheduled_minutes))
        FROM paid WHERE peak_window = 'off_peak'), 0)::numeric AS off_peak_minutes,
      COALESCE((SELECT AVG(COALESCE(actual_minutes, scheduled_minutes)) FROM paid), 0)::numeric AS avg_minutes
  `);

  const r = (rows.rows[0] ?? {}) as Record<string, string | number | null>;
  const n = (k: string) => Number(r[k] ?? 0);

  const totalMinutes = n('total_minutes');
  const uniqueUsers = n('unique_users');
  const newUsers = n('new_users');

  return {
    paidSessions: n('paid_sessions'),
    completedSessions: n('completed_sessions'),
    failedToStartSessions: n('failed_sessions'),
    totalPaidMinutes: totalMinutes,
    totalPaidHours: round2(totalMinutes / 60),
    grossRevenue: round2(n('gross_revenue')),
    vatAmount: round2(n('vat_amount')),
    netRevenue: round2(n('net_revenue')),
    refundedAmount: round2(n('refunded_amount')),
    uniqueUsers,
    newUsers,
    returningUsers: Math.max(0, uniqueUsers - newUsers),
    offPeakHours: round2(n('off_peak_minutes') / 60),
    avgSessionMinutes: Math.round(n('avg_minutes')),
  };
}

export interface NetworkMetrics {
  totalStations: number;
  installedStations: number;
  activeStations: number;
  totalClubs: number;
  activeClubs: number;
  onlineDevices: number;
  offlineDevices: number;
  totalDevices: number;
}

/**
 * "עמדה פעילה" לפי ה־Metric Dictionary: לפחות N סשנים בשבוע האחרון של התקופה
 * וזמינות מעל הרף. שני הרפים מגיעים מההגדרות העסקיות.
 */
export async function getNetworkMetrics(scope: MetricScope): Promise<NetworkMetrics> {
  const settings = await getSettings(scope.scenario ?? 'plan');
  const minSessionsPerWeek = settings.num('metrics.active_station_min_sessions_per_week', 1);
  const { from, to } = scope.range;
  const weeks = Math.max(1, (to.getTime() - from.getTime()) / (7 * 24 * 3_600_000));
  const minSessionsInRange = Math.ceil(minSessionsPerWeek * weeks);

  const clubScope = scope.clubIds
    ? scope.clubIds.length === 0
      ? sql`FALSE`
      : sql`st.club_id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
    : sql`TRUE`;

  const rows = await db.execute(sql`
    WITH station_sessions AS (
      SELECT s.station_id, COUNT(*)::int AS cnt
      FROM sessions s
      WHERE s.started_at >= ${from} AND s.started_at < ${to} AND ${PAID_SESSION_CONDITION}
      GROUP BY s.station_id
    )
    SELECT
      COUNT(*) FILTER (WHERE st.deleted_at IS NULL)::int AS total_stations,
      COUNT(*) FILTER (WHERE st.status = 'active' AND st.deleted_at IS NULL)::int AS installed_stations,
      COUNT(*) FILTER (
        WHERE st.status = 'active' AND st.deleted_at IS NULL
          AND COALESCE(ss.cnt, 0) >= ${minSessionsInRange}
      )::int AS active_stations
    FROM stations st
    LEFT JOIN station_sessions ss ON ss.station_id = st.id
    WHERE ${clubScope}
  `);

  const clubRows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE c.deleted_at IS NULL)::int AS total_clubs,
      COUNT(*) FILTER (WHERE c.status = 'active' AND c.deleted_at IS NULL)::int AS active_clubs
    FROM clubs c
    WHERE ${
      scope.clubIds
        ? scope.clubIds.length === 0
          ? sql`FALSE`
          : sql`c.id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
        : sql`TRUE`
    }
  `);

  const deviceRows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE d.deleted_at IS NULL)::int AS total_devices,
      COUNT(*) FILTER (WHERE d.connectivity = 'online' AND d.deleted_at IS NULL)::int AS online_devices,
      COUNT(*) FILTER (WHERE d.connectivity = 'offline' AND d.deleted_at IS NULL)::int AS offline_devices
    FROM devices d
    WHERE ${
      scope.clubIds
        ? scope.clubIds.length === 0
          ? sql`FALSE`
          : sql`d.current_club_id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
        : sql`TRUE`
    }
  `);

  const s = (rows.rows[0] ?? {}) as Record<string, number>;
  const c = (clubRows.rows[0] ?? {}) as Record<string, number>;
  const d = (deviceRows.rows[0] ?? {}) as Record<string, number>;

  return {
    totalStations: Number(s.total_stations ?? 0),
    installedStations: Number(s.installed_stations ?? 0),
    activeStations: Number(s.active_stations ?? 0),
    totalClubs: Number(c.total_clubs ?? 0),
    activeClubs: Number(c.active_clubs ?? 0),
    totalDevices: Number(d.total_devices ?? 0),
    onlineDevices: Number(d.online_devices ?? 0),
    offlineDevices: Number(d.offline_devices ?? 0),
  };
}

export interface QualityMetrics {
  startSuccessRate: number | null;
  refundRate: number | null;
  uptimePct: number | null;
  openTickets: number;
  criticalOpenTickets: number;
  slaBreaches: number;
  mttrHours: number | null;
  totalDowntimeMinutes: number;
}

export async function getQualityMetrics(scope: MetricScope): Promise<QualityMetrics> {
  const { from, to } = scope.range;

  const startRows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE s.status IN ('active','paused','completed','partially_refunded','interrupted')
      )::int AS reached_active,
      COUNT(*) FILTER (
        WHERE s.started_without_staff_help = true
      )::int AS clean_starts,
      COUNT(*) FILTER (
        WHERE s.status IN ('paid','authorized','connecting','active','paused','completed',
                           'partially_refunded','fully_refunded','failed_to_start','interrupted')
      )::int AS reached_paid,
      COUNT(*) FILTER (WHERE s.refunded_amount > 0)::int AS refunded_sessions,
      COUNT(*) FILTER (WHERE ${PAID_SESSION_CONDITION})::int AS paid_sessions
    FROM sessions s
    WHERE s.created_at >= ${from} AND s.created_at < ${to}
      AND s.deleted_at IS NULL
      AND ${clubFilter(scope.clubIds)}
      AND ${stationFilter(scope.stationId)}
  `);

  const ticketScope = scope.clubIds
    ? scope.clubIds.length === 0
      ? sql`FALSE`
      : sql`t.club_id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
    : sql`TRUE`;

  const ticketRows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE t.status NOT IN ('resolved','closed') AND t.deleted_at IS NULL
      )::int AS open_tickets,
      COUNT(*) FILTER (
        WHERE t.status NOT IN ('resolved','closed') AND t.severity = 'critical' AND t.deleted_at IS NULL
      )::int AS critical_open,
      COUNT(*) FILTER (
        WHERE (t.response_breached OR t.resolution_breached) AND t.deleted_at IS NULL
      )::int AS sla_breaches,
      COALESCE(AVG(
        EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
      ) FILTER (WHERE t.resolved_at IS NOT NULL AND t.resolved_at >= ${from} AND t.resolved_at < ${to}),
      NULL)::numeric AS mttr_hours,
      COALESCE(SUM(t.downtime_minutes) FILTER (
        WHERE t.created_at >= ${from} AND t.created_at < ${to}
      ), 0)::int AS downtime_minutes
    FROM support_tickets t
    WHERE ${ticketScope}
  `);

  const s = (startRows.rows[0] ?? {}) as Record<string, number>;
  const t = (ticketRows.rows[0] ?? {}) as Record<string, number | null>;

  const reachedPaid = Number(s.reached_paid ?? 0);
  const cleanStarts = Number(s.clean_starts ?? 0);
  const paidSessions = Number(s.paid_sessions ?? 0);
  const refundedSessions = Number(s.refunded_sessions ?? 0);

  // זמינות: שעות זמינות מתוכננות מוערכות מ־12 שעות פעילות ליום לעמדה פעילה.
  // כאשר אין נתוני שעות פעילות מלאים, המדד מוצג כ־null ולא כמספר משוער.
  const network = await getNetworkMetrics(scope);
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86_400_000);
  const plannedMinutes = network.installedStations * days * 12 * 60;
  const downtimeMinutes = Number(t.downtime_minutes ?? 0);
  const uptimePct =
    plannedMinutes > 0 ? Math.max(0, 1 - downtimeMinutes / plannedMinutes) : null;

  return {
    startSuccessRate: reachedPaid > 0 ? safeDivide(cleanStarts, reachedPaid, 0) : null,
    refundRate: paidSessions > 0 ? safeDivide(refundedSessions, paidSessions, 0) : null,
    uptimePct,
    openTickets: Number(t.open_tickets ?? 0),
    criticalOpenTickets: Number(t.critical_open ?? 0),
    slaBreaches: Number(t.sla_breaches ?? 0),
    mttrHours: t.mttr_hours === null ? null : round2(Number(t.mttr_hours)),
    totalDowntimeMinutes: downtimeMinutes,
  };
}

export interface RetentionMetrics {
  d7: number | null;
  d30: number | null;
  d90: number | null;
  activatedUsers: number;
  sessionsPerUser: number | null;
}

/**
 * Retention לפי ההגדרה בתוכנית: "חזר בחלון הזמן שנקבע; לא רק פתח אפליקציה".
 * הבסיס הוא משתמשים שהתחילו את הסשן הראשון שלהם בתקופה, כך שיש להם מספיק זמן לחזור.
 */
export async function getRetentionMetrics(scope: MetricScope): Promise<RetentionMetrics> {
  const settings = await getSettings(scope.scenario ?? 'plan');
  const activationSessions = settings.num('metrics.activated_user_sessions', 2);
  const activationWindow = settings.num('metrics.activated_user_window_days', 30);
  const { from, to } = scope.range;

  const rows = await db.execute(sql`
    WITH identities AS (
      SELECT
        COALESCE(s.user_id::text, s.guest_phone) AS identity,
        s.started_at
      FROM sessions s
      WHERE ${PAID_SESSION_CONDITION}
        AND s.started_at IS NOT NULL
        AND COALESCE(s.user_id::text, s.guest_phone) IS NOT NULL
        AND ${clubFilter(scope.clubIds)}
    ),
    firsts AS (
      SELECT identity, MIN(started_at) AS first_at FROM identities GROUP BY identity
    ),
    cohort AS (
      SELECT * FROM firsts WHERE first_at >= ${from} AND first_at < ${to}
    )
    SELECT
      (SELECT COUNT(*) FROM cohort)::int AS cohort_size,
      (SELECT COUNT(*) FROM cohort c WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = c.identity
          AND i.started_at > c.first_at AND i.started_at <= c.first_at + interval '7 days'
      ) AND c.first_at <= now() - interval '7 days')::int AS d7_returned,
      (SELECT COUNT(*) FROM cohort c WHERE c.first_at <= now() - interval '7 days')::int AS d7_eligible,
      (SELECT COUNT(*) FROM cohort c WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = c.identity
          AND i.started_at > c.first_at AND i.started_at <= c.first_at + interval '30 days'
      ) AND c.first_at <= now() - interval '30 days')::int AS d30_returned,
      (SELECT COUNT(*) FROM cohort c WHERE c.first_at <= now() - interval '30 days')::int AS d30_eligible,
      (SELECT COUNT(*) FROM cohort c WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = c.identity
          AND i.started_at > c.first_at AND i.started_at <= c.first_at + interval '90 days'
      ) AND c.first_at <= now() - interval '90 days')::int AS d90_returned,
      (SELECT COUNT(*) FROM cohort c WHERE c.first_at <= now() - interval '90 days')::int AS d90_eligible,
      (SELECT COUNT(*) FROM cohort c WHERE (
        SELECT COUNT(*) FROM identities i WHERE i.identity = c.identity
          AND i.started_at <= c.first_at + (${activationWindow}::int * interval '1 day')
      ) >= ${activationSessions}::int)::int AS activated_users
  `);

  const r = (rows.rows[0] ?? {}) as Record<string, number>;
  const ratio = (ret: unknown, elig: unknown) => {
    const e = Number(elig ?? 0);
    return e > 0 ? safeDivide(Number(ret ?? 0), e, 0) : null;
  };

  const volume = await getCoreVolume(scope);

  return {
    d7: ratio(r.d7_returned, r.d7_eligible),
    d30: ratio(r.d30_returned, r.d30_eligible),
    d90: ratio(r.d90_returned, r.d90_eligible),
    activatedUsers: Number(r.activated_users ?? 0),
    sessionsPerUser:
      volume.uniqueUsers > 0 ? round2(volume.paidSessions / volume.uniqueUsers) : null,
  };
}

export interface EconomicsMetrics {
  contributionPerHour: number;
  contributionMarginPct: number;
  totalContribution: number;
  variableCostTotal: number;
  breakEvenStations: number | null;
  breakEvenPaidHours: number | null;
  annualFixedCost: number;
  /** תרומה לשעת שימוש בפועל, מחושבת מהנתונים ולא מההנחות */
  actualContributionPerHour: number | null;
}

/**
 * כלכלת יחידה. משלב שני מקורות:
 *  • ההנחות מההגדרות העסקיות — לחישוב התיאורטי (שחזור גיליון "כלכלת יחידה")
 *  • הנתונים בפועל — לחישוב התרומה האמיתית על השעות שנצברו
 */
export async function getEconomicsMetrics(scope: MetricScope): Promise<EconomicsMetrics> {
  const scenario = scope.scenario ?? 'plan';
  const settings = await getSettings(scenario);
  const volume = await getCoreVolume(scope);

  const breakdown = computeContribution({
    priceGross: settings.num('pricing.consumer_price_per_hour_incl_vat', 90),
    vatRate: settings.num('finance.vat_rate', 0.18),
    pspPctFee: settings.num('finance.psp_percentage_fee', 0.027),
    pspFixedFee: settings.num('finance.psp_fixed_fee', 1),
    rewardsReservePct: settings.num('finance.rewards_reserve_pct', 0.06),
    coachPoolPct: settings.num('finance.coach_pool_pct', 0.05),
    refundRiskPct: settings.num('finance.refund_risk_pct', 0.03),
    ballsAndWearPerHour: settings.num('finance.balls_and_wear_per_hour', 8),
    cloudAndCommsPerHour: settings.num('finance.cloud_and_comms_per_hour', 2.5),
    sparePartsPerHour: settings.num('finance.spare_parts_per_hour', 0),
    warrantyReservePerHour: settings.num('finance.warranty_reserve_per_hour', 0),
  });

  const annualFixedCost = settings.num('finance.annual_fixed_cost', 730000);
  const operatingDays = settings.num('finance.operating_days_per_year', 312);
  const targetHours = settings.num('quality.paid_hours_per_station_target', 1.5);

  const beStations =
    breakdown.contributionPerHour > 0
      ? annualFixedCost / (breakdown.contributionPerHour * targetHours * operatingDays)
      : null;
  const beHours =
    breakdown.contributionPerHour > 0 ? annualFixedCost / breakdown.contributionPerHour : null;

  // תרומה בפועל: הכנסה נטו בפועל בניכוי זיכויים, פחות העלויות המשתנות על השעות שנצברו
  const netAfterRefunds = round2(
    volume.netRevenue - volume.refundedAmount / (1 + settings.num('finance.vat_rate', 0.18)),
  );
  const variableCostTotal = round2(
    volume.totalPaidHours *
      (breakdown.totalVariableCost -
        // עמלות אחוזיות מחושבות על ההכנסה בפועל ולא על מחיר המחירון
        breakdown.rewardsReserve -
        breakdown.coachPool -
        breakdown.refundRisk) +
      netAfterRefunds *
        (settings.num('finance.rewards_reserve_pct', 0.06) +
          settings.num('finance.coach_pool_pct', 0.05) +
          settings.num('finance.refund_risk_pct', 0.03)),
  );
  const totalContribution = round2(netAfterRefunds - variableCostTotal);

  return {
    contributionPerHour: breakdown.contributionPerHour,
    contributionMarginPct: breakdown.contributionMarginPct,
    totalContribution,
    variableCostTotal,
    breakEvenStations: beStations,
    breakEvenPaidHours: beHours,
    annualFixedCost,
    actualContributionPerHour:
      volume.totalPaidHours > 0 ? round2(totalContribution / volume.totalPaidHours) : null,
  };
}

export interface ClubRevenueMetrics {
  machineLinkedRevenue: number;
  incrementalRevenue: number;
  baselineRevenue: number;
  unverifiedRevenue: number;
  linkedBookingCount: number;
  offPeakUpliftPct: number | null;
}

export async function getClubRevenueMetrics(scope: MetricScope): Promise<ClubRevenueMetrics> {
  const { from, to } = scope.range;
  const settings = await getSettings(scope.scenario ?? 'plan');
  const incrementalityFactor = settings.num('earnback.incrementality_factor', 0.7);

  const bookingScope = scope.clubIds
    ? scope.clubIds.length === 0
      ? sql`FALSE`
      : sql`b.club_id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
    : sql`TRUE`;

  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.session_id IS NOT NULL), 0)::numeric AS machine_linked,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'incremental'), 0)::numeric AS incremental_explicit,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'machine_linked'), 0)::numeric AS machine_linked_unclassified,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'baseline'), 0)::numeric AS baseline,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'unverified'), 0)::numeric AS unverified,
      COUNT(*) FILTER (WHERE b.session_id IS NOT NULL)::int AS linked_count
    FROM court_bookings b
    WHERE b.starts_at >= ${from} AND b.starts_at < ${to}
      AND b.is_cancelled = false AND b.deleted_at IS NULL
      AND ${bookingScope}
  `);

  const r = (rows.rows[0] ?? {}) as Record<string, string | number>;
  const n = (k: string) => Number(r[k] ?? 0);

  const volume = await getCoreVolume(scope);
  const offPeakUplift =
    volume.totalPaidHours > 0 ? safeDivide(volume.offPeakHours, volume.totalPaidHours, 0) : null;

  return {
    machineLinkedRevenue: round2(n('machine_linked')),
    // הכנסה אינקרמנטלית = מה שסווג ידנית + מקדם על מה שטרם סווג
    incrementalRevenue: round2(
      n('incremental_explicit') + n('machine_linked_unclassified') * incrementalityFactor,
    ),
    baselineRevenue: round2(n('baseline')),
    unverifiedRevenue: round2(n('unverified')),
    linkedBookingCount: n('linked_count'),
    offPeakUpliftPct: offPeakUplift,
  };
}

export interface LiabilityMetrics {
  rewardsOutstandingLiability: number;
  rewardsEarnedCost: number;
  rewardsRedeemedCost: number;
  rewardsExpiredCost: number;
  earnBackExposure: number;
  earnBackAtRiskClubs: number;
  coachCommissionsPayable: number;
  refundExposure: number;
}

export async function getLiabilityMetrics(scope: MetricScope): Promise<LiabilityMetrics> {
  const rewardsRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(cost_to_company) FILTER (WHERE tx_type::text LIKE 'earn%'), 0)::numeric AS earned,
      COALESCE(SUM(cost_to_company) FILTER (WHERE tx_type = 'redeem'), 0)::numeric AS redeemed,
      COALESCE(SUM(cost_to_company) FILTER (WHERE tx_type = 'expire'), 0)::numeric AS expired
    FROM rewards_transactions
  `);

  const earnBackScope = scope.clubIds
    ? scope.clubIds.length === 0
      ? sql`FALSE`
      : sql`a.club_id IN (${sql.join(scope.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
    : sql`TRUE`;

  const earnBackRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(
        LEAST(
          GREATEST(a.entry_price - a.verified_revenue, 0),
          COALESCE(a.exposure_cap, a.entry_price)
        )
      ) FILTER (WHERE a.status IN ('active','at_risk')), 0)::numeric AS exposure,
      COUNT(*) FILTER (WHERE a.status = 'at_risk')::int AS at_risk_clubs
    FROM earn_back_agreements a
    WHERE a.deleted_at IS NULL AND ${earnBackScope}
  `);

  const commissionRows = await db.execute(sql`
    SELECT COALESCE(SUM(commission_amount), 0)::numeric AS payable
    FROM coach_commissions
    WHERE status IN ('accrued','holding_period','approved')
  `);

  const refundRows = await db.execute(sql`
    SELECT COALESCE(SUM(amount_gross), 0)::numeric AS pending
    FROM refunds
    WHERE status IN ('pending_approval','approved','processing') AND deleted_at IS NULL
  `);

  const rw = (rewardsRows.rows[0] ?? {}) as Record<string, string>;
  const eb = (earnBackRows.rows[0] ?? {}) as Record<string, string | number>;
  const cm = (commissionRows.rows[0] ?? {}) as Record<string, string>;
  const rf = (refundRows.rows[0] ?? {}) as Record<string, string>;

  const earned = Number(rw.earned ?? 0);
  const redeemed = Number(rw.redeemed ?? 0);
  const expired = Number(rw.expired ?? 0);

  return {
    rewardsEarnedCost: round2(earned),
    rewardsRedeemedCost: round2(redeemed),
    rewardsExpiredCost: round2(expired),
    rewardsOutstandingLiability: round2(Math.max(0, earned - redeemed - expired)),
    earnBackExposure: round2(Number(eb.exposure ?? 0)),
    earnBackAtRiskClubs: Number(eb.at_risk_clubs ?? 0),
    coachCommissionsPayable: round2(Number(cm.payable ?? 0)),
    refundExposure: round2(Number(rf.pending ?? 0)),
  };
}

// מדד ה־North Star וחישובים טהורים נוספים חיים ב־lib/metrics/calculations.ts
// כדי שניתן יהיה לבדוק אותם ביחידות בלי גישה למסד נתונים.
export { paidHoursPerActiveStationPerDay } from '@/lib/metrics/calculations';
