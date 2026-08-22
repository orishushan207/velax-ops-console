import { db } from '@/db/client';
import {
  clubContacts,
  clubContracts,
  clubOperatingHours,
  clubs,
  courts,
  devices,
  deviceAssignments,
  firmwareVersions,
  screens,
  stations,
} from '@/db/schema';
import { encryptSecret, generateToken } from '@/server/auth/crypto';
import { Rng, israeliPhone } from './rng';

/**
 * חמישה מועדונים מסוגים שונים, לפי פרק 15.2 בתוכנית:
 * עירוני עמוס, פרברי, פרימיום, אקדמיה, ופיילוט חדש.
 *
 * הפרופיל התפעולי (usageFactor, reliability) קובע איך ייראו הנתונים
 * ב־90 יום של סשנים — כך שכל מסך בדשבורד יראה שונות אמיתית ולא רעש אחיד.
 */
export const CLUB_BLUEPRINTS = [
  {
    code: 'TLV-01',
    name: 'פאדל תל אביב — יגאל אלון',
    region: 'תל אביב והמרכז',
    city: 'תל אביב',
    address: 'יגאל אלון 98, תל אביב',
    status: 'active' as const,
    courtCount: 6,
    stationCount: 3,
    stationType: 'full' as const,
    joinedDaysAgo: 240,
    /** מועדון עירוני עמוס — שעות שפל מעטות, אך ביקוש גבוה */
    usageFactor: 1.35,
    reliability: 0.97,
    offPeakShare: 0.32,
    slaTier: 'premium' as const,
    pricingModel: 'setup_fee_usage' as const,
    setupFee: 6000,
    monthlyRetainer: 0,
    courtRevenuePerHour: 110,
  },
  {
    code: 'RAA-01',
    name: 'מועדון פאדל רעננה',
    region: 'השרון',
    city: 'רעננה',
    address: 'האורנים 12, רעננה',
    status: 'active' as const,
    courtCount: 4,
    stationCount: 2,
    stationType: 'lean' as const,
    joinedDaysAgo: 185,
    /** פרברי עם זמינות גבוהה — הרבה שעות שפל */
    usageFactor: 1.05,
    reliability: 0.95,
    offPeakShare: 0.52,
    slaTier: 'standard' as const,
    pricingModel: 'setup_fee_usage' as const,
    setupFee: 6000,
    monthlyRetainer: 0,
    courtRevenuePerHour: 90,
  },
  {
    code: 'HRZ-01',
    name: 'Herzliya Padel Club',
    region: 'השרון',
    city: 'הרצליה',
    address: 'מדינת היהודים 60, הרצליה',
    status: 'active' as const,
    courtCount: 5,
    stationCount: 2,
    stationType: 'full' as const,
    joinedDaysAgo: 160,
    /** פרימיום — willingness-to-pay גבוה */
    usageFactor: 1.15,
    reliability: 0.98,
    offPeakShare: 0.44,
    slaTier: 'premium' as const,
    pricingModel: 'hybrid' as const,
    setupFee: 3000,
    monthlyRetainer: 700,
    courtRevenuePerHour: 120,
  },
  {
    code: 'JLM-01',
    name: 'אקדמיית פאדל ירושלים',
    region: 'ירושלים',
    city: 'ירושלים',
    address: 'דרך חברון 101, ירושלים',
    status: 'active' as const,
    courtCount: 4,
    stationCount: 2,
    stationType: 'lean' as const,
    joinedDaysAgo: 120,
    /** מועדון מאמנים — הרבה שיעורי בית ותוכן */
    usageFactor: 0.92,
    reliability: 0.93,
    offPeakShare: 0.61,
    slaTier: 'standard' as const,
    pricingModel: 'setup_fee_usage' as const,
    setupFee: 6000,
    monthlyRetainer: 0,
    courtRevenuePerHour: 85,
  },
  {
    code: 'BSH-01',
    name: 'פאדל באר שבע',
    region: 'הדרום',
    city: 'באר שבע',
    address: 'שדרות רגר 5, באר שבע',
    status: 'pilot' as const,
    courtCount: 3,
    stationCount: 1,
    stationType: 'lean' as const,
    joinedDaysAgo: 55,
    /** פיילוט חדש עם שימוש נמוך — זה המועדון שיהיה בסיכון Earn-Back */
    usageFactor: 0.48,
    reliability: 0.88,
    offPeakShare: 0.38,
    slaTier: 'standard' as const,
    pricingModel: 'setup_fee_usage' as const,
    setupFee: 6000,
    monthlyRetainer: 0,
    courtRevenuePerHour: 75,
  },
];

export type ClubBlueprint = (typeof CLUB_BLUEPRINTS)[number];

export interface SeededStation {
  id: string;
  code: string;
  clubId: string;
  clubCode: string;
  blueprint: ClubBlueprint;
  deviceId: string | null;
}

export async function seedNetwork(
  rng: Rng,
  now: Date,
  slaIds: { defaultSlaId: string; premiumSlaId: string },
  accountManagerId: string,
) {
  console.log('▸ Firmware...');
  const fwRows = await db
    .insert(firmwareVersions)
    .values([
      {
        version: '1.2.0',
        channel: 'stable' as const,
        releaseNotes: 'גרסת בסיס לפיילוט. תמיכה ב־BLE, טיימר מקומי ו־Session Token חתום.',
        releasedAt: new Date(now.getTime() - 200 * 86400000),
        isDemo: true,
      },
      {
        version: '1.3.4',
        channel: 'stable' as const,
        releaseNotes: 'שיפור יציבות חיבור BLE, דיווח מונה כדורים מדויק יותר.',
        releasedAt: new Date(now.getTime() - 90 * 86400000),
        isMinimumRequired: true,
        isDemo: true,
      },
      {
        version: '1.4.2',
        channel: 'stable' as const,
        releaseNotes: 'תמיכה בהארכת סשן, שיפור צריכת סוללה, תיקון באג במנוע ההזנה.',
        releasedAt: new Date(now.getTime() - 25 * 86400000),
        isDemo: true,
      },
      {
        version: '1.5.0-beta.3',
        channel: 'beta' as const,
        releaseNotes: 'ניסיוני: כיול אוטומטי של מהירות. אינו מיועד לעמדות בייצור.',
        releasedAt: new Date(now.getTime() - 8 * 86400000),
        isDemo: true,
      },
    ])
    .returning({ id: firmwareVersions.id, version: firmwareVersions.version });

  const fwByVersion = new Map(fwRows.map((f) => [f.version, f.id]));

  console.log('▸ מועדונים, מגרשים ועמדות...');
  const seededStations: SeededStation[] = [];
  const clubIdByCode = new Map<string, string>();
  const contractIdByClub = new Map<string, string>();

  for (const bp of CLUB_BLUEPRINTS) {
    const joinedAt = new Date(now.getTime() - bp.joinedDaysAgo * 86400000);

    const [club] = await db
      .insert(clubs)
      .values({
        code: bp.code,
        name: bp.name,
        region: bp.region,
        city: bp.city,
        address: bp.address,
        status: bp.status,
        courtCount: bp.courtCount,
        joinedAt: joinedAt.toISOString().slice(0, 10),
        offPeakStart: '08:00',
        offPeakEnd: '16:00',
        offPeakDays: [0, 1, 2, 3, 4],
        accountManagerId,
        isDemo: true,
      })
      .returning({ id: clubs.id });
    if (!club) continue;
    clubIdByCode.set(bp.code, club.id);

    // שעות פעילות: ראשון–חמישי 06:00–23:00, שישי 06:00–17:00, שבת 08:00–22:00
    for (let day = 0; day <= 6; day++) {
      const opens = day === 6 ? '08:00' : '06:00';
      const closes = day === 5 ? '17:00' : '23:00';
      await db.insert(clubOperatingHours).values({
        clubId: club.id,
        dayOfWeek: day,
        opensAt: opens,
        closesAt: closes,
        isDemo: true,
      });
    }

    await db.insert(clubContacts).values([
      {
        clubId: club.id,
        fullName: `${rng.pick(['רון', 'שי', 'אלי', 'דור', 'נטע'])} ${rng.pick(['כהן', 'לוי', 'מזרחי', 'שפירא'])}`,
        role: 'מנהל מועדון',
        email: `manager@${bp.code.toLowerCase()}.example.co.il`,
        phone: israeliPhone(rng),
        isPrimary: true,
        isDemo: true,
      },
      {
        clubId: club.id,
        fullName: `${rng.pick(['מיכל', 'עדי', 'שירן', 'ליאת'])} ${rng.pick(['ברק', 'הראל', 'גולן'])}`,
        role: 'אחראי תפעול',
        email: `ops@${bp.code.toLowerCase()}.example.co.il`,
        phone: israeliPhone(rng),
        isDemo: true,
      },
    ]);

    const [contract] = await db
      .insert(clubContracts)
      .values({
        clubId: club.id,
        contractNumber: `VX-CT-${bp.code}-001`,
        status: 'active',
        pricingModel: bp.pricingModel,
        setupFee: String(bp.setupFee),
        monthlyRetainer: String(bp.monthlyRetainer),
        consumerPricePerHour: bp.slaTier === 'premium' ? '100' : '90',
        startsOn: joinedAt.toISOString().slice(0, 10),
        endsOn: new Date(joinedAt.getTime() + 365 * 86400000).toISOString().slice(0, 10),
        renewalDate: new Date(joinedAt.getTime() + 335 * 86400000).toISOString().slice(0, 10),
        autoRenew: true,
        slaPolicyId: bp.slaTier === 'premium' ? slaIds.premiumSlaId : slaIds.defaultSlaId,
        signedAt: joinedAt,
        signedByName: 'מנהל המועדון',
        terms:
          'הסכם פיילוט VELA-X. כולל ערבות Earn-Back ל־180 יום בכפוף לתנאי הסף המפורטים בנספח א׳.',
        isDemo: true,
      })
      .returning({ id: clubContracts.id });
    if (contract) contractIdByClub.set(bp.code, contract.id);

    const courtIds: string[] = [];
    for (let i = 1; i <= bp.courtCount; i++) {
      const [court] = await db
        .insert(courts)
        .values({
          clubId: club.id,
          name: `מגרש ${i}`,
          isIndoor: i <= 2,
          revenuePerHourNet: String(bp.courtRevenuePerHour),
          isDemo: true,
        })
        .returning({ id: courts.id });
      if (court) courtIds.push(court.id);
    }

    for (let i = 1; i <= bp.stationCount; i++) {
      const code = `${bp.code}-ST${i}`;
      const servesCount = Math.min(courtIds.length, Math.ceil(bp.courtCount / bp.stationCount));
      const [station] = await db
        .insert(stations)
        .values({
          clubId: club.id,
          code,
          name: `עמדה ${i} · ${bp.city}`,
          stationType: bp.stationType,
          status: 'active',
          locationDescription: `סמוך למגרשים ${courtIds.slice((i - 1) * servesCount, i * servesCount).length ? `${(i - 1) * servesCount + 1}–${Math.min(i * servesCount, bp.courtCount)}` : '1'}`,
          servesCourtIds: courtIds.slice((i - 1) * servesCount, i * servesCount),
          installedAt: new Date(joinedAt.getTime() + 3 * 86400000),
          installedCost: bp.stationType === 'full' ? '10000' : '5500',
          qrCodeToken: generateToken(16),
          nfcTagId: `NFC-${code}`,
          isDemo: true,
        })
        .returning({ id: stations.id });
      if (!station) continue;

      seededStations.push({
        id: station.id,
        code,
        clubId: club.id,
        clubCode: bp.code,
        blueprint: bp,
        deviceId: null,
      });

      if (bp.stationType === 'full') {
        await db.insert(screens).values({
          clubId: club.id,
          stationId: station.id,
          name: `מסך ${code}`,
          serialNumber: `SCR-${code}`,
          status: rng.bool(0.85) ? 'online' : 'offline',
          lastHeartbeatAt: new Date(now.getTime() - rng.int(1, 400) * 60000),
          isDemo: true,
        });
      }
    }
  }

  console.log(`  ✓ ${CLUB_BLUEPRINTS.length} מועדונים, ${seededStations.length} עמדות`);

  console.log('▸ מכשירים...');
  // 12 מכשירים: 10 משויכים לעמדות, 2 חלופיים במלאי
  const deviceIds: string[] = [];
  for (let i = 0; i < seededStations.length; i++) {
    const station = seededStations[i]!;
    const bp = station.blueprint;
    const isLagging = i === seededStations.length - 1; // מכשיר אחד עם Firmware ישן
    const fwId =
      fwByVersion.get(isLagging ? '1.3.4' : rng.bool(0.8) ? '1.4.2' : '1.3.4') ??
      fwByVersion.get('1.4.2')!;

    const installedAt = new Date(now.getTime() - bp.joinedDaysAgo * 86400000 + 3 * 86400000);
    const isOffline = !rng.bool(bp.reliability);

    const [device] = await db
      .insert(devices)
      .values({
        deviceId: `VX-DEV-${String(1000 + i)}`,
        serialNumber: `PT9001-${String(240000 + i * 137)}`,
        model: 'PT-9001 · VELA-X ELITE',
        hardwareVersion: 'HW-2.1',
        firmwareVersionId: fwId,
        status: isOffline ? 'offline' : 'active',
        isAuthorized: true,
        authorizedAt: installedAt,
        // ⚠ המפתח נשמר מוצפן. אין endpoint שמחזיר אותו.
        authKeyEncrypted: encryptSecret(generateToken(32)),
        authKeyRotatedAt: installedAt,
        currentClubId: station.clubId,
        currentStationId: station.id,
        connectivity: isOffline ? 'offline' : 'online',
        lastSeenAt: isOffline
          ? new Date(now.getTime() - rng.int(15, 240) * 60000)
          : new Date(now.getTime() - rng.int(1, 8) * 60000),
        batteryPct: isOffline ? rng.int(4, 25) : rng.int(35, 99),
        operatingHours: String(rng.float(80, 620, 2)),
        ballCount: rng.int(9000, 78000),
        estimatedBallsRemaining: rng.int(60, 400),
        purchaseDate: new Date(installedAt.getTime() - 30 * 86400000).toISOString().slice(0, 10),
        purchaseCost: '3000',
        warrantyUntil: new Date(installedAt.getTime() + 365 * 86400000).toISOString().slice(0, 10),
        lastServiceAt: new Date(now.getTime() - rng.int(5, 70) * 86400000),
        nextServiceDue: new Date(now.getTime() + rng.int(-6, 45) * 86400000)
          .toISOString()
          .slice(0, 10),
        qrCodeToken: generateToken(16),
        isDemo: true,
      })
      .returning({ id: devices.id });
    if (!device) continue;

    deviceIds.push(device.id);
    station.deviceId = device.id;

    await db.insert(deviceAssignments).values({
      deviceId: device.id,
      stationId: station.id,
      clubId: station.clubId,
      reason: 'initial_install',
      assignedAt: installedAt,
      assignedBy: accountManagerId,
      notes: 'התקנה ראשונית',
      isDemo: true,
    });
  }

  // שתי מכונות חלופיות במלאי — התחייבות ה־SLA מפרק 14
  for (let i = 0; i < 2; i++) {
    const [spare] = await db
      .insert(devices)
      .values({
        deviceId: `VX-DEV-${String(9000 + i)}`,
        serialNumber: `PT9001-SPARE-${String(90 + i)}`,
        model: 'PT-9001 · VELA-X ELITE',
        hardwareVersion: 'HW-2.1',
        firmwareVersionId: fwByVersion.get('1.4.2')!,
        status: 'in_stock',
        isAuthorized: true,
        authorizedAt: new Date(now.getTime() - 60 * 86400000),
        authKeyEncrypted: encryptSecret(generateToken(32)),
        isSpare: true,
        connectivity: 'offline',
        batteryPct: 100,
        operatingHours: String(rng.float(0, 40, 2)),
        ballCount: rng.int(0, 4000),
        purchaseDate: new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10),
        purchaseCost: '3000',
        warrantyUntil: new Date(now.getTime() + 275 * 86400000).toISOString().slice(0, 10),
        notes: 'מכונה חלופית להחלפה מהירה לפי SLA',
        isDemo: true,
      })
      .returning({ id: devices.id });
    if (spare) deviceIds.push(spare.id);
  }

  console.log(`  ✓ ${deviceIds.length} מכשירים (כולל 2 חלופיים)`);

  return { seededStations, clubIdByCode, contractIdByClub, deviceIds, fwByVersion };
}
