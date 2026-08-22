import { db } from '@/db/client';
import {
  coaches,
  creditWallets,
  consents,
  playerProfiles,
  rewardsAccounts,
  staffProfiles,
  userClubScopes,
  userRoles,
  users,
} from '@/db/schema';
import { hashPassword } from '@/server/auth/session';
import { FIRST_NAMES_HE, LAST_NAMES_HE, Rng, israeliPhone } from './rng';

/**
 * משתמשי המערכת להדגמה. סיסמה זהה לכולם כדי שיהיה אפשר לבדוק כל תפקיד.
 * ⚠ הסיסמה הזו לפיתוח בלבד ואינה תקפה בסביבת production —
 * ה־Seed מסרב לרוץ כאשר APP_ENV=production.
 */
/**
 * סיסמת ההדגמה לפיתוח מקומי.
 *
 * ⚠ מתועדת ב־repo, ולכן אסור שתשמש בסביבה עם כתובת ציבורית.
 * פריסה חייבת להעביר SEED_ADMIN_PASSWORD עם סיסמה ייחודית.
 */
export const DEMO_PASSWORD = 'Velax!2026';

/** הסיסמה שתיטען בפועל — משתנה הסביבה גובר על סיסמת ההדגמה */
export const seedPassword = (): string =>
  process.env.SEED_ADMIN_PASSWORD?.trim() || DEMO_PASSWORD;

export const STAFF_BLUEPRINTS = [
  { email: 'admin@velax.co.il', name: 'אורי שושן', role: 'super_admin', title: 'Super Admin · הנהלה', extraRoles: ['management'] },
  { email: 'arad@velax.co.il', name: 'ארד מלכה', role: 'management', title: 'CEO / Strategy' },
  { email: 'ops@velax.co.il', name: 'דנה גולן', role: 'operations_manager', title: 'מנהלת תפעול' },
  { email: 'fleet@velax.co.il', name: 'ניר אשכנזי', role: 'fleet_manager', title: 'מנהל צי' },
  { email: 'support@velax.co.il', name: 'שירה כהן', role: 'support_agent', title: 'נציגת תמיכה' },
  { email: 'tech@velax.co.il', name: 'עומר ביטון', role: 'technician', title: 'טכנאי שדה' },
  { email: 'finance@velax.co.il', name: 'מיכל רוזן', role: 'finance', title: 'מנהלת כספים' },
  { email: 'sales@velax.co.il', name: 'אלון פרץ', role: 'sales', title: 'מנהל מכירות' },
  { email: 'marketing@velax.co.il', name: 'רותם שפירא', role: 'marketing', title: 'שיווק ותוכן' },
  { email: 'auditor@velax.co.il', name: 'יעל פרידמן', role: 'auditor', title: 'מבקרת' },
] as const;

export const COACH_BLUEPRINTS = [
  {
    email: 'noam.coach@velax.co.il',
    name: 'נועם כהן',
    displayName: 'נועם כהן · Founding Athlete',
    referralCode: 'NOAM10',
    clubCode: 'TLV-01',
    verified: true,
    rating: 4.8,
  },
  {
    email: 'aharon.coach@velax.co.il',
    name: 'אהרון לוי',
    displayName: 'אהרון לוי · Performance Director',
    referralCode: 'AHARON',
    clubCode: 'HRZ-01',
    verified: true,
    rating: 4.6,
  },
  {
    email: 'maya.coach@velax.co.il',
    name: 'מאיה אזולאי',
    displayName: 'מאיה אזולאי · אקדמיית ירושלים',
    referralCode: 'MAYA5',
    clubCode: 'JLM-01',
    verified: false,
    rating: 4.2,
  },
] as const;

export interface SeededPlayer {
  userId: string;
  name: string;
  phone: string;
  level: '1' | '2' | '3';
  preferredClubId: string | null;
  /** נטייה לשימוש — משפיעה על כמה סשנים ייווצרו לו */
  activityFactor: number;
  joinedAt: Date;
  coachId: string | null;
}

export async function seedPeople(
  rng: Rng,
  now: Date,
  roleIds: Map<string, string>,
  clubIdByCode: Map<string, string>,
) {
  console.log('▸ משתמשי מערכת...');
  const passwordHash = await hashPassword(seedPassword());
  const staffIds = new Map<string, string>();

  for (const s of STAFF_BLUEPRINTS) {
    const [user] = await db
      .insert(users)
      .values({
        email: s.email,
        phone: israeliPhone(rng),
        fullName: s.name,
        passwordHash,
        status: 'active',
        isStaff: true,
        mfaEnabled: s.role === 'super_admin' || s.role === 'finance',
        lastLoginAt: new Date(now.getTime() - rng.int(1, 72) * 3600000),
        isDemo: true,
      })
      .returning({ id: users.id });
    if (!user) continue;
    staffIds.set(s.role, user.id);

    await db.insert(staffProfiles).values({
      userId: user.id,
      jobTitle: s.title,
      department: s.role,
      isFieldTechnician: s.role === 'technician',
      regions: s.role === 'technician' ? ['תל אביב והמרכז', 'השרון'] : [],
      isDemo: true,
    });

    // תפקיד ראשי + תפקידים נוספים. משתמש יכול להחזיק כמה תפקידים,
    // וההרשאות שלו הן איחוד ההרשאות של כולם.
    const roleKeys = [s.role, ...(('extraRoles' in s ? s.extraRoles : []) ?? [])];
    for (const key of roleKeys) {
      const roleId = roleIds.get(key);
      if (roleId) {
        await db.insert(userRoles).values({ userId: user.id, roleId }).onConflictDoNothing();
      }
    }
  }

  // מנהל מועדון — מוגבל למועדון אחד בלבד, להדגמת RLS ו־Club Scope
  const [clubManager] = await db
    .insert(users)
    .values({
      email: 'club.tlv@velax.co.il',
      phone: israeliPhone(rng),
      fullName: 'רון כהן — מנהל פאדל תל אביב',
      passwordHash,
      status: 'active',
      isStaff: true,
      isDemo: true,
    })
    .returning({ id: users.id });

  if (clubManager) {
    staffIds.set('club_manager', clubManager.id);
    await db.insert(staffProfiles).values({
      userId: clubManager.id,
      jobTitle: 'מנהל מועדון',
      department: 'club',
      isDemo: true,
    });
    const roleId = roleIds.get('club_manager');
    if (roleId) await db.insert(userRoles).values({ userId: clubManager.id, roleId });
    const tlvId = clubIdByCode.get('TLV-01');
    if (tlvId) await db.insert(userClubScopes).values({ userId: clubManager.id, clubId: tlvId });
  }

  console.log(`  ✓ ${STAFF_BLUEPRINTS.length + 1} משתמשי מערכת`);

  console.log('▸ מאמנים...');
  const coachIds = new Map<string, string>();
  const coachRoleId = roleIds.get('coach');

  for (const c of COACH_BLUEPRINTS) {
    const [user] = await db
      .insert(users)
      .values({
        email: c.email,
        phone: israeliPhone(rng),
        fullName: c.name,
        passwordHash,
        status: 'active',
        isStaff: true,
        isCoach: true,
        isDemo: true,
      })
      .returning({ id: users.id });
    if (!user) continue;

    if (coachRoleId) await db.insert(userRoles).values({ userId: user.id, roleId: coachRoleId });
    const clubId = clubIdByCode.get(c.clubCode);
    if (clubId) await db.insert(userClubScopes).values({ userId: user.id, clubId });

    const [coach] = await db
      .insert(coaches)
      .values({
        userId: user.id,
        displayName: c.displayName,
        bio: 'מאמן פאדל מוסמך. יוצר תוכניות אימון ושיעורי בית במערכת VELA-X.',
        verification: c.verified ? 'verified' : 'pending',
        verifiedAt: c.verified ? new Date(now.getTime() - 60 * 86400000) : null,
        referralCode: c.referralCode,
        homeClubId: clubId ?? null,
        referralBonusAmount: '50',
        retentionCommissionPct: '0.030000',
        homeworkCommissionPct: '0.075000',
        contentRoyaltyPct: '0.175000',
        rating: String(c.rating),
        ratingCount: rng.int(12, 84),
        agreementSignedAt: c.verified ? new Date(now.getTime() - 60 * 86400000) : null,
        contentRightsGranted: c.verified,
        isDemo: true,
      })
      .returning({ id: coaches.id });
    if (coach) coachIds.set(c.referralCode, coach.id);
  }
  console.log(`  ✓ ${coachIds.size} מאמנים`);

  console.log('▸ שחקנים...');
  const clubIds = [...clubIdByCode.values()];
  const coachIdList = [...coachIds.values()];
  const players: SeededPlayer[] = [];
  const playerCount = 160;

  for (let i = 0; i < playerCount; i++) {
    const first = rng.pick(FIRST_NAMES_HE);
    const last = rng.pick(LAST_NAMES_HE);
    const name = `${first} ${last}`;
    const phone = israeliPhone(rng);
    const level = rng.weighted([
      ['1' as const, 45],
      ['2' as const, 40],
      ['3' as const, 15],
    ]);
    const joinedDaysAgo = rng.int(2, 200);
    const joinedAt = new Date(now.getTime() - joinedDaysAgo * 86400000);
    // המועדונים נוצרים אחרי המשתמשים; השיוך מתבצע ב־linkPlayersToClubs
    const preferredClubId = clubIds.length > 0 ? rng.pick(clubIds) : null;
    // התפלגות שימוש: מיעוט משתמשים כבדים, רוב קלים — כמו במציאות
    const activityFactor = Math.max(0.15, rng.normal(1, 0.65));
    const coachId = rng.bool(0.28) ? rng.pick(coachIdList) : null;

    const [user] = await db
      .insert(users)
      .values({
        phone,
        email: rng.bool(0.55)
          ? `player${i}@example.co.il`
          : null,
        fullName: name,
        status: rng.weighted([
          ['active' as const, 92],
          ['suspended' as const, 4],
          ['blocked' as const, 2],
          ['invited' as const, 2],
        ]),
        isPlayer: true,
        createdAt: joinedAt,
        isDemo: true,
      })
      .returning({ id: users.id });
    if (!user) continue;

    await db.insert(playerProfiles).values({
      userId: user.id,
      level,
      dominantHand: rng.weighted([
        ['right' as const, 82],
        ['left' as const, 14],
        ['unknown' as const, 4],
      ]),
      preferredClubId,
      membershipTier: rng.weighted([
        ['X1' as const, 46],
        ['X2' as const, 28],
        ['X3' as const, 16],
        ['X4' as const, 8],
        ['X5' as const, 2],
      ]),
      birthYear: String(rng.int(1975, 2010)),
      isMinor: false,
      acquisitionChannel: rng.weighted([
        ['station_qr', 42],
        ['coach_referral', 22],
        ['friend_referral', 18],
        ['instagram', 12],
        ['club_staff', 6],
      ]),
      utmSource: rng.bool(0.4) ? rng.pick(['instagram', 'facebook', 'google', 'tiktok']) : null,
      utmCampaign: rng.bool(0.3) ? rng.pick(['launch_tlv', 'offpeak_promo', 'coach_network']) : null,
      referredByCoachId: coachId,
      createdAt: joinedAt,
      isDemo: true,
    });

    await db.insert(rewardsAccounts).values({
      userId: user.id,
      createdAt: joinedAt,
      isDemo: true,
    });

    await db.insert(creditWallets).values({ userId: user.id, isDemo: true });

    await db.insert(consents).values([
      {
        userId: user.id,
        consentType: 'terms_of_service',
        granted: true,
        version: '1.0',
        grantedAt: joinedAt,
        isDemo: true,
      },
      {
        userId: user.id,
        consentType: 'privacy_policy',
        granted: true,
        version: '1.0',
        grantedAt: joinedAt,
        isDemo: true,
      },
      {
        userId: user.id,
        consentType: 'marketing',
        granted: rng.bool(0.62),
        version: '1.0',
        grantedAt: joinedAt,
        isDemo: true,
      },
    ]);

    players.push({
      userId: user.id,
      name,
      phone,
      level,
      preferredClubId,
      activityFactor,
      joinedAt,
      coachId,
    });
  }

  console.log(`  ✓ ${players.length} שחקנים`);

  return { staffIds, coachIds, players };
}
