import { describe, expect, it } from 'vitest';
import { formatAxisTick, formatCurrency, pluralHe } from '@/lib/format';

/** מסיר סימני כיווניות (LRM/RLM) שהם חלק תקין מפלט Intl בעברית */
const stripBidi = (s: string) => s.replace(/[\u200e\u200f]/g, '');

describe('formatCurrency — סכומים מלאים', () => {
  it('מציג את הסכום המלא ולא קירוב', () => {
    // ⚠ דרישה מפורשת: 48,000 ולא "48 א׳"
    expect(formatCurrency(48000)).toContain('48,000');
    expect(formatCurrency(48000)).not.toContain('א׳');
    expect(formatCurrency(1_250_000)).toContain('1,250,000');
    expect(formatCurrency(1_250_000)).not.toContain('מ׳');
  });

  it('מציג סכומים קטנים ושליליים במלואם', () => {
    expect(formatCurrency(0)).toContain('0');
    expect(formatCurrency(-39754)).toContain('39,754');
  });

  it('מחזיר מקף כשאין נתון', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });

  it('גרסה מדויקת שומרת שתי ספרות אחרי הנקודה', () => {
    expect(formatCurrency(51.66, true)).toContain('51.66');
  });
});

describe('formatAxisTick — תווית ציר בלבד', () => {
  it('מציג מספר מלא מתחת למיליון, כדי שלא יטעה', () => {
    // 1,350 היה הופך ל־"1K" ומאבד דיוק
    expect(formatAxisTick(1350)).toBe('1,350');
    expect(formatAxisTick(900)).toBe('900');
    expect(formatAxisTick(0)).toBe('0');
  });

  it('מקצר רק ממיליון ומעלה', () => {
    expect(formatAxisTick(1_500_000)).toBe('1.5M');
    // Intl מוסיף LRM לפני מספר שלילי כדי שסימן המינוס יופיע נכון בהקשר RTL.
    // זו התנהגות רצויה — הבדיקה מתעלמת מסימני הכיווניות בלבד.
    expect(stripBidi(formatAxisTick(-2_000_000))).toBe('-2.0M');
  });

  it('מחזיר מחרוזת ריקה כשאין ערך, כדי שהציר לא יציג מקף', () => {
    expect(formatAxisTick(null)).toBe('');
    expect(formatAxisTick(Number.NaN)).toBe('');
  });
});

describe('pluralHe — ריבוי בעברית', () => {
  it('יחיד אינו מקבל מספר לפניו', () => {
    expect(pluralHe(1, 'עמדה אחת פעילה', 'עמדות פעילות')).toBe('עמדה אחת פעילה');
  });

  it('רבים מקבל מספר מעוצב', () => {
    expect(pluralHe(3, 'עמדה אחת פעילה', 'עמדות פעילות')).toBe('3 עמדות פעילות');
    expect(pluralHe(1200, 'אימון אחד', 'אימונים')).toBe('1,200 אימונים');
  });

  it('אפס מתנהג כרבים', () => {
    expect(pluralHe(0, 'עמדה אחת', 'עמדות')).toBe('0 עמדות');
  });
});
