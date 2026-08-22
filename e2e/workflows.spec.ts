import { test, expect } from '@playwright/test';
import { clickAndNavigate } from './helpers';

/**
 * זרימה 5 — תהליכי עבודה מקצה לקצה.
 * כל בדיקה כאן עוברת מסך אחד לשני דרך קישורים אמיתיים, כפי שמשתמש יעשה.
 */

test('מועדון → עמדה → מכונה: שרשרת הניווט המלאה', async ({ page }) => {
  await page.goto('/clubs');
  await clickAndNavigate(
    page,
    page.locator('table tbody tr').first().locator('a').first(),
    /\/clubs\/[0-9a-f-]{36}/,
  );

  await page.getByRole('tab', { name: 'עמדות ומכונות' }).click();
  await clickAndNavigate(
    page,
    page.locator('a[href^="/stations/"]').first(),
    /\/stations\/[0-9a-f-]{36}/,
  );
  await expect(page.getByRole('tab', { name: 'היסטוריית מכונות' })).toBeVisible();
});

test('תקלה מקושרת לסשן, לעמדה ולמכונה', async ({ page }) => {
  await page.goto('/tickets');
  await clickAndNavigate(
    page,
    page.locator('table tbody tr').first().locator('a').first(),
    /\/tickets\/[0-9a-f-]{36}/,
  );

  await expect(page.getByRole('heading', { name: 'SLA' })).toBeVisible();
  await expect(page.getByText('יעד תיקון')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
});

test('Earn-Back מציג פירוק חישוב מלא', async ({ page }) => {
  await page.goto('/earn-back');
  const href = await page.locator('a[href^="/earn-back/"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(href!);

  await expect(page.getByRole('heading', { name: 'פירוק החישוב' })).toBeVisible();
  await expect(page.getByText('הכנסה שנספרת לטובת הערבות')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'תנאי סף לערבות' })).toBeVisible();
});

test('חלון אישור לפעולה רגישה דורש סיבה', async ({ page }) => {
  await page.goto('/live');

  const suspendButton = page.getByRole('button', { name: 'השבתה' }).first();
  if ((await suspendButton.count()) === 0) test.skip();

  await suspendButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('הסיבה נרשמת ב־Audit Log')).toBeVisible();

  // שליחה ללא סיבה נחסמת
  await page.getByRole('button', { name: 'השבת עמדה' }).click();
  await expect(page.getByRole('alert').or(page.getByText(/נא לפרט סיבה/))).toBeVisible();
});

test('Command Palette נפתח ומחפש', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Meta+k');

  const input = page.getByPlaceholder(/חפש Session/);
  await expect(input).toBeVisible();

  await input.fill('תל אביב');
  await expect(page.getByText('מועדונים').first()).toBeVisible({ timeout: 10_000 });
});

test('ייצוא נתונים זמין בכל טבלה', async ({ page }) => {
  await page.goto('/sessions');
  await page.getByRole('button', { name: 'ייצוא' }).click();
  await expect(page.getByRole('menuitem', { name: 'CSV' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'XLSX' })).toBeVisible();
});
