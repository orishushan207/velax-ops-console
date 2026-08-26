/**
 * נרמול מספר טלפון ישראלי לצורה אחת.
 *
 * ⚠ בלי נרמול אותו אדם נוצר במסד כמה פעמים — פעם לפי 050-1234567, פעם
 * לפי +972501234567 — וההיסטוריה שלו מתפצלת. זה שובר שיוך למאמן,
 * Rewards וכל מדד חזרה.
 *
 * לוגיקה טהורה, ללא תלות בשרת, כדי שתהיה ניתנת לבדיקה.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+972\d{9}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^972\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return null;
}
