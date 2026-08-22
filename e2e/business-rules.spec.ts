import { test, expect } from '@playwright/test';

/**
 * זרימה 4 — כללים עסקיים שאסור לשבור.
 * הבדיקות האלה מגנות על ההבחנות שהמודל הפיננסי מדגיש.
 */

test('מסך הכספים מפריד בין גבייה, הכנסה, תרומה ורווח', async ({ page }) => {
  await page.goto('/finance');

  await expect(page.getByText('גבייה ברוטו').first()).toBeVisible();
  await expect(page.getByText('הכנסה נטו').first()).toBeVisible();
  await expect(page.getByText('תרומה').first()).toBeVisible();
  await expect(page.getByText('רווח תפעולי (EBITDA)')).toBeVisible();

  // האזהרה המפורשת מוצגת
  await expect(page.getByText('גבייה ברוטו ≠ הכנסה ≠ תרומה ≠ רווח')).toBeVisible();
});

test('כלכלת היחידה משחזרת את המודל: 51.66 ₪ תרומה לשעה', async ({ page }) => {
  await page.goto('/finance?scenario=plan');
  await expect(page.getByText('51.66').first()).toBeVisible();
});

test('שלושת התרחישים מוצגים במקביל', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('tab', { name: 'ניתוח תרחישים' }).click();

  await expect(page.getByText('תוכנית').first()).toBeVisible();
  await expect(page.getByText('ריאלי').first()).toBeVisible();
  await expect(page.getByText('שמרני').first()).toBeVisible();
});

test('Earn-Back מסביר שהכנסת VELA-X אינה נספרת', async ({ page }) => {
  await page.goto('/earn-back');
  await expect(page.getByRole('heading', { name: 'איך ההכנסה נספרת' })).toBeVisible();
  await expect(page.getByText('אינה נספרת: זו ההכנסה שלנו')).toBeVisible();
});

test('מסך ההגדרות מציג סתירות בין מסמכי המקור', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('tab', { name: /סתירות והנחות/ }).click();

  await expect(page.getByText('סתירות בין מסמכי המקור')).toBeVisible();
  // מחיר ההקמה — הסתירה המרכזית
  await expect(page.getByText('14900').first()).toBeVisible();
});

test('מדדים ללא נתוני מקור מוצגים כ"אין נתונים" ולא כאפס', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('אין נתונים').first()).toBeVisible();
});

test('Audit Log מוצג כטבלה שאינה ניתנת לשינוי', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.getByText('הטבלה הזו אינה ניתנת לשינוי')).toBeVisible();
  await expect(page.getByText('append-only')).toBeVisible();
});

test('אינטגרציות במצב Mock מסומנות במפורש', async ({ page }) => {
  await page.goto('/payments');
  await expect(page.getByText('ספק סליקה במצב Mock — לא בוצעו חיובים אמיתיים')).toBeVisible();
});
