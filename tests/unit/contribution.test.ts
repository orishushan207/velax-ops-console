import { describe, expect, it } from 'vitest';
import {
  breakEvenPaidHours,
  breakEvenStations,
  buildGross,
  computeContribution,
  processingFee,
  proRataRefund,
  round2,
  splitGross,
} from '@/lib/money';

/**
 * בדיקות כלכלת יחידה.
 *
 * המקור: גיליון "כלכלת יחידה" ב־VELAXmodel.xlsx.
 * אם בדיקה כאן נכשלת, המשמעות היא שהמערכת סוטה מהמודל הפיננסי —
 * וזו סטייה שחייבת להיות מודעת ומאושרת, לא תקלה שקטה.
 */

const PLAN_INPUTS = {
  priceGross: 90,
  vatRate: 0.18,
  pspPctFee: 0.027,
  pspFixedFee: 1,
  rewardsReservePct: 0.06,
  coachPoolPct: 0.05,
  refundRiskPct: 0.03,
  ballsAndWearPerHour: 8,
  cloudAndCommsPerHour: 2.5,
  sparePartsPerHour: 0,
  warrantyReservePerHour: 0,
};

describe('מע״מ והפרדת ברוטו/נטו', () => {
  it('מפרק 90 ₪ כולל מע״מ ל־76.27 נטו ו־13.73 מע״מ', () => {
    const { gross, net, vat } = splitGross(90, 0.18);
    expect(gross).toBe(90);
    expect(net).toBe(76.27);
    expect(vat).toBe(13.73);
  });

  it('נטו ומע״מ מסתכמים תמיד לברוטו', () => {
    for (const price of [45, 60, 90, 100, 135, 199.9]) {
      const { gross, net, vat } = splitGross(price, 0.18);
      expect(round2(net + vat)).toBe(gross);
    }
  });

  it('בניית ברוטו מנטו היא פעולה הפוכה עקבית', () => {
    const built = buildGross(76.27, 0.18);
    expect(built.gross).toBe(90.0);
  });

  it('מע״מ 0 מחזיר נטו זהה לברוטו', () => {
    const { net, vat } = splitGross(100, 0);
    expect(net).toBe(100);
    expect(vat).toBe(0);
  });
});

describe('עמלת סליקה', () => {
  it('מחשבת 2.7% + 1 ₪ על 90 ₪ = 3.43 ₪', () => {
    expect(processingFee(90, 0.027, 1)).toBe(3.43);
  });

  it('מגיבה לשינוי בתעריף הספק', () => {
    // הצעת ספק חלופית שמתועדת במודל: 1.9%
    expect(processingFee(90, 0.019, 1)).toBe(2.71);
  });
});

describe('תרומה לשעת שימוש — שחזור גיליון כלכלת יחידה', () => {
  it('תרחיש התוכנית מניב 51.66 ₪ תרומה לשעה', () => {
    const r = computeContribution(PLAN_INPUTS);
    expect(r.netRevenue).toBe(76.27);
    expect(r.processingFee).toBe(3.43);
    expect(r.rewardsReserve).toBe(4.58);
    expect(r.coachPool).toBe(3.81);
    expect(r.refundRisk).toBe(2.29);
    expect(r.contributionPerHour).toBe(51.66);
  });

  it('שיעור התרומה בתרחיש התוכנית הוא כ־67.7%', () => {
    const r = computeContribution(PLAN_INPUTS);
    expect(r.contributionMarginPct).toBeCloseTo(0.677, 3);
  });

  it('תרחיש ריאלי מניב 38.16 ₪ תרומה לשעה', () => {
    const r = computeContribution({
      ...PLAN_INPUTS,
      ballsAndWearPerHour: 15,
      cloudAndCommsPerHour: 3,
      sparePartsPerHour: 3,
      warrantyReservePerHour: 3,
    });
    expect(r.contributionPerHour).toBe(38.16);
    expect(r.contributionMarginPct).toBeCloseTo(0.5, 2);
  });

  it('תרחיש שמרני מניב 26.16 ₪ תרומה לשעה', () => {
    const r = computeContribution({
      ...PLAN_INPUTS,
      ballsAndWearPerHour: 22,
      cloudAndCommsPerHour: 4,
      sparePartsPerHour: 5,
      warrantyReservePerHour: 5,
    });
    expect(r.contributionPerHour).toBe(26.16);
    expect(r.contributionMarginPct).toBeCloseTo(0.343, 2);
  });

  it('הפער בין תוכנית לריאלי הוא כ־26% — כפי שהמודל קובע', () => {
    const plan = computeContribution(PLAN_INPUTS);
    const realistic = computeContribution({
      ...PLAN_INPUTS,
      ballsAndWearPerHour: 15,
      cloudAndCommsPerHour: 3,
      sparePartsPerHour: 3,
      warrantyReservePerHour: 3,
    });
    const gap = realistic.contributionPerHour / plan.contributionPerHour - 1;
    expect(gap).toBeCloseTo(-0.261, 2);
  });

  it('סכום כל העלויות המשתנות שווה להפרש בין נטו לתרומה', () => {
    const r = computeContribution(PLAN_INPUTS);
    expect(round2(r.netRevenue - r.totalVariableCost)).toBe(r.contributionPerHour);
  });

  it('שכר הטכנאי אינו חלק מהעלות המשתנה — אין רכיב כזה בפירוק', () => {
    const r = computeContribution(PLAN_INPUTS);
    const keys = Object.keys(r);
    expect(keys).not.toContain('technicianCost');
    expect(keys).not.toContain('labourCost');
  });
});

describe('נקודת איזון', () => {
  it('בארכיטיפ רזה ו־1.5 שעות ליום נדרשות כ־30 עמדות', () => {
    const stations = breakEvenStations(730_000, 51.66322034, 1.5, 312);
    expect(stations).not.toBeNull();
    expect(Math.round(stations!)).toBe(30);
  });

  it('ב־1.0 שעות ליום נדרשות כ־45 עמדות', () => {
    const stations = breakEvenStations(730_000, 51.66322034, 1.0, 312);
    expect(Math.round(stations!)).toBe(45);
  });

  it('ב־2.0 שעות ליום נדרשות כ־23 עמדות', () => {
    const stations = breakEvenStations(730_000, 51.66322034, 2.0, 312);
    expect(Math.round(stations!)).toBe(23);
  });

  it('בארכיטיפ ארצי ו־1.0 שעות ליום נדרשות מעל 200 עמדות — מעל תקרת השוק', () => {
    const stations = breakEvenStations(3_400_000, 51.66322034, 1.0, 312);
    expect(stations!).toBeGreaterThan(200);
  });

  it('תרומה אפסית או שלילית מחזירה null ולא אינסוף', () => {
    expect(breakEvenStations(730_000, 0, 1.5, 312)).toBeNull();
    expect(breakEvenStations(730_000, -5, 1.5, 312)).toBeNull();
    expect(breakEvenPaidHours(730_000, 0)).toBeNull();
  });

  it('שעות בתשלום שנתיות לאיזון מתיישבות עם מספר העמדות', () => {
    const hours = breakEvenPaidHours(730_000, 51.66322034)!;
    const stations = breakEvenStations(730_000, 51.66322034, 1.5, 312)!;
    expect(round2(hours)).toBeCloseTo(round2(stations * 1.5 * 312), 0);
  });
});

describe('זיכוי יחסי', () => {
  it('אובדן חצי מהזמן מזכה בחצי מהסכום', () => {
    expect(proRataRefund(90, 60, 30)).toBe(45);
  });

  it('אובדן מלא מזכה בסכום המלא', () => {
    expect(proRataRefund(90, 60, 60)).toBe(90);
  });

  it('אובדן מעבר לזמן המתוכנן אינו מזכה מעבר לסכום ששולם', () => {
    expect(proRataRefund(90, 60, 120)).toBe(90);
  });

  it('אין זיכוי כשלא אבד זמן', () => {
    expect(proRataRefund(90, 60, 0)).toBe(0);
  });

  it('משך מתוכנן אפס אינו גורם לחלוקה באפס', () => {
    expect(proRataRefund(90, 0, 30)).toBe(0);
  });
});
