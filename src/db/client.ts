import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * שכבת גישה יחידה למסד הנתונים.
 *
 * המערכת עובדת מול PostgreSQL סטנדרטי. מעבר ל־Supabase דורש רק החלפת
 * DATABASE_URL ל־connection string של Supabase — ה־migrations, ה־RLS
 * וה־schema זהים. ראה DEPLOYMENT.md.
 */

declare global {
  var __velaxPool: Pool | undefined;
}

/**
 * מחרוזת החיבור.
 *
 * DATABASE_URL היא ההגדרה המפורשת וקודמת לכל. אם היא אינה קיימת, נעשה שימוש
 * במשתנה ש־Netlify מזריק אוטומטית ל־Netlify DB. סדר זה מאפשר לעקוף את
 * מסד הברירת־מחדל של הפלטפורמה בלי לשנות קוד.
 */
export function resolveConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED
  );
}

function createPool(): Pool {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL אינו מוגדר. העתק את .env.example ל־.env והגדר את מחרוזת החיבור.',
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase ו־Neon דורשים SSL. Postgres מקומי לא.
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });
}

// בפיתוח, Next מרענן מודולים בכל שינוי — pool גלובלי מונע דליפת חיבורים.
const pool = globalThis.__velaxPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalThis.__velaxPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema, casing: 'snake_case' });
export { pool, schema };

export type Database = typeof db;
/** טיפוס הטרנזקציה, לשימוש בפונקציות שמקבלות tx או db */
export type DbOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
