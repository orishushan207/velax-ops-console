import 'server-only';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { AuthorizationError, requirePermission } from '@/server/auth/guard';
import { getRequestContext, type CurrentUser } from '@/server/auth/session';
import type { PermissionKey } from '@/lib/permissions';

export interface ActionResult<T = void> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

export function actionOk<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

/** ממיר שגיאות Zod למפת שדות לתצוגה בטופס */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !map[key]) map[key] = issue.message;
  }
  return map;
}

export interface ActionContext {
  user: CurrentUser;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

/**
 * עוטף Server Action: אוכף הרשאה, אוסף הקשר ל־Audit Log,
 * ומתרגם שגיאות להודעה שהמשתמש יכול להבין.
 *
 * ⚠ כל Server Action במערכת עובר דרך כאן. זו נקודת האכיפה היחידה.
 */
export async function withPermission<T>(
  permission: PermissionKey,
  handler: (ctx: ActionContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const user = await requirePermission(permission);
    const req = await getRequestContext();
    return await handler({
      user,
      ipAddress: req.ipAddress,
      userAgent: req.userAgent,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionError(error.message);
    }
    // שגיאת redirect של Next אינה שגיאה אמיתית — יש להעביר הלאה
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      String((error as { digest: unknown }).digest).startsWith('NEXT_')
    ) {
      throw error;
    }
    console.error('Server Action נכשל:', error);
    return actionError(
      error instanceof Error ? error.message : 'הפעולה נכשלה. נסה שוב או פנה לתמיכה.',
    );
  }
}

/** מרענן מספר נתיבים לאחר פעולה מוצלחת */
export function revalidate(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

/** קורא ערך טקסט מטופס, עם trim ואימות אורך */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function formNumber(formData: FormData, key: string): number | null {
  const raw = formString(formData, key);
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function formBoolean(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  return raw === 'on' || raw === 'true' || raw === '1';
}
