# VELA-X Ops Console — הרצה ופריסה

---

## 1. דרישות

* Node.js 20+ (נבדק על 24.15)
* PostgreSQL 14+ (נבדק על 17.10)
* npm 10+

---

## 2. הרצה מקומית

```bash
npm install
cp .env.example .env

# יצירת מפתחות אמיתיים — חובה
openssl rand -base64 48   # → AUTH_SECRET
openssl rand -base64 32   # → DEVICE_KEY_ENCRYPTION_KEY

createdb velax_ops
npm run db:migrate    # Schema + RLS + טריגרים
npm run db:seed       # נתוני הדגמה

npm run dev           # http://localhost:3210
```

### אימות שהכל עלה

```bash
npm run verify   # lint + typecheck + 113 בדיקות + build
npm run smoke    # טעינת 31 המסכים
```

---

## 3. משתני סביבה

| משתנה | חובה | תיאור |
|---|---|---|
| `DATABASE_URL` | ✅ | מחרוזת חיבור ל־PostgreSQL |
| `AUTH_SECRET` | ✅ בפרודקשן | 32+ תווים. `openssl rand -base64 48` |
| `DEVICE_KEY_ENCRYPTION_KEY` | ✅ | **32 בתים ב־base64.** `openssl rand -base64 32` |
| `APP_ENV` | ✅ | `development` \| `staging` \| `production` |
| `SESSION_TTL_HOURS` | — | ברירת מחדל 12 |
| `PAYMENT_PROVIDER` | — | `mock` \| `tranzila` \| `cardcom` \| `stripe` |
| `DEVICE_PROVIDER` | — | `mock` \| `http` |
| `BOOKING_PROVIDER` | — | `mock` \| `http` |
| `STORAGE_PROVIDER` | — | `local` \| `s3` \| `supabase` |

⚠ **`DEVICE_KEY_ENCRYPTION_KEY` הוא המפתח שמצפין את מפתחות ההרשאה של המכשירים.**
אובדנו פירושו שכל המכשירים יאבדו את ההרשאה שלהם. שמור אותו במנהל סודות, לא בקוד.

---

## 4. מעבר ל־Supabase

הסכימה, ה־migrations ומדיניות ה־RLS נכתבו ב־PostgreSQL סטנדרטי ורצות כמות שהן.

```bash
# 1. החלף את מחרוזת החיבור
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

# 2. הרץ migrations
npm run db:migrate
```

### התאמת RLS ל־Supabase Auth

`drizzle/rls-policies.sql` משתמש בפונקציה `app_current_user_id()` שקוראת
משתנה session. במעבר ל־Supabase Auth, החלף אותה:

```sql
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT auth.uid();
$$;
```

והחלף את התפקיד `velax_rls` ב־`authenticated`. שאר המדיניות נשארת זהה.

### שכבות נוספות

| שכבה | מה נדרש |
|---|---|
| Authentication | ניתן להישאר עם ה־Auth הקיים (bcrypt + session ב־DB) או לעבור ל־Supabase Auth. במקרה השני יש למפות `users.id` ל־`auth.users.id` |
| Storage | הגדר `STORAGE_PROVIDER=supabase` ומימש את `StorageProvider` |
| Realtime | לא בשימוש כרגע. מסך הזמן־אמת עובד ב־`force-dynamic` |

---

## 5. פריסה לפרודקשן

### Build

```bash
npm ci
npm run build
npm start          # מאזין על 3210
```

### לפני העלייה — checklist

- [ ] `APP_ENV=production` — חוסם `db:seed` ו־`db:reset`
- [ ] `AUTH_SECRET` ו־`DEVICE_KEY_ENCRYPTION_KEY` נוצרו מחדש ואינם ערכי ברירת המחדל
- [ ] `DATABASE_URL` מצביע על מסד פרודקשן **נפרד** מ־staging
- [ ] SSL מופעל בחיבור למסד (מופעל אוטומטית לכל host שאינו localhost)
- [ ] HTTPS בלבד — עוגיית ה־session מסומנת `secure` כאשר `APP_ENV=production`
- [ ] גיבוי אוטומטי מוגדר ונבדק שחזור
- [ ] Error monitoring מחובר
- [ ] נתוני הדגמה **לא** נטענו: `SELECT COUNT(*) FROM sessions WHERE is_demo = true` ⇒ 0

### הגדרות אבטחה שכבר קיימות בקוד

`next.config.ts` שולח:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`poweredByHeader: false` — לא חושף את גרסת Next.

---

## 6. תחזוקה שוטפת

| משימה | תדירות | פקודה |
|---|---|---|
| ניקוי sessions שפגו | יומי | `purgeExpiredSessions()` ב־`src/server/auth/session.ts` |
| חישוב Club Health Score | יומי | `recalculateAllClubHealthScores()` |
| חישוב Earn-Back | יומי | `recalculateEarnBackAction(id)` לכל הסכם פעיל |
| הרצת כללי אוטומציה | דקתי | ⚠ **טרם נבנה** — ראה `REMAINING_WORK.md` |
| גיבוי מסד | יומי | `pg_dump` |

---

## 7. איפוס סביבת פיתוח

```bash
npm run db:reset      # מוחק את הסכימה — חסום בפרודקשן
npm run db:migrate
npm run db:seed
```

`db:seed` מרוקן את כל הטבלאות לפני טעינה, ולכן הרצה חוזרת בטוחה ואידמפוטנטית.

---

## 8. פתרון תקלות

| תסמין | סיבה | פתרון |
|---|---|---|
| `DEVICE_KEY_ENCRYPTION_KEY חייב להיות 32 בתים` | המפתח אינו base64 באורך 32 בתים | `openssl rand -base64 32` |
| `DATABASE_URL אינו מוגדר` | אין קובץ `.env` | `cp .env.example .env` |
| `Cannot find package 'server-only'` בסקריפט | הרצה בלי תנאי `react-server` | הסקריפטים כבר כוללים `--conditions=react-server` |
| מסך ריק אחרי התחברות | ה־seed רץ ומחק את ה־session | התחבר מחדש |
| שני שרתים על פורט 3210 | dev ו־start רצים במקביל | `lsof -ti:3210 \| xargs kill -9` |
