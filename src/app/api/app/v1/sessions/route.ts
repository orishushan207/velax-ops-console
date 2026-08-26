import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DEPLOY_APP_KEY } from '@/generated/deploy-config';
import { createAppSession } from '@/server/app-api/create-session';
import { jsonError, readJson } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * POST /api/app/v1/sessions
 *
 * פתיחת סשן. **המסלול היחיד שאינו דורש טוקן סשן** — כאן הטוקן נוצר.
 *
 * ⚠ הטוקן מוחזר **פעם אחת** ואינו ניתן לשחזור. הוא נשמר במסד כ־hash.
 *
 * ⚠ מפתח האפליקציה הוא שער גס בלבד: הוא יושב בתוך ה־APK וניתן לחילוץ.
 * ההגנה האמיתית היא מצב השרת — העמדה חייבת להיות פעילה, אסור שירוץ
 * עליה סשן אחר, ויש מגבלת קצב לכל מספר טלפון.
 */

const schema = z.object({
  machineCode: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(20),
  playerName: z.string().trim().max(120).nullish(),
  drillVersionId: z.string().uuid().nullish(),
  scheduledMinutes: z.number().int().min(15).max(240).nullish(),
  paymentRef: z.string().trim().max(120).nullish(),
});

function appKeyValid(request: Request): boolean {
  // ריק = השער כבוי. מתאים לפיתוח מקומי, לא לפריסה.
  if (!DEPLOY_APP_KEY) return true;

  const provided = request.headers.get('x-app-key') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(DEPLOY_APP_KEY);
  // אורך שונה מדליף מידע דרך זמן ההשוואה
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd ? (fwd.split(',')[0]?.trim() ?? null) : null;
}

export async function POST(request: Request) {
  if (!appKeyValid(request)) {
    return jsonError('מפתח אפליקציה אינו תקף', 401, { code: 'invalid_app_key' });
  }

  const raw = await readJson<unknown>(request);
  if (raw === null) return jsonError('גוף הבקשה אינו JSON תקין', 400);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(`${first?.path.join('.')} — ${first?.message}`, 400, {
      code: 'invalid_input',
    });
  }

  try {
    const result = await createAppSession({
      ...parsed.data,
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    if (!result.ok) {
      // 409 למצב עמדה, 429 לקצב, 400 לשאר — כדי שהאפליקציה תדע
      // אם כדאי לנסות שוב ומתי
      const status =
        result.code === 'station_busy' || result.code === 'station_unavailable'
          ? 409
          : result.code === 'rate_limited'
            ? 429
            : 400;
      return jsonError(result.message, status, { code: result.code });
    }

    return NextResponse.json({
      ok: true,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt.toISOString(),
      session: {
        id: result.sessionId,
        reference: result.reference,
        stationCode: result.stationCode,
        deviceId: result.deviceId,
        isPaid: result.isPaid,
      },
      // ⚠ מוחזר במפורש כדי שהאפליקציה תוכל להציג שהסשן אינו משולם
      warning: result.isPaid ? null : 'סשן ללא אסמכתת תשלום — לא ייספר כשעה בתשלום',
    });
  } catch (error) {
    console.error('פתיחת סשן נכשלה:', error);
    return jsonError('שגיאת שרת', 500);
  }
}
