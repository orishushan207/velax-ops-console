import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { db, pool, resolveConnectionString } from '@/db/client';

/**
 * הקמת מסד הנתונים מתוך השרת.
 *
 * ⚠ קיים משום שמחרוזת החיבור זמינה רק ב־runtime של הפונקציה — לא בזמן בנייה
 * ולא כמשתנה סביבה. זו הנקודה היחידה שממנה אפשר להריץ את ההקמה מרחוק.
 *
 * ⚠ מוגן בטוקן. ללא SETUP_TOKEN מוגדר, ה־endpoint מושבת לחלוטין —
 * כך שאין נתיב פתוח שמריץ פעולות מסד בפרודקשן.
 *
 * ⚠ אינו הרסני: הטעינה רצה רק כשאין ולו משתמש אחד.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return false;

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // אורך שונה מדליף מידע דרך זמן ההשוואה, ולכן משווים רק באורך זהה
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const step = new URL(request.url).searchParams.get('step') ?? 'status';

  if (!resolveConnectionString()) {
    return NextResponse.json({ error: 'no database connection available' }, { status: 503 });
  }

  try {
    if (step === 'status') {
      const [{ rows }, tables] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int AS n FROM users`).catch(() => ({ rows: [] })),
        db.execute(sql`
          SELECT COUNT(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public'
        `),
      ]);
      return NextResponse.json({
        tables: (tables.rows[0] as { n: number } | undefined)?.n ?? 0,
        users: (rows[0] as { n: number } | undefined)?.n ?? null,
      });
    }

    if (step === 'migrate') {
      await migrate(drizzle(pool), { migrationsFolder: join(process.cwd(), 'drizzle') });
      const rls = readFileSync(join(process.cwd(), 'drizzle', 'rls-policies.sql'), 'utf8');
      await pool.query(rls);
      return NextResponse.json({ ok: true, step: 'migrate' });
    }

    if (step === 'seed') {
      const existing = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users`);
      const count = (existing.rows[0] as { n: number } | undefined)?.n ?? 0;
      if (count > 0) {
        return NextResponse.json({ ok: true, skipped: true, users: count });
      }
      if (!process.env.SEED_ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'SEED_ADMIN_PASSWORD not set' }, { status: 400 });
      }

      const { runSeed } = await import('@/db/seed/index');
      // ה־pool משותף עם שאר השרת — סגירתו הייתה מנתקת בקשות אחרות
      await runSeed({ closePool: false });

      const after = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users`);
      return NextResponse.json({
        ok: true,
        step: 'seed',
        users: (after.rows[0] as { n: number } | undefined)?.n ?? 0,
      });
    }

    return NextResponse.json({ error: 'unknown step' }, { status: 400 });
  } catch (error) {
    console.error(`שלב ההקמה "${step}" נכשל:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed', step },
      { status: 500 },
    );
  }
}
