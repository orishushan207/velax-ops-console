/**
 * טווחי תאריכים לדשבורד ולדוחות.
 * המצב נשמר ב־URL, כך שכל תצוגה ניתנת לשיתוף בקישור (סעיף 29 בהנחיות).
 */

export type RangePreset = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd' | 'custom';

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7 ימים אחרונים' },
  { value: '30d', label: '30 ימים אחרונים' },
  { value: '90d', label: '90 ימים אחרונים' },
  { value: 'mtd', label: 'מתחילת החודש' },
  { value: 'qtd', label: 'מתחילת הרבעון' },
  { value: 'ytd', label: 'מתחילת השנה' },
];

export interface ResolvedRange {
  from: Date;
  to: Date;
  /** התקופה המקבילה הקודמת, לצורך השוואה */
  previousFrom: Date;
  previousTo: Date;
  label: string;
  days: number;
  preset: RangePreset;
}

export function resolveRange(
  preset: string | undefined,
  fromParam?: string,
  toParam?: string,
  now = new Date(),
): ResolvedRange {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from = new Date(to);
  let label = '30 ימים אחרונים';
  let resolved: RangePreset = '30d';

  switch (preset) {
    case '7d':
      from.setDate(to.getDate() - 6);
      label = '7 ימים אחרונים';
      resolved = '7d';
      break;
    case '90d':
      from.setDate(to.getDate() - 89);
      label = '90 ימים אחרונים';
      resolved = '90d';
      break;
    case 'mtd':
      from = new Date(to.getFullYear(), to.getMonth(), 1);
      label = 'מתחילת החודש';
      resolved = 'mtd';
      break;
    case 'qtd':
      from = new Date(to.getFullYear(), Math.floor(to.getMonth() / 3) * 3, 1);
      label = 'מתחילת הרבעון';
      resolved = 'qtd';
      break;
    case 'ytd':
      from = new Date(to.getFullYear(), 0, 1);
      label = 'מתחילת השנה';
      resolved = 'ytd';
      break;
    case 'custom': {
      const parsedFrom = fromParam ? new Date(fromParam) : null;
      const parsedTo = toParam ? new Date(toParam) : null;
      if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) {
        from = parsedFrom;
        from.setHours(0, 0, 0, 0);
      } else {
        from.setDate(to.getDate() - 29);
      }
      if (parsedTo && !Number.isNaN(parsedTo.getTime())) {
        to.setTime(parsedTo.getTime());
        to.setHours(23, 59, 59, 999);
      }
      label = 'טווח מותאם';
      resolved = 'custom';
      break;
    }
    default:
      from.setDate(to.getDate() - 29);
      break;
  }

  from.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - (to.getTime() - from.getTime()));

  return { from, to, previousFrom, previousTo, label, days, preset: resolved };
}

/** בונה query string תוך שמירה על שאר המסננים */
export function buildQuery(
  current: Record<string, string | undefined>,
  changes: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value !== undefined && value !== '' && value !== 'all') params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
