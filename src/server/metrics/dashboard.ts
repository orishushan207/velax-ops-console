import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';
import type { MetricScope } from './kpis';

/**
 * סדרות ותצוגות לגרפים בדשבורד.
 * כל סדרה נבנית משאילתה אחת מצטברת — לא לולאה של שאילתות ליום.
 */

function clubScopeSql(clubIds: string[] | null | undefined, column = 's.club_id') {
  if (!clubIds) return sql`TRUE`;
  if (clubIds.length === 0) return sql`FALSE`;
  return sql`${sql.raw(column)} IN (${sql.join(clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

const PAID = sql`
  s.status IN ('active','paused','completed','partially_refunded')
  AND s.amount_gross > 0 AND s.refunded_amount < s.amount_gross AND s.deleted_at IS NULL
`;

export interface TimePoint {
  label: string;
  date: string;
  revenue: number;
  hours: number;
  sessions: number;
  /** מאפשר העברה ישירה לרכיבי הגרפים, שמצפים למפתחות דינמיים */
  [key: string]: string | number;
}

/** הכנסות ושעות שימוש לאורך זמן */
export async function getRevenueTimeSeries(scope: MetricScope): Promise<TimePoint[]> {
  const { from, to } = scope.range;
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  // מעל 70 יום — קיבוץ שבועי, כדי שהגרף יישאר קריא
  const bucket = days > 70 ? 'week' : 'day';

  const rows = await db.execute(sql`
    SELECT
      date_trunc(${bucket}, s.started_at AT TIME ZONE 'Asia/Jerusalem') AS bucket,
      COALESCE(SUM(s.amount_net - (s.refunded_amount / (1 + s.vat_rate_applied))), 0)::numeric AS revenue,
      COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric / 60 AS hours,
      COUNT(*)::int AS sessions
    FROM sessions s
    WHERE s.started_at >= ${from} AND s.started_at < ${to}
      AND ${PAID} AND ${clubScopeSql(scope.clubIds)}
    GROUP BY 1 ORDER BY 1
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, string>;
    const d = new Date(row.bucket as string);
    return {
      date: d.toISOString(),
      label: new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Jerusalem',
      }).format(d),
      revenue: round2(Number(row.revenue ?? 0)),
      hours: round2(Number(row.hours ?? 0)),
      sessions: Number(row.sessions ?? 0),
    };
  });
}

/** שימוש לפי שעה ביום ויום בשבוע — Heatmap */
export async function getUsageHeatmap(scope: MetricScope) {
  const { from, to } = scope.range;
  const rows = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM s.started_at AT TIME ZONE 'Asia/Jerusalem')::int AS dow,
      EXTRACT(HOUR FROM s.started_at AT TIME ZONE 'Asia/Jerusalem')::int AS hour,
      COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric / 60 AS hours
    FROM sessions s
    WHERE s.started_at >= ${from} AND s.started_at < ${to}
      AND ${PAID} AND ${clubScopeSql(scope.clubIds)}
    GROUP BY 1, 2
  `);

  // 7 ימים × שעות 6..23
  const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
  const grid: number[][] = Array.from({ length: 7 }, () => HOURS.map(() => 0));

  for (const r of rows.rows as Record<string, number>[]) {
    const dow = Number(r.dow);
    const hourIndex = HOURS.indexOf(Number(r.hour));
    if (hourIndex >= 0 && grid[dow]) grid[dow]![hourIndex] = round2(Number(r.hours));
  }

  return {
    rows: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    columns: HOURS.map((h) => String(h).padStart(2, '0')),
    values: grid,
  };
}

export interface ClubPerformanceRow {
  clubId: string;
  clubName: string;
  region: string;
  paidHours: number;
  netRevenue: number;
  sessions: number;
  activeStations: number;
  hoursPerStationPerDay: number | null;
  healthScore: number | null;
  openTickets: number;
}

/** ביצועי מועדונים בהשוואה */
export async function getClubPerformance(scope: MetricScope): Promise<ClubPerformanceRow[]> {
  const { from, to } = scope.range;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.region, c.health_score,
      COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)) FILTER (WHERE ${PAID}), 0)::numeric / 60 AS paid_hours,
      COALESCE(SUM(s.amount_net - (s.refunded_amount / (1 + s.vat_rate_applied))) FILTER (WHERE ${PAID}), 0)::numeric AS net_revenue,
      COUNT(s.id) FILTER (WHERE ${PAID})::int AS sessions,
      (SELECT COUNT(*)::int FROM stations st WHERE st.club_id = c.id AND st.status = 'active' AND st.deleted_at IS NULL) AS active_stations,
      (SELECT COUNT(*)::int FROM support_tickets t WHERE t.club_id = c.id AND t.status NOT IN ('resolved','closed') AND t.deleted_at IS NULL) AS open_tickets
    FROM clubs c
    LEFT JOIN sessions s ON s.club_id = c.id AND s.started_at >= ${from} AND s.started_at < ${to}
    WHERE c.deleted_at IS NULL AND ${clubScopeSql(scope.clubIds, 'c.id')}
    GROUP BY c.id, c.name, c.region, c.health_score
    ORDER BY paid_hours DESC
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, string | number | null>;
    const paidHours = round2(Number(row.paid_hours ?? 0));
    const activeStations = Number(row.active_stations ?? 0);
    return {
      clubId: String(row.id),
      clubName: String(row.name),
      region: String(row.region),
      paidHours,
      netRevenue: round2(Number(row.net_revenue ?? 0)),
      sessions: Number(row.sessions ?? 0),
      activeStations,
      hoursPerStationPerDay:
        activeStations > 0 ? round2(paidHours / (activeStations * days)) : null,
      healthScore: row.health_score === null ? null : Number(row.health_score),
      openTickets: Number(row.open_tickets ?? 0),
    };
  });
}

/**
 * Funnel: סריקה ← תשלום ← התחלת Session ← סיום מוצלח ← חזרה.
 *
 * "סריקה" נגזרת מיצירת סשן ב־draft — זו הנקודה הראשונה שהמערכת רואה.
 * אין מדידת סריקות שלא הבשילו לסשן; זה דורש אירוע ייעודי מהאפליקציה
 * שטרם קיים, ולכן השלב מסומן בהערה במסך.
 */
export async function getConversionFunnel(scope: MetricScope) {
  const { from, to } = scope.range;
  const rows = await db.execute(sql`
    WITH in_range AS (
      SELECT s.* FROM sessions s
      WHERE s.created_at >= ${from} AND s.created_at < ${to}
        AND s.deleted_at IS NULL AND ${clubScopeSql(scope.clubIds)}
    )
    SELECT
      COUNT(*)::int AS created,
      COUNT(*) FILTER (WHERE amount_gross > 0)::int AS paid,
      COUNT(*) FILTER (WHERE started_at IS NOT NULL)::int AS started,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(DISTINCT COALESCE(user_id::text, guest_phone)) FILTER (
        WHERE status = 'completed'
      )::int AS unique_completers
    FROM in_range
  `);

  const r = (rows.rows[0] ?? {}) as Record<string, number>;

  // "חזרה" = משתמשים שהשלימו סשן בתקופה ויש להם סשן קודם
  const returning = await db.execute(sql`
    WITH identities AS (
      SELECT COALESCE(s.user_id::text, s.guest_phone) AS identity, s.started_at
      FROM sessions s WHERE ${PAID} AND s.started_at IS NOT NULL
        AND ${clubScopeSql(scope.clubIds)}
    )
    SELECT COUNT(DISTINCT i.identity)::int AS returning_users
    FROM identities i
    WHERE i.started_at >= ${from} AND i.started_at < ${to}
      AND EXISTS (
        SELECT 1 FROM identities p WHERE p.identity = i.identity AND p.started_at < ${from}
      )
  `);

  const ret = (returning.rows[0] ?? {}) as Record<string, number>;

  return [
    { label: 'סשן נפתח', value: Number(r.created ?? 0) },
    { label: 'תשלום נקלט', value: Number(r.paid ?? 0) },
    { label: 'האימון התחיל', value: Number(r.started ?? 0) },
    { label: 'הושלם בהצלחה', value: Number(r.completed ?? 0) },
    { label: 'משתמשים חוזרים', value: Number(ret.returning_users ?? 0) },
  ];
}

/** Retention Cohorts לפי חודש הצטרפות */
export async function getRetentionCohorts(scope: MetricScope) {
  const rows = await db.execute(sql`
    WITH identities AS (
      SELECT COALESCE(s.user_id::text, s.guest_phone) AS identity, s.started_at
      FROM sessions s
      WHERE ${PAID} AND s.started_at IS NOT NULL
        AND COALESCE(s.user_id::text, s.guest_phone) IS NOT NULL
        AND ${clubScopeSql(scope.clubIds)}
    ),
    firsts AS (
      SELECT identity, MIN(started_at) AS first_at FROM identities GROUP BY identity
    )
    SELECT
      to_char(date_trunc('month', f.first_at), 'YYYY-MM') AS cohort,
      COUNT(*)::int AS cohort_size,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = f.identity
          AND i.started_at > f.first_at AND i.started_at <= f.first_at + interval '7 days'
      ))::int AS d7,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = f.identity
          AND i.started_at > f.first_at AND i.started_at <= f.first_at + interval '30 days'
      ))::int AS d30,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM identities i WHERE i.identity = f.identity
          AND i.started_at > f.first_at AND i.started_at <= f.first_at + interval '90 days'
      ))::int AS d90
    FROM firsts f
    GROUP BY 1 ORDER BY 1
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, string | number>;
    const size = Number(row.cohort_size ?? 0);
    return {
      cohort: String(row.cohort),
      size,
      d7: size > 0 ? Number(row.d7) / size : 0,
      d30: size > 0 ? Number(row.d30) / size : 0,
      d90: size > 0 ? Number(row.d90) / size : 0,
    };
  });
}

/** התפלגות תקלות לפי קטגוריה */
export async function getTicketDistribution(scope: MetricScope) {
  const { from, to } = scope.range;
  const rows = await db.execute(sql`
    SELECT t.category, COUNT(*)::int AS count
    FROM support_tickets t
    WHERE t.created_at >= ${from} AND t.created_at < ${to} AND t.deleted_at IS NULL
      AND ${clubScopeSql(scope.clubIds, 't.club_id')}
    GROUP BY 1 ORDER BY count DESC LIMIT 8
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, string | number>;
    return { category: String(row.category), count: Number(row.count) };
  });
}

/** הכנסות מול עלויות משתנות לאורך זמן */
export async function getRevenueVsCost(scope: MetricScope, variableCostPerHour: number) {
  const series = await getRevenueTimeSeries(scope);
  return series.map((p) => ({
    label: p.label,
    revenue: p.revenue,
    variableCost: round2(p.hours * variableCostPerHour),
    contribution: round2(p.revenue - p.hours * variableCostPerHour),
  }));
}

/** ביצועים לפי רמת שחקן ותוכנית אימון */
export async function getPerformanceByLevel(scope: MetricScope) {
  const { from, to } = scope.range;
  const rows = await db.execute(sql`
    SELECT
      COALESCE(s.level::text, 'לא צוין') AS level,
      COUNT(*)::int AS sessions,
      COALESCE(AVG(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric AS avg_minutes,
      COALESCE(SUM(s.amount_net), 0)::numeric AS net_revenue
    FROM sessions s
    WHERE s.started_at >= ${from} AND s.started_at < ${to}
      AND ${PAID} AND ${clubScopeSql(scope.clubIds)}
    GROUP BY 1 ORDER BY 1
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, string | number>;
    return {
      level: String(row.level),
      sessions: Number(row.sessions),
      avgMinutes: Math.round(Number(row.avg_minutes)),
      netRevenue: round2(Number(row.net_revenue)),
    };
  });
}
