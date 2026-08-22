import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * מריץ את כל ה־migrations, ולאחר מכן את מדיניות ה־RLS.
 * שימוש: npm run db:migrate
 */
async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error('DATABASE_URL חסר');

  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  // מסד מנוהל (Neon/Supabase) מחייב SSL; מסד מקומי אינו תומך בו
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  console.log('▸ מריץ migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✓ migrations הושלמו');

  console.log('▸ מחיל מדיניות RLS...');
  const rlsSql = readFileSync(join(process.cwd(), 'drizzle', 'rls-policies.sql'), 'utf8');
  await pool.query(rlsSql);
  console.log('✓ RLS הוחל');

  await pool.end();
}

main().catch((err) => {
  console.error('✗ שגיאה ב־migration:', err);
  process.exit(1);
});
