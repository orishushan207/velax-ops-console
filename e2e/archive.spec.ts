import { test, expect } from '@playwright/test';
import { Client } from 'pg';

/**
 * זרימה 7 — ארכוב מועדון ועמדה.
 *
 * הבדיקה מוודאת שלושה דברים: שהחסימות באמת חוסמות, שהארכוב הוא רך בלבד,
 * ושהסיבה נשמרת ב־Audit Log. מחיקה קשיחה הייתה הופכת דוח היסטורי לשקרי,
 * ולכן היעדר מחיקה קשיחה הוא עצמו דרישה שנבדקת כאן.
 */

const CLUB_CODE = 'E2E-ARCH';
const STATION_CODE = 'E2E-ST1';

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

let clubId = '';
let stationId = '';

test.beforeAll(async () => {
  await withDb(async (c) => {
    // מפנה קודים משאריות ריצה קודמת — אינדקס הייחודיות חל גם על רשומה מחוקה רכות
    await c.query(
      `UPDATE clubs SET code = 'E2EOLD-' || substr(md5(random()::text || id::text), 1, 12),
       deleted_at = COALESCE(deleted_at, now()) WHERE code LIKE 'E2E-ARCH%'`,
    );
    await c.query(
      `UPDATE stations SET code = 'OLD-' || substr(md5(random()::text || id::text), 1, 12),
       deleted_at = COALESCE(deleted_at, now()) WHERE code LIKE 'E2E-ST%'`,
    );

    const club = await c.query(
      `INSERT INTO clubs (code, name, region, city, status, court_count)
       VALUES ($1, 'מועדון ארכוב E2E', 'שרון', 'רעננה', 'pilot', 4) RETURNING id`,
      [CLUB_CODE],
    );
    clubId = club.rows[0].id;

    const station = await c.query(
      `INSERT INTO stations (club_id, code, name, station_type, status)
       VALUES ($1, $2, 'עמדת ארכוב E2E', 'lean', 'active') RETURNING id`,
      [clubId, STATION_CODE],
    );
    stationId = station.rows[0].id;
  });
});

test.afterAll(async () => {
  await withDb(async (c) => {
    await c.query(
      `UPDATE stations SET code = 'OLD-' || substr(md5(random()::text || id::text), 1, 12),
       deleted_at = COALESCE(deleted_at, now()) WHERE code LIKE 'E2E-ST%'`,
    );
    await c.query(
      `UPDATE clubs SET code = 'E2EOLD-' || substr(md5(random()::text || id::text), 1, 12),
       deleted_at = COALESCE(deleted_at, now()) WHERE code LIKE 'E2E-ARCH%'`,
    );
  });
});

test('ארכוב מועדון חסום כל עוד יש בו עמדה פעילה', async ({ page }) => {
  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('button', { name: 'ארכוב מועדון' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('סיבת הארכוב').fill('בדיקת חסימה כאשר קיימת עמדה פעילה');
  await dialog.getByRole('button', { name: 'ארכב מועדון' }).click();

  await expect(dialog.getByText(/לא ניתן לארכב את המועדון/)).toBeVisible();
  // ריבוי תקין בעברית: יחיד אינו "1 עמדות"
  await expect(dialog.getByText(/עמדה אחת פעילה/)).toBeVisible();

  const still = await withDb((c) =>
    c.query(`SELECT deleted_at FROM clubs WHERE id = $1`, [clubId]),
  );
  expect(still.rows[0].deleted_at).toBeNull();
});

test('סיבת ארכוב קצרה מדי נדחית', async ({ page }) => {
  await page.goto(`/stations/${stationId}`);
  await page.getByRole('button', { name: 'ארכוב עמדה' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('סיבת הארכוב').fill('קצר');
  await dialog.getByRole('button', { name: 'ארכב עמדה' }).click();

  await expect(dialog.getByText(/10 תווים לפחות/)).toBeVisible();
});

test('ארכוב עמדה: מחיקה רכה בלבד, עם סיבה ב־Audit Log', async ({ page }) => {
  await page.goto(`/stations/${stationId}`);
  await page.getByRole('button', { name: 'ארכוב עמדה' }).click();

  const reason = 'העמדה הוסרה פיזית מהמועדון בסיום הפיילוט';
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('סיבת הארכוב').fill(reason);
  await dialog.getByRole('button', { name: 'ארכב עמדה' }).click();

  await page.waitForURL(/\/stations\/?$/);

  const row = await withDb((c) =>
    c.query(`SELECT status, deleted_at FROM stations WHERE id = $1`, [stationId]),
  );
  // ⚠ הרשומה עדיין קיימת — ארכוב אינו מוחק היסטוריה כספית
  expect(row.rows).toHaveLength(1);
  expect(row.rows[0].deleted_at).not.toBeNull();
  expect(row.rows[0].status).toBe('decommissioned');

  const audit = await withDb((c) =>
    c.query(
      `SELECT action, reason FROM audit_logs
       WHERE action_key = 'station.archive' AND entity_id = $1`,
      [stationId],
    ),
  );
  expect(audit.rows).toHaveLength(1);
  expect(audit.rows[0].action).toBe('soft_delete');
  expect(audit.rows[0].reason).toBe(reason);
});

test('לאחר ארכוב העמדה, ארכוב המועדון מתאפשר', async ({ page }) => {
  await page.goto(`/clubs/${clubId}`);
  await page.getByRole('button', { name: 'ארכוב מועדון' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('סיבת הארכוב').fill('הפיילוט הסתיים והמועדון אינו ממשיך להתקשרות');
  await dialog.getByRole('button', { name: 'ארכב מועדון' }).click();

  await page.waitForURL(/\/clubs\/?$/);

  const row = await withDb((c) =>
    c.query(`SELECT status, deleted_at FROM clubs WHERE id = $1`, [clubId]),
  );
  expect(row.rows[0].deleted_at).not.toBeNull();
  expect(row.rows[0].status).toBe('churned');

  // המועדון נעלם מהרשימה אך הרשומה נשמרה
  await expect(page.getByRole('cell', { name: 'מועדון ארכוב E2E' })).toHaveCount(0);
});
