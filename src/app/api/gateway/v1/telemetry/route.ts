import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { deviceTelemetry, devices } from '@/db/schema';
import { FAULT_CODES, ProtocolError, decodeMessage } from '@/lib/pusun/protocol';
import { gatewayError, withGateway } from '../_shared';

export const dynamic = 'force-dynamic';

interface TelemetryBody {
  frames?: string[];
  rssi?: number;
}

/**
 * POST /api/gateway/v1/telemetry
 *
 * קולט טלמטריה מהמכונה דרך השער.
 *
 * ⚠ בניגוד לטלמטריה מהאפליקציה, זו מגיעה **ברציפות** ולא רק בזמן סשן.
 * זה מה שהופך את זיהוי השימוש הבלתי מוסבר מכלי תיאורטי לכלי עובד:
 * ירידת סוללה בין סשנים נמדדת בפועל ולא מוערכת.
 *
 * ⚠ אין sessionId. השער אינו יודע על סשנים, ולכן הקריאה נרשמת ללא שיוך
 * והשיוך נעשה בדיעבד לפי חלון הזמן.
 */
export async function POST(request: Request) {
  return withGateway(request, async (gateway) => {
    if (!gateway.deviceUuid) {
      return gatewayError('אין מכונה משויכת לעמדה', 409, { code: 'no_device' });
    }

    let body: TelemetryBody | null = null;
    try {
      body = (await request.json()) as TelemetryBody;
    } catch {
      return gatewayError('גוף הבקשה אינו JSON תקין', 400);
    }

    let batteryPct: number | null = null;
    let faultCode: string | null = null;
    const rejected: string[] = [];

    for (const frame of body?.frames ?? []) {
      try {
        const message = decodeMessage(frame);
        if (message.kind === 'battery') batteryPct = message.batteryPct;
        if (message.kind === 'fault') faultCode = String(message.code);
      } catch (error) {
        rejected.push(error instanceof ProtocolError ? error.message : 'מסגרת שגויה');
      }
    }

    if (batteryPct === null && faultCode === null && body?.rssi === undefined) {
      return gatewayError('לא התקבלה אף מדידה תקינה', 400, { rejected });
    }

    await db.transaction(async (tx) => {
      await tx.insert(deviceTelemetry).values({
        deviceId: gateway.deviceUuid!,
        sessionId: null,
        batteryPct,
        connectivity: 'online',
        rssi: body?.rssi ?? null,
        errorCode: faultCode,
        raw: { source: 'gateway', gatewayId: gateway.gatewayId, frames: body?.frames ?? [], rejected },
      });

      await tx
        .update(devices)
        .set({
          connectivity: 'online',
          lastSeenAt: sql`now()`,
          ...(batteryPct !== null ? { batteryPct } : {}),
        })
        .where(eq(devices.id, gateway.deviceUuid!));
    });

    return NextResponse.json({
      ok: true,
      accepted: {
        batteryPct,
        faultCode,
        faultDescription: faultCode ? (FAULT_CODES[Number(faultCode)] ?? null) : null,
      },
      rejected,
    });
  });
}
