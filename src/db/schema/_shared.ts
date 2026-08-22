import { boolean, numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * עמודות משותפות לכל טבלה עסקית.
 * Soft delete הוא ברירת המחדל — סעיף 25 בהנחיות אוסר מחיקה קשיחה של ישויות עסקיות.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
};

/**
 * דגל נתוני הדגמה. כל שורה שנוצרה על ידי ה־Seed נושאת true.
 * ה־UI מציג באנר "נתוני הדגמה" כאשר קיימות שורות כאלה — סעיף 28 בהנחיות.
 */
export const demoFlag = {
  isDemo: boolean('is_demo').notNull().default(false),
};

/** סכום כספי בש״ח. numeric ולא float — לעולם לא מבצעים חישוב כספי ב־floating point. */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/** אחוז כשבר עשרוני: 0.18 = 18% */
export const rate = (name: string) => numeric(name, { precision: 8, scale: 6 });

/** כמות שעות / מדדים עם דיוק */
export const quantity = (name: string) => numeric(name, { precision: 14, scale: 4 });

/** המרת numeric של Postgres (מוחזר כמחרוזת) למספר. null-safe. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

/** המרת מספר למחרוזת numeric לכתיבה ל־DB */
export function toNumeric(value: number, scale = 2): string {
  return value.toFixed(scale);
}
