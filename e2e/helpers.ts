import { expect, type Locator, type Page } from '@playwright/test';

/**
 * לוחץ על קישור וממתין לניווט, עם ניסיון חוזר.
 *
 * ⚠ ב־App Router לחיצה שמתרחשת לפני שה־hydration הושלם אינה מפעילה את
 * ה־Link, והדפדפן נשאר במקום. זה מקור הכשלים האקראיים בבדיקות ניווט:
 * הקישור נראה לעין ולחיץ, אך המטפל שלו טרם חובר.
 *
 * toPass חוזר על הלחיצה **ועל הבדיקה יחד**, כך שהניסיון השני מתרחש
 * לאחר שה־hydration הושלם.
 */
export async function clickAndNavigate(
  page: Page,
  link: Locator,
  expectedUrl: RegExp,
): Promise<void> {
  await expect(link).toBeVisible();
  await expect(async () => {
    await link.click();
    await expect(page).toHaveURL(expectedUrl, { timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
}
