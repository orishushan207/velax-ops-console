# VELA-X Ops Console — אינטגרציות

> **כל האינטגרציות החיצוניות נמצאות כרגע במצב Mock.**
> אין חיוב כרטיס אשראי אמיתי, אין פקודה אמיתית למכונה, ואין הודעה שנשלחת לאדם.
>
> זו החלטה מודעת: אין credentials, ומערכת שמעמידה פנים שהיא מחוברת מסוכנת יותר
> ממערכת שאומרת בבירור שהיא לא.

---

## 1. מצב נוכחי

| אינטגרציה | ספק פעיל | מצב | מה נדרש לחיבור |
|---|---|---|---|
| סליקה | `mock-payments` | 🟡 Mock | Terminal ID + API Key מסולק ישראלי |
| בקרת מכשיר (BLE) | `mock-ble-gateway` | 🟡 Mock | הפרוטוקול מומש; חסר אימות ב־Firmware + אפליקציית טלפון |
| הזמנת מגרשים | `mock-court-booking` | 🟡 Mock | API של מערכת ההזמנות בכל מועדון |
| אימייל | `mock-email` | 🟡 Mock | SMTP או API של ספק (Resend / SendGrid) |
| SMS | `mock-sms` | 🟡 Mock | ספק SMS ישראלי + אישור רגולטורי |
| WhatsApp | `mock-whatsapp` | 🟡 Mock | WhatsApp Business API + אישור תבניות |
| Slack | `mock-slack` | 🟡 Mock | Incoming Webhook URL |
| אחסון קבצים | `local-fs` | 🟢 פעיל (מקומי) | S3 / Supabase Storage לפרודקשן |

**איך זה מוצג למשתמש:**
* באנר קבוע בראש כל מסך, המפרט אילו אינטגרציות במצב Mock.
* תג "Mock — לא בוצע חיוב אמיתי" ליד כל תשלום במסך הסשן.
* אזהרה מפורשת בכל פעולה שנשענת על ספק מדומה (עדכון Firmware, שליחת הודעה).
* לשונית ייעודית במסך ההגדרות עם מצב כל אינטגרציה.

---

## 2. הארכיטקטורה

```
src/server/providers/
├── types.ts     ← ממשקים (Contracts)
├── mock.ts      ← מימושים מדומים
└── index.ts     ← Registry: בחירה לפי משתני סביבה
```

כל תוצאה מוחזרת במעטפת אחידה:

```ts
interface ProviderResult<T> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  providerName: string;
  isMock: boolean;      // ← זה מה שמזין את התגיות ב־UI
  latencyMs: number;
}
```

**להוספת ספק אמיתי נדרשים שלושה שלבים בלבד:**

1. מימוש הממשק בקובץ חדש, למשל `providers/tranzila.ts`
2. הוספת ענף ב־`switch` בתוך `index.ts`
3. הגדרת משתני הסביבה

שום קוד אחר במערכת אינו משתנה — לא ה־Actions, לא השאילתות ולא ה־UI.

---

## 3. סליקה

### הממשק

```ts
interface PaymentProvider {
  charge(req: {
    amountGross: number;      // כולל מע״מ
    currency: string;         // 'ILS'
    idempotencyKey: string;   // ← מונע חיוב כפול
    description: string;
    metadata?: Record<string, string>;
  }): Promise<ProviderResult<{
    transactionId: string;
    authorizationCode?: string;
    cardLast4?: string;
    cardBrand?: string;
    capturedAt: Date;
  }>>;

  refund(req: {
    transactionId: string;
    amountGross: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<ProviderResult<{ refundId: string; processedAt: Date }>>;
}
```

### מה ה־Mock עושה

* Latency דטרמיניסטי (120–520ms) לפי ה־`idempotencyKey`
* 8% כשלים מדומים בפיתוח, **0% בבדיקות** — כדי שהבדיקות יהיו יציבות
* מחזיר `cardLast4` ו־`cardBrand` מדומים
* **אינו נוגע בשום מערכת חיצונית**

### משתני סביבה

```bash
PAYMENT_PROVIDER="tranzila"      # mock | tranzila | cardcom | stripe
PAYMENT_API_KEY="…"
PAYMENT_TERMINAL_ID="…"
```

### שאלות פתוחות לפני חיבור

1. **מי הסולק?** המודל מתמחר 2.7% + 1 ₪, אך מתועדת גם הצעה של 1.9%.
   ההפרש שווה כ־0.7 ₪ לשעת שימוש — כ־1.4% מהתרומה.
2. **Tokenization** — האם השחקן שומר אמצעי תשלום? נדרש לתמיכה במנויים.
3. **Chargebacks** — הסכימה תומכת (`chargebacks`), אך אין webhook לקליטתם.
4. **Settlement** — טבלת `settlements` קיימת; נדרש ייבוא קובץ ההתאמה מהסולק.

---

## 4. בקרת מכשיר — BLE

### הממשק

```ts
type DeviceCommand =
  | 'start' | 'pause' | 'resume' | 'stop' | 'force_stop'
  | 'lock' | 'unlock' | 'firmware_update' | 'firmware_rollback' | 'ping';

interface DeviceProvider {
  sendCommand(req: {
    deviceId: string;
    command: DeviceCommand;
    sessionToken?: string;   // ⚠ לא נשמר ולא נרשם ביומן
    params?: Record<string, unknown>;
  }): Promise<ProviderResult<{
    acknowledged: boolean;
    deviceState: string;
    batteryPct?: number;
    firmwareVersion?: string;
  }>>;

  fetchTelemetry(deviceId: string): Promise<ProviderResult<Record<string, unknown>>>;
}
```

### ✅ הפרוטוקול התקבל ומומש — ראה `SECURITY_PUSUN.md`

מסמך היצרן התקבל ב־22.08.2026 ומומש במלואו ב־`src/lib/pusun/protocol.ts`,
מאומת ב־39 בדיקות מול כל דוגמה שבמסמך.

**שתי מסקנות שמשנות את הארכיטקטורה:**

1. **למכונה אין קישוריות משלה.** הפרוטוקול הוא BLE בין הטלפון למכונה בלבד.
   הענן אינו יכול לפקד על מכונה, ולכן "השבתת עמדה" בקונסולה מונעת סשנים
   חדשים אך אינה עוצרת מכונה שרצה. ספק מכשיר אמיתי יהיה **תור פקודות**
   שאפליקציית הטלפון אוספת — לא שער HTTP אל המכונה.

2. **אין בפרוטוקול אימות כלשהו.** אין טוקן, חתימה, הצפנה או pairing.
   ה־UUID גנרי והחיבור אינו bonded. כל לקוח BLE יכול להפעיל את המכונה.
   פירוט מלא והשלכות עסקיות ב־`SECURITY_PUSUN.md`.

### ⚠ החסימה שנותרה — אימות ב־Firmware

התוכנית העסקית מגדירה את שכבת ה־Firmware כ־Moat התחרותי המרכזי (פרק 19), ומזהירה
במפורש: *"Bluetooth פתוח ואפליקציית ברקוד QR לבדם אינם חוסמים מכונה זהה. ההגנה
חייבת להיות ברמת PUSUN Firmware."*

**מה קיים במערכת:**
* `devices.auth_key_encrypted` — מפתח מוצפן ב־AES-256-GCM
* `sessions.session_token_hash` — hash של הטוקן החתום
* `device_firmware_history` — מעקב עדכונים ו־Rollback
* `device_telemetry` — סוללה, RSSI, טמפ׳ מנוע, מונה כדורים, קודי שגיאה

**מה חסר:**
* מפרט הפרוטוקול מול היצרן — אלגוריתם החתימה, מבנה ה־Token, חלון התוקף
* Gateway שמתווך בין הענן למכשיר
* תמיכת Firmware ב־Rollback חתום

עד לקבלת המפרט, כל פקודה נרשמת ב־Audit Log כפי שתירשם בפרודקשן, אך אינה מגיעה למכשיר.

### משתני סביבה

```bash
DEVICE_PROVIDER="http"
DEVICE_GATEWAY_URL="https://gateway.velax.example"
DEVICE_GATEWAY_TOKEN="…"
```

---

## 5. מערכת הזמנת מגרשים

### למה זו האינטגרציה הקריטית ביותר עסקית

**Earn-Back אינו נמדד לפי Sessions.** הוא נמדד לפי הכנסת המגרש המקושרת של המועדון.
בלי חיבור למערכת ההזמנות, המערכת אינה יכולה לדעת אילו הזמנות מקושרות למכונה.

### הממשק

```ts
interface BookingProvider {
  fetchBookings(clubExternalId: string, from: Date, to: Date):
    Promise<ProviderResult<{
      externalId: string;
      courtName: string;
      startsAt: Date;
      endsAt: Date;
      revenueNet: number;      // לפני מע״מ
      bookedByPhone?: string;
      isCancelled: boolean;
    }[]>>;
}
```

### ⚠ ה־Mock מחזיר רשימה ריקה במכוון

הוא **אינו** ממציא הזמנות. הזמנות ההדגמה נוצרות ב־Seed ומסומנות `is_demo = true`.
זו הפרדה חשובה: נתוני הדגמה מסומנים ככאלה, ואינם מוצגים כאילו הגיעו ממערכת חיצונית.

### שאלות פתוחות

1. **כל מועדון ומערכת ההזמנות שלו** — נדרש Adapter לכל ספק, או ייבוא CSV ידני.
2. **הקישור בין הזמנה לסשן** — התוכנית דורשת "חיבור הזמנת המגרש לקוד VELA-X".
   נדרשת החלטה: קוד קופון בהזמנה? קישור לפי טלפון וחלון זמן?
3. **סיווג אינקרמנטליות** — כרגע ידני, עם מקדם ברירת מחדל של 70%.
   **זו ההנחה החשובה ביותר במודל הערבות והיא דורשת אימות בפיילוט.**

---

## 6. ערוצי התראה

```ts
interface NotificationChannelProvider {
  readonly channel: 'email' | 'sms' | 'whatsapp' | 'slack';
  send(msg: { to: string; subject?: string; body: string }):
    Promise<ProviderResult<{ messageId: string }>>;
}
```

**ה־Mock אינו שולח דבר.** ההתראה נשמרת ב־`notifications` עם
`delivery_provider = 'mock'`, מוצגת במרכז ההתראות, ומסומנת בתג "לא נשלח — Mock".

### נדרש לפני חיבור WhatsApp/SMS

* אישור תבניות הודעה מול WhatsApp Business
* הסכמת המשתמש לקבלת הודעות — קיימת בטבלת `consents` (`consent_type = 'marketing'`)
* עמידה בחוק הספאם הישראלי: מנגנון הסרה בכל הודעה

---

## 7. אחסון קבצים

`LocalStorageProvider` פעיל וכותב ל־`./storage`. הוא **אינו Mock** — הוא עובד באמת,
אך אינו מתאים לפרודקשן מרובה־שרתים.

```bash
STORAGE_PROVIDER="s3"          # local | s3 | supabase
STORAGE_LOCAL_PATH="./storage"
```

לפרודקשן נדרש S3 או Supabase Storage עם URLs חתומים בעלי תוקף מוגבל.

---

## 8. סיכום — מה חוסם מה

| חסימה | מה לא עובד בלעדיה | דחיפות |
|---|---|---|
| מפרט Firmware / BLE | הפעלת מכונה בפועל — **ליבת המוצר** | 🔴 קריטי |
| Credentials סליקה | חיוב אמיתי של שחקנים | 🔴 קריטי |
| API הזמנות מגרש | מדידת Earn-Back אמיתית | 🟠 גבוה |
| ערוצי התראה | התראות תפעוליות מגיעות לצוות | 🟠 גבוה |
| S3 / Storage | העלאת תמונות לתקלות ולמסכים | 🟡 בינוני |
| מנגנון NPS | מדד NPS בדוחות | 🟡 בינוני |
| תקציב שיווק | CAC, LTV, Payback | 🟡 בינוני |

עד אז, כל אחד מהמסכים שתלוי בנתון חסר מציג **"אין נתונים"** ומסביר מה נדרש —
ולא מספר מומצא.
