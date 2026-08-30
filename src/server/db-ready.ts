import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool, resolveConnectionString } from '@/db/client';
import { DEPLOY_ADMIN_PASSWORD } from '@/generated/deploy-config';

/**
 * הסיסמה שהפריסה אמורה לאכוף.
 *
 * ⚠ משתני הסביבה של Netlify אינם מגיעים ל־runtime של הפונקציה, ולכן הערך
 * נצרב בזמן בנייה. משתנה הסביבה עדיין קודם — הוא עובד מקומית ובכל אירוח אחר.
 */
function deployPassword(): string {
  return process.env.SEED_ADMIN_PASSWORD?.trim() || DEPLOY_ADMIN_PASSWORD.trim();
}

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

/**
 * האם הטעינה הושלמה, ולא רק התחילה.
 *
 * ⚠ ספירת משתמשים לבדה אינה מספיקה: טעינה שנקטעה באמצע — למשל בגלל מגבלת
 * זמן הריצה של הפונקציה — משאירה משתמשים ומועדונים אך בלי סשנים, וכל
 * המדדים מוצגים כאפס. הסשנים הם הטבלה האחרונה שנטענת, ולכן קיומם הוא
 * הסימן לכך שהטעינה הגיעה לסופה.
 */
async function seedComplete(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT (SELECT COUNT(*) FROM users) > 0
       AND (SELECT COUNT(*) FROM sessions) > 0 AS done
  `);
  return Boolean((result.rows[0] as { done: boolean } | undefined)?.done);
}

/**
 * מוודא שסיסמת הצוות היא זו שהוגדרה בסביבה.
 *
 * ⚠ בלי זה, מסד שנטען פעם אחת עם סיסמת ההדגמה נשאר איתה לנצח — וסיסמת
 * ההדגמה מתועדת ב־repo. כאן הסביבה היא מקור האמת, כך שגם מסד שנטען
 * בטעות עם ברירת המחדל מתוקן מעצמו בעלייה הבאה.
 */
async function reconcileStaffPassword(isLocalDb: boolean): Promise<void> {
  // ⚠ לא מסנכרנים מסד פיתוח מקומי. סיסמת הפריסה שייכת לפריסה; מסד מקומי
  // נשאר עם סיסמת ההדגמה המתועדת, אחרת כל בנייה מקומית משנה אותה
  // והבדיקות נשברות.
  if (isLocalDb) return;

  const desired = deployPassword();
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
  const connection = resolveConnectionString();
  const isLocalDb =
    !connection || connection.includes('localhost') || connection.includes('127.0.0.1');

  // ⚠ סירוב מכוון: פריסה מול מסד מרוחק לעולם לא תרוץ עם סיסמת ההדגמה
  // המתועדת ב־repo. עדיף להיכשל ברעש מאשר להעלות קונסולה פתוחה לכל.
  //
  // הקריטריון הוא המסד ולא NODE_ENV: `npm run start` מקומי רץ גם הוא
  // כ־production, וסיסמת הדגמה מול מסד מקומי אינה מסוכנת.
  if (!isLocalDb && !deployPassword()) {
    return {
      ok: false,
      reason: 'failed',
      message:
        'SEED_ADMIN_PASSWORD אינו מוגדר בסביבת האירוח. ' +
        'ללא סיסמה ייעודית המערכת מסרבת לפעול, כדי לא לרוץ עם סיסמת ההדגמה.',
    };
  }

  if (!connection) {
    return {
      ok: false,
      reason: 'no-connection',
      message: 'המערכת אינה מחוברת למסד נתונים. יש להגדיר DATABASE_URL בסביבת האירוח.',
    };
  }

  try {
    // ⚠ בדיקת מוכנות **לפני** הנעילה, ובלעדיה.
    //
    // מסד שכבר מוכן הוא המקרה הרגיל, והוא חייב לעבור בלי לגעת בנעילה
    // בכלל. קודם לכן כל בקשה ניסתה לנעול, וזה נעל את האתר: הבקשה
    // הראשונה נקטעה באמצע ההקמה, הנעילה לא שוחררה, וכל בקשה אחרת
    // חיכתה לה לנצח.
    if ((await schemaExists()) && (await seedComplete())) {
      await reconcileStaffPassword(isLocalDb);
      return { ok: true, prepared: false };
    }

    // ⚠ try ולא lock: מול pooler של Neon נעילה חוסמת אינה משתחררת
    // בהכרח כשהתהליך נהרג, ובקשה שממתינה לה נתקעת עד לפסק זמן.
    const got = await pool.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [LOCK_ID],
    );
    if (!got.rows[0]?.locked) {
      // מופע אחר מקים כרגע. עדיף להחזיר הודעה ברורה מלהמתין.
      return {
        ok: false,
        reason: 'failed',
        message: 'המסד בהקמה כרגע. נסה שוב בעוד רגע.',
      };
    }

    try {
      console.log('▸ מכין את המסד...');
      await migrate(drizzle(pool), { migrationsFolder: join(process.cwd(), 'drizzle') });
      await pool.query(readFileSync(join(process.cwd(), 'drizzle', 'rls-policies.sql'), 'utf8'));

      const alreadySeeded = await seedComplete();
      if (!alreadySeeded) {
        const { runSeed } = await import('@/db/seed/index');
        await runSeed({ closePool: false });
      }

      await reconcileStaffPassword(isLocalDb);
      console.log('✓ המסד מוכן.');
      return { ok: true, prepared: !alreadySeeded };
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
