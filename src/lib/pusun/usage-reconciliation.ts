/**
 * זיהוי שימוש שאינו מוסבר בסשנים משולמים.
 *
 * ⚠ **למה דווקא סוללה.** פרוטוקול PUSUN מדווח שני דברים בלבד: אחוז סוללה
 * וקוד תקלה. אין בו מונה כדורים ואין מונה זמן ריצה. לכן `ballsFired`
 * שהאפליקציה שולחת סופר רק את מה שהיא עצמה פקדה — הוא עיוור לשימוש עוקף
 * ואינו יכול לשמש לזיהוי.
 *
 * הסוללה היא האות היחיד ששורד: היא מתרוקנת גם כשאיש מאיתנו אינו מסתכל,
 * והקריאה הבאה שלנו רואה את התוצאה המצטברת.
 *
 * ⚠ זו **הערכת תחתון**. שימוש עוקף אינו מדווח על עצמו, וקריאות מגיעות רק
 * כשטלפון מחובר. התוצאה אומרת "לפחות X% צריכה בלתי מוסברת", לא "בדיוק X".
 */

export interface BatteryReading {
  recordedAt: Date;
  batteryPct: number;
}

/** דקות שימוש משולם שנפלו בתוך חלון זמן */
export interface PaidUsageWindow {
  from: Date;
  to: Date;
  activeMinutes: number;
}

export interface DrainModel {
  /**
   * צריכה באחוזים לשעה כשהמכונה דולקת ואינה מגישה.
   * ⚠ ערך משוער. יש לכייל ממכונה שידוע שלא הייתה בשימוש.
   */
  standbyPctPerHour: number;
  /**
   * צריכה באחוזים לשעת הגשה בפועל.
   * ⚠ ערך משוער. יש לכייל מסשנים משולמים מבוקרים.
   */
  activePctPerHour: number;
  /**
   * סף רעש באחוזים. הסוללה מדווחת ברזולוציה של אחוז שלם, ולכן פערים
   * קטנים אינם מידע.
   */
  noiseFloorPct: number;
}

export const DEFAULT_DRAIN_MODEL: DrainModel = {
  standbyPctPerHour: 0.5,
  activePctPerHour: 12,
  noiseFloorPct: 3,
};

export interface ReconciliationInterval {
  from: Date;
  to: Date;
  elapsedHours: number;
  observedDropPct: number;
  paidActiveMinutes: number;
  expectedDropPct: number;
  unexplainedDropPct: number;
  /** שעות הגשה משוערות שהפער מייצג */
  unexplainedHours: number;
  flagged: boolean;
}

export interface ReconciliationResult {
  intervals: ReconciliationInterval[];
  totalUnexplainedHours: number;
  flaggedCount: number;
  /** מקטעים שנפסלו ולמה — שקיפות במקום השמטה שקטה */
  skipped: { from: Date; to: Date; reason: string }[];
}

function overlapMinutes(window: PaidUsageWindow, from: Date, to: Date): number {
  const start = Math.max(window.from.getTime(), from.getTime());
  const end = Math.min(window.to.getTime(), to.getTime());
  if (end <= start) return 0;
  // מייחס את הדקות באופן יחסי לחפיפה, ולא את כל הסשן למקטע
  const windowMs = window.to.getTime() - window.from.getTime();
  if (windowMs <= 0) return 0;
  return window.activeMinutes * ((end - start) / windowMs);
}

/**
 * משווה צריכת סוללה בפועל מול הצריכה שהסשנים המשולמים מסבירים.
 *
 * ⚠ מקטע שבו הסוללה עלתה נפסל: המכונה נטענה, ואי אפשר להסיק ממנו דבר.
 * ⚠ מקטע ארוך מדי נפסל: ככל שהחלון גדל, מודל הצריכה מצטבר לאי־ודאות
 *   שגדולה מהאות שמחפשים.
 */
export function reconcileUsage(
  readings: BatteryReading[],
  paidWindows: PaidUsageWindow[],
  model: DrainModel = DEFAULT_DRAIN_MODEL,
  maxIntervalHours = 24,
): ReconciliationResult {
  const sorted = [...readings].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const intervals: ReconciliationInterval[] = [];
  const skipped: { from: Date; to: Date; reason: string }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const elapsedHours = (b.recordedAt.getTime() - a.recordedAt.getTime()) / 3_600_000;

    if (elapsedHours <= 0) continue;

    if (b.batteryPct > a.batteryPct) {
      skipped.push({ from: a.recordedAt, to: b.recordedAt, reason: 'המכונה נטענה' });
      continue;
    }
    if (elapsedHours > maxIntervalHours) {
      skipped.push({
        from: a.recordedAt,
        to: b.recordedAt,
        reason: `מרווח של ${elapsedHours.toFixed(0)} שעות ארוך מכדי להסיק ממנו`,
      });
      continue;
    }

    const observedDropPct = a.batteryPct - b.batteryPct;
    const paidActiveMinutes = paidWindows.reduce(
      (sum, w) => sum + overlapMinutes(w, a.recordedAt, b.recordedAt),
      0,
    );

    const expectedDropPct =
      model.standbyPctPerHour * elapsedHours +
      model.activePctPerHour * (paidActiveMinutes / 60);

    const rawUnexplained = observedDropPct - expectedDropPct;
    const unexplainedDropPct = Math.max(0, rawUnexplained);
    const flagged = unexplainedDropPct > model.noiseFloorPct;

    intervals.push({
      from: a.recordedAt,
      to: b.recordedAt,
      elapsedHours,
      observedDropPct,
      paidActiveMinutes,
      expectedDropPct,
      unexplainedDropPct,
      unexplainedHours: unexplainedDropPct / model.activePctPerHour,
      flagged,
    });
  }

  const flaggedIntervals = intervals.filter((i) => i.flagged);
  return {
    intervals,
    // ⚠ נצבר רק ממקטעים שחצו את סף הרעש. צבירת רעש הייתה מייצרת
    // "שימוש בלתי מוסבר" מתוך אי־דיוק מדידה בלבד.
    totalUnexplainedHours: flaggedIntervals.reduce((s, i) => s + i.unexplainedHours, 0),
    flaggedCount: flaggedIntervals.length,
    skipped,
  };
}
