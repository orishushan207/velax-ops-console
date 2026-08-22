import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  countsTowardStartSuccess,
  isPaidSession,
  refundableAmount,
  statusAfterRefund,
  type SessionStatus,
} from '@/lib/session-lifecycle';
import {
  countedEarnBackRevenue,
  forecastRevenue,
  requiredDailyRunRate,
  startSuccessRate,
  uptimeRatio,
} from '@/lib/metrics/calculations';

describe('מכונת המצבים של Session', () => {
  it('כל 14 הסטטוסים מסעיף 10 בהנחיות מוגדרים', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS)).toHaveLength(14);
  });

  it('המסלול התקין: draft → awaiting_payment → paid → authorized → connecting → active → completed', () => {
    const path: SessionStatus[] = [
      'draft',
      'awaiting_payment',
      'paid',
      'authorized',
      'connecting',
      'active',
      'completed',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it('לא ניתן לדלג מ־draft ישירות ל־active', () => {
    expect(canTransition('draft', 'active')).toBe(false);
  });

  it('לא ניתן להפעיל סשן ללא תשלום — awaiting_payment אינו עובר ל־active', () => {
    expect(canTransition('awaiting_payment', 'active')).toBe(false);
    expect(canTransition('awaiting_payment', 'connecting')).toBe(false);
    expect(canTransition('awaiting_payment', 'authorized')).toBe(false);
  });

  it('סשן שבוטל הוא מצב סופי', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it('סשן פעיל יכול להיות מושהה ולחזור', () => {
    expect(canTransition('active', 'paused')).toBe(true);
    expect(canTransition('paused', 'active')).toBe(true);
  });

  it('סשן שהושלם אינו יכול לחזור להיות פעיל', () => {
    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('completed', 'paused')).toBe(false);
  });

  it('כשל בהתחלה מוביל לזיכוי ולא לסיום מוצלח', () => {
    expect(canTransition('failed_to_start', 'fully_refunded')).toBe(true);
    expect(canTransition('failed_to_start', 'completed')).toBe(false);
  });
});

describe('הגדרת Paid Session', () => {
  it('סשן שהושלם ושולם נספר', () => {
    expect(isPaidSession({ status: 'completed', amountGross: 90, refundedAmount: 0 })).toBe(true);
  });

  it('סשן שזוכה במלואו אינו נספר', () => {
    expect(isPaidSession({ status: 'completed', amountGross: 90, refundedAmount: 90 })).toBe(false);
  });

  it('זיכוי חלקי עדיין נספר כסשן בתשלום', () => {
    expect(
      isPaidSession({ status: 'partially_refunded', amountGross: 90, refundedAmount: 45 }),
    ).toBe(true);
  });

  it('סשן ללא תשלום אינו נספר', () => {
    expect(isPaidSession({ status: 'completed', amountGross: 0, refundedAmount: 0 })).toBe(false);
  });

  it('סשן שכשל בהתחלה אינו נספר גם אם שולם', () => {
    expect(
      isPaidSession({ status: 'failed_to_start', amountGross: 90, refundedAmount: 0 }),
    ).toBe(false);
  });

  it('סשן שבוטל אינו נספר', () => {
    expect(isPaidSession({ status: 'cancelled', amountGross: 0, refundedAmount: 0 })).toBe(false);
  });
});

describe('Start Success', () => {
  it('סשן שהתחיל ללא עזרה נספר לטובה', () => {
    expect(
      countsTowardStartSuccess({ status: 'completed', startedWithoutStaffHelp: true }),
    ).toBe(true);
  });

  it('סשן שהצריך עזרת צוות אינו נספר לטובה', () => {
    expect(
      countsTowardStartSuccess({ status: 'completed', startedWithoutStaffHelp: false }),
    ).toBe(false);
  });

  it('סשן שכשל בהתחלה אינו נספר לטובה', () => {
    expect(
      countsTowardStartSuccess({ status: 'failed_to_start', startedWithoutStaffHelp: true }),
    ).toBe(false);
  });

  it('שיעור ההתחלות המוצלחות מחושב נכון', () => {
    expect(startSuccessRate(95, 100)).toBe(0.95);
    expect(startSuccessRate(0, 0)).toBeNull();
  });
});

describe('חישוב זיכוי', () => {
  it('הסכום הניתן לזיכוי הוא ההפרש מהסכום ששולם', () => {
    expect(refundableAmount({ amountGross: 90, refundedAmount: 0 })).toBe(90);
    expect(refundableAmount({ amountGross: 90, refundedAmount: 30 })).toBe(60);
  });

  it('לא ניתן לזכות מעבר לסכום ששולם', () => {
    expect(refundableAmount({ amountGross: 90, refundedAmount: 90 })).toBe(0);
    expect(refundableAmount({ amountGross: 90, refundedAmount: 120 })).toBe(0);
  });

  it('זיכוי חלקי מסמן את הסשן כזוכה חלקית', () => {
    expect(statusAfterRefund(90, 45)).toBe('partially_refunded');
  });

  it('זיכוי מלא מסמן את הסשן כזוכה במלואו', () => {
    expect(statusAfterRefund(90, 90)).toBe('fully_refunded');
    expect(statusAfterRefund(90, 95)).toBe('fully_refunded');
  });
});

describe('חישובי Earn-Back', () => {
  it('הכנסה אינקרמנטלית שסווגה ידנית נספרת במלואה', () => {
    expect(countedEarnBackRevenue(1000, 0, 0.7)).toBe(1000);
  });

  it('הכנסה מקושרת שטרם סווגה משוקללת במקדם', () => {
    expect(countedEarnBackRevenue(0, 1000, 0.7)).toBe(700);
  });

  it('מקדם 1.0 סופר את כל ההכנסה המקושרת', () => {
    expect(countedEarnBackRevenue(0, 1000, 1)).toBe(1000);
  });

  it('מקדם 0 מנטרל לחלוטין הכנסה שלא סווגה', () => {
    expect(countedEarnBackRevenue(500, 1000, 0)).toBe(500);
  });

  it('משלב סיווג ידני ומשוקלל יחד', () => {
    expect(countedEarnBackRevenue(1200, 2000, 0.7)).toBe(2600);
  });

  it('קצב יומי נדרש מחושב מהפער הנותר', () => {
    // פער 4500 ₪, 50 ימים, 90 ₪ לשעה → שעה ליום
    expect(requiredDailyRunRate(4500, 50, 90)).toBe(1);
  });

  it('אין קצב נדרש כשהתקופה הסתיימה', () => {
    expect(requiredDailyRunRate(4500, 0, 90)).toBe(0);
  });

  it('תחזית מרחיבה את הקצב שנצבר עד סוף התקופה', () => {
    // 3000 ₪ ב־50 ימים = 60 ליום; 50 ימים נוספים → 6000
    expect(forecastRevenue(3000, 50, 50)).toBe(6000);
  });

  it('תחזית ללא ימים שחלפו מחזירה את מה שנצבר', () => {
    expect(forecastRevenue(3000, 0, 50)).toBe(3000);
  });

  it('חישוב ההחזר: 6,000 ₪ ב־90 ₪ לשעה = 66.7 שעות', () => {
    const requiredHours = 6000 / 90;
    expect(Number(requiredHours.toFixed(1))).toBe(66.7);
  });

  it('חישוב ההחזר במחיר הישן: 14,900 ₪ ב־90 ₪ = 165.6 שעות', () => {
    const requiredHours = 14900 / 90;
    expect(Number(requiredHours.toFixed(1))).toBe(165.6);
  });

  it('שעות ליום נדרשות: 66.7 שעות ב־156 ימי פעילות = 0.43', () => {
    const perDay = 6000 / 90 / 156;
    expect(Number(perDay.toFixed(2))).toBe(0.43);
  });
});

describe('חישוב זמינות', () => {
  it('אין השבתה = זמינות מלאה', () => {
    expect(uptimeRatio(1000, 0)).toBe(1);
  });

  it('השבתה של 5% מורידה את הזמינות ל־95%', () => {
    expect(uptimeRatio(1000, 50)).toBe(0.95);
  });

  it('השבתה מלאה מאפסת את הזמינות', () => {
    expect(uptimeRatio(1000, 1000)).toBe(0);
  });

  it('השבתה מעבר לזמן המתוכנן אינה מייצרת ערך שלילי', () => {
    expect(uptimeRatio(1000, 2000)).toBe(0);
  });

  it('ללא זמן מתוכנן מוחזר null ולא חלוקה באפס', () => {
    expect(uptimeRatio(0, 100)).toBeNull();
  });
});
