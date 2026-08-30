/**
 * בחירת מחרוזת החיבור מתוך משתני הסביבה.
 *
 * לוגיקה טהורה, ללא תלות בשרת, כדי שתהיה ניתנת לבדיקה. החיבור למסד
 * המנוהל של Netlify נעשה ב־db/client.ts שעוטף את הפונקציה הזו.
 */

/** האם אנחנו רצים על פלטפורמת אירוח ולא על מחשב מקומי */
export function isHostedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * ⚠ כתובת מקומית בסביבת אירוח נדחית.
 *
 * Next מעתיק את קובץ ה־.env אל תוך ה־bundle של הפונקציה. כשהבנייה
 * נעשית מקומית, ה־DATABASE_URL של הפיתוח נוסע איתה לענן — והפונקציה
 * מנסה להתחבר ל־127.0.0.1. זה כבר שבר פרודקשן פעם אחת.
 *
 * כתובת מקומית בענן היא תמיד שארית של הבנייה, לעולם לא כוונה אמיתית.
 */
export function connectionFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const candidate =
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.NETLIFY_DATABASE_URL ||
    env.NETLIFY_DATABASE_URL_UNPOOLED;

  if (!candidate) return undefined;

  const pointsLocal = candidate.includes('localhost') || candidate.includes('127.0.0.1');
  if (pointsLocal && isHostedEnvironment(env)) return undefined;

  return candidate;
}
