import 'server-only';
import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { devices, sessions, stations, users } from '@/db/schema';
import { generateToken, hashToken } from '@/server/auth/crypto';
import { writeAudit } from '@/server/audit';
import { RUNNING_STATUSES } from '@/lib/session-lifecycle';
import { normalizePhone } from '@/lib/phone';

export { normalizePhone };

/**
 * פתיחת סשן מהאפליקציה.
 *
 * ⚠ זו נקודת הכניסה היחידה שאין לפניה טוקן — הסשן עדיין לא קיים. לכן
 * כל האימות כאן נשען על מצב השרת ולא על מה שהלקוח מספר: העמדה חייבת
 * להיות פעילה, ואסור שירוץ עליה סשן אחר.
 *
 * ⚠ **כל עוד אין סליקה, הנקודה הזו היא שער ההכנסה בפועל.** סשן ללא
 * אסמכתת תשלום נוצר בסטטוס נפרד ומסומן במפורש, כדי שלא ייספר כשעה
 * בתשלום ולא יזהם את המדדים.
 */

/** מגבלת קצב פר טלפון, כדי שנקודה חסרת־תשלום לא תהיה פתוחה לרעה */
const MAX_SESSIONS_PER_PHONE_PER_HOUR = 6;

export interface CreateSessionInput {
  /** הקוד מהברקוד — מזהה מכונה, טוקן QR, או קוד עמדה */
  machineCode: string;
  phone: string;
  playerName?: string | null;
  drillVersionId?: string | null;
  scheduledMinutes?: number | null;
  /** אסמכתת תשלום. null = סשן פיילוט שאינו נחשב משולם. */
  paymentRef?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type CreateSessionResult =
  | {
      ok: true;
      sessionId: string;
      reference: string;
      sessionToken: string;
      expiresAt: Date;
      deviceId: string | null;
      stationCode: string;
      isPaid: boolean;
    }
  | { ok: false; code: string; message: string };

/** מזהה קריא לאדם: VX-260826-0042 */
function buildReference(now: Date, counter: number): string {
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `VX-${y}${m}${d}-${String(counter).padStart(4, '0')}`;
}

/**
 * מאתר את העמדה לפי הקוד שנסרק.
 *
 * ⚠ מקבל כמה צורות במכוון: הברקוד מודבק על המכונה, אך המכונה מוחלפת
 * והעמדה נשארת. תמיכה בשתי הצורות מונעת ניתוק כשמחליפים מכונה.
 */
async function resolveStation(machineCode: string) {
  const code = machineCode.trim();

  const [byDevice] = await db
    .select({
      stationId: stations.id,
      stationCode: stations.code,
      stationStatus: stations.status,
      clubId: stations.clubId,
      deviceUuid: devices.id,
      deviceId: devices.deviceId,
    })
    .from(devices)
    .innerJoin(stations, eq(stations.id, devices.currentStationId))
    .where(
      and(
        or(eq(devices.deviceId, code), eq(devices.qrCodeToken, code)),
        isNull(devices.deletedAt),
        isNull(stations.deletedAt),
      ),
    )
    .limit(1);
  if (byDevice) return byDevice;

  const [byStation] = await db
    .select({
      stationId: stations.id,
      stationCode: stations.code,
      stationStatus: stations.status,
      clubId: stations.clubId,
      deviceUuid: devices.id,
      deviceId: devices.deviceId,
    })
    .from(stations)
    .leftJoin(
      devices,
      and(eq(devices.currentStationId, stations.id), isNull(devices.deletedAt)),
    )
    .where(
      and(
        or(eq(stations.code, code), eq(stations.qrCodeToken, code)),
        isNull(stations.deletedAt),
      ),
    )
    .limit(1);

  return byStation ?? null;
}

export async function createAppSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    return { ok: false, code: 'invalid_phone', message: 'מספר טלפון אינו תקין' };
  }

  const station = await resolveStation(input.machineCode);
  if (!station) {
    return { ok: false, code: 'unknown_machine', message: 'הקוד אינו מוכר במערכת' };
  }
  if (station.stationStatus !== 'active') {
    return {
      ok: false,
      code: 'station_unavailable',
      message: `העמדה אינה זמינה כרגע (${station.stationStatus})`,
    };
  }

  // ⚠ ההגנה החשובה ביותר כאן. בלעדיה שני אנשים פותחים סשן על אותה
  // מכונה, שניהם משלמים, ורק אחד מקבל אימון.
  const [busy] = await db
    .select({ reference: sessions.reference })
    .from(sessions)
    .where(
      and(
        eq(sessions.stationId, station.stationId),
        inArray(sessions.status, RUNNING_STATUSES),
        isNull(sessions.deletedAt),
      ),
    )
    .limit(1);
  if (busy) {
    return {
      ok: false,
      code: 'station_busy',
      message: 'כבר מתקיים אימון על העמדה הזו',
    };
  }

  const [recent] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(users.phone, phone),
        gte(sessions.createdAt, sql`now() - interval '1 hour'`),
        isNull(sessions.deletedAt),
      ),
    );
  if ((recent?.n ?? 0) >= MAX_SESSIONS_PER_PHONE_PER_HOUR) {
    return {
      ok: false,
      code: 'rate_limited',
      message: 'נפתחו יותר מדי סשנים מהמספר הזה בשעה האחרונה',
    };
  }

  const isPaid = Boolean(input.paymentRef?.trim());
  const sessionToken = generateToken(32);
  const now = new Date();
  const minutes = input.scheduledMinutes ?? 60;
  // תוקף הטוקן חורג מהאימון, כדי שדיווח מאוחר לא יידחה
  const expiresAt = new Date(now.getTime() + (minutes + 60) * 60_000);

  const created = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);

    let userId = existing?.id;
    if (!userId) {
      const [row] = await tx
        .insert(users)
        .values({
          phone,
          fullName: input.playerName?.trim() || `שחקן ${phone.slice(-4)}`,
          status: 'active',
          isPlayer: true,
        })
        .returning({ id: users.id });
      userId = row!.id;
    }

    // מונה יומי לצורך מזהה קריא
    const counted = (
      await tx.execute(sql`
        SELECT COUNT(*)::int AS n FROM sessions
        WHERE created_at >= date_trunc('day', now())
      `)
    ).rows as { n: number }[];
    const dailyCount = Number(counted[0]?.n ?? 0);

    const [session] = await tx
      .insert(sessions)
      .values({
        reference: buildReference(now, dailyCount + 1),
        // ⚠ סשן ללא תשלום נכנס כ־authorized ולא כ־paid. isPaidSession
        // בודק גם סטטוס וגם סכום, ולכן הוא לא ייספר כשעה בתשלום.
        status: isPaid ? 'paid' : 'authorized',
        userId,
        isGuest: !existing,
        guestPhone: phone,
        guestName: input.playerName?.trim() || null,
        clubId: station.clubId,
        stationId: station.stationId,
        deviceId: station.deviceUuid ?? null,
        drillVersionId: input.drillVersionId ?? null,
        scheduledMinutes: minutes,
        scheduledStartAt: now,
        sessionTokenHash: hashToken(sessionToken),
        tokenIssuedAt: now,
        tokenExpiresAt: expiresAt,
        // ⚠ אסמכתת התשלום נשמרת ב־metadata ולא בעמודה ייעודית: עד
        // שהסליקה תחובר אין לה סמנטיקה מוסכמת, ועמודה ריקה הייתה
        // נראית כמו שדה שכבר מאומת.
        metadata: input.paymentRef?.trim()
          ? { paymentRef: input.paymentRef.trim(), source: 'app' }
          : { source: 'app', unpaidPilot: true },
      })
      .returning({ id: sessions.id, reference: sessions.reference });

    await writeAudit(
      {
        action: 'create',
        actionKey: 'session.create_from_app',
        entityType: 'session',
        entityId: session!.id,
        entityLabel: session!.reference,
        clubId: station.clubId,
        // ⚠ הטוקן עצמו לעולם אינו נרשם ביומן
        after: {
          station: station.stationCode,
          device: station.deviceId,
          phone,
          paid: isPaid,
          paymentRef: input.paymentRef ?? null,
        },
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      tx,
    );

    return session!;
  });

  return {
    ok: true,
    sessionId: created.id,
    reference: created.reference,
    sessionToken,
    expiresAt,
    deviceId: station.deviceId ?? null,
    stationCode: station.stationCode,
    isPaid,
  };
}
