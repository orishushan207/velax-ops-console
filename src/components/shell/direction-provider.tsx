'use client';

import { DirectionProvider as RadixDirectionProvider } from '@radix-ui/react-direction';

/**
 * מכריח את כל רכיבי Radix לעבוד ב־RTL.
 *
 * ⚠ **רכיבי Radix מוגדרים כברירת מחדל ל־ltr**, ללא קשר ל־dir שעל ה־html.
 * Tabs, DropdownMenu, Select ואחרים מציבים `dir="ltr"` על שורש הרכיב,
 * וכל מה שבתוכם יורש LTR — כולל טבלאות, שסדר העמודות שלהן מתהפך.
 *
 * זו הייתה הסיבה לכך שמסכים עם לשוניות הציגו עמודות משמאל לימין, בעוד
 * מסכים בלעדיהן היו תקינים. ספק אחד בשורש פותר את כולם.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  return <RadixDirectionProvider dir="rtl">{children}</RadixDirectionProvider>;
}
