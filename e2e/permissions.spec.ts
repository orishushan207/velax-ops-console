import { test, expect } from '@playwright/test';

/**
 * זרימה 3 — הרשאות והיקף מועדונים.
 *
 * זו הבדיקה הכי חשובה מבחינת אבטחה: היא מוודאת שמנהל מועדון
 * לא רואה נתונים שאינם שלו, ושמבקר אינו רואה כפתורי פעולה.
 */

test.use({ storageState: { cookies: [], origins: [] } });

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('Velax!2026');
  await page.getByRole('button', { name: 'כניסה' }).click();
  await page.waitForURL('/');
}

test('מנהל מועדון רואה רק את המועדון שלו', async ({ page }) => {
  await loginAs(page, 'club.tlv@velax.co.il');
  await page.goto('/clubs');

  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('תל אביב');
});

test('מנהל מועדון אינו רואה את מסך הכספים בניווט', async ({ page }) => {
  await loginAs(page, 'club.tlv@velax.co.il');
  const nav = page.getByRole('navigation', { name: 'ניווט ראשי' }).first();
  await expect(nav.getByRole('link', { name: 'כספים וכלכלת יחידה' })).toHaveCount(0);
});

test('מבקר רואה נתונים אך ללא כפתורי פעולה', async ({ page }) => {
  await loginAs(page, 'auditor@velax.co.il');

  await page.goto('/stations');
  await expect(page.getByRole('heading', { name: 'עמדות ומכונות', level: 1 })).toBeVisible();
  // אין הרשאת devices.register ולכן אין כפתור רישום
  await expect(page.getByRole('button', { name: 'רישום מכשיר' })).toHaveCount(0);

  await page.goto('/tickets');
  await expect(page.getByRole('button', { name: 'קריאה חדשה' })).toHaveCount(0);
});

test('משתמש ללא הרשאה מופנה למסך התחברות', async ({ page }) => {
  await page.goto('/finance');
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'התחברות למערכת' })).toBeVisible();
});

test('התחברות עם סיסמה שגויה נכשלת בהודעה גנרית', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill('admin@velax.co.il');
  await page.getByLabel('סיסמה').fill('wrong-password');
  await page.getByRole('button', { name: 'כניסה' }).click();

  // Next מוסיף route announcer עם role="alert"; מסננים לפי התוכן
  await expect(
    page.getByRole('alert').filter({ hasText: 'האימייל או הסיסמה' }),
  ).toBeVisible();
});
