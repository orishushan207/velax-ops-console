import { test, expect } from '@playwright/test';

/**
 * זרימה 1 — ניווט וטעינת כל המסכים.
 * מוודא שאין מסך שנשבר ושכל אזור בניווט מוביל למקום אמיתי.
 */

const SCREENS = [
  { path: '/', heading: 'מרכז שליטה' },
  { path: '/live', heading: 'פעילות בזמן אמת' },
  { path: '/sessions', heading: 'Sessions והזמנות' },
  { path: '/tickets', heading: 'תקלות ושירות' },
  { path: '/maintenance', heading: 'תחזוקה ומלאי' },
  { path: '/clubs', heading: 'מועדונים' },
  { path: '/stations', heading: 'עמדות ומכונות' },
  { path: '/players', heading: 'לקוחות ושחקנים' },
  { path: '/coaches', heading: 'מאמנים' },
  { path: '/payments', heading: 'תשלומים וזיכויים' },
  { path: '/earn-back', heading: 'Earn-Back — ערבות ההחזר' },
  { path: '/finance', heading: 'כספים וכלכלת יחידה' },
  { path: '/crm', heading: 'CRM ומכירות' },
  { path: '/content', heading: 'תוכן ותוכניות אימון' },
  { path: '/rewards', heading: 'Rewards וקופונים' },
  { path: '/screens', heading: 'מסכים וקמפיינים' },
  { path: '/reports', heading: 'דוחות ו־Analytics' },
  { path: '/notifications', heading: 'התראות ואוטומציות' },
  { path: '/users', heading: 'משתמשי מערכת והרשאות' },
  { path: '/audit', heading: 'Audit Log' },
  { path: '/settings', heading: 'הגדרות' },
];

for (const screen of SCREENS) {
  test(`מסך ${screen.heading} נטען ללא שגיאה`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(screen.path);
    await expect(page.getByRole('heading', { name: screen.heading, level: 1 })).toBeVisible();

    // אין Error Boundary
    await expect(page.getByText('משהו השתבש')).not.toBeVisible();
    expect(errors, `שגיאות JS במסך ${screen.path}`).toEqual([]);
  });
}

test('המסמך כולו ב־RTL ובעברית', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('באנר נתוני ההדגמה מוצג כשקיימים נתוני Demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('נתוני הדגמה').first()).toBeVisible();
});
