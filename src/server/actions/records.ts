'use server';

import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { diffRecords as diff } from '@/lib/record-diff';
import { pluralHe } from '@/lib/format';
import {
  clubs,
  coaches,
  devices,
  drillVersions,
  drills,
  leads,
  playerProfiles,
  stations,
  users,
} from '@/db/schema';
import { writeAudit } from '@/server/audit';
import { assertClubAccess } from '@/server/auth/guard';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  zodFieldErrors,
  type ActionResult,
} from './_helpers';

/**
 * יצירה ועריכה של רשומות הליבה — מועדונים, עמדות, שחקנים, מאמנים ולידים.
 *
 * כל פעולה כאן:
 *   1. עוברת דרך withPermission — אכיפת הרשאה
 *   2. מאמתת בעזרת Zod — לא סומכים על הטופס
 *   3. רצה בטרנזקציה יחד עם writeAudit — כישלון ברישום מבטל את השינוי
 *   4. שומרת before/after כדי שאפשר יהיה לראות מה בדיוק השתנה
 */

function invalid(error: z.ZodError) {
  return actionError('נא לתקן את השדות המסומנים', zodFieldErrors(error));
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `עד ${max} תווים`)
    .optional()
    .transform((v) => (v ? v : null));

const nameSchema = z.string().trim().min(2, 'שם קצר מדי').max(200, 'שם ארוך מדי');

/** מייל אופציונלי — מחרוזת ריקה נחשבת "ללא מייל", לא מייל שגוי */
const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'כתובת מייל אינה תקינה');

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[^\d+]/g, '') : null))
  .refine((v) => v === null || /^\+?\d{9,15}$/.test(v), 'מספר טלפון אינו תקין');

// ─────────────────────────── מועדונים ───────────────────────────

const clubFields = z.object({
  name: nameSchema,
  code: z
    .string()
    .trim()
    .min(2, 'קוד קצר מדי')
    .max(24, 'עד 24 תווים')
    .regex(/^[A-Z0-9-]+$/, 'קוד באותיות לטיניות גדולות, ספרות ומקפים בלבד'),
  city: z.string().trim().min(2, 'נא לציין עיר').max(100),
  region: z.string().trim().min(2, 'נא לציין אזור').max(80),
  address: optionalText(300),
  status: z.enum(['prospect', 'pilot', 'active', 'paused', 'churned']),
  courtCount: z.coerce.number().int().min(0, 'לא יכול להיות שלילי').max(200, 'ערך גבוה מדי'),
  offPeakStart: z.string().regex(/^\d{2}:\d{2}$/, 'שעה בפורמט HH:MM'),
  offPeakEnd: z.string().regex(/^\d{2}:\d{2}$/, 'שעה בפורמט HH:MM'),
  notes: optionalText(2000),
});

function parseClub(formData: FormData) {
  return clubFields.safeParse({
    name: formString(formData, 'name'),
    code: formString(formData, 'code').toUpperCase(),
    city: formString(formData, 'city'),
    region: formString(formData, 'region'),
    address: formString(formData, 'address'),
    status: formString(formData, 'status') || 'prospect',
    courtCount: formString(formData, 'courtCount') || '0',
    offPeakStart: formString(formData, 'offPeakStart') || '08:00',
    offPeakEnd: formString(formData, 'offPeakEnd') || '16:00',
    notes: formString(formData, 'notes'),
  });
}

async function codeTaken(code: string, exceptId?: string) {
  const where = exceptId
    ? and(eq(clubs.code, code), ne(clubs.id, exceptId))
    : eq(clubs.code, code);
  const [row] = await db.select({ id: clubs.id }).from(clubs).where(where).limit(1);
  return Boolean(row);
}

export async function createClubAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('clubs.create', async (ctx) => {
    const parsed = parseClub(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    if (v.offPeakEnd <= v.offPeakStart) {
      return actionError('חלון Off-Peak אינו תקין', { offPeakEnd: 'שעת סיום חייבת להיות אחרי ההתחלה' });
    }
    if (await codeTaken(v.code)) {
      return actionError('קוד המועדון כבר קיים', { code: 'קוד תפוס' });
    }

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clubs)
        .values({
          name: v.name,
          code: v.code,
          city: v.city,
          region: v.region,
          address: v.address,
          status: v.status,
          courtCount: v.courtCount,
          offPeakStart: v.offPeakStart,
          offPeakEnd: v.offPeakEnd,
          notes: v.notes,
          joinedAt: v.status === 'active' || v.status === 'pilot' ? new Date().toISOString().slice(0, 10) : null,
        })
        .returning({ id: clubs.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'club.create',
          entityType: 'club',
          entityId: row!.id,
          entityLabel: v.name,
          clubId: row!.id,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ...v },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return row!.id;
    });

    revalidate('/clubs', '/crm');
    return actionOk({ id }, `המועדון "${v.name}" נוצר`);
  });
}

export async function updateClubAction(
  clubId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('clubs.edit', async (ctx) => {
    assertClubAccess(ctx.user, clubId);
    const parsed = parseClub(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    if (v.offPeakEnd <= v.offPeakStart) {
      return actionError('חלון Off-Peak אינו תקין', { offPeakEnd: 'שעת סיום חייבת להיות אחרי ההתחלה' });
    }

    const [current] = await db
      .select()
      .from(clubs)
      .where(and(eq(clubs.id, clubId), isNull(clubs.deletedAt)))
      .limit(1);
    if (!current) return actionError('המועדון לא נמצא');

    if (v.code !== current.code && (await codeTaken(v.code, clubId))) {
      return actionError('קוד המועדון כבר קיים', { code: 'קוד תפוס' });
    }

    const d = diff(
      {
        name: current.name,
        code: current.code,
        city: current.city,
        region: current.region,
        address: current.address,
        status: current.status,
        courtCount: current.courtCount,
        offPeakStart: current.offPeakStart,
        offPeakEnd: current.offPeakEnd,
        notes: current.notes,
      },
      { ...v },
    );
    if (!d.changed) return actionOk({ id: clubId }, 'לא בוצע שינוי');

    await db.transaction(async (tx) => {
      await tx
        .update(clubs)
        .set({
          name: v.name,
          code: v.code,
          city: v.city,
          region: v.region,
          address: v.address,
          status: v.status,
          courtCount: v.courtCount,
          offPeakStart: v.offPeakStart,
          offPeakEnd: v.offPeakEnd,
          notes: v.notes,
        })
        .where(eq(clubs.id, clubId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'club.update',
          entityType: 'club',
          entityId: clubId,
          entityLabel: v.name,
          clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/clubs', `/clubs/${clubId}`);
    return actionOk({ id: clubId }, 'פרטי המועדון עודכנו');
  });
}

// ─────────────────────────── עמדות ───────────────────────────

const stationFields = z.object({
  clubId: z.string().uuid('נא לבחור מועדון'),
  name: z.string().trim().min(2, 'שם קצר מדי').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'קוד קצר מדי')
    .max(32)
    .regex(/^[A-Z0-9-]+$/, 'קוד באותיות לטיניות גדולות, ספרות ומקפים בלבד'),
  stationType: z.enum(['lean', 'full']),
  status: z.enum(['planned', 'installing', 'active', 'suspended', 'decommissioned']),
  locationDescription: optionalText(300),
  installedCost: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (Number.isFinite(Number(v)) && Number(v) >= 0), 'עלות אינה תקינה'),
});

function parseStation(formData: FormData) {
  return stationFields.safeParse({
    clubId: formString(formData, 'clubId'),
    name: formString(formData, 'name'),
    code: formString(formData, 'code').toUpperCase(),
    stationType: formString(formData, 'stationType') || 'lean',
    status: formString(formData, 'status') || 'planned',
    locationDescription: formString(formData, 'locationDescription'),
    installedCost: formString(formData, 'installedCost'),
  });
}

export async function createStationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('stations.manage', async (ctx) => {
    const parsed = parseStation(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    assertClubAccess(ctx.user, v.clubId);

    const [club] = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .where(and(eq(clubs.id, v.clubId), isNull(clubs.deletedAt)))
      .limit(1);
    if (!club) return actionError('המועדון לא נמצא');

    // קוד עמדה ייחודי בתוך המועדון
    const [dup] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.clubId, v.clubId), eq(stations.code, v.code), isNull(stations.deletedAt)))
      .limit(1);
    if (dup) return actionError('קוד העמדה כבר קיים במועדון', { code: 'קוד תפוס' });

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(stations)
        .values({
          clubId: v.clubId,
          name: v.name,
          code: v.code,
          stationType: v.stationType,
          status: v.status,
          locationDescription: v.locationDescription,
          installedCost: v.installedCost,
          installedAt: v.status === 'active' ? new Date() : null,
        })
        .returning({ id: stations.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'station.create',
          entityType: 'station',
          entityId: row!.id,
          entityLabel: `${v.code} · ${v.name}`,
          clubId: v.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ...v, clubName: club.name },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return row!.id;
    });

    revalidate('/stations', '/clubs', `/clubs/${v.clubId}`);
    return actionOk({ id }, `העמדה "${v.name}" נוצרה`);
  });
}

export async function updateStationAction(
  stationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('stations.manage', async (ctx) => {
    const parsed = parseStation(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select()
      .from(stations)
      .where(and(eq(stations.id, stationId), isNull(stations.deletedAt)))
      .limit(1);
    if (!current) return actionError('העמדה לא נמצאה');

    assertClubAccess(ctx.user, current.clubId);
    // העברת עמדה בין מועדונים דורשת גישה גם למועדון היעד
    if (v.clubId !== current.clubId) assertClubAccess(ctx.user, v.clubId);

    const [dup] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(
        and(
          eq(stations.clubId, v.clubId),
          eq(stations.code, v.code),
          ne(stations.id, stationId),
          isNull(stations.deletedAt),
        ),
      )
      .limit(1);
    if (dup) return actionError('קוד העמדה כבר קיים במועדון', { code: 'קוד תפוס' });

    const d = diff(
      {
        clubId: current.clubId,
        name: current.name,
        code: current.code,
        stationType: current.stationType,
        status: current.status,
        locationDescription: current.locationDescription,
        installedCost: current.installedCost,
      },
      { ...v },
    );
    if (!d.changed) return actionOk({ id: stationId }, 'לא בוצע שינוי');

    await db.transaction(async (tx) => {
      await tx
        .update(stations)
        .set({
          clubId: v.clubId,
          name: v.name,
          code: v.code,
          stationType: v.stationType,
          status: v.status,
          locationDescription: v.locationDescription,
          installedCost: v.installedCost,
          // רגע ההתקנה נרשם פעם אחת, כשהעמדה עוברת לפעילה בפועל
          installedAt:
            current.installedAt ?? (v.status === 'active' ? new Date() : null),
        })
        .where(eq(stations.id, stationId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'station.update',
          entityType: 'station',
          entityId: stationId,
          entityLabel: `${v.code} · ${v.name}`,
          clubId: v.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/${stationId}`, '/clubs', `/clubs/${v.clubId}`);
    return actionOk({ id: stationId }, 'פרטי העמדה עודכנו');
  });
}

// ─────────────────────────── שחקנים ───────────────────────────

const playerFields = z.object({
  fullName: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  status: z.enum(['active', 'invited', 'suspended', 'blocked', 'deleted']),
  level: z.enum(['1', '2', '3']),
  dominantHand: z.enum(['right', 'left', 'unknown']),
  membershipTier: z.enum(['X1', 'X2', 'X3', 'X4', 'X5']),
  birthYear: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || (/^\d{4}$/.test(v) && Number(v) >= 1920 && Number(v) <= new Date().getFullYear()),
      'שנת לידה אינה תקינה',
    ),
  preferredClubId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, 'מועדון אינו תקין'),
  notes: optionalText(2000),
});

function parsePlayer(formData: FormData) {
  return playerFields.safeParse({
    fullName: formString(formData, 'fullName'),
    email: formString(formData, 'email'),
    phone: formString(formData, 'phone'),
    status: formString(formData, 'status') || 'active',
    level: formString(formData, 'level') || '1',
    dominantHand: formString(formData, 'dominantHand') || 'unknown',
    membershipTier: formString(formData, 'membershipTier') || 'X1',
    birthYear: formString(formData, 'birthYear'),
    preferredClubId: formString(formData, 'preferredClubId'),
    notes: formString(formData, 'notes'),
  });
}

/** מייל וטלפון ייחודיים ברמת users — בדיקה מפורשת לשגיאה קריאה במקום כישלון UNIQUE */
async function contactTaken(
  email: string | null,
  phone: string | null,
  exceptUserId?: string,
): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};
  if (email) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(exceptUserId ? and(eq(users.email, email), ne(users.id, exceptUserId)) : eq(users.email, email))
      .limit(1);
    if (row) errors.email = 'כתובת המייל כבר רשומה במערכת';
  }
  if (phone) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(exceptUserId ? and(eq(users.phone, phone), ne(users.id, exceptUserId)) : eq(users.phone, phone))
      .limit(1);
    if (row) errors.phone = 'מספר הטלפון כבר רשום במערכת';
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function createPlayerAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('players.edit', async (ctx) => {
    const parsed = parsePlayer(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    if (!v.email && !v.phone) {
      return actionError('נדרש מייל או טלפון ליצירת קשר', { phone: 'נא למלא מייל או טלפון' });
    }
    const taken = await contactTaken(v.email, v.phone);
    if (taken) return actionError('פרטי הקשר כבר קיימים', taken);

    const isMinor = v.birthYear ? new Date().getFullYear() - Number(v.birthYear) < 18 : false;

    const id = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          fullName: v.fullName,
          email: v.email,
          phone: v.phone,
          status: v.status,
          isPlayer: true,
          notes: v.notes,
        })
        .returning({ id: users.id });

      await tx.insert(playerProfiles).values({
        userId: user!.id,
        level: v.level,
        dominantHand: v.dominantHand,
        membershipTier: v.membershipTier,
        birthYear: v.birthYear,
        preferredClubId: v.preferredClubId,
        isMinor,
      });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'player.create',
          entityType: 'player',
          entityId: user!.id,
          entityLabel: v.fullName,
          clubId: v.preferredClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { fullName: v.fullName, level: v.level, membershipTier: v.membershipTier, isMinor },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return user!.id;
    });

    revalidate('/players');
    return actionOk({ id }, `השחקן "${v.fullName}" נוסף`);
  });
}

export async function updatePlayerAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('players.edit', async (ctx) => {
    const parsed = parsePlayer(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        status: users.status,
        notes: users.notes,
        level: playerProfiles.level,
        dominantHand: playerProfiles.dominantHand,
        membershipTier: playerProfiles.membershipTier,
        birthYear: playerProfiles.birthYear,
        preferredClubId: playerProfiles.preferredClubId,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (!current) return actionError('השחקן לא נמצא');

    const taken = await contactTaken(v.email, v.phone, userId);
    if (taken) return actionError('פרטי הקשר כבר קיימים', taken);

    const d = diff({ ...current, id: undefined }, { ...v });
    if (!d.changed) return actionOk({ id: userId }, 'לא בוצע שינוי');

    const isMinor = v.birthYear ? new Date().getFullYear() - Number(v.birthYear) < 18 : false;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          fullName: v.fullName,
          email: v.email,
          phone: v.phone,
          status: v.status,
          notes: v.notes,
        })
        .where(eq(users.id, userId));

      // שחקן שנוצר לפני שהיה לו פרופיל — יוצרים אותו עכשיו במקום להיכשל
      await tx
        .insert(playerProfiles)
        .values({
          userId,
          level: v.level,
          dominantHand: v.dominantHand,
          membershipTier: v.membershipTier,
          birthYear: v.birthYear,
          preferredClubId: v.preferredClubId,
          isMinor,
        })
        .onConflictDoUpdate({
          target: playerProfiles.userId,
          set: {
            level: v.level,
            dominantHand: v.dominantHand,
            membershipTier: v.membershipTier,
            birthYear: v.birthYear,
            preferredClubId: v.preferredClubId,
            isMinor,
          },
        });

      await writeAudit(
        {
          action: 'update',
          actionKey: 'player.update',
          entityType: 'player',
          entityId: userId,
          entityLabel: v.fullName,
          clubId: v.preferredClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/players', `/players/${userId}`);
    return actionOk({ id: userId }, 'פרטי השחקן עודכנו');
  });
}

// ─────────────────────────── מאמנים ───────────────────────────

const coachFields = z.object({
  fullName: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  displayName: z.string().trim().min(2, 'שם תצוגה קצר מדי').max(200),
  referralCode: z
    .string()
    .trim()
    .min(3, 'קוד קצר מדי')
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'קוד באותיות לטיניות גדולות, ספרות ומקפים בלבד'),
  verification: z.enum(['pending', 'verified', 'rejected', 'suspended']),
  homeClubId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, 'מועדון אינו תקין'),
  bio: optionalText(2000),
});

function parseCoach(formData: FormData) {
  return coachFields.safeParse({
    fullName: formString(formData, 'fullName'),
    email: formString(formData, 'email'),
    phone: formString(formData, 'phone'),
    displayName: formString(formData, 'displayName') || formString(formData, 'fullName'),
    referralCode: formString(formData, 'referralCode').toUpperCase(),
    verification: formString(formData, 'verification') || 'pending',
    homeClubId: formString(formData, 'homeClubId'),
    bio: formString(formData, 'bio'),
  });
}

async function referralCodeTaken(code: string, exceptCoachId?: string) {
  const [row] = await db
    .select({ id: coaches.id })
    .from(coaches)
    .where(
      exceptCoachId
        ? and(eq(coaches.referralCode, code), ne(coaches.id, exceptCoachId))
        : eq(coaches.referralCode, code),
    )
    .limit(1);
  return Boolean(row);
}

export async function createCoachAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('coaches.manage', async (ctx) => {
    const parsed = parseCoach(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    if (!v.email && !v.phone) {
      return actionError('נדרש מייל או טלפון ליצירת קשר', { email: 'נא למלא מייל או טלפון' });
    }
    const taken = await contactTaken(v.email, v.phone);
    if (taken) return actionError('פרטי הקשר כבר קיימים', taken);
    if (await referralCodeTaken(v.referralCode)) {
      return actionError('קוד ההפניה כבר קיים', { referralCode: 'קוד תפוס' });
    }

    const id = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          fullName: v.fullName,
          email: v.email,
          phone: v.phone,
          status: 'active',
          isCoach: true,
        })
        .returning({ id: users.id });

      const [coach] = await tx
        .insert(coaches)
        .values({
          userId: user!.id,
          displayName: v.displayName,
          referralCode: v.referralCode,
          verification: v.verification,
          homeClubId: v.homeClubId,
          bio: v.bio,
          verifiedAt: v.verification === 'verified' ? new Date() : null,
          verifiedBy: v.verification === 'verified' ? ctx.user.id : null,
        })
        .returning({ id: coaches.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'coach.create',
          entityType: 'coach',
          entityId: coach!.id,
          entityLabel: v.displayName,
          clubId: v.homeClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ...v },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return coach!.id;
    });

    revalidate('/coaches');
    return actionOk({ id }, `המאמן "${v.displayName}" נוסף`);
  });
}

export async function updateCoachAction(
  coachId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('coaches.manage', async (ctx) => {
    const parsed = parseCoach(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select({
        id: coaches.id,
        userId: coaches.userId,
        displayName: coaches.displayName,
        referralCode: coaches.referralCode,
        verification: coaches.verification,
        homeClubId: coaches.homeClubId,
        bio: coaches.bio,
        verifiedAt: coaches.verifiedAt,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(coaches)
      .innerJoin(users, eq(users.id, coaches.userId))
      .where(and(eq(coaches.id, coachId), isNull(coaches.deletedAt)))
      .limit(1);
    if (!current) return actionError('המאמן לא נמצא');

    const taken = await contactTaken(v.email, v.phone, current.userId);
    if (taken) return actionError('פרטי הקשר כבר קיימים', taken);
    if (v.referralCode !== current.referralCode && (await referralCodeTaken(v.referralCode, coachId))) {
      return actionError('קוד ההפניה כבר קיים', { referralCode: 'קוד תפוס' });
    }

    const d = diff(
      {
        fullName: current.fullName,
        email: current.email,
        phone: current.phone,
        displayName: current.displayName,
        referralCode: current.referralCode,
        verification: current.verification,
        homeClubId: current.homeClubId,
        bio: current.bio,
      },
      { ...v },
    );
    if (!d.changed) return actionOk({ id: coachId }, 'לא בוצע שינוי');

    const becameVerified = v.verification === 'verified' && current.verification !== 'verified';

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ fullName: v.fullName, email: v.email, phone: v.phone })
        .where(eq(users.id, current.userId));

      await tx
        .update(coaches)
        .set({
          displayName: v.displayName,
          referralCode: v.referralCode,
          verification: v.verification,
          homeClubId: v.homeClubId,
          bio: v.bio,
          verifiedAt: becameVerified ? new Date() : current.verifiedAt,
          verifiedBy: becameVerified ? ctx.user.id : undefined,
        })
        .where(eq(coaches.id, coachId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'coach.update',
          entityType: 'coach',
          entityId: coachId,
          entityLabel: v.displayName,
          clubId: v.homeClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/coaches', `/coaches/${coachId}`);
    return actionOk({ id: coachId }, 'פרטי המאמן עודכנו');
  });
}

// ─────────────────────────── לידים ───────────────────────────

const leadStages = [
  'lead',
  'contacted',
  'qualified',
  'demo_scheduled',
  'demo_completed',
  'proposal_sent',
  'negotiation',
  'pilot_agreed',
  'contract_sent',
  'contract_signed',
  'installation_scheduled',
  'live',
  'lost',
] as const;

const leadFields = z.object({
  clubName: nameSchema,
  stage: z.enum(leadStages),
  city: optionalText(100),
  region: optionalText(80),
  courtCount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 200), 'מספר מגרשים אינו תקין'),
  contactName: optionalText(200),
  contactRole: optionalText(100),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  source: optionalText(80),
  dealValue: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : '0'))
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'שווי עסקה אינו תקין'),
  expectedCloseDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'תאריך אינו תקין'),
  notes: optionalText(2000),
});

function parseLead(formData: FormData) {
  return leadFields.safeParse({
    clubName: formString(formData, 'clubName'),
    stage: formString(formData, 'stage') || 'lead',
    city: formString(formData, 'city'),
    region: formString(formData, 'region'),
    courtCount: formString(formData, 'courtCount'),
    contactName: formString(formData, 'contactName'),
    contactRole: formString(formData, 'contactRole'),
    contactEmail: formString(formData, 'contactEmail'),
    contactPhone: formString(formData, 'contactPhone'),
    source: formString(formData, 'source'),
    dealValue: formString(formData, 'dealValue'),
    expectedCloseDate: formString(formData, 'expectedCloseDate'),
    notes: formString(formData, 'notes'),
  });
}

export async function createLeadAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('crm.manage', async (ctx) => {
    const parsed = parseLead(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(leads)
        .values({
          clubName: v.clubName,
          stage: v.stage,
          city: v.city,
          region: v.region,
          courtCount: v.courtCount,
          contactName: v.contactName,
          contactRole: v.contactRole,
          contactEmail: v.contactEmail,
          contactPhone: v.contactPhone,
          source: v.source,
          dealValue: v.dealValue,
          expectedCloseDate: v.expectedCloseDate,
          notes: v.notes,
          ownerId: ctx.user.id,
        })
        .returning({ id: leads.id });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'lead.create',
          entityType: 'lead',
          entityId: row!.id,
          entityLabel: v.clubName,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ...v },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return row!.id;
    });

    revalidate('/crm');
    return actionOk({ id }, `הליד "${v.clubName}" נוצר`);
  });
}

export async function updateLeadAction(
  leadId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('crm.manage', async (ctx) => {
    const parsed = parseLead(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
      .limit(1);
    if (!current) return actionError('הליד לא נמצא');

    const d = diff(
      {
        clubName: current.clubName,
        stage: current.stage,
        city: current.city,
        region: current.region,
        courtCount: current.courtCount,
        contactName: current.contactName,
        contactRole: current.contactRole,
        contactEmail: current.contactEmail,
        contactPhone: current.contactPhone,
        source: current.source,
        dealValue: current.dealValue,
        expectedCloseDate: current.expectedCloseDate,
        notes: current.notes,
      },
      { ...v },
    );
    if (!d.changed) return actionOk({ id: leadId }, 'לא בוצע שינוי');

    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({
          clubName: v.clubName,
          stage: v.stage,
          city: v.city,
          region: v.region,
          courtCount: v.courtCount,
          contactName: v.contactName,
          contactRole: v.contactRole,
          contactEmail: v.contactEmail,
          contactPhone: v.contactPhone,
          source: v.source,
          dealValue: v.dealValue,
          expectedCloseDate: v.expectedCloseDate,
          notes: v.notes,
          // סימון זמן סגירה כדי שמדדי המשפך לא יסתמכו על ניחוש
          lostAt: v.stage === 'lost' ? (current.lostAt ?? new Date()) : null,
          wonAt: v.stage === 'live' ? (current.wonAt ?? new Date()) : current.wonAt,
        })
        .where(eq(leads.id, leadId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'lead.update',
          entityType: 'lead',
          entityId: leadId,
          entityLabel: v.clubName,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/crm', `/crm/${leadId}`);
    return actionOk({ id: leadId }, 'פרטי הליד עודכנו');
  });
}

// ─────────────────────────── מכונות ───────────────────────────

/**
 * עריכת פרטי מכונה.
 *
 * ⚠ deviceId ו־authKey אינם ניתנים לעריכה: המזהה הוא מה שהמכונה משדרת בשטח,
 * ושינויו ינתק את הטלמטריה. שיוך לעמדה ושינוי סטטוס בידוד נעשים
 * בפעולות ייעודיות עם סיבה, לא מכאן.
 */
const deviceFields = z.object({
  serialNumber: z.string().trim().min(3, 'מספר סידורי קצר מדי').max(80),
  model: z.string().trim().min(1, 'נא לציין דגם').max(80),
  hardwareVersion: optionalText(40),
  purchaseCost: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (Number.isFinite(Number(v)) && Number(v) >= 0), 'עלות אינה תקינה'),
  isSpare: z.boolean(),
  notes: optionalText(2000),
});

export async function updateDeviceAction(
  deviceId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('devices.assign', async (ctx) => {
    const parsed = deviceFields.safeParse({
      serialNumber: formString(formData, 'serialNumber'),
      model: formString(formData, 'model'),
      hardwareVersion: formString(formData, 'hardwareVersion'),
      purchaseCost: formString(formData, 'purchaseCost'),
      isSpare: formData.get('isSpare') === 'on',
      notes: formString(formData, 'notes'),
    });
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select({
        id: devices.id,
        deviceId: devices.deviceId,
        serialNumber: devices.serialNumber,
        model: devices.model,
        hardwareVersion: devices.hardwareVersion,
        purchaseCost: devices.purchaseCost,
        isSpare: devices.isSpare,
        notes: devices.notes,
        currentClubId: devices.currentClubId,
      })
      .from(devices)
      .where(and(eq(devices.id, deviceId), isNull(devices.deletedAt)))
      .limit(1);
    if (!current) return actionError('המכונה לא נמצאה');
    if (current.currentClubId) assertClubAccess(ctx.user, current.currentClubId);

    const [dup] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.serialNumber, v.serialNumber), ne(devices.id, deviceId)))
      .limit(1);
    if (dup) return actionError('מספר סידורי כבר קיים', { serialNumber: 'מספר תפוס' });

    const d = diff(
      {
        serialNumber: current.serialNumber,
        model: current.model,
        hardwareVersion: current.hardwareVersion,
        purchaseCost: current.purchaseCost,
        isSpare: current.isSpare,
        notes: current.notes,
      },
      { ...v },
    );
    if (!d.changed) return actionOk({ id: deviceId }, 'לא בוצע שינוי');

    await db.transaction(async (tx) => {
      await tx
        .update(devices)
        .set({
          serialNumber: v.serialNumber,
          model: v.model,
          hardwareVersion: v.hardwareVersion,
          purchaseCost: v.purchaseCost,
          isSpare: v.isSpare,
          notes: v.notes,
        })
        .where(eq(devices.id, deviceId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'device.update',
          entityType: 'device',
          entityId: deviceId,
          entityLabel: current.deviceId,
          clubId: current.currentClubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: d.before,
          after: d.after,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/devices/${deviceId}`);
    return actionOk({ id: deviceId }, 'פרטי המכונה עודכנו');
  });
}

// ─────────────────────────── ארכוב (מחיקה רכה) ───────────────────────────

/**
 * מחיקה במערכת היא תמיד מחיקה רכה.
 *
 * ⚠ רשומה נמחקת מחזיקה היסטוריה כספית — סשנים, תשלומים, זיכויים והתחייבות
 * Earn-Back — ומחיקה קשיחה הייתה הופכת דוחות היסטוריים לשקריים.
 * לכן `deleted_at` בלבד, וכל השאילתות במערכת מסננות `deleted_at IS NULL`.
 *
 * הפעולה חסומה כשיש פעילות חיה, כדי שלא ייווצר מצב של סשן שרץ על עמדה
 * שכבר אינה קיימת מבחינת המערכת.
 */

const archiveReasonSchema = z
  .string()
  .trim()
  .min(10, 'נא לפרט סיבת ארכוב של 10 תווים לפחות')
  .max(500, 'עד 500 תווים');

/** בדיקות חסימה משותפות לעמדה — מוחזרות כהודעה אחת ברורה */
async function stationBlockers(stationId: string): Promise<string[]> {
  const blockers: string[] = [];

  const [running] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM sessions
    WHERE station_id = ${stationId}
      AND status IN ('connecting','authorized','active','paused')
      AND deleted_at IS NULL
  `).then((r) => r.rows as { n: number }[]);
  if (running && running.n > 0) {
    blockers.push(`${pluralHe(running.n, 'אימון אחד פעיל', 'אימונים פעילים')} על העמדה`);
  }

  const [device] = await db
    .select({ deviceId: devices.deviceId })
    .from(devices)
    .where(and(eq(devices.currentStationId, stationId), isNull(devices.deletedAt)))
    .limit(1);
  if (device) {
    blockers.push(`מכונה ${device.deviceId} עדיין משויכת לעמדה`);
  }

  return blockers;
}

export async function archiveStationAction(
  stationId: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('stations.archive', async (ctx) => {
    const parsedReason = archiveReasonSchema.safeParse(reason);
    if (!parsedReason.success) {
      return actionError(parsedReason.error.issues[0]?.message ?? 'סיבה אינה תקינה', {
        reason: parsedReason.error.issues[0]?.message ?? '',
      });
    }

    const [station] = await db
      .select({
        id: stations.id,
        code: stations.code,
        name: stations.name,
        clubId: stations.clubId,
        status: stations.status,
      })
      .from(stations)
      .where(and(eq(stations.id, stationId), isNull(stations.deletedAt)))
      .limit(1);
    if (!station) return actionError('העמדה לא נמצאה או שכבר אורכבה');

    assertClubAccess(ctx.user, station.clubId);

    const blockers = await stationBlockers(stationId);
    if (blockers.length > 0) {
      return actionError(`לא ניתן לארכב את העמדה: ${blockers.join(' · ')}`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(stations)
        .set({ deletedAt: new Date(), status: 'decommissioned', decommissionedAt: new Date() })
        .where(eq(stations.id, stationId));

      await writeAudit(
        {
          action: 'soft_delete',
          actionKey: 'station.archive',
          entityType: 'station',
          entityId: stationId,
          entityLabel: `${station.code} · ${station.name}`,
          clubId: station.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: station.status, deletedAt: null },
          after: { status: 'decommissioned', deletedAt: new Date().toISOString() },
          reason: parsedReason.data,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/stations', `/stations/${stationId}`, '/clubs', `/clubs/${station.clubId}`);
    return actionOk({ id: stationId }, `העמדה "${station.name}" אורכבה`);
  });
}

export async function archiveClubAction(
  clubId: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('clubs.archive', async (ctx) => {
    const parsedReason = archiveReasonSchema.safeParse(reason);
    if (!parsedReason.success) {
      return actionError(parsedReason.error.issues[0]?.message ?? 'סיבה אינה תקינה', {
        reason: parsedReason.error.issues[0]?.message ?? '',
      });
    }

    const [club] = await db
      .select({ id: clubs.id, name: clubs.name, code: clubs.code, status: clubs.status })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), isNull(clubs.deletedAt)))
      .limit(1);
    if (!club) return actionError('המועדון לא נמצא או שכבר אורכב');

    assertClubAccess(ctx.user, clubId);

    const blockers: string[] = [];

    const [running] = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM sessions
      WHERE club_id = ${clubId}
        AND status IN ('connecting','authorized','active','paused')
        AND deleted_at IS NULL
    `).then((r) => r.rows as { n: number }[]);
    if (running && running.n > 0) {
      blockers.push(`${pluralHe(running.n, 'אימון אחד פעיל', 'אימונים פעילים')} במועדון`);
    }

    const [activeStations] = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM stations
      WHERE club_id = ${clubId} AND deleted_at IS NULL AND status <> 'decommissioned'
    `).then((r) => r.rows as { n: number }[]);
    if (activeStations && activeStations.n > 0) {
      blockers.push(
        `${pluralHe(activeStations.n, 'עמדה אחת פעילה', 'עמדות פעילות')} — יש לארכב אותן קודם`,
      );
    }

    // התחייבות Earn-Back פתוחה היא חוב כספי כלפי המועדון
    const [openEarnBack] = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM earn_back_agreements
      WHERE club_id = ${clubId} AND deleted_at IS NULL
        AND status IN ('active','at_risk','breached_by_club')
    `).then((r) => r.rows as { n: number }[]);
    if (openEarnBack && openEarnBack.n > 0) {
      blockers.push(
        pluralHe(openEarnBack.n, 'התחייבות Earn-Back אחת פתוחה', 'התחייבויות Earn-Back פתוחות'),
      );
    }

    if (blockers.length > 0) {
      return actionError(`לא ניתן לארכב את המועדון: ${blockers.join(' · ')}`);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(clubs)
        .set({ deletedAt: new Date(), status: 'churned' })
        .where(eq(clubs.id, clubId));

      await writeAudit(
        {
          action: 'soft_delete',
          actionKey: 'club.archive',
          entityType: 'club',
          entityId: clubId,
          entityLabel: `${club.code} · ${club.name}`,
          clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: club.status, deletedAt: null },
          after: { status: 'churned', deletedAt: new Date().toISOString() },
          reason: parsedReason.data,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/clubs', `/clubs/${clubId}`, '/stations', '/crm');
    return actionOk({ id: clubId }, `המועדון "${club.name}" אורכב`);
  });
}

// ─────────────────────────── תרגילים ───────────────────────────

/**
 * תרגיל מגורסה: `drills` מחזיק את הזהות, `drill_versions` את התוכן.
 *
 * ⚠ עריכה **אינה** משנה גרסה שפורסמה. תרגיל שרץ במכונה אצל שחקנים לא
 * ישתנה תחת ידיהם באמצע. עריכה יוצרת גרסה חדשה בטיוטה, והפרסום הוא
 * פעולה נפרדת ומודעת.
 */

const drillFields = z.object({
  nameHe: z.string().trim().min(2, 'שם קצר מדי').max(200),
  drillType: z.enum([
    'single_stroke',
    'combination',
    'custom_drill',
    'program',
    'coach_homework',
    'quick_start',
    'challenge',
    'screen_content',
  ]),
  level: z.enum(['1', '2', '3']),
  trainingGoal: optionalText(200),
  description: optionalText(2000),
  playerCount: z.coerce.number().int().min(1).max(2),
  durationMinutes: z.coerce.number().int().min(5, 'לפחות 5 דקות').max(180),
  shotCount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 2000), 'מספר מכות אינו תקין'),
  // ⚠ טווחי המכונה האמיתיים, לפי מסמך היצרן. ראה lib/pusun/protocol.ts
  speedKmh: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 20 && v <= 200), 'מהירות מחוץ לטווח 20–200'),
  spinLevel: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= -30 && v <= 30), 'סיבוב בטווח 30- עד 30'),
  frequencyPerMinute: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 7 && v <= 33),
      'תדירות מחוץ ליכולת המכונה (7–33 כדורים לדקה)',
    ),
  heightLevel: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 10), 'גובה בטווח 1–10'),
  depthLevel: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 10), 'עומק בטווח 1–10'),
  angleDegrees: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= -45 && v <= 45), 'זווית בטווח 45- עד 45'),
  sequence: z.enum(['fixed', 'random']),
  safetyInstructions: optionalText(1000),
});

function parseDrill(formData: FormData) {
  return drillFields.safeParse({
    nameHe: formString(formData, 'nameHe'),
    drillType: formString(formData, 'drillType') || 'single_stroke',
    level: formString(formData, 'level') || '1',
    trainingGoal: formString(formData, 'trainingGoal'),
    description: formString(formData, 'description'),
    playerCount: formString(formData, 'playerCount') || '1',
    durationMinutes: formString(formData, 'durationMinutes') || '30',
    shotCount: formString(formData, 'shotCount'),
    speedKmh: formString(formData, 'speedKmh'),
    spinLevel: formString(formData, 'spinLevel'),
    frequencyPerMinute: formString(formData, 'frequencyPerMinute'),
    heightLevel: formString(formData, 'heightLevel'),
    depthLevel: formString(formData, 'depthLevel'),
    angleDegrees: formString(formData, 'angleDegrees'),
    sequence: formString(formData, 'sequence') || 'fixed',
    safetyInstructions: formString(formData, 'safetyInstructions'),
  });
}

/** מייצר slug ייחודי מהשם העברי */
function slugify(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'drill'}-${Date.now().toString(36)}`;
}

export async function createDrillAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('content.edit', async (ctx) => {
    const parsed = parseDrill(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const id = await db.transaction(async (tx) => {
      const [drill] = await tx
        .insert(drills)
        .values({ slug: slugify(v.nameHe), nameHe: v.nameHe, drillType: v.drillType, createdByUserId: ctx.user.id })
        .returning({ id: drills.id });

      const [version] = await tx
        .insert(drillVersions)
        .values({
          drillId: drill!.id,
          versionNumber: 1,
          // ⚠ נוצר כטיוטה. פרסום הוא פעולה נפרדת ומודעת.
          status: 'draft',
          level: v.level,
          trainingGoal: v.trainingGoal,
          description: v.description,
          playerCount: v.playerCount,
          durationMinutes: v.durationMinutes,
          shotCount: v.shotCount,
          speedKmh: v.speedKmh,
          spinLevel: v.spinLevel,
          frequencyPerMinute: v.frequencyPerMinute,
          heightLevel: v.heightLevel,
          depthLevel: v.depthLevel,
          angleDegrees: v.angleDegrees,
          sequence: v.sequence,
          safetyInstructions: v.safetyInstructions,
        })
        .returning({ id: drillVersions.id });

      await tx.update(drills).set({ currentVersionId: version!.id }).where(eq(drills.id, drill!.id));

      await writeAudit(
        {
          action: 'create',
          actionKey: 'drill.create',
          entityType: 'drill',
          entityId: drill!.id,
          entityLabel: v.nameHe,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ...v },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
      return drill!.id;
    });

    revalidate('/content');
    return actionOk({ id }, `התרגיל "${v.nameHe}" נוצר כטיוטה`);
  });
}

/**
 * עריכת תרגיל.
 *
 * ⚠ אם הגרסה הנוכחית פורסמה — נוצרת גרסה חדשה בטיוטה במקום לשנות אותה.
 * שינוי גרסה פעילה היה משנה תרגיל שרץ ברגע זה על מכונה.
 */
export async function updateDrillAction(
  drillId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withPermission('content.edit', async (ctx) => {
    const parsed = parseDrill(formData);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;

    const [current] = await db
      .select({
        drillId: drills.id,
        nameHe: drills.nameHe,
        versionId: drillVersions.id,
        versionNumber: drillVersions.versionNumber,
        status: drillVersions.status,
      })
      .from(drills)
      .leftJoin(drillVersions, eq(drillVersions.id, drills.currentVersionId))
      .where(and(eq(drills.id, drillId), isNull(drills.deletedAt)))
      .limit(1);
    if (!current) return actionError('התרגיל לא נמצא');

    const published = current.status === 'published';

    await db.transaction(async (tx) => {
      await tx
        .update(drills)
        .set({ nameHe: v.nameHe, drillType: v.drillType })
        .where(eq(drills.id, drillId));

      const payload = {
        level: v.level,
        trainingGoal: v.trainingGoal,
        description: v.description,
        playerCount: v.playerCount,
        durationMinutes: v.durationMinutes,
        shotCount: v.shotCount,
        speedKmh: v.speedKmh,
        spinLevel: v.spinLevel,
        frequencyPerMinute: v.frequencyPerMinute,
        heightLevel: v.heightLevel,
        depthLevel: v.depthLevel,
        angleDegrees: v.angleDegrees,
        sequence: v.sequence,
        safetyInstructions: v.safetyInstructions,
      };

      if (published || !current.versionId) {
        const [next] = await tx
          .insert(drillVersions)
          .values({
            drillId,
            versionNumber: (current.versionNumber ?? 0) + 1,
            status: 'draft',
            ...payload,
          })
          .returning({ id: drillVersions.id });
        await tx.update(drills).set({ currentVersionId: next!.id }).where(eq(drills.id, drillId));
      } else {
        await tx.update(drillVersions).set(payload).where(eq(drillVersions.id, current.versionId));
      }

      await writeAudit(
        {
          action: 'update',
          actionKey: published ? 'drill.new_version' : 'drill.update',
          entityType: 'drill',
          entityId: drillId,
          entityLabel: v.nameHe,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { name: current.nameHe, version: current.versionNumber, status: current.status },
          after: { ...v, newVersion: published },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/content');
    return actionOk(
      { id: drillId },
      published
        ? 'נוצרה גרסה חדשה בטיוטה. הגרסה שפורסמה לא שונתה.'
        : 'התרגיל עודכן',
    );
  });
}
