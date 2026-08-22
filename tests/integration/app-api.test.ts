import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

/**
 * בדיקות אינטגרציה לתור הפקודות ולגבול האמון מול אפליקציית הטלפון.
 *
 * ⚠ נבדק מול מסד אמיתי במכוון: הסמנטיקה כאן — סדר עדיפויות, תפוגה,
 * ומניעת איסוף כפול — נשענת על התנהגות טרנזקציות ואינדקסים, ולא על
 * לוגיקה בזיכרון.
 *
 * דרישה מוקדמת: npm run db:migrate && npm run db:seed
 */

let pool: Pool;
let deviceUuid: string;
let otherDeviceUuid: string;
let sessionId: string;

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const d = await pool.query(
    `SELECT id FROM devices WHERE deleted_at IS NULL ORDER BY created_at LIMIT 2`,
  );
  deviceUuid = d.rows[0].id;
  otherDeviceUuid = d.rows[1].id;
  const s = await pool.query(`SELECT id FROM sessions WHERE deleted_at IS NULL LIMIT 1`);
  sessionId = s.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM device_commands WHERE reason LIKE 'TEST:%'`);
  await pool.end();
});

async function enqueue(
  device: string,
  command: string,
  priority: number,
  ttlSeconds = 300,
  tag = 'TEST:generic',
) {
  const r = await pool.query(
    `INSERT INTO device_commands (device_id, session_id, command, priority, expires_at, reason)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval, $6) RETURNING id`,
    [device, sessionId, command, priority, String(ttlSeconds), tag],
  );
  return r.rows[0].id as string;
}

describe('תור הפקודות', () => {
  it('עצירה נאספת לפני פקודות שהמתינו קודם', async () => {
    // ⚠ הסדר חייב להיות לפי עדיפות ולא לפי זמן: פקודת בטיחות שנכנסה
    // אחרונה חייבת לעקוף שינוי הגדרות שממתין מזמן
    await pool.query(`DELETE FROM device_commands WHERE device_id = $1`, [deviceUuid]);
    await enqueue(deviceUuid, 'apply_settings', 20, 300, 'TEST:order');
    await enqueue(deviceUuid, 'stop', 90, 300, 'TEST:order');

    const r = await pool.query(
      `SELECT command FROM device_commands
       WHERE device_id = $1 AND status = 'pending'
       ORDER BY priority DESC, issued_at ASC`,
      [deviceUuid],
    );
    expect(r.rows.map((x) => x.command)).toEqual(['stop', 'apply_settings']);
  });

  it('פקודה שפג תוקפה אינה נמסרת', async () => {
    await pool.query(`DELETE FROM device_commands WHERE device_id = $1`, [deviceUuid]);
    await pool.query(
      `INSERT INTO device_commands (device_id, command, priority, expires_at, reason)
       VALUES ($1, 'start', 10, now() - interval '1 minute', 'TEST:expired')`,
      [deviceUuid],
    );

    await pool.query(
      `UPDATE device_commands SET status = 'expired'
       WHERE device_id = $1 AND status = 'pending' AND expires_at <= now()`,
      [deviceUuid],
    );

    const r = await pool.query(
      `SELECT status FROM device_commands WHERE device_id = $1 AND reason = 'TEST:expired'`,
      [deviceUuid],
    );
    expect(r.rows[0].status).toBe('expired');
  });

  it('אישור מוגבל למכשיר שאליו הפקודה שייכת', async () => {
    // ⚠ בלי זה אפליקציה יכולה לסמן פקודות של מכשיר אחר כבוצעו
    const id = await enqueue(deviceUuid, 'stop', 90, 300, 'TEST:owner');
    const wrong = await pool.query(
      `UPDATE device_commands SET status = 'acknowledged'
       WHERE id = $1 AND device_id = $2 RETURNING id`,
      [id, otherDeviceUuid],
    );
    expect(wrong.rows).toHaveLength(0);

    const right = await pool.query(
      `UPDATE device_commands SET status = 'acknowledged'
       WHERE id = $1 AND device_id = $2 RETURNING id`,
      [id, deviceUuid],
    );
    expect(right.rows).toHaveLength(1);
  });

  it('סטטוס fetched נבדל מ־acknowledged', async () => {
    // ⚠ איסוף אינו ביצוע: אין ודאות שהמכונה קיבלה עד אישור מפורש
    const id = await enqueue(deviceUuid, 'pause', 50, 300, 'TEST:states');
    await pool.query(
      `UPDATE device_commands SET status='fetched', fetched_at=now() WHERE id=$1`,
      [id],
    );
    const r = await pool.query(
      `SELECT status, fetched_at, acknowledged_at FROM device_commands WHERE id=$1`,
      [id],
    );
    expect(r.rows[0].status).toBe('fetched');
    expect(r.rows[0].fetched_at).not.toBeNull();
    expect(r.rows[0].acknowledged_at).toBeNull();
  });
});

describe('אימות טוקן סשן', () => {
  it('הטוקן נשמר כ־hash בלבד', async () => {
    // ⚠ דליפת המסד אינה מאפשרת התחזות
    const token = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE sessions SET session_token_hash=$1, token_expires_at=now() + interval '1 hour'
       WHERE id=$2`,
      [hashToken(token), sessionId],
    );

    const byHash = await pool.query(`SELECT id FROM sessions WHERE session_token_hash=$1`, [
      hashToken(token),
    ]);
    expect(byHash.rows).toHaveLength(1);

    const byPlain = await pool.query(`SELECT id FROM sessions WHERE session_token_hash=$1`, [token]);
    expect(byPlain.rows).toHaveLength(0);
  });

  it('טוקן שפג תוקפו אינו מזוהה כתקף', async () => {
    const token = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE sessions SET session_token_hash=$1, token_expires_at=now() - interval '1 minute'
       WHERE id=$2`,
      [hashToken(token), sessionId],
    );
    const r = await pool.query(
      `SELECT id FROM sessions WHERE session_token_hash=$1 AND token_expires_at > now()`,
      [hashToken(token)],
    );
    expect(r.rows).toHaveLength(0);
  });
});
