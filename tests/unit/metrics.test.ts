import { describe, expect, it } from 'vitest';
import { METRICS, METRICS_BY_KEY, metricCaution, metricTooltip } from '@/lib/metrics/dictionary';
import { paidHoursPerActiveStationPerDay } from '@/lib/metrics/calculations';
import { percentChange, safeDivide, clamp, buildReference } from '@/lib/utils';
import { HEALTH_WEIGHTS } from '@/lib/metrics/health-weights';

describe('Metric Dictionary', () => {
  it('לכל מדד יש הגדרה, נוסחה, מקור נתונים ובעלים', () => {
    for (const m of METRICS) {
      expect(m.definition.length, `${m.key}: חסרה הגדרה`).toBeGreaterThan(10);
      expect(m.formula.length, `${m.key}: חסרה נוסחה`).toBeGreaterThan(5);
      expect(m.dataSource.length, `${m.key}: חסר מקור נתונים`).toBeGreaterThan(2);
      expect(m.ownerRole.length, `${m.key}: חסר בעלים`).toBeGreaterThan(2);
      expect(m.tooltipHe.length, `${m.key}: חסר Tooltip`).toBeGreaterThan(10);
      expect(m.version).toBeGreaterThanOrEqual(1);
    }
  });

  it('אין מפתחות מדד כפולים', () => {
    const keys = METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('מדדי נפח נושאים אזהרה מפני הצגתם כהוכחת שיפור מקצועי', () => {
    expect(metricCaution('sessions_per_user')).toContain('שיפור מקצועי');
  });

  it('מדד הכנסת מגרש מקושרת מזהיר שאינה הכנסת VELA-X', () => {
    expect(metricCaution('machine_linked_court_revenue')).toContain('VELA-X');
  });

  it('מדד התרומה מזהיר שתרומה אינה רווח', () => {
    const caution = metricCaution('contribution_per_hour');
    expect(caution).toContain('אינה רווח');
  });

  it('CAC ו־NPS מסומנים כדורשי מקור נתונים שאינו קיים', () => {
    expect(metricCaution('cac')).toBeTruthy();
    expect(metricCaution('nps')).toBeTruthy();
  });

  it('מחזיר undefined למפתח שאינו קיים ולא זורק', () => {
    expect(metricTooltip('no_such_metric')).toBeUndefined();
    expect(METRICS_BY_KEY.get('no_such_metric')).toBeUndefined();
  });
});

describe('מדד ה־North Star', () => {
  it('מחשב שעות לעמדה ליום נכון', () => {
    // 300 שעות, 10 עמדות, 30 יום → 1.00 שעות ליום
    expect(paidHoursPerActiveStationPerDay(300, 10, 30)).toBe(1);
  });

  it('מחזיר null כשאין עמדות פעילות — ולא אפס מטעה', () => {
    expect(paidHoursPerActiveStationPerDay(300, 0, 30)).toBeNull();
  });

  it('מחזיר null כשאין ימים בתקופה', () => {
    expect(paidHoursPerActiveStationPerDay(300, 10, 0)).toBeNull();
  });

  it('מזהה עמידה בשער ה־PMF של 1.5 שעות', () => {
    const value = paidHoursPerActiveStationPerDay(468, 10, 30);
    expect(value).toBe(1.56);
    expect(value! >= 1.5).toBe(true);
  });
});

describe('Club Health Score', () => {
  it('סכום המשקלים הוא בדיוק 1.0', () => {
    const total = Object.values(HEALTH_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(Number(total.toFixed(6))).toBe(1);
  });

  it('כל עשרת הרכיבים מסעיף 8 בהנחיות קיימים', () => {
    const keys = Object.keys(HEALTH_WEIGHTS);
    expect(keys).toHaveLength(10);
    expect(keys).toContain('stationAvailability');
    expect(keys).toContain('usageHours');
    expect(keys).toContain('usageTrend');
    expect(keys).toContain('incidents');
    expect(keys).toContain('slaCompliance');
    expect(keys).toContain('staffActivity');
    expect(keys).toContain('checklistCompletion');
    expect(keys).toContain('chargingAndBalls');
    expect(keys).toContain('marketingPresence');
    expect(keys).toContain('earnBackCompliance');
  });
});

describe('פונקציות עזר מספריות', () => {
  it('safeDivide מחזיר fallback במקום חלוקה באפס', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('percentChange מחזיר null כשאין בסיס להשוואה', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(150, 100)).toBe(0.5);
    expect(percentChange(50, 100)).toBe(-0.5);
  });

  it('clamp מגביל לטווח', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('buildReference מייצר מזהה קריא ועקבי', () => {
    const ref = buildReference('VX', new Date('2026-08-20T10:00:00Z'), 42);
    expect(ref).toMatch(/^VX-\d{6}-0042$/);
  });
});
