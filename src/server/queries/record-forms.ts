import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs, coaches, devices, leads, playerProfiles, stations, users } from '@/db/schema';

/**
 * שליפת הערכים הנוכחיים למילוי מראש של טופסי עריכה.
 *
 * שאילתות ייעודיות ולא שימוש חוזר בשאילתות המסך: הטופס צריך בדיוק
 * את השדות שהוא כותב אליהם, וכך שינוי בתצוגה לא שובר את העריכה.
 * הגישה עצמה נאכפת ב־Server Action, וגם ב־RLS מתחת.
 */

export async function getClubFormValues(clubId: string) {
  const [row] = await db
    .select({
      name: clubs.name,
      code: clubs.code,
      city: clubs.city,
      region: clubs.region,
      address: clubs.address,
      status: clubs.status,
      courtCount: clubs.courtCount,
      offPeakStart: clubs.offPeakStart,
      offPeakEnd: clubs.offPeakEnd,
      notes: clubs.notes,
    })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), isNull(clubs.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getStationFormValues(stationId: string) {
  const [row] = await db
    .select({
      clubId: stations.clubId,
      name: stations.name,
      code: stations.code,
      stationType: stations.stationType,
      status: stations.status,
      locationDescription: stations.locationDescription,
      installedCost: stations.installedCost,
    })
    .from(stations)
    .where(and(eq(stations.id, stationId), isNull(stations.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getPlayerFormValues(userId: string) {
  const [row] = await db
    .select({
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
  return row ?? null;
}

export async function getCoachFormValues(coachId: string) {
  const [row] = await db
    .select({
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      displayName: coaches.displayName,
      referralCode: coaches.referralCode,
      verification: coaches.verification,
      homeClubId: coaches.homeClubId,
      bio: coaches.bio,
    })
    .from(coaches)
    .innerJoin(users, eq(users.id, coaches.userId))
    .where(and(eq(coaches.id, coachId), isNull(coaches.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getLeadFormValues(leadId: string) {
  const [row] = await db
    .select({
      clubName: leads.clubName,
      stage: leads.stage,
      city: leads.city,
      region: leads.region,
      courtCount: leads.courtCount,
      contactName: leads.contactName,
      contactRole: leads.contactRole,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
      source: leads.source,
      dealValue: leads.dealValue,
      expectedCloseDate: leads.expectedCloseDate,
      notes: leads.notes,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getDeviceFormValues(deviceId: string) {
  const [row] = await db
    .select({
      serialNumber: devices.serialNumber,
      model: devices.model,
      hardwareVersion: devices.hardwareVersion,
      purchaseCost: devices.purchaseCost,
      isSpare: devices.isSpare,
      notes: devices.notes,
    })
    .from(devices)
    .where(and(eq(devices.id, deviceId), isNull(devices.deletedAt)))
    .limit(1);
  return row ?? null;
}
