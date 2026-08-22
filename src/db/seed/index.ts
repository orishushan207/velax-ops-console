import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { seedBusiness } from './business';
import { seedContent } from './content';
import { seedFoundation } from './foundation';
import { seedNetwork } from './network';
import { DEMO_PASSWORD, seedPeople } from './people';
import { seedActiveSessions, seedOperations } from './operations';
import { seedService } from './service';
import { Rng } from './rng';

/**
 * טעינת נתוני הדגמה מלאים.
 *
 * ⚠ כל שורה עסקית נטענת עם is_demo = true. שכבת היסוד (הרשאות, הגדרות, מדדים)
 * נטענת עם is_demo = false כי היא התצורה של המערכת ולא הדגמה.
 *
 * שימוש:  npm run db:reset && npm run db:migrate && npm run db:seed
 */
async function main() {
  const started = Date.now();

  if (process.env.APP_ENV === 'production') {
    throw new Error(
      'db:seed חסום בסביבת production. נתוני הדגמה לעולם אינם נטענים לסביבה חיה.',
    );
  }

  const now = new Date();
  const rng = new Rng(20260820);
  // תאריך תחולה של ההגדרות: שנה אחורה, כך שכל חישוב היסטורי משתמש בהן
  const settingsEffectiveFrom = new Date(now.getTime() - 400 * 86400000);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  VELA-X Ops Console — טעינת נתונים                   ║');
  console.log('║  TRAIN SMARTER. PERFORM BETTER.                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  await wipeAllTables();

  const foundation = await seedFoundation(settingsEffectiveFrom);

  // המועדונים צריכים account manager, אז יוצרים קודם משתמש זמני ואז מעדכנים.
  // כדי להימנע מכך, מייצרים תחילה את משתמשי הצוות ללא תלות במועדונים.
  const clubIdByCodePlaceholder = new Map<string, string>();
  const people = await seedPeople(rng, now, foundation.roleIds, clubIdByCodePlaceholder);
  const accountManagerId =
    people.staffIds.get('sales') ?? people.staffIds.get('super_admin') ?? '';

  const network = await seedNetwork(
    rng,
    now,
    { defaultSlaId: foundation.defaultSlaId, premiumSlaId: foundation.premiumSlaId },
    accountManagerId,
  );

  // עכשיו שיש מועדונים — משייכים את מנהל המועדון ואת המאמנים למועדונים שלהם
  await linkClubScopes(network.clubIdByCode, people.staffIds);
  await linkPlayersToClubs(network.clubIdByCode);
  await linkCoachesToClubs(network.clubIdByCode);

  // רענון רשימת השחקנים עם מועדון מועדף אמיתי
  const players = await refreshPlayers();

  const content = await seedContent(
    rng,
    now,
    [...people.coachIds.values()],
    people.staffIds.get('marketing') ?? accountManagerId,
  );

  const sessionsList = await seedOperations(
    rng,
    now,
    network.seededStations,
    players,
    people.coachIds,
    content.programVersionIds,
    90,
  );

  await seedActiveSessions(rng, now, network.seededStations, players, content.programVersionIds);

  await seedService(
    rng,
    now,
    network.seededStations,
    sessionsList,
    people.staffIds,
    { defaultSlaId: foundation.defaultSlaId, premiumSlaId: foundation.premiumSlaId },
  );

  await seedBusiness(
    rng,
    now,
    network.clubIdByCode,
    network.contractIdByClub,
    sessionsList,
    people.staffIds,
    people.coachIds,
  );

  await refreshClubHealthScores();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log(`✓ הטעינה הושלמה ב־${elapsed} שניות`);
  console.log('');
  console.log('  התחברות למערכת:');
  console.log('  ────────────────────────────────────────');
  console.log('  admin@velax.co.il      Super Admin');
  console.log('  arad@velax.co.il       הנהלה');
  console.log('  ops@velax.co.il        מנהל תפעול');
  console.log('  fleet@velax.co.il      מנהל צי');
  console.log('  support@velax.co.il    נציג תמיכה');
  console.log('  tech@velax.co.il       טכנאי שדה');
  console.log('  finance@velax.co.il    כספים');
  console.log('  sales@velax.co.il      מכירות');
  console.log('  marketing@velax.co.il  שיווק');
  console.log('  club.tlv@velax.co.il   מנהל מועדון (תל אביב בלבד)');
  console.log('  auditor@velax.co.il    מבקר — צפייה בלבד');
  console.log('');
  console.log(`  סיסמה לכולם: ${DEMO_PASSWORD}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  await pool.end();
}

/**
 * מרוקן את כל הטבלאות לפני טעינה מחדש, כדי שההרצה תהיה חזרתית.
 * חסום בסביבת production על ידי הבדיקה ב־main().
 */
async function wipeAllTables() {
  console.log('▸ מרוקן טבלאות קיימות...');
  const rows = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
  `);
  const names = rows.rows
    .map((r) => (r as { tablename: string }).tablename)
    .map((t) => `"${t}"`)
    .join(', ');
  if (names) {
    await db.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`));
  }
  console.log(`  ✓ ${rows.rows.length} טבלאות רוקנו`);
}

/** משייך את מנהל המועדון למועדון תל אביב לאחר שהמועדונים נוצרו */
async function linkClubScopes(
  clubIdByCode: Map<string, string>,
  staffIds: Map<string, string>,
) {
  const managerId = staffIds.get('club_manager');
  const tlvId = clubIdByCode.get('TLV-01');
  if (!managerId || !tlvId) return;
  await db.execute(sql`
    INSERT INTO user_club_scopes (user_id, club_id)
    VALUES (${managerId}::uuid, ${tlvId}::uuid)
    ON CONFLICT DO NOTHING
  `);
}

/** מפזר את השחקנים בין המועדונים שנוצרו */
async function linkPlayersToClubs(clubIdByCode: Map<string, string>) {
  const ids = [...clubIdByCode.values()];
  if (ids.length === 0) return;
  await db.execute(sql`
    UPDATE player_profiles p
    SET preferred_club_id = c.id
    FROM (
      SELECT id, row_number() OVER (ORDER BY code) AS rn FROM clubs
    ) c
    WHERE c.rn = (abs(hashtext(p.id::text)) % ${ids.length}) + 1
  `);
}

async function linkCoachesToClubs(clubIdByCode: Map<string, string>) {
  const mapping: [string, string][] = [
    ['NOAM10', 'TLV-01'],
    ['AHARON', 'HRZ-01'],
    ['MAYA5', 'JLM-01'],
  ];
  for (const [code, clubCode] of mapping) {
    const clubId = clubIdByCode.get(clubCode);
    if (!clubId) continue;
    await db.execute(sql`
      UPDATE coaches SET home_club_id = ${clubId}::uuid WHERE referral_code = ${code}
    `);
    await db.execute(sql`
      INSERT INTO user_club_scopes (user_id, club_id)
      SELECT c.user_id, ${clubId}::uuid FROM coaches c WHERE c.referral_code = ${code}
      ON CONFLICT DO NOTHING
    `);
  }
}

async function refreshPlayers() {
  const rows = await db.execute(sql`
    SELECT
      u.id AS user_id, u.full_name, u.phone, u.created_at,
      p.level, p.preferred_club_id, p.referred_by_coach_id
    FROM users u
    JOIN player_profiles p ON p.user_id = u.id
    WHERE u.is_player = true AND u.deleted_at IS NULL
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      userId: String(row.user_id),
      name: String(row.full_name),
      phone: String(row.phone ?? ''),
      level: String(row.level) as '1' | '2' | '3',
      preferredClubId: String(row.preferred_club_id),
      activityFactor: 0.3 + (Math.abs(hashCode(String(row.user_id))) % 170) / 100,
      joinedAt: new Date(row.created_at as string),
      coachId: row.referred_by_coach_id ? String(row.referred_by_coach_id) : null,
    };
  });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * מחשב ציון בריאות ראשוני לכל מועדון.
 * הנוסחה המלאה ב־src/server/metrics/club-health.ts; כאן רק הפעלה ראשונית.
 */
async function refreshClubHealthScores() {
  console.log('▸ חישוב Club Health Score...');
  const { recalculateAllClubHealthScores } = await import('@/server/metrics/club-health');
  const count = await recalculateAllClubHealthScores();
  console.log(`  ✓ ${count} מועדונים`);
}

main().catch((err) => {
  console.error('✗ שגיאה בטעינת הנתונים:', err);
  process.exit(1);
});
