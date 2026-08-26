import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { shotEvents } from '@/db/schema';
import { isOperable, resolveDeviceForSession } from '@/server/app-api/auth';
import { RANGES } from '@/lib/pusun/protocol';
import { jsonError, readJson, withSession } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * POST /api/app/v1/shots
 *
 * קליטת חבטות מהאפליקציה.
 *
 * ⚠ **הערכים כאן הם מה שנשלח למכונה, לא מדידה.** פרוטוקול PUSUN אינו
 * מדווח אירועי חבטה, ולכן אין שום אישור שהחבטה אכן יצאה כפי שהוזמנה.
 * ראה ההערה על shot_events בסכימה.
 *
 * ⚠ **בקבוצות ולא בודדות.** בקצב של 20 חבטות לדקה, שליחה בודדת הייתה
 * מייצרת 20 בקשות HTTP לדקה לכל סשן פעיל. המסלול מקבל עד 500 בכל פעם.
 *
 * ⚠ **חסין לשליחה חוזרת.** אינדקס ייחודי על (session, sequence) מוודא
 * שמנה שנשלחה שוב אחרי כשל רשת לא תיצור כפילות.
 */

const MAX_BATCH = 500;

const shotSchema = z.object({
  sequence: z.number().int().min(0),
  firedAt: z.string().datetime({ offset: true }),
  lr: z.number().int().min(RANGES.lr.min).max(RANGES.lr.max).nullish(),
  ud: z.number().int().min(RANGES.ud.min).max(RANGES.ud.max).nullish(),
  velocity: z.number().int().min(RANGES.velocity.min).max(RANGES.velocity.max).nullish(),
  spinType: z.number().int().min(0).max(2).nullish(),
  spinAmount: z.number().int().min(0).max(RANGES.spin.max).nullish(),
  intervalSeconds: z.number().min(0).max(60).nullish(),
  serveMode: z.enum(['fixed', 'horizontal', 'vertical', 'random', 'program']).nullish(),
  pointIndex: z.number().int().min(1).max(28).nullish(),
  // ערכים שהאפליקציה גזרה מהכיול שלה
  speedKmh: z.number().min(0).max(300).nullish(),
  heightLevel: z.number().int().min(0).max(100).nullish(),
  angleDegrees: z.number().int().min(-180).max(180).nullish(),
  calibrationRef: z.string().max(64).nullish(),
  extra: z.record(z.string(), z.unknown()).nullish(),
});

const bodySchema = z.object({
  deviceId: z.string().min(1),
  shots: z.array(shotSchema).min(1).max(MAX_BATCH),
});

export async function POST(request: Request) {
  return withSession(request, async (session) => {
    const raw = await readJson<unknown>(request);
    if (raw === null) return jsonError('גוף הבקשה אינו JSON תקין', 400);

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return jsonError(
        `נתוני חבטה אינם תקינים: ${first?.path.join('.')} — ${first?.message}`,
        400,
        { code: 'invalid_shots' },
      );
    }

    if (!isOperable(session.status)) {
      return jsonError(`הסשן במצב ${session.status} ואינו מקבל חבטות`, 409, {
        code: 'not_operable',
      });
    }

    const device = await resolveDeviceForSession(session, parsed.data.deviceId);
    if (!device.ok) return jsonError(device.reason, 403, { code: 'device_mismatch' });

    const rows = parsed.data.shots.map((s) => ({
      sessionId: session.sessionId,
      deviceId: device.deviceUuid,
      stationId: session.stationId,
      sequence: s.sequence,
      firedAt: new Date(s.firedAt),
      commandedLr: s.lr ?? null,
      commandedUd: s.ud ?? null,
      commandedVelocity: s.velocity ?? null,
      commandedSpinType: s.spinType ?? null,
      commandedSpinAmount: s.spinAmount ?? null,
      intervalSeconds: s.intervalSeconds === null || s.intervalSeconds === undefined
        ? null
        : String(s.intervalSeconds),
      serveMode: s.serveMode ?? null,
      pointIndex: s.pointIndex ?? null,
      derivedSpeedKmh: s.speedKmh === null || s.speedKmh === undefined ? null : String(s.speedKmh),
      derivedHeightLevel: s.heightLevel ?? null,
      derivedAngleDegrees: s.angleDegrees ?? null,
      calibrationRef: s.calibrationRef ?? null,
      extra: s.extra ?? null,
    }));

    // ⚠ onConflictDoNothing ולא update: חבטה שכבר נרשמה אינה משתנה
    // בדיעבד. שליחה חוזרת אמורה להיות חסרת השפעה, לא לדרוס.
    const inserted = await db
      .insert(shotEvents)
      .values(rows)
      .onConflictDoNothing({ target: [shotEvents.sessionId, shotEvents.sequence] })
      .returning({ sequence: shotEvents.sequence });

    return NextResponse.json({
      ok: true,
      received: rows.length,
      stored: inserted.length,
      duplicates: rows.length - inserted.length,
    });
  });
}
