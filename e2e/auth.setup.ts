import { test as setup, expect } from '@playwright/test';

const ADMIN_FILE = 'e2e/.auth/admin.json';

/**
 * התחברות פעם אחת ושמירת ה־session לשאר הבדיקות.
 * זו גם הבדיקה הראשונה: אם ההתחברות נשברה, כל השאר לא ירוץ.
 */
setup('התחברות כ־Super Admin', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'התחברות למערכת' })).toBeVisible();

  await page.getByLabel('אימייל').fill('admin@velax.co.il');
  await page.getByLabel('סיסמה').fill('Velax!2026');
  await page.getByRole('button', { name: 'כניסה' }).click();

  await page.waitForURL('/');
  await expect(page.getByRole('heading', { name: 'מרכז שליטה' })).toBeVisible();

  await page.context().storageState({ path: ADMIN_FILE });
});
