import { NextResponse } from 'next/server';
import { authenticateSession, type AppSessionContext } from '@/server/app-api/auth';

/**
 * עוטף מסלול של אפליקציית הטלפון.
 *
 * ⚠ הודעות הכשל מכוונות: הן מבחינות בין טוקן חסר, שגוי ופג — כדי
 * שהאפליקציה תדע אם לבקש טוקן חדש או להציג שגיאה — אך אינן מגלות
 * דבר על קיומו של סשן, ואינן מחזירות את הטוקן עצמו.
 */

export const AUTH_MESSAGES: Record<string, string> = {
  missing_token: 'נדרש טוקן סשן',
  invalid_token: 'טוקן אינו תקף',
  expired_token: 'תוקף הטוקן פג',
};

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function withSession(
  request: Request,
  handler: (session: AppSessionContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticateSession(request);
  if (!auth.ok) {
    const status = auth.failure.reason === 'expired_token' ? 401 : 401;
    return jsonError(AUTH_MESSAGES[auth.failure.reason] ?? 'אימות נכשל', status, {
      code: auth.failure.reason,
    });
  }
  try {
    return await handler(auth.session);
  } catch (error) {
    console.error('שגיאה במסלול אפליקציה:', error);
    return jsonError('שגיאת שרת', 500);
  }
}

/** קורא גוף JSON בבטחה — גוף פגום הוא קלט לא מהימן, לא קריסה */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
