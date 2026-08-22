import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { drillVersions } from '@/db/schema';
import { isOperable } from '@/server/app-api/auth';
import { drillToMachineSettings } from '@/lib/pusun/drill-mapping';
import { ProtocolError } from '@/lib/pusun/protocol';
import { jsonError, withSession } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/app/v1/session
 *
 * מחזיר לאפליקציה את מצב הסשן ואת הגדרות המכונה לשידור ב־BLE.
 *
 * ⚠ ההגדרות מתורגמות בשרת ולא באפליקציה. אימות הטווחים הוא שכבת בטיחות,
 * ואסור שיהיה תלוי בגרסת אפליקציה שהמשתמש מריץ.
 */
export async function GET(request: Request) {
  return withSession(request, async (session) => {
    if (!isOperable(session.status)) {
      return jsonError(`הסשן במצב ${session.status} ואינו מאפשר הפעלה`, 409, {
        code: 'not_operable',
        status: session.status,
      });
    }

    let machineSettings: Record<string, unknown> | null = null;
    let settingsError: string | null = null;

    if (session.drillVersionId) {
      const [drill] = await db
        .select({
          nameHe: drillVersions.trainingGoal,
          frequencyPerMinute: drillVersions.frequencyPerMinute,
          spinLevel: drillVersions.spinLevel,
          sequence: drillVersions.sequence,
          speedKmh: drillVersions.speedKmh,
          durationMinutes: drillVersions.durationMinutes,
          safetyInstructions: drillVersions.safetyInstructions,
        })
        .from(drillVersions)
        .where(eq(drillVersions.id, session.drillVersionId))
        .limit(1);

      if (drill) {
        try {
          const settings = drillToMachineSettings({
            frequencyPerMinute: drill.frequencyPerMinute,
            spinLevel: drill.spinLevel,
            sequence: drill.sequence,
            speedKmh: drill.speedKmh,
          });
          machineSettings = { ...settings };
        } catch (error) {
          // ⚠ אינו חוסם את הסשן: התרגיל אולי אינו ניתן לתרגום, אך
          // האפליקציה עדיין צריכה לדעת שהסשן תקף. השגיאה מוחזרת במפורש.
          settingsError =
            error instanceof ProtocolError ? error.message : 'תרגום התרגיל נכשל';
        }
      }
    }

    return NextResponse.json({
      ok: true,
      session: {
        id: session.sessionId,
        reference: session.sessionReference,
        status: session.status,
        stationId: session.stationId,
        scheduledMinutes: session.scheduledMinutes,
      },
      machineSettings,
      settingsError,
    });
  });
}
