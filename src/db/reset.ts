import 'dotenv/config';
import { Pool } from 'pg';

/**
 * מוחק את כל הסכימה ובונה אותה מחדש. פיתוח בלבד.
 * שימוש: npm run db:reset && npm run db:setup
 */
async function main() {
  if (process.env.APP_ENV === 'production') {
    throw new Error('db:reset חסום בסביבת production');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL חסר');

  const pool = new Pool({ connectionString });
  console.log('▸ מוחק סכימה public...');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query('GRANT ALL ON SCHEMA public TO public;');
  console.log('✓ הסכימה אופסה');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ שגיאה:', err);
  process.exit(1);
});
