/**
 * עיצוב תצוגה — עברית, ש״ח, אזור זמן ישראל.
 * כל תצוגת מספר במערכת עוברת דרך כאן.
 */

const ILS = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ILS_PRECISE = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM3 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const PCT = new Intl.NumberFormat('he-IL', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const PCT0 = new Intl.NumberFormat('he-IL', { style: 'percent', maximumFractionDigits: 0 });

export const TIMEZONE = 'Asia/Jerusalem';

export function formatCurrency(value: number | null | undefined, precise = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return precise ? ILS_PRECISE.format(value) : ILS.format(value);
}

/**
 * תווית לציר גרף בלבד.
 *
 * ⚠ אינה לשימוש להצגת סכום. סכומים מוצגים תמיד במלואם דרך formatCurrency,
 * כדי שמספר שהמשתמש קורא יהיה המספר האמיתי ולא קירוב.
 * כאן מדובר בסימון על סקאלה, ותוויות מלאות היו נדרסות זו על זו.
 */
export function formatAxisTick(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  // מיליון ומעלה בלבד מקוצר. מתחת לזה המספר המלא קריא ונכנס בציר,
  // וקיצור היה הופך 1,350 ל־"1K" — מטעה ולא מדויק.
  if (Math.abs(value) >= 1_000_000) return `${NUM1.format(value / 1_000_000)}M`;
  return NUM.format(value);
}

export function formatNumber(value: number | null | undefined, decimals: 0 | 1 | 2 | 3 = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (decimals === 1) return NUM1.format(value);
  if (decimals === 2) return NUM2.format(value);
  if (decimals === 3) return NUM3.format(value);
  return NUM.format(value);
}

export function formatPercent(value: number | null | undefined, decimals: 0 | 1 = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return decimals === 0 ? PCT0.format(value) : PCT.format(value);
}

/** שעות: 1.4 ש׳ */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${NUM1.format(value)} ש׳`;
}

/** משך זמן בדקות → "1:24 ש׳" או "45 דק׳" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${total} דק׳`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')} ש׳`;
}

const DATE_FMT = new Intl.DateTimeFormat('he-IL', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATETIME_FMT = new Intl.DateTimeFormat('he-IL', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const TIME_FMT = new Intl.DateTimeFormat('he-IL', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_FMT.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return DATETIME_FMT.format(d);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return TIME_FMT.format(d);
}

/** "לפני 5 דקות" / "בעוד שעתיים" */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('he-IL', { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return 'עכשיו';
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day');
  return DATE_FMT.format(d);
}

/** תאריך בפורמט ISO ליום בלבד, באזור זמן ישראל */
export function toIsraelDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  return parts;
}

export const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
export const WEEKDAYS_HE_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;

/**
 * ריבוי בעברית — "עמדה אחת" מול "2 עמדות".
 *
 * ⚠ עברית אינה מתנהגת כמו אנגלית: הצורה היחידה אינה "1 עמדות".
 * שרשור נאיבי של מספר ומילה מייצר טקסט שגוי, ולכן כל הודעה שסופרת
 * פריטים עוברת דרך כאן.
 */
export function pluralHe(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : `${NUM.format(count)} ${plural}`;
}
