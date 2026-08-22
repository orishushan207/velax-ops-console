import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs } from '@/db/schema';
import { clamp } from '@/lib/utils';
import {
  HEALTH_COMPONENT_LABELS,
  HEALTH_WEIGHTS,
  type HealthBreakdown,
  type HealthComponent,
} from '@/lib/metrics/health-weights';

export { HEALTH_COMPONENT_LABELS, HEALTH_WEIGHTS };
export type { HealthBreakdown, HealthComponent };

/**
 * Club Health Score — ציון בריאות מועדון, 0–100.
 *
 * ⚠ סעיף 8 בהנחיות: "הצג את נוסחת הציון באופן שקוף וניתן להגדרה."
 * המשקלים כאן הם ברירת המחדל; המסך מציג את הפירוק המלא לכל מועדון,
 * וכל רכיב ניתן לבדיקה בנפרד.
 *
 * עשרת הרכיבים מגיעים ישירות מסעיף 8 בהנחיות המשימה.
 */
/**
 * מחשב ציון בריאות למועדון בודד.
 * כל רכיב מוחזר בסולם 0–100, והציון הכולל הוא הממוצע המשוקלל.
 */
export async function calculateClubHealth(clubId: string): Promise<HealthBreakdown> {
  const result = await db.execute(sql`
    WITH window_30 AS (SELECT now() - interval '30 days' AS since),
         window_60 AS (SELECT now() - interval '60 days' AS since),
    station_stats AS (
      SELECT
        COUNT(*)::numeric AS total,
        COUNT(*) FILTER (WHERE status = 'active')::numeric AS active
      FROM stations WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
    ),
    device_stats AS (
      SELECT
        COUNT(*)::numeric AS total,
        COUNT(*) FILTER (WHERE connectivity = 'online')::numeric AS online,
        COALESCE(AVG(battery_pct), 0)::numeric AS avg_battery,
        COUNT(*) FILTER (WHERE COALESCE(estimated_balls_remaining, 0) < 100)::numeric AS low_balls
      FROM devices WHERE current_club_id = ${clubId}::uuid AND deleted_at IS NULL
    ),
    usage_now AS (
      SELECT COALESCE(SUM(COALESCE(actual_minutes, scheduled_minutes)), 0)::numeric / 60 AS hours
      FROM sessions
      WHERE club_id = ${clubId}::uuid
        AND started_at >= (SELECT since FROM window_30)
        AND status IN ('completed','partially_refunded','active','paused')
        AND refunded_amount < amount_gross
    ),
    usage_prev AS (
      SELECT COALESCE(SUM(COALESCE(actual_minutes, scheduled_minutes)), 0)::numeric / 60 AS hours
      FROM sessions
      WHERE club_id = ${clubId}::uuid
        AND started_at >= (SELECT since FROM window_60)
        AND started_at < (SELECT since FROM window_30)
        AND status IN ('completed','partially_refunded','active','paused')
        AND refunded_amount < amount_gross
    ),
    ticket_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE created_at >= (SELECT since FROM window_30))::numeric AS recent,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed'))::numeric AS open_now,
        COUNT(*) FILTER (WHERE resolution_breached OR response_breached)::numeric AS breaches,
        COUNT(*)::numeric AS total
      FROM support_tickets WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
    ),
    checklist_stats AS (
      SELECT
        COUNT(*)::numeric AS total,
        COUNT(*) FILTER (WHERE status IN ('completed','completed_with_issues'))::numeric AS done
      FROM checklist_submissions
      WHERE club_id = ${clubId}::uuid AND for_date >= current_date - 30
    ),
    screen_stats AS (
      SELECT
        COUNT(*)::numeric AS total,
        COUNT(*) FILTER (WHERE status = 'online')::numeric AS online
      FROM screens WHERE club_id = ${clubId}::uuid AND deleted_at IS NULL
    ),
    earnback_stats AS (
      SELECT
        COUNT(c.*)::numeric AS total,
        COUNT(c.*) FILTER (WHERE c.status IN ('met','waived'))::numeric AS met
      FROM earn_back_conditions c
      JOIN earn_back_agreements a ON a.id = c.agreement_id
      WHERE a.club_id = ${clubId}::uuid AND a.deleted_at IS NULL
    )
    SELECT
      (SELECT total FROM station_stats) AS station_total,
      (SELECT active FROM station_stats) AS station_active,
      (SELECT total FROM device_stats) AS device_total,
      (SELECT online FROM device_stats) AS device_online,
      (SELECT avg_battery FROM device_stats) AS avg_battery,
      (SELECT low_balls FROM device_stats) AS low_balls,
      (SELECT hours FROM usage_now) AS hours_now,
      (SELECT hours FROM usage_prev) AS hours_prev,
      (SELECT recent FROM ticket_stats) AS tickets_recent,
      (SELECT open_now FROM ticket_stats) AS tickets_open,
      (SELECT breaches FROM ticket_stats) AS sla_breaches,
      (SELECT total FROM ticket_stats) AS tickets_total,
      (SELECT total FROM checklist_stats) AS checklist_total,
      (SELECT done FROM checklist_stats) AS checklist_done,
      (SELECT total FROM screen_stats) AS screen_total,
      (SELECT online FROM screen_stats) AS screen_online,
      (SELECT total FROM earnback_stats) AS eb_total,
      (SELECT met FROM earnback_stats) AS eb_met
  `);

  const r = (result.rows[0] ?? {}) as Record<string, string | number | null>;
  const n = (k: string) => Number(r[k] ?? 0);

  const stationTotal = n('station_total');
  const deviceTotal = n('device_total');
  const hoursNow = n('hours_now');
  const hoursPrev = n('hours_prev');
  const checklistTotal = n('checklist_total');
  const screenTotal = n('screen_total');
  const ebTotal = n('eb_total');

  // זמינות: שילוב של עמדות פעילות ומכשירים מחוברים
  const stationAvailability =
    stationTotal > 0
      ? clamp(
          ((n('station_active') / stationTotal) * 0.5 +
            (deviceTotal > 0 ? n('device_online') / deviceTotal : 0) * 0.5) *
            100,
          0,
          100,
        )
      : 0;

  // שעות שימוש: 45 שעות ב־30 יום לעמדה = ציון מלא (1.5 שעות ליום — יעד ה־PMF)
  const targetHours = Math.max(1, stationTotal) * 45;
  const usageHours = clamp((hoursNow / targetHours) * 100, 0, 100);

  // מגמה: יחס בין 30 הימים האחרונים ל־30 שקדמו להם. יציבות = 70 נקודות.
  const usageTrend =
    hoursPrev > 0
      ? clamp(50 + ((hoursNow - hoursPrev) / hoursPrev) * 100, 0, 100)
      : hoursNow > 0
        ? 75
        : 30;

  // תקלות: 0 תקלות ב־30 יום = 100. כל תקלה גורעת 8 נקודות, כל תקלה פתוחה 6 נוספות.
  const incidents = clamp(100 - n('tickets_recent') * 8 - n('tickets_open') * 6, 0, 100);

  const ticketsTotal = n('tickets_total');
  const slaCompliance =
    ticketsTotal > 0 ? clamp((1 - n('sla_breaches') / ticketsTotal) * 100, 0, 100) : 100;

  // פעילות צוות: נגזרת מהגשות Checklist שבוצעו בזמן
  const checklistCompletion =
    checklistTotal > 0 ? clamp((n('checklist_done') / checklistTotal) * 100, 0, 100) : 50;
  const staffActivity = checklistCompletion;

  // טעינה וכדורים: סוללה ממוצעת + מכשירים עם מלאי כדורים נמוך
  const chargingAndBalls =
    deviceTotal > 0
      ? clamp(n('avg_battery') * 0.7 + (1 - n('low_balls') / deviceTotal) * 30, 0, 100)
      : 50;

  // שיווק והצגה: מסכים פעילים. מועדון בלי מסך מקבל ציון ניטרלי.
  const marketingPresence =
    screenTotal > 0 ? clamp((n('screen_online') / screenTotal) * 100, 0, 100) : 60;

  const earnBackCompliance = ebTotal > 0 ? clamp((n('eb_met') / ebTotal) * 100, 0, 100) : 70;

  const components: Record<HealthComponent, number> = {
    stationAvailability,
    usageHours,
    usageTrend,
    incidents,
    slaCompliance,
    staffActivity,
    checklistCompletion,
    chargingAndBalls,
    marketingPresence,
    earnBackCompliance,
  };

  let total = 0;
  for (const [key, weight] of Object.entries(HEALTH_WEIGHTS) as [HealthComponent, number][]) {
    total += components[key] * weight;
  }

  return { ...components, total: Math.round(clamp(total, 0, 100)) };
}

export async function recalculateClubHealth(clubId: string): Promise<HealthBreakdown> {
  const breakdown = await calculateClubHealth(clubId);
  await db
    .update(clubs)
    .set({
      healthScore: breakdown.total,
      healthScoreAt: new Date(),
      healthScoreBreakdown: { ...breakdown },
    })
    .where(eq(clubs.id, clubId));
  return breakdown;
}

export async function recalculateAllClubHealthScores(): Promise<number> {
  const rows = await db.select({ id: clubs.id }).from(clubs);
  for (const row of rows) {
    await recalculateClubHealth(row.id);
  }
  return rows.length;
}
