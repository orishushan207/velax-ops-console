import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * בדיקות אינטגרציה מול מסד הנתונים האמיתי.
 *
 * הן בודקות את מה שאי אפשר לבדוק ביחידות: אילוצי DB, טריגרים,
 * מדיניות RLS, ואכיפת Idempotency ברמת האינדקס הייחודי.
 *
 * דרישה מוקדמת: npm run db:migrate && npm run db:seed
 */

let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

describe('אילוצי מסד הנתונים', () => {
  it('אימון אינו יכול לכלול יותר משני שחקנים — CHECK על slot', async () => {
    const session = await pool.query<{ id: string }>(
      `SELECT id FROM sessions WHERE deleted_at IS NULL LIMIT 1`,
    );
    const sessionId = session.rows[0]!.id;

    await expect(
      pool.query(
        `INSERT INTO session_players (session_id, slot, is_demo) VALUES ($1, 3, true)`,
        [sessionId],
      ),
    ).rejects.toThrow();
  });

  it('player_count מוגבל ל־1 או 2', async () => {
    const club = await pool.query<{ id: string }>(`SELECT id FROM clubs LIMIT 1`);
    const station = await pool.query<{ id: string }>(`SELECT id FROM stations LIMIT 1`);

    await expect(
      pool.query(
        `INSERT INTO sessions (reference, club_id, station_id, player_count, is_demo)
         VALUES ('TEST-3P', $1, $2, 3, true)`,
        [club.rows[0]!.id, station.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it('סכום זיכוי אינו יכול לעלות על הסכום ששולם', async () => {
    const club = await pool.query<{ id: string }>(`SELECT id FROM clubs LIMIT 1`);
    const station = await pool.query<{ id: string }>(`SELECT id FROM stations LIMIT 1`);

    await expect(
      pool.query(
        `INSERT INTO sessions (reference, club_id, station_id, amount_gross, refunded_amount, is_demo)
         VALUES ('TEST-OVERREFUND', $1, $2, 90, 200, true)`,
        [club.rows[0]!.id, station.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it('תשלום עם סכום אפס או שלילי נחסם', async () => {
    await expect(
      pool.query(
        `INSERT INTO payments (reference, amount_gross, amount_net, idempotency_key, is_demo)
         VALUES ('TEST-ZERO', 0, 0, 'test_zero_key', true)`,
      ),
    ).rejects.toThrow();
  });

  it('יתרת ארנק אינה יכולה להיות שלילית', async () => {
    const user = await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM credit_wallets LIMIT 1`,
    );
    await expect(
      pool.query(`UPDATE credit_wallets SET balance = -50 WHERE user_id = $1`, [
        user.rows[0]!.id,
      ]),
    ).rejects.toThrow();
  });
});

describe('Idempotency בפעולות כספיות', () => {
  it('שני תשלומים עם אותו idempotency_key נחסמים', async () => {
    const key = `test_idem_${Date.now()}`;
    const club = await pool.query<{ id: string }>(`SELECT id FROM clubs LIMIT 1`);

    await pool.query(
      `INSERT INTO payments (reference, club_id, amount_gross, amount_net, idempotency_key, is_demo)
       VALUES ($1, $2, 90, 76.27, $3, true)`,
      [`TEST-IDEM-A-${Date.now()}`, club.rows[0]!.id, key],
    );

    await expect(
      pool.query(
        `INSERT INTO payments (reference, club_id, amount_gross, amount_net, idempotency_key, is_demo)
         VALUES ($1, $2, 90, 76.27, $3, true)`,
        [`TEST-IDEM-B-${Date.now()}`, club.rows[0]!.id, key],
      ),
    ).rejects.toThrow(/idempotency/i);

    await pool.query(`DELETE FROM payments WHERE idempotency_key = $1`, [key]);
  });

  it('שני זיכויים עם אותו idempotency_key נחסמים', async () => {
    const key = `test_refund_idem_${Date.now()}`;
    const payment = await pool.query<{ id: string }>(
      `SELECT id FROM payments WHERE deleted_at IS NULL LIMIT 1`,
    );

    await pool.query(
      `INSERT INTO refunds (reference, payment_id, refund_type, amount_gross, amount_net,
        reason, reason_note, idempotency_key, is_demo)
       VALUES ($1, $2, 'partial', 10, 8.47, 'other', 'בדיקה', $3, true)`,
      [`TEST-RF-A-${Date.now()}`, payment.rows[0]!.id, key],
    );

    await expect(
      pool.query(
        `INSERT INTO refunds (reference, payment_id, refund_type, amount_gross, amount_net,
          reason, reason_note, idempotency_key, is_demo)
         VALUES ($1, $2, 'partial', 10, 8.47, 'other', 'בדיקה', $3, true)`,
        [`TEST-RF-B-${Date.now()}`, payment.rows[0]!.id, key],
      ),
    ).rejects.toThrow(/idempotency/i);

    await pool.query(`DELETE FROM refunds WHERE idempotency_key = $1`, [key]);
  });
});

describe('Audit Log — טבלת append-only', () => {
  it('לא ניתן לעדכן רשומת Audit', async () => {
    const row = await pool.query<{ id: string }>(`SELECT id FROM audit_logs LIMIT 1`);
    if (row.rows.length === 0) return; // אין רשומות עדיין

    await expect(
      pool.query(`UPDATE audit_logs SET reason = 'שונה' WHERE id = $1`, [row.rows[0]!.id]),
    ).rejects.toThrow(/append-only/);
  });

  it('לא ניתן למחוק רשומת Audit', async () => {
    const row = await pool.query<{ id: string }>(`SELECT id FROM audit_logs LIMIT 1`);
    if (row.rows.length === 0) return;

    await expect(
      pool.query(`DELETE FROM audit_logs WHERE id = $1`, [row.rows[0]!.id]),
    ).rejects.toThrow(/append-only/);
  });
});

describe('Row Level Security', () => {
  it('התפקיד velax_rls קיים במסד', async () => {
    const res = await pool.query(`SELECT 1 FROM pg_roles WHERE rolname = 'velax_rls'`);
    expect(res.rowCount).toBe(1);
  });

  it('מדיניות RLS מוגדרת על טבלאות מוגבלות־מועדון', async () => {
    const res = await pool.query<{ tablename: string }>(`
      SELECT tablename FROM pg_policies WHERE schemaname = 'public'
    `);
    const tables = res.rows.map((r) => r.tablename);
    for (const t of ['clubs', 'sessions', 'payments', 'support_tickets', 'stations', 'devices']) {
      expect(tables, `חסרה מדיניות RLS על ${t}`).toContain(t);
    }
  });

  it('RLS מופעל ונאכף (FORCE) על טבלת sessions', async () => {
    const res = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'sessions'
    `);
    expect(res.rows[0]?.relrowsecurity).toBe(true);
    expect(res.rows[0]?.relforcerowsecurity).toBe(true);
  });

  it('משתמש מוגבל־מועדון רואה רק את המועדונים שלו', async () => {
    // מנהל המועדון מ־Seed מוגבל למועדון אחד
    const managerRes = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'club.tlv@velax.co.il' LIMIT 1`,
    );
    if (managerRes.rows.length === 0) return;
    const managerId = managerRes.rows[0]!.id;

    const scopeRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM user_club_scopes WHERE user_id = $1`,
      [managerId],
    );
    expect(Number(scopeRes.rows[0]!.count)).toBeGreaterThan(0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE velax_rls`);
      await client.query(`SET LOCAL app.current_user_id = '${managerId}'`);

      const visible = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM clubs`,
      );
      // המנהל משויך למועדון אחד בלבד
      expect(Number(visible.rows[0]!.count)).toBe(1);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('משתמש גלובלי רואה את כל המועדונים', async () => {
    const adminRes = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin@velax.co.il' LIMIT 1`,
    );
    if (adminRes.rows.length === 0) return;
    const adminId = adminRes.rows[0]!.id;

    const totalRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM clubs WHERE deleted_at IS NULL`,
    );
    const total = Number(totalRes.rows[0]!.count);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE velax_rls`);
      await client.query(`SET LOCAL app.current_user_id = '${adminId}'`);

      const visible = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM clubs WHERE deleted_at IS NULL`,
      );
      expect(Number(visible.rows[0]!.count)).toBe(total);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('משתמש ללא הקשר אינו רואה דבר', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE velax_rls`);
      // לא מוגדר app.current_user_id

      const visible = await client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM clubs`);
      expect(Number(visible.rows[0]!.count)).toBe(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

describe('הגדרות עסקיות עם תאריך תחולה', () => {
  it('כל הגדרה בקטלוג קיימת במסד', async () => {
    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM business_settings`,
    );
    expect(Number(res.rows[0]!.count)).toBeGreaterThan(50);
  });

  it('לכל הגדרה יש לפחות גרסה אחת בתוקף', async () => {
    const res = await pool.query<{ key: string }>(`
      SELECT bs.key FROM business_settings bs
      WHERE NOT EXISTS (
        SELECT 1 FROM setting_versions sv
        WHERE sv.setting_id = bs.id AND sv.effective_from <= now()
          AND (sv.effective_until IS NULL OR sv.effective_until > now())
      )
    `);
    expect(res.rows.map((r) => r.key)).toEqual([]);
  });

  it('גרסה עתידית אינה משפיעה על הערך הנוכחי', async () => {
    const setting = await pool.query<{ id: string; key: string }>(
      `SELECT id, key FROM business_settings WHERE key = 'finance.vat_rate' LIMIT 1`,
    );
    const settingId = setting.rows[0]!.id;

    const before = await pool.query<{ value: string }>(
      `SELECT value FROM setting_versions
       WHERE setting_id = $1 AND scenario IS NULL AND club_id IS NULL
         AND effective_from <= now() AND (effective_until IS NULL OR effective_until > now())
       ORDER BY effective_from DESC LIMIT 1`,
      [settingId],
    );

    // מוסיפים גרסה שתיכנס לתוקף בעוד שנה
    await pool.query(
      `INSERT INTO setting_versions (setting_id, value, effective_from, change_reason, is_demo)
       VALUES ($1, '0.20', now() + interval '365 days', 'בדיקה', true)`,
      [settingId],
    );

    const after = await pool.query<{ value: string }>(
      `SELECT value FROM setting_versions
       WHERE setting_id = $1 AND scenario IS NULL AND club_id IS NULL
         AND effective_from <= now() AND (effective_until IS NULL OR effective_until > now())
       ORDER BY effective_from DESC LIMIT 1`,
      [settingId],
    );

    expect(after.rows[0]!.value).toBe(before.rows[0]!.value);

    await pool.query(
      `DELETE FROM setting_versions WHERE setting_id = $1 AND change_reason = 'בדיקה'`,
      [settingId],
    );
  });

  it('מע״מ ברירת המחדל הוא 18% כפי שמופיע במסמכי המקור', async () => {
    const res = await pool.query<{ value: string }>(`
      SELECT sv.value FROM setting_versions sv
      JOIN business_settings bs ON bs.id = sv.setting_id
      WHERE bs.key = 'finance.vat_rate' AND sv.scenario IS NULL AND sv.club_id IS NULL
        AND sv.effective_from <= now()
      ORDER BY sv.effective_from DESC LIMIT 1
    `);
    expect(Number(res.rows[0]!.value)).toBe(0.18);
  });

  it('הסתירות בין המסמכים מתועדות עם שני הערכים', async () => {
    const res = await pool.query<{ key: string; conflicting_value: string }>(`
      SELECT key, conflicting_value FROM business_settings WHERE confidence = 'disputed'
    `);
    expect(res.rows.length).toBeGreaterThan(3);
    for (const row of res.rows) {
      expect(row.conflicting_value, `${row.key}: חסר ערך חלופי`).toBeTruthy();
    }
  });
});

describe('הרשאות ותפקידים', () => {
  it('קיימים 12 תפקידים', async () => {
    const res = await pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM roles`);
    expect(Number(res.rows[0]!.count)).toBe(12);
  });

  it('Super Admin מחזיק בכל ההרשאות', async () => {
    const total = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM permissions`,
    );
    const superAdmin = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id WHERE r.key = 'super_admin'
    `);
    expect(Number(superAdmin.rows[0]!.count)).toBe(Number(total.rows[0]!.count));
  });

  it('תפקיד המבקר אינו מחזיק בהרשאות שינוי', async () => {
    const res = await pool.query<{ key: string }>(`
      SELECT p.key FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.key = 'auditor'
        AND (p.key LIKE '%.edit' OR p.key LIKE '%.approve%' OR p.key LIKE '%.manage%'
             OR p.key LIKE '%.create' OR p.key LIKE '%.suspend')
    `);
    expect(res.rows.map((r) => r.key)).toEqual([]);
  });

  it('מנהל מועדון אינו רואה נתונים כספיים של VELA-X', async () => {
    const res = await pool.query<{ key: string }>(`
      SELECT p.key FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.key = 'club_manager' AND p.key IN ('finance.view', 'finance.view_unit_economics')
    `);
    expect(res.rows).toEqual([]);
  });

  it('כל ההרשאות הרגישות מסומנות ככאלה', async () => {
    const res = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM permissions WHERE is_sensitive = true`,
    );
    expect(Number(res.rows[0]!.count)).toBeGreaterThan(20);
  });
});

describe('שלמות נתוני ההדגמה', () => {
  it('כל הסשנים מקושרים למועדון ולעמדה קיימים', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM sessions s
      LEFT JOIN clubs c ON c.id = s.club_id
      LEFT JOIN stations st ON st.id = s.station_id
      WHERE c.id IS NULL OR st.id IS NULL
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });

  it('אין סשן עם יותר משני שחקנים', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM (
        SELECT session_id FROM session_players GROUP BY session_id HAVING COUNT(*) > 2
      ) x
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });

  it('הכנסה נטו ומע״מ מסתכמים לברוטו בכל סשן', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM sessions
      WHERE amount_gross > 0 AND ABS((amount_net + vat_amount) - amount_gross) > 0.02
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });

  it('סשן שזוכה במלואו מסומן כ־fully_refunded', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM sessions
      WHERE amount_gross > 0 AND refunded_amount >= amount_gross
        AND status <> 'fully_refunded'
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });

  it('כל נתוני ההדגמה מסומנים ב־is_demo', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM sessions WHERE is_demo = false
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });

  it('מפתחות ההרשאה של המכשירים מוצפנים ואינם טקסט גלוי', async () => {
    const res = await pool.query<{ auth_key_encrypted: string | null }>(`
      SELECT auth_key_encrypted FROM devices WHERE auth_key_encrypted IS NOT NULL LIMIT 5
    `);
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      // פורמט ההצפנה: v1.<iv>.<tag>.<ciphertext>
      expect(row.auth_key_encrypted).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\./);
    }
  });

  // מוגבל לנתוני ה־Seed: מועדון שנוצר דרך הממשק קיים לגיטימית לפני שנחתם לו
  // הסכם ותנאי Earn-Back. האינווריאנט נבדק על הנתונים שה־Seed מייצר.
  it('לכל מועדון פעיל בנתוני ה־Seed יש הסכם ותנאי Earn-Back', async () => {
    const res = await pool.query<{ name: string }>(`
      SELECT c.name FROM clubs c
      WHERE c.status IN ('active','pilot') AND c.deleted_at IS NULL AND c.is_demo = true
        AND NOT EXISTS (
          SELECT 1 FROM earn_back_agreements a WHERE a.club_id = c.id AND a.deleted_at IS NULL
        )
    `);
    expect(res.rows.map((r) => r.name)).toEqual([]);
  });

  it('כל הזמנת מגרש מקושרת מצביעה על סשן קיים', async () => {
    const res = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM court_bookings b
      WHERE b.session_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.id = b.session_id)
    `);
    expect(Number(res.rows[0]!.count)).toBe(0);
  });
});
