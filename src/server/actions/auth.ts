'use server';

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { writeAudit } from '@/server/audit';
import {
  createSession,
  destroySession,
  getCurrentUser,
  getRequestContext,
  verifyPassword,
} from '@/server/auth/session';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'נא להזין אימייל').email('כתובת אימייל אינה תקינה'),
  password: z.string().min(1, 'נא להזין סיסמה'),
});

export interface LoginState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** מספר ניסיונות כושלים לפני נעילה זמנית — הגנה מפני Brute Force */
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const ctx = await getRequestContext();
  const email = parsed.data.email.toLowerCase();

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      status: users.status,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  // הודעה זהה בכל מקרה כשל — לא חושפים אם המשתמש קיים
  const genericError = 'האימייל או הסיסמה אינם נכונים';

  if (!user || !user.passwordHash) {
    await writeAudit({
      action: 'login_failed',
      actionKey: 'auth.login_failed',
      entityType: 'user',
      entityLabel: email,
      succeeded: false,
      errorMessage: 'משתמש לא נמצא',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return { error: genericError };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `החשבון נעול זמנית עקב ניסיונות כושלים. נסה שוב בעוד ${LOCK_MINUTES} דקות.` };
  }

  if (user.status !== 'active') {
    await writeAudit({
      action: 'login_failed',
      actionKey: 'auth.login_failed',
      entityType: 'user',
      entityId: user.id,
      entityLabel: email,
      succeeded: false,
      errorMessage: `סטטוס משתמש: ${user.status}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return { error: 'החשבון אינו פעיל. פנה למנהל המערכת.' };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    const failed = Number.parseInt(user.failedLoginCount, 10) + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: String(failed),
        lockedUntil:
          failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));

    await writeAudit({
      action: 'login_failed',
      actionKey: 'auth.login_failed',
      entityType: 'user',
      entityId: user.id,
      entityLabel: email,
      succeeded: false,
      errorMessage: `סיסמה שגויה (ניסיון ${failed})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return { error: genericError };
  }

  await db
    .update(users)
    .set({ failedLoginCount: '0', lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const session = await createSession({
    userId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  await writeAudit({
    action: 'login',
    actionKey: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    entityLabel: user.fullName,
    actorUserId: user.id,
    actorName: user.fullName,
    authSessionId: session.sessionId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  const ctx = await getRequestContext();

  if (user) {
    await writeAudit({
      action: 'logout',
      actionKey: 'auth.logout',
      entityType: 'user',
      entityId: user.id,
      entityLabel: user.fullName,
      actorUserId: user.id,
      actorName: user.fullName,
      authSessionId: user.authSessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  await destroySession();
  redirect('/login');
}
