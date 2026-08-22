import { NextResponse } from 'next/server';
import { acknowledgeCommand, fetchPendingCommands } from '@/server/app-api/command-queue';
import { gatewayError, withGateway } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gateway/v1/commands
 *
 * מוסר לשער את הפקודות הממתינות למכונה שבעמדתו.
 *
 * ⚠ אין צורך לציין מכשיר: הוא נגזר מהעמדה שאליה השער משויך. כך שער
 * אינו יכול למשוך פקודות של עמדה אחרת גם אם ינסה.
 */
export async function GET(request: Request) {
  return withGateway(request, async (gateway) => {
    if (!gateway.deviceUuid) {
      // עמדה בלי מכונה משויכת אינה שגיאה — השער פשוט ממתין
      return NextResponse.json({ ok: true, commands: [], device: null });
    }

    const commands = await fetchPendingCommands(gateway.deviceUuid);

    return NextResponse.json({
      ok: true,
      device: gateway.deviceId,
      station: gateway.stationCode,
      commands: commands.map((c) => ({
        id: c.id,
        command: c.command,
        payload: c.payload,
        expiresAt: c.expiresAt.toISOString(),
      })),
    });
  });
}

interface AckBody {
  commandId?: string;
  success?: boolean;
  failureReason?: string;
}

/**
 * POST /api/gateway/v1/commands
 *
 * מדווח על תוצאת פקודה כפי שהתקבלה מהמכונה ב־BLE.
 */
export async function POST(request: Request) {
  return withGateway(request, async (gateway) => {
    if (!gateway.deviceUuid) {
      return gatewayError('אין מכונה משויכת לעמדה', 409, { code: 'no_device' });
    }

    let body: AckBody | null = null;
    try {
      body = (await request.json()) as AckBody;
    } catch {
      return gatewayError('גוף הבקשה אינו JSON תקין', 400);
    }

    if (!body?.commandId || typeof body.success !== 'boolean') {
      return gatewayError('נדרשים commandId ו־success', 400);
    }

    const updated = await acknowledgeCommand(gateway.deviceUuid, body.commandId, {
      success: body.success,
      failureReason: body.failureReason ?? null,
    });

    if (!updated) {
      return gatewayError('הפקודה אינה קיימת, אינה של מכונה זו, או כבר נסגרה', 409, {
        code: 'not_acknowledgeable',
      });
    }

    return NextResponse.json({ ok: true });
  });
}
