import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRAIN_MODEL,
  reconcileUsage,
  type BatteryReading,
  type PaidUsageWindow,
} from '@/lib/pusun/usage-reconciliation';

const at = (hoursFromNow: number) => new Date(Date.UTC(2026, 7, 22, 8) + hoursFromNow * 3_600_000);

describe('התאמת שימוש מול צריכת סוללה', () => {
  it('סשן משולם שמסביר את הצריכה אינו מסומן', () => {
    // שעה אחת של הגשה ≈ 12% + 0.5% standby
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 90 },
      { recordedAt: at(1), batteryPct: 78 },
    ];
    const paid: PaidUsageWindow[] = [{ from: at(0), to: at(1), activeMinutes: 60 }];

    const result = reconcileUsage(readings, paid);
    expect(result.flaggedCount).toBe(0);
    expect(result.totalUnexplainedHours).toBe(0);
  });

  it('צריכה גדולה בלי סשן משולם מסומנת', () => {
    // ⚠ זה בדיוק תרחיש העקיפה: המכונה עבדה, אף אחד לא שילם
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 90 },
      { recordedAt: at(2), batteryPct: 66 },
    ];
    const result = reconcileUsage(readings, []);

    expect(result.flaggedCount).toBe(1);
    // 24% ירידה, מהם 1% standby → ~23% ≈ 1.9 שעות הגשה
    expect(result.totalUnexplainedHours).toBeGreaterThan(1.5);
    expect(result.totalUnexplainedHours).toBeLessThan(2.2);
  });

  it('פער קטן מסף הרעש אינו מסומן', () => {
    // ⚠ הסוללה מדווחת באחוזים שלמים; פער של 2% אינו מידע
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 80 },
      { recordedAt: at(1), batteryPct: 77.5 },
    ];
    const result = reconcileUsage(readings, []);
    expect(result.flaggedCount).toBe(0);
  });

  it('טעינה פוסלת את המקטע במקום להשמיט אותו בשקט', () => {
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 40 },
      { recordedAt: at(1), batteryPct: 95 },
    ];
    const result = reconcileUsage(readings, []);
    expect(result.intervals).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/נטענה/);
  });

  it('מרווח ארוך מדי נפסל — אי־הוודאות גדולה מהאות', () => {
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 100 },
      { recordedAt: at(72), batteryPct: 20 },
    ];
    const result = reconcileUsage(readings, []);
    expect(result.intervals).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/ארוך מכדי/);
  });

  it('מייחס דקות סשן באופן יחסי לחפיפה עם המקטע', () => {
    // סשן של שעתיים שרק מחציתו נופלת בתוך המקטע
    const readings: BatteryReading[] = [
      { recordedAt: at(1), batteryPct: 90 },
      { recordedAt: at(2), batteryPct: 84 },
    ];
    const paid: PaidUsageWindow[] = [{ from: at(0), to: at(2), activeMinutes: 120 }];
    const result = reconcileUsage(readings, paid);

    expect(result.intervals[0]!.paidActiveMinutes).toBeCloseTo(60, 0);
    expect(result.flaggedCount).toBe(0);
  });

  it('צריכה שלילית אינה הופכת ל"קרדיט" של שימוש', () => {
    // סשן קצר שצרך פחות מהמודל — אינו מקזז חשד במקטע אחר
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 90 },
      { recordedAt: at(1), batteryPct: 89 },
    ];
    const paid: PaidUsageWindow[] = [{ from: at(0), to: at(1), activeMinutes: 60 }];
    const result = reconcileUsage(readings, paid);
    expect(result.intervals[0]!.unexplainedDropPct).toBe(0);
  });

  it('צובר רק מקטעים שחצו את סף הרעש', () => {
    // ⚠ צבירת רעש הייתה מייצרת "שימוש בלתי מוסבר" מאי־דיוק מדידה
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 90 },
      { recordedAt: at(1), batteryPct: 88 },
      { recordedAt: at(2), batteryPct: 86 },
      { recordedAt: at(3), batteryPct: 84 },
    ];
    const result = reconcileUsage(readings, []);
    expect(result.flaggedCount).toBe(0);
    expect(result.totalUnexplainedHours).toBe(0);
  });

  it('המודל ניתן לכיול — שינוי הקצב משנה את התוצאה', () => {
    const readings: BatteryReading[] = [
      { recordedAt: at(0), batteryPct: 90 },
      { recordedAt: at(1), batteryPct: 66 },
    ];
    const strict = reconcileUsage(readings, [], { ...DEFAULT_DRAIN_MODEL, activePctPerHour: 24 });
    expect(strict.totalUnexplainedHours).toBeCloseTo(0.98, 1);
  });
});
