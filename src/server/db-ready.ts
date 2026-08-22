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

async function prepare(): Promise<DbReadyResult> {
  if (!resolveConnectionString()) {
    return {
      ok: false,
      reason: 'no-connection',
      message: 'המערכת אינה מחוברת למסד נתונים. יש להגדיר DATABASE_URL בסביבת האירוח.',
    };
  }

  try {
    if ((await schemaExists()) && (await userCount()) > 0) {
      return { ok: true, prepared: false };
    }

    // נעילה ברמת המסד — כמה בקשות במקביל לא יריצו הקמה בו־זמנית
    await pool.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try {
      // בדיקה חוזרת תחת הנעילה: ייתכן שבקשה אחרת סיימה בינתיים
      if ((await schemaExists()) && (await userCount()) > 0) {
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

      console.log('✓ המסד מוכן.');
      return { ok: true, prepared: true };
    } finally {
      await pool.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    }
  } catch (error) {
    console.error('הכנת המסד נכשלה:', error);
    return {
      ok: false,
      reason: 'failed',
      message: 'המסד אינו זמין כרגע. נסה שוב בעוד רגע.',
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
