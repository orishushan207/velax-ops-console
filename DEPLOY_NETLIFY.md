# פריסה ל־Netlify — VELA-X Ops Console

הקונסולה פרוסה כאתר Next.js מלא (SSR, Server Actions) ולא כדף סטטי.

| | |
|---|---|
| **כתובת** | https://velax-ops-console.netlify.app |
| **לוח בקרה** | https://app.netlify.com/projects/velax-ops-console |
| **Site ID** | `22ec4934-8a0b-4fb3-a7c7-e11befd6902b` |
| **גישה** | ציבורי — ההגנה היא ההתחברות של המערכת עצמה |

## הקמה ראשונה

```bash
bash scripts/setup-remote-db.sh   # מקים ומאכלס את המסד — פעם אחת
bash scripts/redeploy.sh          # פריסה
```

## פריסה שוטפת

```bash
bash scripts/redeploy.sh
```

## משתני סביבה

מוגדרים ב־Netlify. `AUTH_SECRET` ו־`DEVICE_KEY_ENCRYPTION_KEY` נוצרו מחדש לפריסה
ואינם זהים לערכים המקומיים.

| משתנה | ערך |
|---|---|
| `DATABASE_URL` | מחרוזת החיבור למסד המרוחק |
| `AUTH_SECRET` | סוד — חתימת עוגיות ההתחברות |
| `DEVICE_KEY_ENCRYPTION_KEY` | סוד — הצפנת מפתחות מכשירים |
| `APP_ENV` | `demo` |
| `SESSION_TTL_HOURS` | `12` |

⚠ `APP_ENV` הוא `demo` ולא `production` **במכוון**: הגנה ב־`db:seed` חוסמת טעינת
נתוני הדגמה לסביבת production. הסביבה הזו אכן מציגה נתוני הדגמה, ולכן התיוג נכון.
בעת מעבר לנתונים אמיתיים יש לשנות ל־`production` — וההגנה תחסום seed בטעות.

## סיסמאות

סיסמת ההדגמה `Velax!2026` **אינה** בתוקף בפריסה. היא מתועדת ב־repo, וכתובת
ציבורית עם סיסמה מתועדת היא קונסולה פתוחה לכל. כל חשבונות הצוות עברו לסיסמה
חדשה שנמסרה בנפרד.

להחלפת הסיסמה:

```bash
node -e "require('bcryptjs').hash(process.argv[1],10).then(console.log)" 'סיסמה-חדשה'
# ואז עדכון password_hash למשתמש הרצוי
```

## הערות פריסה

* **אתחול עצל של המסד** — `src/db/client.ts` יוצר את ה־pool בשאילתה הראשונה ולא
  בזמן ייבוא. יצירה בזמן ייבוא הפילה את `next build` בשלב Collecting page data,
  כי מחרוזת החיבור אינה קיימת בזמן בנייה.
* **גודל העלאה** — `netlify deploy --build` מעלה רק את תוצר הבנייה. העלאת כל
  תיקיית המקור (1.2GB עם `node_modules` ו־`.next`) נכשלת.
* **בדיקות אינן רצות בבנייה** — Vitest ו־Playwright דורשים מסד מקומי. יש להריץ
  `npm run verify` מקומית לפני פריסה.
