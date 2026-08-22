import { NextResponse } from 'next/server';
import { resolveDeviceForSession } from '@/server/app-api/auth';
import { acknowledgeCommand, fetchPendingCommands } from '@/server/app-api/command-queue';
import { jsonError, readJson, withSession } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/app/v1/commands?deviceId=VX-DEV-1012
 *
 * מוסר לאפליקציה את הפקודות הממתינות למכשיר.
 *
 * ⚠ הענן אינו מגיע למכונה. זו נקודת המפגש היחידה: פקודה שהוזנה בקונסולה
 * ממתינה כאן עד שהאפליקציה מתחברת ואוספת אותה.
 */
export async function GET(request: Request) {
  return withSession(request, async (session) => {
    const deviceId = new URL(request.url).searchParams.get('deviceId');
    if (!deviceId) return jsonError('נדרש deviceId', 400);

    const device = await resolveDeviceForSession(session, deviceId);
    if (!device.ok) return jsonError(device.reason, 403, { code: 'device_mismatch' });

    const commands = await fetchPendingCommands(device.deviceUuid);

    return NextResponse.json({
      ok: true,
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
  deviceId?: string;
  commandId?: string;
  success?: boolean;
  failureReason?: string;
}

/**
 * POST /api/app/v1/commands
 *
 * מדווח על תוצאת פקודה כפי שהתקבלה מהמכונה.
 *
 * ⚠ "נאספה" אינו "בוצעה". רק אישור מפורש כאן קובע שהמכונה קיבלה את
 * הפקודה, ולכן הקונסולה מציגה שני מצבים נפרדים.
 */
export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const body = await readJson<AckBody>(request);
    if (!body?.deviceId || !body.commandId || typeof body.success !== 'boolean') {
      return jsonError('נדרשים deviceId, commandId ו־success', 400);
    }

    const device = await resolveDeviceForSession(session, body.deviceId);
    if (!device.ok) return jsonError(device.reason, 403, { code: 'device_mismatch' });

    const updated = await acknowledgeCommand(device.deviceUuid, body.commandId, {
      success: body.success,
      failureReason: body.failureReason ?? null,
    });

    if (!updated) {
      return jsonError('הפקודה אינה קיימת, אינה שייכת למכשיר, או כבר נסגרה', 409, {
        code: 'not_acknowledgeable',
      });
    }

    return NextResponse.json({ ok: true });
  });
}
