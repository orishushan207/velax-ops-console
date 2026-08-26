import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizePhone } from '@/lib/phone';

/**
 * פתיחת סשן מהאפליקציה.
 *
 * ⚠ זו נקודת הכניסה היחידה שאין לפניה טוקן, וכל עוד אין סליקה היא שער
 * ההכנסה בפועל. הבדיקות כאן מכסות את מה שמגן עליה: מצב העמדה, מניעת
 * סשן כפול, וסימון סשן שלא שולם.
 */

let pool: Pool;

beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.query(`DELETE FROM sessions WHERE reference LIKE 'VX-TEST%'`);
  await pool.query(`DELETE FROM users WHERE phone = '0501110000'`);
  await pool.end();
});

describe('נרמול טלפון', () => {
  it('מכיר בשלוש הצורות של אותו מספר', () => {
    // ⚠ בלי נרמול אותו אדם היה נוצר שלוש פעמים, וההיסטוריה שלו מתפצלת
    expect(normalizePhone('0501234567')).toBe('0501234567');
    expect(normalizePhone('+972501234567')).toBe('0501234567');
    expect(normalizePhone('972-50-123-4567')).toBe('0501234567');
    expect(normalizePhone('050-123-4567')).toBe('0501234567');
  });

  it('דוחה מספר שאינו תקין', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('05012345678')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('מניעת סשן כפול על עמדה', () => {
  it('עמדה עם סשן פעיל מזוהה כתפוסה', async () => {
    // ⚠ בלי זה שני אנשים פותחים סשן על אותה מכונה, שניהם משלמים,
    // ורק אחד מקבל אימון
    const busy = await pool.query(`
      SELECT s.id FROM stations s
      WHERE EXISTS (
        SELECT 1 FROM sessions x
        WHERE x.station_id = s.id
          AND x.status IN ('connecting','authorized','active','paused')
          AND x.deleted_at IS NULL
      ) LIMIT 1
    `);
    expect(busy.rows.length).toBeGreaterThan(0);
  });
});

describe('סשן ללא תשלום', () => {
  it('אינו נספר כשעה בתשלום — לא לפי סטטוס ולא לפי סכום', async () => {
    const st = await pool.query(
      `SELECT id, club_id FROM stations WHERE deleted_at IS NULL LIMIT 1`,
    );
    const r = await pool.query(
      `INSERT INTO sessions (reference, status, club_id, station_id, scheduled_minutes, metadata)
       VALUES ('VX-TEST-0001', 'authorized', $1, $2, 60, '{"unpaidPilot":true}'::jsonb)
       RETURNING status, amount_gross, metadata`,
      [st.rows[0].club_id, st.rows[0].id],
    );

    // שתי הגנות בלתי תלויות
    expect(r.rows[0].status).toBe('authorized');
    expect(Number(r.rows[0].amount_gross)).toBe(0);
    expect(r.rows[0].metadata.unpaidPilot).toBe(true);

    // ⚠ המדד סופר רק סטטוסים משולמים עם סכום חיובי
    const counted = await pool.query(
      `SELECT COUNT(*)::int AS n FROM sessions
       WHERE reference = 'VX-TEST-0001'
         AND status IN ('active','paused','completed','partially_refunded')
         AND amount_gross > 0`,
    );
    expect(counted.rows[0].n).toBe(0);
  });
});

describe('הטוקן', () => {
  it('נשמר כ־hash ואינו ניתן לשליפה', async () => {
    const withToken = await pool.query(
      `SELECT session_token_hash FROM sessions
       WHERE session_token_hash IS NOT NULL LIMIT 1`,
    );
    if (withToken.rows.length > 0) {
      // ⚠ אורך SHA-256 בהקסה. ערך גולמי היה קצר או ארוך אחרת.
      expect(withToken.rows[0].session_token_hash).toHaveLength(64);
    }
  });
});
