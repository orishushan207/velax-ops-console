/**
 * כותב הגדרות פריסה לקובץ שנוצר בזמן בנייה.
 *
 * ⚠ קיים משום שמשתני סביבה של Netlify אינם מגיעים ל־runtime של פונקציית
 * Next, אך כן זמינים בזמן בנייה. הגשר היחיד ביניהם הוא קובץ שנוצר בבנייה.
 *
 * ⚠ הקובץ מיובא אך ורק מקוד שרת ואינו נכנס ל־bundle של הדפדפן.
 * אין להשתמש ב־`env` של next.config — הוא מזליג ערכים גם ללקוח.
 *
 * ⚠ הקובץ ב־.gitignore. הסיסמה לעולם אינה נשמרת ב־repo.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const password = process.env.SEED_ADMIN_PASSWORD?.trim() ?? '';

/**
 * מפתח הצפנת מפתחות המכשירים.
 *
 * ⚠ נוצר אקראית בכל בנייה כשאינו מוגדר בסביבה, במקום להישמר ב־repo.
 * זה בטוח כאן משום ש־decryptSecret אינו נקרא בשום מקום באפליקציה:
 * מפתח המכשיר מוצפן בכתיבה ואינו מפוענח לעולם, ולכן החלפת המפתח
 * בין פריסות אינה שוברת דבר.
 */
const deviceKey =
  process.env.DEVICE_KEY_ENCRYPTION_KEY?.trim() || randomBytes(32).toString('base64');
const outDir = join(process.cwd(), 'src', 'generated');
mkdirSync(outDir, { recursive: true });

const body = `// נוצר אוטומטית בזמן בנייה. אין לערוך ואין להוסיף ל־git.
import 'server-only';

/** סיסמת הצוות לפריסה. ריק = לא הוגדרה בסביבת הבנייה. */
export const DEPLOY_ADMIN_PASSWORD = ${JSON.stringify(password)};

/** מפתח הצפנת מפתחות מכשירים. נוצר בבנייה אם לא הוגדר בסביבה. */
export const DEPLOY_DEVICE_KEY = ${JSON.stringify(deviceKey)};
`;

writeFileSync(join(outDir, 'deploy-config.ts'), body, 'utf8');
console.log(
  password
    ? '▸ הגדרות פריסה נכתבו (סיסמה הוגדרה).'
    : '⚠ הגדרות פריסה נכתבו ללא סיסמה — SEED_ADMIN_PASSWORD חסר בסביבת הבנייה.',
);
if (!process.env.DEVICE_KEY_ENCRYPTION_KEY?.trim()) {
  console.log('▸ מפתח הצפנת מכשירים נוצר אקראית לבנייה זו.');
}
