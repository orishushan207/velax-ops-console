import { describe, expect, it } from 'vitest';
import { diffRecords, sameValue } from '@/lib/record-diff';

/**
 * Audit Log חייב לשקף שינויים אמיתיים בלבד.
 * הבדיקות כאן מגנות מפני רעש שנובע מהפורמט שבו Postgres מחזיר ערכים.
 */

describe('sameValue', () => {
  it('מזהה ערכים זהים', () => {
    expect(sameValue('הרצליה', 'הרצליה')).toBe(true);
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(true, true)).toBe(true);
  });

  it('מזהה שינוי אמיתי', () => {
    expect(sameValue('הרצליה', 'רעננה')).toBe(false);
    expect(sameValue(null, 'רעננה')).toBe(false);
    expect(sameValue('רעננה', null)).toBe(false);
    expect(sameValue(true, false)).toBe(false);
  });

  it('משווה שעות בפורמט HH:MM מול HH:MM:SS', () => {
    expect(sameValue('08:00:00', '08:00')).toBe(true);
    expect(sameValue('16:00:00', '16:00')).toBe(true);
    expect(sameValue('08:00:00', '09:00')).toBe(false);
  });

  it('משווה מספרים ערכית ולא טקסטואלית', () => {
    expect(sameValue('5500.00', '5500')).toBe(true);
    expect(sameValue(6, '6')).toBe(true);
    expect(sameValue('0.00', 0)).toBe(true);
    expect(sameValue('5500.00', '5500.01')).toBe(false);
    expect(sameValue(6, '9')).toBe(false);
  });

  it('אינו מתייחס למחרוזת ריקה כאל אפס', () => {
    expect(sameValue('', 0)).toBe(false);
  });
});

describe('diffRecords', () => {
  it('מחזיר רק שדות שהשתנו', () => {
    const d = diffRecords(
      { name: 'מועדון א', courtCount: 6, offPeakStart: '08:00:00' },
      { name: 'מועדון ב', courtCount: '6', offPeakStart: '08:00' },
    );
    expect(d.changed).toBe(true);
    expect(Object.keys(d.after)).toEqual(['name']);
    expect(d.before.name).toBe('מועדון א');
    expect(d.after.name).toBe('מועדון ב');
  });

  it('שמירה ללא שינוי אינה נרשמת', () => {
    const d = diffRecords(
      { name: 'מועדון א', installedCost: '5500.00', offPeakEnd: '16:00:00' },
      { name: 'מועדון א', installedCost: '5500', offPeakEnd: '16:00' },
    );
    expect(d.changed).toBe(false);
    expect(d.after).toEqual({});
  });

  it('מנרמל undefined ל־null כדי לא לרשום שינוי מדומה', () => {
    const d = diffRecords({ address: null }, { address: undefined });
    expect(d.changed).toBe(false);
  });

  it('מזהה מעבר מערך ל־null כשינוי', () => {
    const d = diffRecords({ address: 'רחוב הרצל 1' }, { address: null });
    expect(d.changed).toBe(true);
    expect(d.before.address).toBe('רחוב הרצל 1');
    expect(d.after.address).toBeNull();
  });

  it('מתעלם משדות שאינם בטופס', () => {
    const d = diffRecords({ name: 'א', internalId: 'x' }, { name: 'א' });
    expect(d.changed).toBe(false);
  });
});
