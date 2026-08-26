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
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/**
 * טוען סודות פריסה מקובץ מקומי שאינו ב־repo.
 *
 * ⚠ הם היו קודם ב־netlify.toml, כלומר בתוך הקוד. קובץ נפרד ומוחרג
 * מ־git מונע מהם להיכנס להיסטוריה, שממנה אי אפשר למחוק אותם.
 */
function loadDeploySecrets() {
  const file = join(process.cwd(), '.env.deploy');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // ⚠ הסביבה גוברת: משתנה שהוגדר במפורש אינו נדרס על ידי הקובץ
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}
loadDeploySecrets();

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

/**
 * מפתח האפליקציה.
 *
 * ⚠ שער גס בלבד. הוא יושב בתוך ה־APK וניתן לחילוץ, ולכן אינו גבול
 * האבטחה — הוא רק מונע פנייה אקראית מהאינטרנט. ההגנה האמיתית היא
 * אימות התשלום, שיתווסף כשהסליקה תחובר.
 */
const appKey = process.env.APP_API_KEY?.trim() || '';

const outDir = join(process.cwd(), 'src', 'generated');
mkdirSync(outDir, { recursive: true });

const body = `// נוצר אוטומטית בזמן בנייה. אין לערוך ואין להוסיף ל־git.
import 'server-only';

/** סיסמת הצוות לפריסה. ריק = לא הוגדרה בסביבת הבנייה. */
export const DEPLOY_ADMIN_PASSWORD = ${JSON.stringify(password)};

/** מפתח הצפנת מפתחות מכשירים. נוצר בבנייה אם לא הוגדר בסביבה. */
export const DEPLOY_DEVICE_KEY = ${JSON.stringify(deviceKey)};

/** מפתח האפליקציה. ריק = השער כבוי, וכל בקשה תתקבל. */
export const DEPLOY_APP_KEY = ${JSON.stringify(appKey)};
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
