import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * תיעוד חבטות.
 *
 * ⚠ הבדיקה המרכזית כאן היא מניעת כפילות: האפליקציה שולחת בקבוצות, ורשת
 * סלולרית לא יציבה תגרום לשליחה חוזרת. בלי האינדקס הייחודי כל ניסיון
 * חוזר היה מכפיל את מספר החבטות ומזהם את המדדים.
 */

let pool: Pool;
let sessionId: string;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const s = await pool.query(
    `SELECT id FROM sessions WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
  );
  sessionId = s.rows[0].id;
  await pool.query(`DELETE FROM shot_events WHERE session_id = $1`, [sessionId]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM shot_events WHERE session_id = $1`, [sessionId]);
  await pool.end();
});

async function insertShot(sequence: number, speedKmh: number | null = null) {
  return pool.query(
    `INSERT INTO shot_events (session_id, sequence, fired_at, commanded_velocity, derived_speed_kmh)
     VALUES ($1, $2, now(), 120, $3)
     ON CONFLICT (session_id, sequence) DO NOTHING
     RETURNING id`,
    [sessionId, sequence, speedKmh],
  );
}

describe('מניעת כפילות', () => {
  it('שליחה חוזרת של אותו רצף אינה יוצרת שורה נוספת', async () => {
    const first = await insertShot(1);
    expect(first.rows).toHaveLength(1);

    const retry = await insertShot(1);
    expect(retry.rows).toHaveLength(0);

    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM shot_events WHERE session_id = $1 AND sequence = 1`,
      [sessionId],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('אותו מספר רצף בסשן אחר הוא חבטה נפרדת', async () => {
    // ⚠ הייחודיות היא לפי סשן, לא גלובלית
    const other = await pool.query(
      `SELECT id FROM sessions WHERE id <> $1 AND deleted_at IS NULL LIMIT 1`,
      [sessionId],
    );
    const otherId = other.rows[0].id;
    await pool.query(
      `INSERT INTO shot_events (session_id, sequence, fired_at) VALUES ($1, 1, now())
       ON CONFLICT DO NOTHING`,
      [otherId],
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM shot_events WHERE sequence = 1 AND session_id IN ($1, $2)`,
      [sessionId, otherId],
    );
    expect(count.rows[0].n).toBe(2);
    await pool.query(`DELETE FROM shot_events WHERE session_id = $1`, [otherId]);
  });
});

describe('הפרדה בין ערך שנשלח לערך שנגזר', () => {
  it('חבטה בלי כיול שומרת ערך בקרה בלי קמ״ש', async () => {
    // ⚠ היעדר קמ״ש אינו חוסם רישום. הערך הגולמי הוא הנתון האמין.
    await insertShot(10, null);
    const r = await pool.query(
      `SELECT commanded_velocity, derived_speed_kmh FROM shot_events
       WHERE session_id = $1 AND sequence = 10`,
      [sessionId],
    );
    expect(Number(r.rows[0].commanded_velocity)).toBe(120);
    expect(r.rows[0].derived_speed_kmh).toBeNull();
  });

  it('סיכום מחשב ממוצע רק על חבטות עם ערך גזור', async () => {
    await insertShot(20, 30);
    await insertShot(21, 40);
    await insertShot(22, null);

    const r = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(derived_speed_kmh)::int AS with_derived,
              AVG(derived_speed_kmh) AS avg
       FROM shot_events WHERE session_id = $1 AND sequence IN (20,21,22)`,
      [sessionId],
    );
    expect(r.rows[0].total).toBe(3);
    expect(r.rows[0].with_derived).toBe(2);
    // ⚠ הממוצע על שתיים ולא על שלוש: NULL אינו אפס
    expect(Number(r.rows[0].avg)).toBe(35);
  });
});
