import { round2 } from '@/lib/money';

/**
 * חישובי מדדים טהורים — ללא גישה למסד נתונים.
 *
 * הפרדה זו מכוונת: היא מאפשרת לבדוק את הלוגיקה העסקית ביחידות בלי
 * להרים מסד נתונים, ומונעת מצב שבו נוסחת מדד "מתחבאת" בתוך שאילתה.
 */

/**
 * מדד ה־North Star: שעות אימון בתשלום לעמדה פעילה ליום.
 *
 * ⚠ מחזיר null — ולא 0 — כשאין עמדות פעילות או ימים בתקופה.
 * אפס היה נראה כמו ביצוע גרוע; null אומר "אין בסיס לחישוב".
 */
export function paidHoursPerActiveStationPerDay(
  totalPaidHours: number,
  activeStations: number,
  days: number,
): number | null {
  if (activeStations <= 0 || days <= 0) return null;
  return round2(totalPaidHours / (activeStations * days));
}

/** שיעור זמינות: זמן זמין בפועל חלקי זמן שהעמדה אמורה הייתה להיות זמינה */
export function uptimeRatio(
  plannedMinutes: number,
  downtimeMinutes: number,
): number | null {
  if (plannedMinutes <= 0) return null;
  return Math.max(0, Math.min(1, 1 - downtimeMinutes / plannedMinutes));
}

/** Start Success: סשנים שהתחילו ללא עזרת צוות חלקי כל הסשנים ששולמו */
export function startSuccessRate(
  cleanStarts: number,
  paidSessions: number,
): number | null {
  if (paidSessions <= 0) return null;
  return cleanStarts / paidSessions;
}

/**
 * הכנסה אינקרמנטלית ל־Earn-Back.
 *
 * הזמנות שסווגו ידנית כאינקרמנטליות נספרות במלואן.
 * הזמנות מקושרות שטרם סווגו משוקללות במקדם האינקרמנטליות.
 * הזמנות שסווגו כבסיסיות אינן נספרות כלל.
 */
export function countedEarnBackRevenue(
  explicitIncremental: number,
  unclassifiedLinked: number,
  incrementalityFactor: number,
): number {
  return round2(explicitIncremental + unclassifiedLinked * incrementalityFactor);
}

/** קצב יומי נדרש כדי לסגור פער עד סוף התקופה */
export function requiredDailyRunRate(
  remainingGap: number,
  remainingDays: number,
  revenuePerHour: number,
): number {
  if (remainingDays <= 0 || revenuePerHour <= 0) return 0;
  return round2(remainingGap / remainingDays / revenuePerHour);
}

/** תחזית הכנסה לסוף התקופה, לפי הקצב שנצבר עד כה */
export function forecastRevenue(
  achievedRevenue: number,
  elapsedDays: number,
  remainingDays: number,
): number {
  if (elapsedDays <= 0) return achievedRevenue;
  const dailyRate = achievedRevenue / elapsedDays;
  return round2(achievedRevenue + dailyRate * remainingDays);
}
