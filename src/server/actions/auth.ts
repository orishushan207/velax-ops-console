'use server';

import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, resolveConnectionString } from '@/db/client';
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

/**
 * בדיקת זמינות המסד לפני ניסיון ההתחברות.
 *
 * מבחינה בין שלוש תקלות תשתית שנראות זהות למשתמש אך דורשות טיפול שונה:
 * היעדר הגדרת חיבור, מסד שאינו נענה, וסכימה שלא נוצרה.
 */
async function checkDatabaseReachable(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!resolveConnectionString()) {
    return {
      ok: false,
      message: 'המערכת אינה מחוברת למסד נתונים. יש להגדיר DATABASE_URL בסביבת האירוח.',
    };
  }

  try {
    await db.execute(sql`SELECT 1 FROM users LIMIT 1`);
    return { ok: true };
  } catch (error) {
    // ⚠ Drizzle עוטף את שגיאת pg, ולכן הקוד יושב על cause ולא על השגיאה עצמה.
    // בדיקה של error.code בלבד מפספסת תמיד ומחזירה הודעה גנרית.
    const pgCode =
      (error as { code?: string })?.code ??
      ((error as { cause?: { code?: string } })?.cause?.code);

    // 42P01 = undefined_table — המסד עלה אך ה־migrations לא רצו
    if (pgCode === '42P01') {
      return {
        ok: false,
        message: 'מסד הנתונים ריק — טרם הורצו ה־migrations. יש להריץ npm run db:migrate.',
      };
    }
    console.error('בדיקת זמינות מסד נכשלה:', error);
    return { ok: false, message: 'המסד אינו זמין כרגע. נסה שוב בעוד רגע.' };
  }
}

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

  // ⚠ כשל תשתית אינו "פרטים שגויים". בלי הבחנה כזו, מסד שאינו זמין נראה
  // למשתמש כמו סיסמה לא נכונה — והוא ינסה שוב ושוב בלי סיכוי להצליח.
  const health = await checkDatabaseReachable();
  if (!health.ok) return { error: health.message };

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
