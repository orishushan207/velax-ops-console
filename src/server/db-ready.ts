import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool, resolveConnectionString } from '@/db/client';

/**
 * מביא את המסד למצב שמיש בבקשה הראשונה, ומוודא זאת פעם אחת לכל תהליך.
 *
 * ⚠ קיים משום שמחרוזת החיבור זמינה רק ב־runtime: לא בזמן בנייה ולא כמשתנה
 * סביבה. לכן אין שום נקודה מוקדמת יותר שממנה אפשר להריץ migrations,
 * והמסד היה נשאר ריק אחרי הפריסה.
 *
 * ⚠ אינו הרסני. הטעינה רצה רק כשאין ולו משתמש אחד, כך שהפעלה חוזרת —
 * גם על ידי מבקר אקראי — אינה יכולה למחוק נתונים.
 */

const LOCK_ID = 907_314_522;

export type DbReadyResult =
  | { ok: true; prepared: boolean }
  | { ok: false; reason: 'no-connection' | 'failed'; message: string };

/** נבדק פעם אחת לכל תהליך; cold start חדש יבדוק שוב */
let cached: Promise<DbReadyResult> | undefined;

async function schemaExists(): Promise<boolean> {
  const result = await db.execute(sql`SELECT to_regclass('public.users') IS NOT NULL AS present`);
  return Boolean((result.rows[0] as { present: boolean } | undefined)?.present);
}

async function userCount(): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users`);
  return (result.rows[0] as { n: number } | undefined)?.n ?? 0;
}

/**
 * מוודא שסיסמת הצוות היא זו שהוגדרה בסביבה.
 *
 * ⚠ בלי זה, מסד שנטען פעם אחת עם סיסמת ההדגמה נשאר איתה לנצח — וסיסמת
 * ההדגמה מתועדת ב־repo. כאן הסביבה היא מקור האמת, כך שגם מסד שנטען
 * בטעות עם ברירת המחדל מתוקן מעצמו בעלייה הבאה.
 */
async function reconcileStaffPassword(): Promise<void> {
  const desired = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!desired) return;

  const { rows } = await pool.query<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE email = 'admin@velax.co.il' LIMIT 1",
  );
  const current = rows[0]?.password_hash;
  if (!current) return;

  const bcrypt = await import('bcryptjs');
  if (await bcrypt.compare(desired, current)) return;

  const hash = await bcrypt.hash(desired, 10);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE password_hash IS NOT NULL',
    [hash],
  );
  console.log(`▸ סיסמת הצוות סונכרנה מהסביבה (${result.rowCount} חשבונות).`);
}

async function prepare(): Promise<DbReadyResult> {
  // ⚠ סירוב מכוון: פריסה ציבורית לעולם לא תרוץ עם סיסמת ההדגמה המתועדת
  // ב־repo. עדיף להיכשל ברעש מאשר להעלות קונסולה שכל אחד יכול להיכנס אליה.
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD?.trim()) {
    return {
      ok: false,
      reason: 'failed',
      message:
        'SEED_ADMIN_PASSWORD אינו מוגדר בסביבת האירוח. ' +
        'ללא סיסמה ייעודית המערכת מסרבת לפעול, כדי לא לרוץ עם סיסמת ההדגמה.',
    };
  }

  if (!resolveConnectionString()) {
    return {
      ok: false,
      reason: 'no-connection',
      message: 'המערכת אינה מחוברת למסד נתונים. יש להגדיר DATABASE_URL בסביבת האירוח.',
    };
  }

  try {
    if ((await schemaExists()) && (await userCount()) > 0) {
      await reconcileStaffPassword();
      return { ok: true, prepared: false };
    }

    // נעילה ברמת המסד — כמה בקשות במקביל לא יריצו הקמה בו־זמנית
    await pool.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try {
      // בדיקה חוזרת תחת הנעילה: ייתכן שבקשה אחרת סיימה בינתיים
      if ((await schemaExists()) && (await userCount()) > 0) {
        await reconcileStaffPassword();
        return { ok: true, prepared: false };
      }

      console.log('▸ מכין את המסד בפעם הראשונה...');
      await migrate(drizzle(pool), { migrationsFolder: join(process.cwd(), 'drizzle') });
      await pool.query(readFileSync(join(process.cwd(), 'drizzle', 'rls-policies.sql'), 'utf8'));

      if ((await userCount()) === 0) {
        const { runSeed } = await import('@/db/seed/index');
        // ה־pool משותף עם שאר השרת — סגירתו הייתה מנתקת בקשות אחרות
        await runSeed({ closePool: false });
      }

      await reconcileStaffPassword();
      console.log('✓ המסד מוכן.');
      return { ok: true, prepared: true };
    } finally {
      await pool.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    }
  } catch (error) {
    console.error('הכנת המסד נכשלה:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: 'failed',
      // ⚠ הודעת השגיאה שלנו בלבד. אינה כוללת מחרוזת חיבור או סוד אחר,
      // ובלעדיה אי אפשר לאבחן כשל שקורה רק בסביבת האירוח.
      message: `הכנת המסד נכשלה: ${detail}`,
    };
  }
}

export function ensureDatabaseReady(): Promise<DbReadyResult> {
  if (!cached) {
    cached = prepare().then((result) => {
      // כישלון אינו נשמר במטמון, כדי שהבקשה הבאה תנסה שוב
      if (!result.ok) cached = undefined;
      return result;
    });
  }
  return cached;
}
