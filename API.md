# VELA-X Ops Console — תיעוד API

> המערכת בנויה על **Server Actions** ו־**Server Components**, לא על REST API.
> אין endpoint ציבורי שמחזיר נתונים עסקיים; כל גישה עוברת דרך אכיפת הרשאות בשרת.

---

## 1. מודל הגישה

```
Server Component  →  requirePermission()  →  queries/*.ts  →  DB
Client Component  →  Server Action        →  withPermission()  →  DB + Audit
```

**אין נתיב שלישי.** אין `fetch` מהלקוח לנתונים עסקיים, ולכן אין endpoint לתקוף.

---

## 2. Server Actions

כל Action מחזיר `ActionResult<T>`:

```ts
interface ActionResult<T = void> {
  ok: boolean;
  message?: string;                      // הודעה בעברית למשתמש
  fieldErrors?: Record<string, string>;  // שגיאות ברמת שדה
  data?: T;
}
```

### 2.1 אימות — `src/server/actions/auth.ts`

| Action | הרשאה | תיאור |
|---|---|---|
| `loginAction(prev, formData)` | — | התחברות. נועל חשבון אחרי 8 כשלים ל־15 דקות. רושם `login` / `login_failed` |
| `logoutAction()` | מחובר | מבטל את ה־session ורושם `logout` |

### 2.2 Sessions — `src/server/actions/sessions.ts`

| Action | הרשאה | סיבה נדרשת | Audit |
|---|---|---|---|
| `pauseSessionAction(id, reason)` | `sessions.control` | ✅ 5+ | `session.pause` |
| `resumeSessionAction(id)` | `sessions.control` | — | `session.resume` |
| `extendSessionAction(id, minutes, reason)` | `sessions.control` | ✅ 5+ | `session.extend` |
| `stopSessionAction(id, reason, force)` | `sessions.control` / `sessions.force_end` | ✅ 5+ / 10+ | `session.stop` / `session.force_end` |
| `markSessionFaultyAction(id, category, reason)` | `sessions.mark_faulty` | ✅ 5+ | `session.mark_faulty` — פותח Ticket |
| `messagePlayerAction(id, message)` | `sessions.message_player` | — | `session.message_player` |
| `suspendStationAction(id, reason)` | `stations.suspend` | ✅ 10+ | `station.suspend` |
| `reactivateStationAction(id, reason)` | `stations.suspend` | ✅ 5+ | `station.reactivate` |
| `issueRefundAction(formData)` | `refunds.request` (+`refunds.approve` מעל הרף) | ✅ 5+ | `refund.issue` |
| `suggestRefundAmount(id)` | — (קריאה) | — | — |

**`issueRefundAction` בפירוט** — הפעולה הכספית הרגישה ביותר:

```
1. withPermission('refunds.request')
2. Zod validation: sessionId, refundType, destination, reason, note
3. assertClubAccess()
4. חישוב maxRefundable = amount_gross − refunded_amount
5. אם amount > refund.approval_threshold_ils ⇒ נדרשת refunds.approve
6. קריאה ל־PaymentProvider.refund() עם idempotencyKey
7. טרנזקציה אחת:
     INSERT refunds
     UPDATE sessions.refunded_amount + status
     UPDATE payments.status
     INSERT session_events
     writeAudit(financial_action, amount, approver)
8. revalidatePath()
```

אינדקס ייחודי על `refunds.idempotency_key` חוסם ביצוע כפול גם אם השלב הקודם רץ פעמיים.

### 2.3 צי מכשירים — `src/server/actions/devices.ts`

| Action | הרשאה | סיבה | Audit |
|---|---|---|---|
| `registerDeviceAction(formData)` | `devices.register` | — | `device.register` |
| `assignDeviceAction(deviceId, stationId, reason)` | `devices.assign` | ✅ 5+ | `device.assign` / `device.unassign` |
| `quarantineDeviceAction(id, reason)` | `devices.quarantine` | ✅ 10+ | `device.quarantine` |
| `releaseDeviceAction(id, reason)` | `devices.quarantine` | ✅ 5+ | `device.release` |
| `updateFirmwareAction(id, versionId, reason, isRollback)` | `devices.firmware` | ✅ 5+ | `device.firmware_update` / `_rollback` |
| `retireDeviceAction(id, reason, outcome)` | `devices.retire` | ✅ 10+ | `device.retired` / `device.lost` |
| `pingDeviceAction(id)` | `devices.telemetry` | — | — |

⚠ `registerDeviceAction` יוצר `auth_key` ומצפין אותו מיד ב־AES-256-GCM.
**המפתח אינו מוחזר מהפונקציה ואין endpoint שמחזיר אותו.**

### 2.4 שירות ו־SLA — `src/server/actions/tickets.ts`

| Action | הרשאה | תיאור |
|---|---|---|
| `createTicketAction(formData)` | `tickets.create` | מחשב SLA מהמדיניות של המועדון |
| `assignTicketAction(id, assigneeId)` | `tickets.assign` | מעביר `new` → `assigned` |
| `updateTicketStatusAction(id, status, note)` | `tickets.edit` | מסמן `response_breached` בתגובה ראשונה |
| `closeTicketAction(formData)` | `tickets.close` | מחייב Root Cause + פעולות + סיבת סגירה; מחשב Downtime |
| `addTicketCommentAction(id, message, isInternal)` | `tickets.edit` | הערה פנימית או חיצונית |

### 2.5 Earn-Back — `src/server/actions/earn-back.ts`

| Action | הרשאה | סיבה | תיאור |
|---|---|---|---|
| `recalculateEarnBackAction(id)` | `earnback.view` | — | חישוב מחדש מהזמנות המגרש בפועל |
| `classifyBookingAction(id, linkType, note)` | `bookings.classify` | ✅ 5+ | סיווג הזמנה כאינקרמנטלית או בסיסית |
| `addEarnBackAdjustmentAction(formData)` | `earnback.adjust` | ✅ **15+** | התאמה ידנית — נשמרת כרשומה עם מאשר |
| `updateEarnBackConditionAction(id, status, reason)` | `earnback.manage` | ✅ 5+ | עדכון תנאי סף, כולל ויתור מנומק |
| `settleEarnBackAction(id, outcome, amount, reason)` | `earnback.manage` | ✅ **15+** | השלמת פער או Buyback. מוגבל בתקרת החשיפה |

### 2.6 רשומות ליבה — `src/server/actions/records.ts`

יצירה ועריכה של הישויות שמנוהלות ידנית על ידי הצוות.

| Action | הרשאה | Audit |
|---|---|---|
| `createClubAction(formData)` | `clubs.create` | `club.create` |
| `updateClubAction(clubId, formData)` | `clubs.edit` | `club.update` |
| `createStationAction(formData)` | `stations.manage` | `station.create` |
| `updateStationAction(stationId, formData)` | `stations.manage` | `station.update` |
| `updateDeviceAction(deviceId, formData)` | `devices.assign` | `device.update` |
| `createPlayerAction(formData)` | `players.edit` | `player.create` |
| `updatePlayerAction(userId, formData)` | `players.edit` | `player.update` |
| `createCoachAction(formData)` | `coaches.manage` | `coach.create` |
| `updateCoachAction(coachId, formData)` | `coaches.manage` | `coach.update` |
| `createLeadAction(formData)` | `crm.manage` | `lead.create` |
| `updateLeadAction(leadId, formData)` | `crm.manage` | `lead.update` |
| `archiveStationAction(stationId, reason)` | `stations.archive` | `station.archive` |
| `archiveClubAction(clubId, reason)` | `clubs.archive` | `club.archive` |

כללים משותפים לכל הפעולות במודול:

* **היקף מועדונים נאכף** — `assertClubAccess` על מועדון המקור *ועל מועדון היעד*,
  כדי שהעברת עמדה בין מועדונים לא תעקוף את ההיקף.
* **ייחודיות נבדקת מפורשות** — קוד מועדון, קוד עמדה בתוך המועדון, מספר סידורי,
  קוד הפניה, מייל וטלפון. השגיאה חוזרת כשגיאת שדה קריאה ולא ככישלון אינדקס.
* **פעולות עדכון רושמות רק שינוי אמיתי** — ההשוואה מנרמלת פורמטים של Postgres
  (`08:00:00` מול `08:00`, `5500.00` מול `5500`) דרך `src/lib/record-diff.ts`,
  כדי שה־Audit Log לא יתמלא ברעש. שמירה ללא שינוי מחזירה "לא בוצע שינוי".
* **`deviceId` אינו ניתן לעריכה** — הוא המזהה שהמכונה משדרת בשטח, ושינויו ינתק
  את הטלמטריה. גם `auth_key` אינו נחשף ואינו נערך מכאן.

#### ארכוב — מחיקה רכה בלבד

⚠ **אין במערכת מחיקה קשיחה של מועדון או עמדה.** רשומה כזו מחזיקה היסטוריה
כספית — סשנים, תשלומים, זיכויים והתחייבות Earn-Back — ומחיקה פיזית הייתה
הופכת דוחות היסטוריים לשקריים. הארכוב מסמן `deleted_at`, והרשומה נעלמת
מכל המסכים אך נשארת שלמה במסד. הניסוח בממשק הוא "ארכוב" ולא "מחיקה" בכוונה.

שתי הפעולות דורשות סיבה של **10 תווים לפחות**, שנשמרת ב־Audit Log
תחת `action = 'soft_delete'`.

חסימות לפני ארכוב עמדה:

| חסימה | למה |
|---|---|
| אימון פעיל על העמדה | סשן שרץ על עמדה שאינה קיימת יותר מבחינת המערכת |
| מכונה משויכת לעמדה | המכונה הייתה נשארת משויכת לרשומה מחוקה |

חסימות לפני ארכוב מועדון:

| חסימה | למה |
|---|---|
| אימון פעיל במועדון | כנ״ל |
| עמדה פעילה במועדון | יש לארכב את העמדות קודם, כדי שההחלטה תהיה מפורשת |
| התחייבות Earn-Back פתוחה | זהו חוב כספי כלפי המועדון — אין לסגור אותו בשקט |

### 2.7 הגדרות — `src/server/actions/settings.ts`

| Action | הרשאה | סיבה | תיאור |
|---|---|---|---|
| `updateSettingAction(formData)` | `finance.edit_assumptions` | ✅ **10+** | יוצר גרסה חדשה עם תאריך תחולה; סוגר את הקודמת |

⚠ שינוי הגדרה **אינו דורס** את הערך הקודם. הוא סוגר אותו ב־`effective_until`
ופותח גרסה חדשה — כדי שחישוב היסטורי יישאר נכון.

---

## 3. HTTP Endpoints

יש בדיוק אחד:

### `GET /api/search?q=<query>`

חיפוש גלובלי ל־Command Palette.

```json
{ "results": [
  { "type": "session", "id": "…", "title": "VX-260820-0042",
    "subtitle": "פאדל תל אביב · TLV-01-ST1",
    "href": "/sessions/…", "badge": "completed" }
]}
```

* **אימות:** עוגיית session. ללא — `401` עם `{ results: [] }`.
* **הרשאות:** כל סוג ישות מסונן לפי ההרשאה שלו (`sessions.view`, `players.view`…).
* **היקף:** מסונן לפי מועדוני המשתמש. **אין פרמטר `clubId` שהלקוח יכול לשלוט בו.**
* **PII:** טלפון ואימייל מוחזרים רק עם `players.view_pii`.
* **מינימום:** 2 תווים. פחות מכך מחזיר רשימה ריקה בלי לגעת במסד.

---

## 4. שכבת השאילתות — `src/server/queries/`

| קובץ | מה הוא מספק |
|---|---|
| `sessions.ts` | `listSessions`, `getSessionDetail`, `getSessionTimeline`, `getSessionFinancials`, `clubScopeSql` |
| `clubs.ts` | `listClubs`, `getClubDetail`, `getClubRelated`, `getClubUsageSeries` |
| `fleet.ts` | `listStations`, `listDevices`, `getStationDetail`, `getDeviceDetail`, `listFirmwareVersions` |
| `tickets.ts` | `listTickets`, `getTicketStats`, `getTicketDetail`, `listTechnicians` |
| `finance.ts` | `listPayments`, `listRefunds`, `getPaymentStats`, `getRefundReasonBreakdown`, `getRefundAnomalies`, `getPaymentSeries` |
| `people.ts` | `listPlayers`, `getPlayerDetail`, `listCoaches`, `getCoachDetail` |
| `crm.ts` | `listLeads`, `getLeadDetail`, `listSalesOwners` |
| `live.ts` | `getLiveSessions`, `getLiveAlerts`, `getLiveStations` |
| `settings.ts` | `listSettings`, `getSettingHistory`, `listMetricDefinitions`, `listSlaPolicies`, `listAutomationRules` |
| `search.ts` | `globalSearch` |

**`clubScopeSql(user, column)`** הוא הפונקציה הקריטית. היא מחזירה:

```ts
TRUE                      // משתמש גלובלי
FALSE                     // משתמש מוגבל ללא מועדונים  ← לא "הכל"
club_id IN (...)          // משתמש מוגבל
```

---

## 5. שכבת המדדים — `src/server/metrics/`

| קובץ | תפקיד |
|---|---|
| `kpis.ts` | `getCoreVolume`, `getNetworkMetrics`, `getQualityMetrics`, `getRetentionMetrics`, `getEconomicsMetrics`, `getClubRevenueMetrics`, `getLiabilityMetrics` |
| `dashboard.ts` | סדרות זמן, Heatmap, Funnel, Cohorts, ביצועי מועדונים |
| `earn-back.ts` | `listEarnBackAgreements`, `getEarnBackPortfolio`, `getEarnBackDetail`, `computeEarnBack` |
| `club-health.ts` | `calculateClubHealth`, `recalculateClubHealth` |

חישובים **טהורים** יושבים ב־`src/lib/metrics/calculations.ts` כדי שניתן יהיה לבדוק
אותם ביחידות בלי מסד נתונים.

---

## 6. Adapters לאינטגרציות — `src/server/providers/`

```ts
interface PaymentProvider {
  readonly name: string;
  readonly isMock: boolean;
  charge(req: ChargeRequest): Promise<ProviderResult<ChargeResult>>;
  refund(req: RefundRequest): Promise<ProviderResult<RefundResult>>;
}

interface DeviceProvider {
  sendCommand(req: DeviceCommandRequest): Promise<ProviderResult<DeviceCommandResult>>;
  fetchTelemetry(deviceId: string): Promise<ProviderResult<Record<string, unknown>>>;
}
```

כל תוצאה נושאת `isMock: boolean` ו־`latencyMs`. פרטים מלאים ב־`INTEGRATIONS.md`.

---

## 7. טיפול בשגיאות

| מצב | תגובה |
|---|---|
| חוסר הרשאה | `ActionResult { ok: false, message: 'אין לך הרשאה לבצע פעולה זו' }` |
| ולידציה נכשלה | `fieldErrors` ממופה לשדות בטופס |
| חריגה מהיקף מועדון | `AuthorizationError` — הודעה זהה לחוסר הרשאה, בלי לחשוף קיום ישות |
| כשל ספק חיצוני | ההודעה מהספק, בלי לחשוף credentials |
| כשל DB | נרשם ל־console; המשתמש מקבל הודעה גנרית |
| שגיאת רינדור | `error.tsx` מציג מסך שגיאה עם `digest` למעקב |

⚠ שגיאת התחברות מחזירה **הודעה זהה** בכל מקרה — משתמש לא קיים, סיסמה שגויה או
חשבון מושהה. כך לא ניתן למפות אילו אימיילים קיימים במערכת.
