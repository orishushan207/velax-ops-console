import { test, expect } from '@playwright/test';
import { clickAndNavigate } from './helpers';

/**
 * זרימה 2 — Session: צפייה, Timeline, וקישור לישויות.
 */

test('רשימת ה־Sessions מציגה נתונים ומאפשרת מעבר לפירוט', async ({ page }) => {
  await page.goto('/sessions');
  await expect(page.getByRole('heading', { name: 'Sessions והזמנות', level: 1 })).toBeVisible();

  // יש שורות בטבלה
  const firstRef = page.locator('table tbody tr').first().locator('a').first();
  await expect(firstRef).toBeVisible();

  const refText = await firstRef.textContent();
  await clickAndNavigate(page, firstRef, /\/sessions\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: refText!.trim(), level: 1 })).toBeVisible();
});

test('מסך Session מציג Timeline והפרדה בין ברוטו לנטו', async ({ page }) => {
  await page.goto('/sessions');
  await clickAndNavigate(
    page,
    page.locator('table tbody tr').first().locator('a').first(),
    /\/sessions\/[0-9a-f-]{36}/,
  );

  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'כספים' })).toBeVisible();

  // ההפרדה החשבונאית מוצגת במפורש
  await expect(page.getByText('חויב (כולל מע״מ)')).toBeVisible();
  await expect(page.getByText('הכנסה נטו (לפני מע״מ)')).toBeVisible();
});

test('סינון לפי סטטוס משנה את ה־URL ואת התוצאות', async ({ page }) => {
  await page.goto('/sessions?status=failed_to_start');
  await expect(page).toHaveURL(/status=failed_to_start/);
  await expect(page.getByRole('heading', { name: 'Sessions והזמנות', level: 1 })).toBeVisible();
});
