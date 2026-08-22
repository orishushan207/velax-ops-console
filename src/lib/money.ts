/**
 * חשבון כספי. כל הסכומים בש״ח, מעוגלים לאגורות.
 *
 * ⚠ כללי ברזל (סעיף 33 בהנחיות):
 *   • אין לערבב הכנסה כולל מע״מ עם הכנסה לפני מע״מ.
 *   • אין לערבב הכנסה עם רווח.
 *   • כל חישוב עובר דרך הפונקציות כאן ולא inline בקומפוננטה.
 */

/** עיגול לאגורות. מונע שגיאות floating point מצטברות. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * פירוק סכום ברוטו (כולל מע״מ) לרכיביו.
 * לדוגמה: 90 ₪ במע״מ 18% → net 76.27, vat 13.73
 */
export function splitGross(grossAmount: number, vatRate: number) {
  const net = round2(grossAmount / (1 + vatRate));
  const vat = round2(grossAmount - net);
  return { gross: round2(grossAmount), net, vat };
}

/** בניית סכום ברוטו מתוך סכום נטו */
export function buildGross(netAmount: number, vatRate: number) {
  const vat = round2(netAmount * vatRate);
  return { gross: round2(netAmount + vat), net: round2(netAmount), vat };
}

/**
 * עמלת סליקה: אחוז מהעסקה + רכיב קבוע.
 * ברירת מחדל מהמודל: 2.7% + 1 ₪. גיליון הנחות B10/B11.
 */
export function processingFee(grossAmount: number, pctFee: number, fixedFee: number): number {
  return round2(grossAmount * pctFee + fixedFee);
}

export interface ContributionInputs {
  /** מחיר לצרכן כולל מע״מ */
  priceGross: number;
  vatRate: number;
  pspPctFee: number;
  pspFixedFee: number;
  /** קרן תגמולים — אחוז מההכנסה נטו */
  rewardsReservePct: number;
  /** עמלות מאמנים — אחוז משוקלל מההכנסה נטו */
  coachPoolPct: number;
  /** זיכויים, ביטולים וסיכון — אחוז מההכנסה נטו */
  refundRiskPct: number;
  /** עלויות משתנות ישירות בש״ח לשעה */
  ballsAndWearPerHour: number;
  cloudAndCommsPerHour: number;
  sparePartsPerHour: number;
  warrantyReservePerHour: number;
}

export interface ContributionBreakdown {
  priceGross: number;
  vatAmount: number;
  netRevenue: number;
  processingFee: number;
  rewardsReserve: number;
  coachPool: number;
  refundRisk: number;
  ballsAndWear: number;
  cloudAndComms: number;
  spareParts: number;
  warrantyReserve: number;
  totalVariableCost: number;
  contributionPerHour: number;
  contributionMarginPct: number;
}

/**
 * כלכלת שעת שימוש — שחזור מדויק של גיליון "כלכלת יחידה" ב־VELAXmodel.xlsx.
 *
 * אימות: בהנחות התוכנית (90 ₪, מע״מ 18%, 2.7%+1, 6%, 5%, 3%, 8, 2.5, 0, 0)
 * התוצאה חייבת להיות 51.66 ₪ תרומה לשעה. ראה tests/unit/contribution.test.ts.
 *
 * ⚠ שכר הטכנאי אינו כאן. הוא בהוצאה הקבועה — אחרת הוא נספר פעמיים.
 * זו טעות שהייתה בגרסה קודמת של המודל ותוקנה (גיליון "כלכלת יחידה" הערה A27).
 */
export function computeContribution(input: ContributionInputs): ContributionBreakdown {
  const { net, vat } = splitGross(input.priceGross, input.vatRate);

  const psp = processingFee(input.priceGross, input.pspPctFee, input.pspFixedFee);
  const rewards = round2(net * input.rewardsReservePct);
  const coach = round2(net * input.coachPoolPct);
  const refundRisk = round2(net * input.refundRiskPct);

  const totalVariableCost = round2(
    psp +
      rewards +
      coach +
      refundRisk +
      input.ballsAndWearPerHour +
      input.cloudAndCommsPerHour +
      input.sparePartsPerHour +
      input.warrantyReservePerHour,
  );

  const contribution = round2(net - totalVariableCost);

  return {
    priceGross: round2(input.priceGross),
    vatAmount: vat,
    netRevenue: net,
    processingFee: psp,
    rewardsReserve: rewards,
    coachPool: coach,
    refundRisk,
    ballsAndWear: round2(input.ballsAndWearPerHour),
    cloudAndComms: round2(input.cloudAndCommsPerHour),
    spareParts: round2(input.sparePartsPerHour),
    warrantyReserve: round2(input.warrantyReservePerHour),
    totalVariableCost,
    contributionPerHour: contribution,
    contributionMarginPct: net > 0 ? contribution / net : 0,
  };
}

/**
 * נקודת איזון בעמדות.
 * נוסחה מגיליון "נקודת איזון": הוצאה קבועה ÷ (תרומה לשעה × שעות ליום × ימי פעילות)
 */
export function breakEvenStations(
  annualFixedCost: number,
  contributionPerHour: number,
  paidHoursPerStationPerDay: number,
  operatingDaysPerYear: number,
): number | null {
  const denominator = contributionPerHour * paidHoursPerStationPerDay * operatingDaysPerYear;
  if (denominator <= 0) return null;
  return annualFixedCost / denominator;
}

/** נקודת איזון בשעות בתשלום בשנה */
export function breakEvenPaidHours(
  annualFixedCost: number,
  contributionPerHour: number,
): number | null {
  if (contributionPerHour <= 0) return null;
  return annualFixedCost / contributionPerHour;
}

/**
 * חישוב זיכוי חלקי לפי דקות השבתה.
 * מחזיר את הסכום הברוטו לזיכוי, מוגבל לסכום ששולם.
 */
export function proRataRefund(
  paidGross: number,
  scheduledMinutes: number,
  lostMinutes: number,
): number {
  if (scheduledMinutes <= 0) return 0;
  const ratio = Math.min(lostMinutes / scheduledMinutes, 1);
  return round2(Math.min(paidGross * ratio, paidGross));
}
