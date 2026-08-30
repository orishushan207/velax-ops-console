import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getConnectionString as netlifyConnectionString } from '@netlify/database';
import { connectionFromEnv, isHostedEnvironment } from '@/lib/db-connection';
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
  // 1. מסד מנוהל של Netlify, כשהוא קיים. מקור אמת ודאי, וגובר על כל
  //    ערך שנגרר לתוך ה־bundle בזמן בנייה מקומית.
  try {
    const managed = netlifyConnectionString();
    if (managed) return managed;
  } catch {
    // אין מסד מנוהל — ממשיכים למשתני הסביבה
  }

  const fromEnv = connectionFromEnv();
  if (!fromEnv && isHostedEnvironment() && process.env.DATABASE_URL) {
    console.error('⚠ DATABASE_URL מצביע על מסד מקומי בסביבת אירוח — מתעלם ממנו.');
  }
  return fromEnv;
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

/**
 * אתחול עצל.
 *
 * ⚠ יצירת ה־pool ברמת המודול מפילה את `next build`: השלב "Collecting page data"
 * טוען כל route, וללא DATABASE_URL בזמן בנייה הבנייה נכשלת — גם כשאף עמוד
 * אינו באמת ניגש למסד. בפרודקשן מחרוזת החיבור קיימת רק ב־runtime,
 * ולכן החיבור נוצר בשאילתה הראשונה בפועל ולא בזמן הייבוא.
 */
let poolInstance: Pool | undefined;

function getPool(): Pool {
  if (globalThis.__velaxPool) return globalThis.__velaxPool;
  if (!poolInstance) {
    poolInstance = createPool();
    // בפיתוח, Next מרענן מודולים בכל שינוי — pool גלובלי מונע דליפת חיבורים.
    if (process.env.NODE_ENV !== 'production') globalThis.__velaxPool = poolInstance;
  }
  return poolInstance;
}

let dbInstance: NodePgDatabase<typeof schema> | undefined;

function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema, casing: 'snake_case' });
  }
  return dbInstance;
}

/** מייצג את ה־pool/db האמיתי, אך דוחה את יצירתו עד לגישה הראשונה */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get: (_t, prop, receiver) => Reflect.get(resolve() as object, prop, receiver),
    set: (_t, prop, value) => Reflect.set(resolve() as object, prop, value),
    has: (_t, prop) => Reflect.has(resolve() as object, prop),
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve() as object),
    getOwnPropertyDescriptor: (_t, prop) =>
      Reflect.getOwnPropertyDescriptor(resolve() as object, prop),
  });
}

export const db: NodePgDatabase<typeof schema> = lazy(getDb);
export const pool: Pool = lazy(getPool);
export { schema };

export type Database = typeof db;
/** טיפוס הטרנזקציה, לשימוש בפונקציות שמקבלות tx או db */
export type DbOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
