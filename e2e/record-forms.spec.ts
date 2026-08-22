import { test, expect } from '@playwright/test';
import { Client } from 'pg';

/**
 * זרימה 6 — יצירה ועריכה של רשומות ליבה.
 *
 * הבדיקה כותבת למסד באמת, כי הערך שלה הוא בדיוק בזה: שהטופס, ה־Server Action,
 * הוולידציה, הטרנזקציה וה־Audit Log עובדים יחד.
 *
 * ⚠ הקוד קבוע ולא אקראי, כדי שבדיקת הכפילות תתייחס לאותה רשומה שנוצרה לפניה.
 * לכן beforeAll מפנה את הקוד: הרשומות הישנות נמחקות רכות ומקבלות קוד אחר,
 * כי אינדקס הייחודיות חל גם על רשומה שנמחקה רכות.
 */

const CLUB_CODE = 'E2E-CRUD';
const CLUB_NAME = 'מועדון בדיקת E2E';
const UPDATED_NAME = `${CLUB_NAME} מעודכן`;

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * מפנה את הקוד הקבוע משאריות של ריצות קודמות.
 * הקוד מוחלף בקוד חדש לגמרי ולא בסיומת נוספת, כדי שריצות חוזרות
 * לא יתקרבו למגבלת 24 התווים של העמודה.
 */
async function releaseCode() {
  await withDb((c) =>
    c.query(
      `UPDATE clubs
       SET code = 'E2EOLD-' || substr(md5(random()::text || id::text), 1, 12),
           deleted_at = COALESCE(deleted_at, now())
       WHERE code LIKE 'E2E-%'`,
    ),
  );
}

test.beforeAll(releaseCode);
// מחיקה רכה בלבד: ה־Audit Log הוא append-only ואי אפשר — ולא נכון — למחוק ממנו.
test.afterAll(releaseCode);

test('יצירת מועדון: הטופס נשמר, מפנה לכרטיס ונרשם ב־Audit Log', async ({ page }) => {
  await page.goto('/clubs');

  await page.getByRole('button', { name: 'מועדון חדש' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'מועדון חדש' })).toBeVisible();

  await dialog.getByLabel('שם המועדון').fill(CLUB_NAME);
  await dialog.getByLabel('קוד מועדון').fill(CLUB_CODE);
  await dialog.getByLabel('עיר').fill('רעננה');
  await dialog.getByLabel('אזור').fill('שרון');
  await dialog.getByLabel('מספר מגרשים').fill('6');
  await dialog.getByRole('button', { name: 'צור מועדון' }).click();

  // הצלחה = ניווט לכרטיס המועדון שנוצר
  await page.waitForURL(/\/clubs\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name: CLUB_NAME })).toBeVisible();
  await expect(page.getByText(CLUB_CODE).first()).toBeVisible();

  const audit = await withDb((c) =>
    c.query(
      `SELECT after_value FROM audit_logs
       WHERE action_key = 'club.create' AND entity_label = $1
       ORDER BY occurred_at DESC LIMIT 1`,
      [CLUB_NAME],
    ),
  );
  expect(audit.rows).toHaveLength(1);
  expect((audit.rows[0].after_value as Record<string, unknown>).code).toBe(CLUB_CODE);
});

test('קוד מועדון כפול נדחה עם שגיאת שדה ולא יוצר רשומה שנייה', async ({ page }) => {
  await page.goto('/clubs');
  await page.getByRole('button', { name: 'מועדון חדש' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('שם המועדון').fill(`${CLUB_NAME} כפול`);
  await dialog.getByLabel('קוד מועדון').fill(CLUB_CODE);
  await dialog.getByLabel('עיר').fill('רעננה');
  await dialog.getByLabel('אזור').fill('שרון');
  await dialog.getByRole('button', { name: 'צור מועדון' }).click();

  await expect(dialog.getByText('קוד תפוס')).toBeVisible();
  // הדיאלוג נשאר פתוח — המשתמש יכול לתקן בלי לאבד את מה שהקליד
  await expect(dialog).toBeVisible();

  const count = await withDb((c) =>
    c.query(`SELECT COUNT(*)::int AS n FROM clubs WHERE code = $1`, [CLUB_CODE]),
  );
  expect(count.rows[0].n).toBe(1);
});

test('עריכת מועדון מעדכנת את הכרטיס ורושמת before/after מדויק', async ({ page }) => {
  const found = await withDb((c) =>
    c.query(`SELECT id FROM clubs WHERE code = $1 AND deleted_at IS NULL`, [CLUB_CODE]),
  );
  const clubId = found.rows[0].id as string;

  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('button', { name: 'עריכת מועדון' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('שם המועדון')).toHaveValue(CLUB_NAME);

  await dialog.getByLabel('שם המועדון').fill(UPDATED_NAME);
  await dialog.getByLabel('מספר מגרשים').fill('9');
  await dialog.getByRole('button', { name: 'שמור שינויים' }).click();

  await expect(page.getByRole('heading', { name: UPDATED_NAME })).toBeVisible();

  const audit = await withDb((c) =>
    c.query(
      `SELECT before_value, after_value FROM audit_logs
       WHERE action_key = 'club.update' AND entity_label = $1
       ORDER BY occurred_at DESC LIMIT 1`,
      [UPDATED_NAME],
    ),
  );
  expect(audit.rows).toHaveLength(1);
  const before = audit.rows[0].before_value as Record<string, unknown>;
  const after = audit.rows[0].after_value as Record<string, unknown>;

  expect(before.name).toBe(CLUB_NAME);
  expect(after.name).toBe(UPDATED_NAME);
  expect(String(after.courtCount)).toBe('9');
  // שדות שלא נגענו בהם אינם מופיעים ברישום
  expect(after).not.toHaveProperty('city');
  expect(after).not.toHaveProperty('offPeakStart');
});

test('שמירה ללא שינוי אינה יוצרת רישום Audit נוסף', async ({ page }) => {
  const found = await withDb((c) =>
    c.query(`SELECT id FROM clubs WHERE code = $1 AND deleted_at IS NULL`, [CLUB_CODE]),
  );
  const clubId = found.rows[0].id as string;

  const countBefore = await withDb((c) =>
    c.query(`SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_key = 'club.update'`),
  );

  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('button', { name: 'עריכת מועדון' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'שמור שינויים' }).click();

  await expect(page.getByText('לא בוצע שינוי')).toBeVisible();

  const countAfter = await withDb((c) =>
    c.query(`SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_key = 'club.update'`),
  );
  expect(countAfter.rows[0].n).toBe(countBefore.rows[0].n);
});

test('טופס עריכת שחקן נטען עם הערכים הקיימים', async ({ page }) => {
  await page.goto('/players');
  // שורת השחקן מכילה גם קישור למועדון — יש לכוון לקישור השחקן במפורש.
  // ניווט ישיר ולא לחיצה: ניווט צד־לקוח אינו מפעיל אירוע load שאפשר להמתין לו.
  const href = await page.locator('table tbody a[href^="/players/"]').first().getAttribute('href');
  await page.goto(href!);

  const heading = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();

  await page.getByRole('button', { name: 'עריכת שחקן' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await expect(dialog.locator('input[name="fullName"]')).toHaveValue(heading);
  // שדות בחירה נטענים עם הערך הנוכחי ולא ריקים
  await expect(dialog.locator('select[name="level"]')).not.toHaveValue('');
  await expect(dialog.locator('select[name="membershipTier"]')).not.toHaveValue('');
  // התווית קשורה לשדה בפועל — לחיצה עליה ממקדת את השדה הנכון
  await expect(dialog.getByLabel('שם מלא')).toHaveValue(heading);
});
