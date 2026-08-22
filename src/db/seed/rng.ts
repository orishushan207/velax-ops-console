/**
 * מחולל אקראיות דטרמיניסטי (mulberry32).
 * אותו seed מייצר תמיד את אותם נתונים — כך שהדגמה, בדיקות ו־screenshots יציבים.
 */
export class Rng {
  private state: number;

  constructor(seed = 20260820) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, decimals = 2): number {
    const v = this.next() * (max - min) + min;
    return Number(v.toFixed(decimals));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick על מערך ריק');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** בחירה משוקללת: [[value, weight], ...] */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** התפלגות נורמלית מקורבת (Box-Muller) */
  normal(mean: number, stdDev: number): number {
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
    }
    return arr;
  }
}

export const FIRST_NAMES_HE = [
  'נועם', 'איתי', 'יובל', 'אורי', 'דניאל', 'עידו', 'רועי', 'אלון', 'גיא', 'עומר',
  'מאיה', 'שירה', 'נועה', 'תמר', 'יעל', 'רוני', 'ליאור', 'אביגיל', 'הדר', 'טל',
  'אסף', 'עמית', 'ניר', 'ברק', 'תום', 'שחר', 'מתן', 'אלעד', 'יונתן', 'ארז',
  'ענבל', 'דנה', 'מיכל', 'סיון', 'אורית', 'רותם', 'גל', 'שני', 'עדי', 'ליה',
];

export const LAST_NAMES_HE = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי',
  'גבאי', 'אוחיון', 'חדד', 'בן דוד', 'שרון', 'רוזן', 'גולן', 'ברק', 'אשכנזי', 'טל',
  'סגל', 'הראל', 'נחום', 'אלבז', 'יוסף', 'שמעוני', 'ברוך', 'זהבי', 'קפלן', 'ארד',
];

export function israeliPhone(rng: Rng): string {
  const prefix = rng.pick(['050', '052', '053', '054', '055', '058']);
  return `${prefix}${String(rng.int(1000000, 9999999))}`;
}
