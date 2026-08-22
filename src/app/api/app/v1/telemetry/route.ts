import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { deviceTelemetry, devices } from '@/db/schema';
import { resolveDeviceForSession } from '@/server/app-api/auth';
import { FAULT_CODES, decodeMessage, ProtocolError } from '@/lib/pusun/protocol';
import { jsonError, readJson, withSession } from '../_shared';

export const dynamic = 'force-dynamic';

interface TelemetryBody {
  deviceId?: string;
  /** מסגרות notify גולמיות כפי שהתקבלו ב־BLE, כמחרוזות hex */
  frames?: string[];
  /** מדדים שהאפליקציה מודדת בעצמה ואינם בפרוטוקול */
  rssi?: number;
  ballsFired?: number;
}

/**
 * POST /api/app/v1/telemetry
 *
 * קולט טלמטריה מהמכונה, כפי שהאפליקציה קלטה אותה ב־BLE.
 *
 * ⚠ האפליקציה מעבירה את המסגרות **גולמיות**, והפענוח נעשה כאן. כך יש
 * מקור אמת אחד לפרוטוקול, ותיקון באג בפענוח אינו דורש עדכון אפליקציה
 * אצל כל המשתמשים.
 *
 * ⚠ מסגרת פגומה נדחית ואינה נרשמת. רישום ערך שגוי כאילו נמדד גרוע
 * מהיעדר מדידה, כי הוא מזין מדדים תפעוליים.
 */
export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJson<TelemetryBody>(request);
    if (!body?.deviceId) return jsonError('נדרש deviceId', 400);

    const device = await resolveDeviceForSession(session, body.deviceId);
    if (!device.ok) return jsonError(device.reason, 403, { code: 'device_mismatch' });

    let batteryPct: number | null = null;
    let faultCode: string | null = null;
    const rejected: string[] = [];

    for (const frame of body.frames ?? []) {
      try {
        const message = decodeMessage(frame);
        if (message.kind === 'battery') batteryPct = message.batteryPct;
        if (message.kind === 'fault') faultCode = String(message.code);
      } catch (error) {
        rejected.push(error instanceof ProtocolError ? error.message : 'מסגרת שגויה');
      }
    }

    const hasReading =
      batteryPct !== null ||
      faultCode !== null ||
      body.rssi !== undefined ||
      body.ballsFired !== undefined;

    if (!hasReading) {
      return jsonError('לא התקבלה אף מדידה תקינה', 400, { rejected });
    }

    await db.transaction(async (tx) => {
      await tx.insert(deviceTelemetry).values({
        deviceId: device.deviceUuid,
        sessionId: session.sessionId,
        batteryPct,
        connectivity: 'online',
        rssi: body.rssi ?? null,
        ballsFired: body.ballsFired ?? null,
        errorCode: faultCode,
        raw: { frames: body.frames ?? [], rejected },
      });

      // מצב המכשיר משקף את המדידה האחרונה, כדי שמסכי הצי לא ישאלו
      // את טבלת הטלמטריה בכל רינדור
      await tx
        .update(devices)
        .set({
          connectivity: 'online',
          lastSeenAt: sql`now()`,
          ...(batteryPct !== null ? { batteryPct } : {}),
        })
        .where(eq(devices.id, device.deviceUuid));
    });

    return NextResponse.json({
      ok: true,
      accepted: { batteryPct, faultCode, faultDescription: faultCode ? FAULT_CODES[Number(faultCode)] ?? null : null },
      rejected,
    });
  });
}
