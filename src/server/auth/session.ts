import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { authSessions, roles, userClubScopes, userRoles, users } from '@/db/schema';
import { permissionsForRole, type PermissionKey } from '@/lib/permissions';
import { generateToken, hashToken } from './crypto';

const COOKIE_NAME = 'velax_session';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string | null;
  roleKeys: string[];
  roleNames: string[];
  permissions: Set<PermissionKey>;
  /** null = גישה לכל המועדונים. מערך = מוגבל למועדונים אלה. */
  clubIds: string[] | null;
  isGlobal: boolean;
  authSessionId: string;
  impersonatedByUserId: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * יוצר Session חדש ומחזיר את הטוקן הגולמי (נשמר רק כ־hash ב־DB).
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedByUserId?: string | null;
  impersonationReason?: string | null;
}): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const ttlHours = Number.parseInt(process.env.SESSION_TTL_HOURS ?? '12', 10);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);

  const [row] = await db
    .insert(authSessions)
    .values({
      userId: params.userId,
      tokenHash: hashToken(token),
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt,
      impersonatedByUserId: params.impersonatedByUserId ?? null,
      impersonationReason: params.impersonationReason ?? null,
    })
    .returning({ id: authSessions.id });

  if (!row) throw new Error('יצירת Session נכשלה');

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.APP_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { token, expiresAt, sessionId: row.id };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.tokenHash, hashToken(token)));
  }
  jar.delete(COOKIE_NAME);
}

/**
 * המשתמש הנוכחי, כולל הרשאות מחושבות והיקף מועדונים.
 * cache() — פעם אחת לכל בקשה גם אם נקרא מעשרה מקומות.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [session] = await db
    .select({
      sessionId: authSessions.id,
      userId: authSessions.userId,
      impersonatedByUserId: authSessions.impersonatedByUserId,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, hashToken(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!session || session.status !== 'active') return null;

  const roleRows = await db
    .select({ key: roles.key, nameHe: roles.nameHe, isClubScoped: roles.isClubScoped })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, session.userId));

  const permissions = new Set<PermissionKey>();
  for (const r of roleRows) {
    for (const p of permissionsForRole(r.key)) permissions.add(p);
  }

  const scopeRows = await db
    .select({ clubId: userClubScopes.clubId })
    .from(userClubScopes)
    .where(eq(userClubScopes.userId, session.userId));

  const hasClubScopedRole = roleRows.some((r) => r.isClubScoped);
  // משתמש עם תפקיד מוגבל־מועדון רואה רק את המועדונים שהוקצו לו.
  // אם לא הוקצה לו אף מועדון — הוא לא רואה כלום, ולא את הכל.
  const clubIds = hasClubScopedRole ? scopeRows.map((s) => s.clubId) : null;

  return {
    id: session.userId,
    fullName: session.fullName,
    email: session.email,
    roleKeys: roleRows.map((r) => r.key),
    roleNames: roleRows.map((r) => r.nameHe),
    permissions,
    clubIds,
    isGlobal: clubIds === null,
    authSessionId: session.sessionId,
    impersonatedByUserId: session.impersonatedByUserId,
  };
});

/** פרטי הבקשה לצורך Audit Log */
export async function getRequestContext() {
  const h = await headers();
  return {
    ipAddress:
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null,
    userAgent: h.get('user-agent'),
    requestId: h.get('x-request-id') ?? crypto.randomUUID(),
  };
}

/** ניקוי sessions שפג תוקפם — נקרא מנקודת תחזוקה */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await db
    .delete(authSessions)
    .where(sql`${authSessions.expiresAt} < now() - interval '7 days'`)
    .returning({ id: authSessions.id });
  return result.length;
}
