import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * מביא את מסד הנתונים למצב תקין — פעולה אחת, בטוחה לחזרה.
 *
 * רץ בכל בנייה. אם הסכימה חסרה היא נוצרת, ואם המסד ריק נטענים נתוני ההדגמה.
 * אם הכול כבר קיים — לא נעשה דבר.
 *
 * ⚠ לעולם אינו מוחק נתונים קיימים. הטעינה מופעלת רק כשאין ולו משתמש אחד,
 * כדי שפריסה לא תמחק עבודה אמיתית.
 *
 * ⚠ אינו מפיל את הבנייה כשאין מסד. פריסה ללא מסד עדיין מעלה אתר תקין
 * שמציג הודעה ברורה במסך ההתחברות.
 */

/** נעילה ברמת המסד — כמה בנייה/פונקציות במקביל לא יריצו את זה יחד */
const LOCK_ID = 907_314_522;

function resolveConnectionString(): string | undefined {
  const fromEnv =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED;
  if (fromEnv) return fromEnv;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getConnectionString } = require('@netlify/database') as {
      getConnectionString: () => string;
    };
    return getConnectionString() || undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const connectionString = resolveConnectionString();

  if (!connectionString) {
    console.log('⚠ אין מחרוזת חיבור — מדלג על הכנת המסד.');
    console.log('  האתר יעלה ויציג הודעה מתאימה במסך ההתחברות.');
    return;
  }

  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const host = connectionString.replace(/\/\/[^@]*@/, '//***@').split('/')[2] ?? 'unknown';
  console.log(`▸ מסד יעד: ${host}`);

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 20_000,
  });

  try {
    await pool.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);

    console.log('▸ מוודא סכימה...');
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });

    console.log('▸ מחיל מדיניות RLS...');
    const rls = readFileSync(join(process.cwd(), 'drizzle', 'rls-policies.sql'), 'utf8');
    await pool.query(rls);

    const { rows } = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users');
    const userCount = Number(rows[0]?.n ?? '0');

    if (userCount > 0) {
      console.log(`✓ המסד כבר מאוכלס (${userCount} משתמשים) — אין טעינה.`);
      return;
    }

    console.log('▸ המסד ריק — טוען נתוני הדגמה...');
    const password = process.env.SEED_ADMIN_PASSWORD?.trim();
    if (!password) {
      // ⚠ סיסמת ההדגמה מתועדת ב־repo. טעינה בלעדיה על כתובת ציבורית
      // הייתה יוצרת קונסולה שכל אחד יכול להיכנס אליה.
      throw new Error('SEED_ADMIN_PASSWORD חסר. לא טוען נתונים עם סיסמת ההדגמה.');
    }

    // מופעל כתהליך נפרד כדי לעשות שימוש חוזר בסקריפט הטעינה הבדוק כמות שהוא
    const result = spawnSync('npm', ['run', 'db:seed'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        APP_ENV: process.env.APP_ENV === 'production' ? 'demo' : (process.env.APP_ENV ?? 'demo'),
        SEED_ADMIN_PASSWORD: password,
      },
    });
    if (result.status !== 0) throw new Error('טעינת הנתונים נכשלה');

    console.log('✓ הנתונים נטענו.');
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await pool.end().catch(() => {});
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ הכנת המסד נכשלה:', err instanceof Error ? err.message : err);
    // ⚠ יציאה תקינה במכוון: אתר עם הודעה ברורה עדיף על פריסה שנחסמה.
    process.exit(0);
  });
