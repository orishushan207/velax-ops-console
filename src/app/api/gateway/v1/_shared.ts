import { NextResponse } from 'next/server';
import { authenticateGateway, touchGateway, type GatewayContext } from '@/server/app-api/gateway-auth';

/**
 * עוטף מסלול של שער BLE.
 *
 * ⚠ כל בקשה מעדכנת את סימני החיים של השער. בלי זה אין דרך להבחין בין
 * "אין פקודות ממתינות" לבין "השער מנותק" — ושני המצבים נראים זהים
 * מהקונסולה.
 */

const REASONS: Record<string, string> = {
  missing_key: 'נדרש מפתח שער',
  invalid_key: 'מפתח שער אינו תקף',
  retired: 'השער הוצא משימוש',
};

export function gatewayError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd ? (fwd.split(',')[0]?.trim() ?? null) : null;
}

export async function withGateway(
  request: Request,
  handler: (gateway: GatewayContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticateGateway(request);
  if (!auth.ok) {
    return gatewayError(REASONS[auth.reason] ?? 'אימות נכשל', 401, { code: auth.reason });
  }

  const bleHeader = request.headers.get('x-ble-connected');
  await touchGateway(auth.gateway.gatewayRowId, {
    ipAddress: clientIp(request),
    bleConnected: bleHeader === null ? undefined : bleHeader === 'true',
    firmwareVersion: request.headers.get('x-gateway-firmware'),
  });

  try {
    return await handler(auth.gateway);
  } catch (error) {
    console.error('שגיאה במסלול שער:', error);
    return gatewayError('שגיאת שרת', 500);
  }
}
