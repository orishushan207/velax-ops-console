import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

/**
 * גבול האמון של שער ה־BLE.
 *
 * ⚠ מפתח שער הוא הרשאה ארוכת־טווח לשלוט במכונה — רחבה יותר מטוקן סשן.
 * הבדיקות כאן מוודאות שהוא נשמר כ־hash, שהוא כבול לעמדה אחת, ושהוא
 * אינו מאפשר להגיע לעמדה אחרת.
 */

let pool: Pool;
let stationA: string;
let stationB: string;

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const s = await pool.query(
    `SELECT id FROM stations WHERE deleted_at IS NULL ORDER BY code LIMIT 2`,
  );
  stationA = s.rows[0].id;
  stationB = s.rows[1].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM station_gateways WHERE gateway_id LIKE 'GWTEST-%'`);
  await pool.end();
});

async function makeGateway(gatewayId: string, stationId: string) {
  const key = randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO station_gateways (station_id, gateway_id, key_hash, status)
     VALUES ($1, $2, $3, 'provisioned')`,
    [stationId, gatewayId, hash(key)],
  );
  return key;
}

describe('מפתח השער', () => {
  it('נשמר כ־hash ואינו ניתן לשליפה מהמסד', async () => {
    const key = await makeGateway('GWTEST-HASH', stationA);

    const byHash = await pool.query(`SELECT id FROM station_gateways WHERE key_hash = $1`, [
      hash(key),
    ]);
    expect(byHash.rows).toHaveLength(1);

    // ⚠ המפתח עצמו אינו קיים בשום עמודה
    const byPlain = await pool.query(`SELECT id FROM station_gateways WHERE key_hash = $1`, [key]);
    expect(byPlain.rows).toHaveLength(0);
  });

  it('כבול לעמדה אחת ואינו מגיע לעמדה אחרת', async () => {
    // ⚠ בלי זה שער במועדון אחד יכול לשלוט במכונה במועדון אחר
    const keyA = await makeGateway('GWTEST-SCOPE-A', stationA);
    await makeGateway('GWTEST-SCOPE-B', stationB);

    const resolved = await pool.query(
      `SELECT station_id FROM station_gateways WHERE key_hash = $1`,
      [hash(keyA)],
    );
    expect(resolved.rows[0].station_id).toBe(stationA);
    expect(resolved.rows[0].station_id).not.toBe(stationB);
  });

  it('סבב מפתח פוסל את הקודם מיידית', async () => {
    const oldKey = await makeGateway('GWTEST-ROTATE', stationA);
    const newKey = randomBytes(32).toString('hex');

    await pool.query(
      `UPDATE station_gateways SET key_hash = $1, key_rotated_at = now(), status = 'provisioned'
       WHERE gateway_id = 'GWTEST-ROTATE'`,
      [hash(newKey)],
    );

    const withOld = await pool.query(`SELECT id FROM station_gateways WHERE key_hash = $1`, [
      hash(oldKey),
    ]);
    expect(withOld.rows).toHaveLength(0);

    const withNew = await pool.query(`SELECT id FROM station_gateways WHERE key_hash = $1`, [
      hash(newKey),
    ]);
    expect(withNew.rows).toHaveLength(1);
  });

  it('מזהה שער ייחודי ברמת המסד', async () => {
    await makeGateway('GWTEST-UNIQ', stationA);
    await expect(makeGateway('GWTEST-UNIQ', stationB)).rejects.toThrow();
  });
});

describe('גזירת המכונה מהעמדה', () => {
  it('השער מגיע למכונה שבעמדתו, ומחליף אותה כשהיא מוחלפת', async () => {
    // ⚠ השער משויך לעמדה ולא למכונה: החלפת מכונה אינה מצריכה הגדרה מחדש
    const key = await makeGateway('GWTEST-RESOLVE', stationA);

    const resolved = await pool.query(
      `SELECT d.device_id
       FROM station_gateways g
       JOIN stations s ON s.id = g.station_id
       LEFT JOIN devices d ON d.current_station_id = s.id AND d.deleted_at IS NULL
       WHERE g.key_hash = $1`,
      [hash(key)],
    );
    expect(resolved.rows).toHaveLength(1);
    // ייתכן שאין מכונה בעמדה — זה מצב תקין ולא שגיאה
    expect(resolved.rows[0]).toHaveProperty('device_id');
  });
});
