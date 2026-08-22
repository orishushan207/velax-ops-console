/**
 * השוואת ערכי רשומה לזיהוי שינוי אמיתי, לצורך רישום מדויק ב־Audit Log.
 *
 * ⚠ למה זה לא השוואת מחרוזות פשוטה:
 * Postgres מחזיר ערכים בפורמט משלו — time כ־"08:00:00" מול "08:00" שהטופס שולח,
 * ו־numeric כ־"5500.00" מול "5500". בלי נורמליזציה כל שמירה הייתה נרשמת כשינוי,
 * וההיסטוריה הייתה מתמלאת ברעש שמסתיר שינויים אמיתיים.
 */

const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

export function sameValue(bv: unknown, av: unknown): boolean {
  if (bv === null && av === null) return true;
  if (bv === null || av === null) return false;

  const bs = String(bv);
  const as = String(av);
  if (bs === as) return true;

  // שעות — HH:MM מול HH:MM:SS. נבדק לפני מספרים כי "08:00" אינו מספר.
  if (TIME_PATTERN.test(bs) && TIME_PATTERN.test(as)) return bs.slice(0, 5) === as.slice(0, 5);

  // מספרים — השוואה ערכית ולא טקסטואלית
  if (bs.trim() !== '' && as.trim() !== '') {
    const bn = Number(bs);
    const an = Number(as);
    if (Number.isFinite(bn) && Number.isFinite(an)) return bn === an;
  }

  return false;
}

export interface RecordDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changed: boolean;
}

/** מחזיר רק את השדות שבאמת השתנו */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): RecordDiff {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const bv = before[key] ?? null;
    const av = after[key] ?? null;
    if (!sameValue(bv, av)) {
      b[key] = bv;
      a[key] = av;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}
