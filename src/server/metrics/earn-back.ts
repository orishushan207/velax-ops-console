import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { CurrentUser } from '@/server/auth/session';
import { clubScopeSql } from '@/server/queries/sessions';

/**
 * מנוע Earn-Back — סעיף 15 בהנחיות.
 *
 * ⚠ הכלל המרכזי: "אין לחשב Earn-Back רק לפי Sessions."
 * ההכנסה שנספרת היא הכנסת המגרש של המועדון, ולא ההכנסה של VELA-X,
 * ורק החלק שסווג או שוקלל כאינקרמנטלי נספר בפועל.
 *
 * ארבע שכבות ההכנסה:
 *   Session Revenue        — מה ששולם ל־VELA-X.  ❌ לא נספר
 *   Machine-Linked Booking — הזמנת מגרש עם session_id.  ✅ בסיס החישוב
 *   Incremental            — אומתה כהכנסה שלא הייתה קיימת.  ✅ נספרת במלואה
 *   Baseline               — הייתה מתקיימת בכל מקרה.  ❌ לא נספרת
 */

export interface EarnBackRow {
  id: string;
  clubId: string;
  clubName: string;
  status: string;
  entryPrice: number;
  startsOn: string;
  endsOn: string;
  operatingDaysInPeriod: number;
  courtRevenuePerHourNet: number;
  requiredHours: number;
  requiredHoursPerDay: number;
  incrementalityFactor: number;
  clubBallCostPerHour: number;
  exposureCap: number | null;
  achievedHours: number;
  verifiedRevenue: number;
  remainingGap: number;
  requiredRunRatePerDay: number;
  forecastRevenue: number;
  forecastWillMeet: boolean | null;
  progressPct: number;
  /** ימים שנותרו בתקופת הערבות */
  daysRemaining: number;
  /** כמה תנאי סף לא מתקיימים */
  conditionsNotMet: number;
  conditionsTotal: number;
  /** חשיפה כספית בפועל, מוגבלת בתקרה */
  exposure: number;
}

export async function listEarnBackAgreements(user: CurrentUser): Promise<EarnBackRow[]> {
  const rows = await db.execute(sql`
    SELECT
      a.*, c.name AS club_name,
      (SELECT COUNT(*)::int FROM earn_back_conditions ec
        WHERE ec.agreement_id = a.id) AS conditions_total,
      (SELECT COUNT(*)::int FROM earn_back_conditions ec
        WHERE ec.agreement_id = a.id AND ec.status = 'not_met') AS conditions_not_met
    FROM earn_back_agreements a
    JOIN clubs c ON c.id = a.club_id
    WHERE a.deleted_at IS NULL AND ${clubScopeSql(user, 'a.club_id')}
    ORDER BY
      CASE a.status WHEN 'at_risk' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
      a.ends_on
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const entryPrice = round2(Number(row.entry_price ?? 0));
    const verified = round2(Number(row.verified_revenue ?? 0));
    const cap = row.exposure_cap === null ? null : round2(Number(row.exposure_cap));
    const rawExposure = Math.max(0, entryPrice - verified);
    const endsOn = new Date(String(row.ends_on));
    return {
      id: String(row.id),
      clubId: String(row.club_id),
      clubName: String(row.club_name),
      status: String(row.status),
      entryPrice,
      startsOn: String(row.starts_on),
      endsOn: String(row.ends_on),
      operatingDaysInPeriod: Number(row.operating_days_in_period ?? 156),
      courtRevenuePerHourNet: round2(Number(row.court_revenue_per_hour_net ?? 0)),
      requiredHours: round2(Number(row.required_hours ?? 0)),
      requiredHoursPerDay: Number(Number(row.required_hours_per_day ?? 0).toFixed(3)),
      incrementalityFactor: Number(row.incrementality_factor ?? 0.7),
      clubBallCostPerHour: round2(Number(row.club_ball_cost_per_hour ?? 0)),
      exposureCap: cap,
      achievedHours: round2(Number(row.achieved_hours ?? 0)),
      verifiedRevenue: verified,
      remainingGap: round2(Number(row.remaining_gap ?? 0)),
      requiredRunRatePerDay: Number(Number(row.required_run_rate_per_day ?? 0).toFixed(3)),
      forecastRevenue: round2(Number(row.forecast_revenue ?? 0)),
      forecastWillMeet: row.forecast_will_meet === null ? null : Boolean(row.forecast_will_meet),
      progressPct: entryPrice > 0 ? Math.min(1, verified / entryPrice) : 0,
      daysRemaining: Math.max(
        0,
        Math.ceil((endsOn.getTime() - Date.now()) / 86_400_000),
      ),
      conditionsTotal: Number(row.conditions_total ?? 0),
      conditionsNotMet: Number(row.conditions_not_met ?? 0),
      exposure: cap === null ? round2(rawExposure) : round2(Math.min(rawExposure, cap)),
    };
  });
}

export interface EarnBackPortfolio {
  totalAgreements: number;
  activeAgreements: number;
  atRiskAgreements: number;
  metAgreements: number;
  totalEntryPrice: number;
  totalVerifiedRevenue: number;
  totalExposure: number;
  /** רזרבה שיש להחזיק לפי אחוז ההפרשה */
  requiredReserve: number;
  /** תרחיש הרעה: כל המועדונים הפעילים נכשלים בו-זמנית */
  worstCaseExposure: number;
}

export async function getEarnBackPortfolio(user: CurrentUser): Promise<EarnBackPortfolio> {
  const agreements = await listEarnBackAgreements(user);

  const active = agreements.filter((a) => a.status === 'active' || a.status === 'at_risk');
  const totalEntryPrice = round2(agreements.reduce((s, a) => s + a.entryPrice, 0));
  const totalVerified = round2(agreements.reduce((s, a) => s + a.verifiedRevenue, 0));
  const totalExposure = round2(active.reduce((s, a) => s + a.exposure, 0));

  const reserveRows = await db.execute(sql`
    SELECT COALESCE(AVG(reserve_pct), 0.125)::numeric AS avg_reserve
    FROM earn_back_agreements WHERE deleted_at IS NULL
  `);
  const reservePct = Number(
    (reserveRows.rows[0] as Record<string, string>)?.avg_reserve ?? 0.125,
  );

  return {
    totalAgreements: agreements.length,
    activeAgreements: agreements.filter((a) => a.status === 'active').length,
    atRiskAgreements: agreements.filter((a) => a.status === 'at_risk').length,
    metAgreements: agreements.filter((a) => a.status === 'met').length,
    totalEntryPrice,
    totalVerifiedRevenue: totalVerified,
    totalExposure,
    requiredReserve: round2(totalEntryPrice * reservePct),
    // תרחיש קיצון: המודל מזהיר שהסיכון מתואם — אם הביקוש חלש,
    // כל המועדונים נכשלים באותו רגע. זו אינה חשיפה מפוזרת.
    worstCaseExposure: round2(
      active.reduce((s, a) => s + (a.exposureCap ?? a.entryPrice), 0),
    ),
  };
}

export async function getEarnBackDetail(agreementId: string, user: CurrentUser) {
  const rows = await db.execute(sql`
    SELECT a.*, c.name AS club_name, c.code AS club_code, ct.contract_number
    FROM earn_back_agreements a
    JOIN clubs c ON c.id = a.club_id
    LEFT JOIN club_contracts ct ON ct.id = a.contract_id
    WHERE a.id = ${agreementId}::uuid AND a.deleted_at IS NULL
      AND ${clubScopeSql(user, 'a.club_id')}
    LIMIT 1
  `);
  const agreement = rows.rows[0] as Record<string, unknown> | undefined;
  if (!agreement) return null;

  const [conditions, measurements, adjustments, bookingBreakdown] = await Promise.all([
    db.execute(sql`
      SELECT ec.*, u.full_name AS waived_by_name FROM earn_back_conditions ec
      LEFT JOIN users u ON u.id = ec.waived_by
      WHERE ec.agreement_id = ${agreementId}::uuid ORDER BY ec.condition_key
    `),
    db.execute(sql`
      SELECT * FROM earn_back_measurements WHERE agreement_id = ${agreementId}::uuid
      ORDER BY period_start
    `),
    db.execute(sql`
      SELECT ea.*, u.full_name AS approved_by_name FROM earn_back_adjustments ea
      LEFT JOIN users u ON u.id = ea.approved_by
      WHERE ea.agreement_id = ${agreementId}::uuid ORDER BY ea.approved_at DESC
    `),
    db.execute(sql`
      SELECT b.link_type,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.revenue_net), 0)::numeric AS revenue,
        COALESCE(SUM(b.duration_minutes), 0)::int AS minutes
      FROM court_bookings b
      WHERE b.club_id = ${String(agreement.club_id)}::uuid
        AND b.starts_at >= ${String(agreement.starts_on)}::date
        AND b.starts_at < ${String(agreement.ends_on)}::date
        AND b.is_cancelled = false AND b.deleted_at IS NULL
      GROUP BY 1
    `),
  ]);

  return {
    agreement,
    conditions: conditions.rows as Record<string, unknown>[],
    measurements: measurements.rows as Record<string, unknown>[],
    adjustments: adjustments.rows as Record<string, unknown>[],
    bookingBreakdown: bookingBreakdown.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        linkType: String(row.link_type),
        count: Number(row.count ?? 0),
        revenue: round2(Number(row.revenue ?? 0)),
        minutes: Number(row.minutes ?? 0),
      };
    }),
  };
}

/**
 * מריץ מחדש את חישוב ה־Earn-Back להסכם, מהזמנות המגרש בפועל.
 * מחזיר את התוצאה בלי לשמור — הפעולה השומרת יושבת ב־actions/earn-back.ts.
 */
export async function computeEarnBack(agreementId: string) {
  const rows = await db.execute(sql`
    SELECT a.* FROM earn_back_agreements a WHERE a.id = ${agreementId}::uuid LIMIT 1
  `);
  const a = rows.rows[0] as Record<string, unknown> | undefined;
  if (!a) return null;

  const entryPrice = Number(a.entry_price ?? 0);
  const courtRate = Number(a.court_revenue_per_hour_net ?? 90);
  const factor = Number(a.incrementality_factor ?? 0.7);
  const ballCost = Number(a.club_ball_cost_per_hour ?? 0);
  const operatingDays = Number(a.operating_days_in_period ?? 156);
  const startsOn = new Date(String(a.starts_on));
  const endsOn = new Date(String(a.ends_on));

  const revRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'incremental'), 0)::numeric AS incremental,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'machine_linked'), 0)::numeric AS linked,
      COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'baseline'), 0)::numeric AS baseline,
      COALESCE(SUM(b.duration_minutes) FILTER (WHERE b.session_id IS NOT NULL), 0)::numeric AS linked_minutes
    FROM court_bookings b
    WHERE b.club_id = ${String(a.club_id)}::uuid
      AND b.starts_at >= ${String(a.starts_on)}::date
      AND b.starts_at < ${String(a.ends_on)}::date
      AND b.is_cancelled = false AND b.deleted_at IS NULL
  `);
  const rev = (revRows.rows[0] ?? {}) as Record<string, string>;

  const incremental = Number(rev.incremental ?? 0);
  const linked = Number(rev.linked ?? 0);
  const achievedHours = round2(Number(rev.linked_minutes ?? 0) / 60);

  // ההכנסה שנספרת: מה שסווג במפורש כאינקרמנטלי, ועוד המקדם על מה שטרם סווג
  const countedRevenue = round2(incremental + linked * factor);

  // התאמות ידניות מאושרות
  const adjRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE adjustment_type = 'revenue_credit'), 0)::numeric AS credits,
      COALESCE(SUM(amount) FILTER (WHERE adjustment_type = 'revenue_debit'), 0)::numeric AS debits,
      COALESCE(SUM(days) FILTER (WHERE adjustment_type = 'period_extension'), 0)::int AS extra_days
    FROM earn_back_adjustments WHERE agreement_id = ${agreementId}::uuid
  `);
  const adj = (adjRows.rows[0] ?? {}) as Record<string, string>;
  const adjustedRevenue = round2(
    countedRevenue + Number(adj.credits ?? 0) - Number(adj.debits ?? 0),
  );
  const extraDays = Number(adj.extra_days ?? 0);

  const effectiveEnd = new Date(endsOn.getTime() + extraDays * 86_400_000);
  const totalCalendarDays = Math.max(
    1,
    Math.round((effectiveEnd.getTime() - startsOn.getTime()) / 86_400_000),
  );
  const elapsedCalendarDays = Math.max(
    0,
    Math.min(totalCalendarDays, Math.round((Date.now() - startsOn.getTime()) / 86_400_000)),
  );
  // המרת ימים קלנדריים לימי פעילות
  const elapsedOperatingDays = Math.max(
    1,
    Math.round((elapsedCalendarDays / totalCalendarDays) * operatingDays),
  );
  const remainingOperatingDays = Math.max(0, operatingDays - elapsedOperatingDays);

  const remainingGap = round2(Math.max(0, entryPrice - adjustedRevenue));
  const actualDailyRevenue = adjustedRevenue / elapsedOperatingDays;
  const forecastRevenue = round2(
    adjustedRevenue + actualDailyRevenue * remainingOperatingDays,
  );
  const requiredRunRatePerDay =
    remainingOperatingDays > 0 ? round2(remainingGap / remainingOperatingDays / courtRate) : 0;
  const actualRunRatePerDay = round2(actualDailyRevenue / courtRate);

  const willMeet = forecastRevenue >= entryPrice;

  // בדיקת תנאי סף
  const condRows = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status = 'not_met')::int AS not_met
    FROM earn_back_conditions WHERE agreement_id = ${agreementId}::uuid
  `);
  const conditionsNotMet = Number(
    (condRows.rows[0] as Record<string, number>)?.not_met ?? 0,
  );

  const status: 'met' | 'active' | 'at_risk' | 'breached_by_club' =
    conditionsNotMet > 0 && remainingOperatingDays === 0
      ? 'breached_by_club'
      : adjustedRevenue >= entryPrice
        ? 'met'
        : willMeet
          ? 'active'
          : 'at_risk';

  return {
    entryPrice,
    countedRevenue: adjustedRevenue,
    rawCountedRevenue: countedRevenue,
    incrementalRevenue: round2(incremental),
    machineLinkedRevenue: round2(linked + incremental),
    baselineRevenue: round2(Number(rev.baseline ?? 0)),
    achievedHours,
    requiredHours: round2(entryPrice / courtRate),
    remainingGap,
    requiredRunRatePerDay,
    actualRunRatePerDay,
    forecastRevenue,
    willMeet,
    status,
    elapsedOperatingDays,
    remainingOperatingDays,
    extraDays,
    clubBallCostTotal: round2(achievedHours * ballCost),
    netClubBenefit: round2(adjustedRevenue - achievedHours * ballCost),
    conditionsNotMet,
  };
}
