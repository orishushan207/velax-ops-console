import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { Pool } from 'pg';

/**
 * בדיקת עשן — טוענת כל מסך במערכת ומוודאת שהוא מחזיר 200 ללא שגיאת שרת.
 *
 * הסקריפט יוצר Session ישירות במסד (עוקף את מסך ההתחברות) ולכן הוא
 * מיועד לפיתוח ול־CI בלבד. הוא מסרב לרוץ מול APP_ENV=production.
 *
 * שימוש: npm run smoke [-- --user=finance@velax.co.il]
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3210';

const ROUTES: { path: string; name: string; expect?: string }[] = [
  { path: '/', name: 'מרכז שליטה', expect: 'מרכז שליטה' },
  { path: '/live', name: 'פעילות בזמן אמת', expect: '<h1' },
  { path: '/sessions', name: 'Sessions', expect: '<h1' },
  { path: '/tickets', name: 'תקלות', expect: '<h1' },
  { path: '/maintenance', name: 'תחזוקה ומלאי', expect: '<h1' },
  { path: '/clubs', name: 'מועדונים', expect: '<h1' },
  { path: '/stations', name: 'עמדות', expect: '<h1' },
  { path: '/players', name: 'שחקנים', expect: '<h1' },
  { path: '/coaches', name: 'מאמנים', expect: '<h1' },
  { path: '/usage-audit', name: 'בקרת שימוש', expect: '<h1' },
  { path: '/payments', name: 'תשלומים', expect: '<h1' },
  { path: '/payments/refunds', name: 'זיכויים', expect: '<h1' },
  { path: '/earn-back', name: 'Earn-Back', expect: '<h1' },
  { path: '/finance', name: 'כספים', expect: '<h1' },
  { path: '/crm', name: 'CRM', expect: '<h1' },
  { path: '/content', name: 'תוכן', expect: '<h1' },
  { path: '/rewards', name: 'Rewards', expect: '<h1' },
  { path: '/screens', name: 'מסכים', expect: '<h1' },
  { path: '/reports', name: 'דוחות', expect: '<h1' },
  { path: '/notifications', name: 'התראות', expect: '<h1' },
  { path: '/users', name: 'משתמשים', expect: '<h1' },
  { path: '/audit', name: 'Audit Log', expect: '<h1' },
  { path: '/settings', name: 'הגדרות', expect: '<h1' },
];

async function main() {
  if (process.env.APP_ENV === 'production') {
    throw new Error('smoke חסום בסביבת production');
  }

  const email =
    process.argv.find((a) => a.startsWith('--user='))?.split('=')[1] ?? 'admin@velax.co.il';

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const userRow = await pool.query<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [email],
  );
  const user = userRow.rows[0];
  if (!user) throw new Error(`משתמש ${email} לא נמצא. הרץ npm run db:seed`);

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await pool.query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, now() + interval '1 hour', '127.0.0.1', 'velax-smoke')`,
    [user.id, tokenHash],
  );

  console.log(`\n▸ בדיקת עשן — ${ROUTES.length} מסכים · משתמש: ${email} (${user.full_name})`);
  console.log(`  כתובת: ${BASE_URL}\n`);

  let failures = 0;
  let dynamicChecked = 0;

  // מזהי ישויות אמיתיות לבדיקת מסכי פירוט
  const ids = await pool.query<{
    session_id: string | null;
    club_id: string | null;
    station_id: string | null;
    device_id: string | null;
    ticket_id: string | null;
    player_id: string | null;
    coach_id: string | null;
    lead_id: string | null;
    agreement_id: string | null;
  }>(`
    SELECT
      (SELECT id FROM sessions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS session_id,
      (SELECT id FROM clubs WHERE deleted_at IS NULL LIMIT 1) AS club_id,
      (SELECT id FROM stations WHERE deleted_at IS NULL LIMIT 1) AS station_id,
      (SELECT id FROM devices WHERE deleted_at IS NULL LIMIT 1) AS device_id,
      (SELECT id FROM support_tickets WHERE deleted_at IS NULL LIMIT 1) AS ticket_id,
      (SELECT u.id FROM users u JOIN player_profiles p ON p.user_id = u.id LIMIT 1) AS player_id,
      (SELECT id FROM coaches WHERE deleted_at IS NULL LIMIT 1) AS coach_id,
      (SELECT id FROM leads WHERE deleted_at IS NULL LIMIT 1) AS lead_id,
      (SELECT id FROM earn_back_agreements WHERE deleted_at IS NULL LIMIT 1) AS agreement_id
  `);
  const e = ids.rows[0]!;

  const dynamicRoutes: { path: string; name: string; expect?: string }[] = [
    e.session_id && { path: `/sessions/${e.session_id}`, name: 'פרטי Session' },
    e.club_id && { path: `/clubs/${e.club_id}`, name: 'פרטי מועדון' },
    e.station_id && { path: `/stations/${e.station_id}`, name: 'פרטי עמדה' },
    e.device_id && { path: `/stations/devices/${e.device_id}`, name: 'פרטי מכונה' },
    e.ticket_id && { path: `/tickets/${e.ticket_id}`, name: 'פרטי תקלה' },
    e.player_id && { path: `/players/${e.player_id}`, name: 'פרטי שחקן' },
    e.coach_id && { path: `/coaches/${e.coach_id}`, name: 'פרטי מאמן' },
    e.lead_id && { path: `/crm/${e.lead_id}`, name: 'פרטי ליד' },
    e.agreement_id && { path: `/earn-back/${e.agreement_id}`, name: 'פרטי Earn-Back' },
  ].filter(Boolean) as { path: string; name: string; expect?: string }[];

  const all = [...ROUTES, ...dynamicRoutes];

  for (const route of all) {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${route.path}`, {
        headers: { cookie: `velax_session=${token}` },
        redirect: 'manual',
      });
      const ms = Date.now() - started;
      const body = res.status === 200 ? await res.text() : '';
      // Error Boundary שנרנדר, או שגיאת RSC שנשלחה ללקוח בזרם הנתונים
      const hasErrorBoundary =
        body.includes('משהו השתבש') ||
        body.includes('An error occurred in the Server Components render') ||
        body.includes('Functions cannot be passed directly to Client Components');

      // 200 בלבד אינו מספיק: שגיאת RSC עדיין מחזירה 200 עם גוף חלקי.
      // לכן נדרש גם סימן שהמסך באמת רונדר.
      const expected = route.expect ?? null;
      const rendered = expected ? body.includes(expected) : true;

      if (res.status === 200 && !hasErrorBoundary && rendered) {
        console.log(`  ✓ ${String(res.status)}  ${route.path.padEnd(34)} ${route.name}  (${ms}ms)`);
      } else if (res.status === 404) {
        console.log(`  ⊘ 404  ${route.path.padEnd(34)} ${route.name} — המסך טרם נבנה`);
        failures++;
      } else if (!rendered && res.status === 200) {
        console.log(`  ✗ 200  ${route.path.padEnd(34)} ${route.name} — המסך לא רונדר (שגיאת שרת)`);
        failures++;
      } else if (hasErrorBoundary) {
        console.log(`  ✗ 200  ${route.path.padEnd(34)} ${route.name} — שגיאת רינדור (Error Boundary)`);
        failures++;
      } else {
        console.log(`  ✗ ${String(res.status)}  ${route.path.padEnd(34)} ${route.name}`);
        failures++;
      }
      if (dynamicRoutes.includes(route)) dynamicChecked++;
    } catch (error) {
      console.log(`  ✗ ERR  ${route.path.padEnd(34)} ${(error as Error).message}`);
      failures++;
    }
  }

  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
  await pool.end();

  console.log(
    `\n  ${all.length - failures}/${all.length} מסכים עברו · ${dynamicChecked} מסכי פירוט נבדקו\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('✗ בדיקת העשן נכשלה:', err);
  process.exit(1);
});
