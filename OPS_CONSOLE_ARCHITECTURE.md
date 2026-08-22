# VELA-X Ops Console — ארכיטקטורת המערכת

> מסמך זה מתאר את הבחירות הטכניות, מבנה הקוד, שכבות האכיפה וזרימת הנתונים.
> הוא נכתב יחד עם `OPS_CONSOLE_ANALYSIS.md` לפני כתיבת הקוד ועודכן בסיום.

---

## 1. בחירת ה־Stack

לא נמצא Stack קיים של VELA-X (ראה `OPS_CONSOLE_ANALYSIS.md` סעיף 0), ולכן נבחר Stack חדש
לפי סעיף 4 בהנחיות.

| שכבה | בחירה | נימוק |
|---|---|---|
| Framework | **Next.js 15 · App Router** | Server Components מאפשרים לשלוף נתונים בשרת בלי לחשוף שאילתות ללקוח. Server Actions נותנים נקודת אכיפה אחת להרשאות. |
| שפה | **TypeScript strict** | כולל `noUncheckedIndexedAccess` — מונע קריסות על מערך ריק, שהן הבאג הנפוץ ביותר בדשבורדים. |
| מסד נתונים | **PostgreSQL 17** | נדרש: enums, CHECK constraints, RLS, `FILTER`, CTEs, `date_trunc` עם אזור זמן. |
| ORM | **Drizzle ORM** | Schema-as-code עם טיפוסים אמיתיים; migrations כ־SQL קריא ולא כקסם. |
| עיצוב | **Tailwind CSS v4** | Logical properties (`ps-`, `pe-`, `start-`, `end-`) הופכות RTL לתקין מהיסוד ולא כתיקון בדיעבד. |
| רכיבים | **Radix UI primitives** בסגנון shadcn | נגישות, ניווט מקלדת ו־ARIA מובנים. הקוד בבעלותנו ולא מוסתר בספרייה. |
| טבלאות | **TanStack Table** + מימוש עצמאי | הטבלאות כאן צריכות Pagination בצד שרת, ולכן רוב הלוגיקה בשרת. |
| גרפים | **Recharts** | תמיכה טובה ב־SSR ובמצב Dark. |
| טפסים | **React Hook Form + Zod** | אותה סכימת Zod משמשת לאימות בלקוח ובשרת. |
| בדיקות | **Vitest** (יחידה ואינטגרציה) · **Playwright** (E2E) | |

### 1.1 מדוע לא Supabase ישירות

ההנחיות מאפשרות Supabase **או שכבת שירות מופשטת שתאפשר מעבר קל**. נבחרה האפשרות השנייה:

* אין credentials של Supabase, ולכן מערכת שתלויה בהם לא הייתה רצה כלל.
* ה־Schema, ה־migrations ומדיניות ה־RLS נכתבו ב־PostgreSQL סטנדרטי — הם רצים כמות שהם על Supabase.
* המעבר מסתכם בהחלפת `DATABASE_URL` והחלפת `app_current_user_id()` ב־`auth.uid()`.
  ראה `DEPLOYMENT.md` סעיף 4.

---

## 2. מבנה התיקיות

```
src/
├── app/
│   ├── (auth)/login/          מסך התחברות (ללא Shell)
│   ├── (app)/                 כל המסכים המאובטחים
│   │   ├── layout.tsx         Shell: Sidebar, Header, Command Palette, Toaster
│   │   ├── page.tsx           מרכז שליטה
│   │   ├── dashboard/         תצוגת ה־Dashboard (מופרדת לצורך Suspense)
│   │   ├── live/              פעילות בזמן אמת + פקדי שליטה
│   │   ├── sessions/          רשימה + פירוט + Timeline
│   │   ├── clubs/             רשימה + עמוד מועדון עם 9 טאבים
│   │   ├── stations/          עמדות + מכונות (Device Registry)
│   │   ├── tickets/           קריאות שירות + SLA
│   │   ├── maintenance/       תחזוקה מונעת, Checklists, מלאי
│   │   ├── payments/          תשלומים + זיכויים
│   │   ├── earn-back/         ערבות ההחזר
│   │   ├── finance/           כלכלת יחידה, תרחישים, נקודת איזון
│   │   ├── crm/               Pipeline מכירות
│   │   ├── players/ coaches/ content/ rewards/ screens/
│   │   ├── reports/ notifications/ users/ audit/ settings/
│   │   └── api/search/        endpoint לחיפוש הגלובלי
│   ├── globals.css            מערכת העיצוב
│   └── layout.tsx             RTL, גופנים, Theme
│
├── components/
│   ├── ui/                    Primitives: Button, Card, Badge, Dialog, Select…
│   │   └── feedback.tsx       ⚠ אינו 'use client' — מאפשר העברת אייקונים מהשרת
│   ├── data/                  DataTable, KpiCard, ConfirmAction, RefundDialog
│   ├── charts/                עטיפות Recharts + Heatmap
│   └── shell/                 Sidebar, Header, FilterBar, CommandPalette
│
├── lib/                       ⚠ קוד טהור — ניתן לבדיקה ללא מסד נתונים
│   ├── money.ts               מע״מ, עמלות, תרומה, נקודת איזון
│   ├── format.ts              עיצוב עברית/ש״ח/אזור זמן ישראל
│   ├── labels.ts              תרגום כל ה־enums + צבע סמנטי
│   ├── permissions.ts         קטלוג 78 הרשאות ו־12 תפקידים
│   ├── settings-catalog.ts    60 הגדרות עסקיות עם מקור ורמת אמינות
│   ├── session-lifecycle.ts   מכונת המצבים של Session
│   ├── date-range.ts          טווחי תאריכים והשוואה לתקופה קודמת
│   └── metrics/
│       ├── dictionary.ts      Metric Dictionary — 25 מדדים
│       ├── calculations.ts    חישובים טהורים (North Star, Uptime, Earn-Back)
│       └── health-weights.ts  משקלי Club Health Score
│
├── server/                    ⚠ 'server-only' — לא נכנס ל־bundle של הלקוח
│   ├── auth/                  session, guard, crypto
│   ├── settings/service.ts    פתרון הגדרות עם תאריך תחולה
│   ├── audit/                 כתיבה ל־Audit Log
│   ├── providers/             Adapters לאינטגרציות + Mock
│   ├── metrics/               שאילתות KPI, Dashboard, Earn-Back, Club Health
│   ├── queries/               שאילתות קריאה לכל מודול
│   └── actions/               Server Actions — נקודת האכיפה היחידה לכתיבה
│
└── db/
    ├── schema/                18 קבצי Schema · 78 טבלאות
    ├── client.ts              Pool יחיד + Drizzle
    ├── migrate.ts / reset.ts
    └── seed/                  7 מודולי Seed
```

---

## 3. שכבות האכיפה

האכיפה היא **ארבע-שכבתית**. פריצה של אחת אינה מספיקה כדי לגשת לנתונים.

```
1. ניווט         — פריט שאין לו הרשאה אינו מוצג כלל בסרגל
2. Server Action  — withPermission() חוסם לפני כל גישה למסד
3. היקף מועדון    — assertClubAccess() + clubScopeSql() בכל שאילתה
4. RLS            — מדיניות במסד עצמו, כולל FORCE ROW LEVEL SECURITY
```

### 3.1 שכבה 2 — `withPermission`

כל Server Action עטוף:

```ts
export async function issueRefundAction(formData: FormData) {
  return withPermission('refunds.request', async (ctx) => {
    // ctx.user, ctx.ipAddress, ctx.requestId זמינים כאן
  });
}
```

העטיפה: אוכפת הרשאה → אוספת הקשר ל־Audit → מתרגמת שגיאות להודעה בעברית.
אין נתיב כתיבה שעוקף אותה.

### 3.2 שכבה 3 — היקף מועדון

`clubScopeSql(user, 'club_id')` מחזיר:
* `TRUE` — משתמש גלובלי
* `FALSE` — משתמש מוגבל ללא מועדונים (**לא** "הכל")
* `club_id IN (...)` — משתמש מוגבל

הבחירה ב־`FALSE` במקום `TRUE` היא הבחירה הבטוחה: משתמש שהוגדר שגוי לא רואה כלום
במקום לראות את הכל.

### 3.3 שכבה 4 — RLS

`drizzle/rls-policies.sql` מגדיר:
* תפקיד `velax_rls` עם `FORCE ROW LEVEL SECURITY` על 20 טבלאות
* פונקציות `app_current_user_id()`, `app_is_global()`, `app_can_access_club()`
* טריגר שחוסם `UPDATE`/`DELETE` על `audit_logs`
* טריגר שאוכף מקסימום שני שחקנים לאימון
* טריגר `updated_at` אוטומטי על כל טבלה

הבדיקות ב־`tests/integration/db.test.ts` מריצות שאילתות תחת `SET LOCAL ROLE velax_rls`
ומוודאות שהמדיניות באמת חוסמת.

---

## 4. זרימת נתונים

### 4.1 קריאה

```
Server Component (page.tsx)
   └─> requirePermission('x.view')      ← אכיפה
       └─> src/server/queries/*.ts      ← שאילתה עם clubScopeSql
           └─> db.execute(sql`...`)
               └─> Client Component      ← נתונים סריאליזביליים בלבד
```

⚠ **גבול Server → Client**: רכיבי React (למשל אייקוני Lucide) אינם סריאליזביליים.
לכן `nav-config.ts` מעביר `iconName: string` ו־`nav-icons.tsx` ממפה אותו בצד הלקוח.

### 4.2 כתיבה

```
Client Component (טופס / ConfirmAction)
   └─> Server Action
       └─> withPermission()             ← 1. הרשאה
           └─> Zod schema.safeParse()   ← 2. אימות
               └─> assertClubAccess()   ← 3. היקף
                   └─> db.transaction() ← 4. אטומיות
                       ├─> UPDATE/INSERT
                       └─> writeAudit(entry, tx)   ← באותה טרנזקציה
                   └─> revalidatePath()
```

**כישלון ב־Audit Log מבטל את הפעולה כולה.** זו הסיבה ש־`writeAudit` מקבל `tx`.

---

## 5. הגדרות עסקיות עם תאריך תחולה

זו הארכיטקטורה שמאפשרת לקיים את סעיף 1.5 בהנחיות.

```
business_settings          מטא־דאטה: שם, קטגוריה, סוג, מקור, רמת אמינות, ערך סותר
    └── setting_versions   ערך + תאריך תחולה + תרחיש + מועדון + נימוק + מי שינה
```

`resolveSettings()` בוחר לפי סדר עדיפויות:

```
1. דריסה למועדון + תרחיש
2. דריסה למועדון
3. ערך גלובלי לתרחיש
4. ערך גלובלי
5. ברירת מחדל מהקטלוג (רק אם ה־DB ריק)
```

ובכל המקרים — רק גרסה ש־`effective_from <= asOf`.

**התוצאה:** שינוי מחיר ב־1 בספטמבר אינו משנה את חישובי אוגוסט. הבדיקה
`גרסה עתידית אינה משפיעה על הערך הנוכחי` מגנה על ההתנהגות הזו.

---

## 6. שלוש הרצות תרחיש במקביל

מסך הכספים אינו מציג תרחיש אחד — הוא מריץ את שלושתם:

```ts
const scenarioSettings = await Promise.all(
  ['plan', 'realistic', 'conservative'].map((s) => getSettings(s))
);
```

זו החלטה מודעת: המודל הפיננסי מראה שהמעבר מתרחיש התוכנית לריאלי מוריד את התרומה
בכ־26% ומזיז את נקודת האיזון בעשרות עמדות. הצגת תרחיש אחד בלבד הייתה מסתירה את
הרגישות הזו.

---

## 7. Adapters לאינטגרציות

```
src/server/providers/
├── types.ts     ממשקים: PaymentProvider, DeviceProvider, BookingProvider…
├── mock.ts      מימושים מדומים עם latency וכשלים דטרמיניסטיים
└── index.ts     Registry — בחירה לפי משתני סביבה בלבד
```

כל תוצאה נושאת `isMock: boolean`. ה־UI מציג תג "Mock" ליד כל פעולה כזו,
ו־`getIntegrationStatus()` מזין את הבאנר העליון ואת מסך ההגדרות.

**להוספת ספק אמיתי:** מימוש הממשק + ענף ב־`switch` + משתני סביבה. שום קוד אחר לא משתנה.

---

## 8. מודל האבטחה

| איום | הגנה |
|---|---|
| דליפת מפתחות מכשירים | `AES-256-GCM`, מפתח מ־ENV, אין endpoint שמחזיר אותם |
| חיוב כפול | `idempotency_key` עם UNIQUE index על `payments` ועל `refunds` |
| שינוי Audit Log | טריגר `audit_logs_immutable()` שחוסם UPDATE/DELETE |
| Brute Force | נעילת חשבון אחרי 8 ניסיונות ל־15 דקות |
| גניבת Session | `httpOnly` + `sameSite=lax` + `secure` בפרודקשן; נשמר hash בלבד |
| הצפת הרשאות | RBAC ברמת פעולה + RLS ברמת שורה |
| חשיפת PII | `players.view_pii` נפרדת מ־`players.view` |
| XSS | React escaping; אין `dangerouslySetInnerHTML` למעט סקריפט Theme סטטי |
| SQL Injection | פרמטרים מקושרים בלבד; `sql.raw` רק על שמות עמודות מרשימה סגורה |
| CSRF | Server Actions של Next עם אימות Origin מובנה |
| Clickjacking | `X-Frame-Options: DENY` |

---

## 9. ביצועים

* **Pagination בצד השרת** — `LIMIT/OFFSET` עם `COUNT(*)` נפרד.
* **`React.cache()`** — `getCurrentUser()` ו־`getSettings()` פעם אחת לכל בקשה.
* **`Promise.all`** — הדשבורד מריץ 16 שאילתות במקביל ולא בטור.
* **קיבוץ אוטומטי בגרפים** — מעל 70 יום, סדרות עוברות לקיבוץ שבועי.
* **Indexes** — 180+ אינדקסים; במיוחד על `(club_id, started_at)`, `(station_id, started_at)`,
  `(status, due_on)`, ועל כל FK שמשמש לסינון.
* **Pool גלובלי בפיתוח** — מונע דליפת חיבורים ב־Hot Reload.

---

## 10. החלטות שנדחו במכוון

| נשקל | הוחלט | סיבה |
|---|---|---|
| Realtime (WebSocket) למסך החי | `force-dynamic` + רענון בטעינה | Realtime אמיתי דורש תשתית Pub/Sub. `force-dynamic` נותן נתונים טריים בכל טעינה בלי להעמיד תשתית שלא תרוץ. |
| ספריית SheetJS לייצוא XLSX | כותב OOXML עצמאי עם `fflate` | לגרסת ה־npm של SheetJS יש פגיעויות ידועות (Prototype Pollution, ReDoS). |
| טופס יצירת משתמש מערכת | לא נבנה | יצירת חשבון ללא אימות אימייל היא סיכון אבטחה. ראה `REMAINING_WORK.md`. |
| ערכי ברירת מחדל קשיחים בקוד | טבלת הגדרות | דרישה מפורשת בסעיף 1.5. |
| לוגו כקובץ PNG/SVG סטטי | רכיב SVG inline | נשאר חד בכל גודל, שואב צבעים מטוקני המותג, ומגיב ל־Dark/Light בלי שני קבצים. |
| מחיקה קשיחה | Soft delete בכל ישות עסקית | דרישה מפורשת בסעיף 25. |

---

## 11. מה חסר כדי להגיע לפרודקשן

מפורט ב־`REMAINING_WORK.md`. בקצרה:

1. **credentials אמיתיים** לסליקה, BLE, הזמנת מגרשים וערוצי התראה.
2. **מנגנון הזמנת משתמשים** באימייל, ו־MFA בפועל.
3. **Error monitoring** (Sentry) ו־Structured logs.
4. **Backups** ומדיניות Retention אכיפה.
5. **Job runner** להרצת כללי האוטומציה מדי דקה — כרגע הם מוגדרים ומוצגים אך אינם רצים בלולאה.
