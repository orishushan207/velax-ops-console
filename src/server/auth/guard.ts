import 'server-only';
import { redirect } from 'next/navigation';
import type { PermissionKey } from '@/lib/permissions';
import { getCurrentUser, type CurrentUser } from './session';

/** שגיאה שנתפסת ומוצגת למשתמש כהודעה, ולא כמסך קריסה */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly permission?: string,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** מחייב משתמש מחובר. מפנה למסך התחברות אם אין. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * מחייב הרשאה ספציפית.
 *
 * ⚠ כל Server Action במערכת קורא לפונקציה הזו כשורה ראשונה.
 * זו שכבת האכיפה הראשונה; RLS במסד הוא השכבה השנייה.
 */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) {
    throw new AuthorizationError(`אין לך הרשאה לבצע פעולה זו`, permission);
  }
  return user;
}

/** מחייב לפחות אחת מרשימת ההרשאות */
export async function requireAnyPermission(...permissions: PermissionKey[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!permissions.some((p) => user.permissions.has(p))) {
    throw new AuthorizationError('אין לך הרשאה לבצע פעולה זו', permissions[0]);
  }
  return user;
}

/** מחייב גישה למועדון ספציפי */
export function assertClubAccess(user: CurrentUser, clubId: string | null | undefined): void {
  if (user.isGlobal) return;
  if (!clubId) throw new AuthorizationError('אין לך גישה למועדון זה');
  if (!user.clubIds?.includes(clubId)) {
    throw new AuthorizationError('אין לך גישה למועדון זה');
  }
}

export function can(user: CurrentUser | null, permission: PermissionKey): boolean {
  return user?.permissions.has(permission) ?? false;
}

export function canAny(user: CurrentUser | null, ...permissions: PermissionKey[]): boolean {
  return permissions.some((p) => can(user, p));
}
