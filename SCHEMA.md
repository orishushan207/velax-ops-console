# VELA-X Ops Console — תיעוד Schema

> 78 טבלאות, 180+ אינדקסים. הסכימה מוגדרת ב־`src/db/schema/` ומיוצרת כ־SQL
> ב־`drizzle/0000_init.sql`. מדיניות RLS וטריגרים ב־`drizzle/rls-policies.sql`.

---

## 1. עקרונות רוחביים

| עיקרון | מימוש |
|---|---|
| מפתחות | `uuid` עם `defaultRandom()` — לא מזהים רצים שחושפים נפח עסקי |
| חותמות זמן | `created_at` / `updated_at` עם `timezone`; טריגר מעדכן `updated_at` אוטומטית |
| מחיקה | **Soft delete** — `deleted_at` + `deleted_by`. אין `DELETE` על ישות עסקית |
| נתוני הדגמה | `is_demo boolean` בכל טבלה עסקית; ה־UI מציג באנר כל עוד קיימות שורות כאלה |
| סכומים כספיים | `numeric(14,2)` — לעולם לא `float`. חישוב כספי ב־floating point הוא באג |
| אחוזים | `numeric(8,6)` כשבר עשרוני (0.18 = 18%) |
| ערכים מוגדרים | `pgEnum` לערכים יציבים; טבלאות lookup לערכים עסקיים משתנים |

---

## 2. ההפרדה המבנית החשובה ביותר

מסמכי המקור מערבבים לעיתים "עמדה" ו"מכונה". הסכימה מפרידה ביניהן במפורש,
כי מכונה מוחלפת והעמדה נשארת — וכל מדידת Uptime, שעות ו־Earn-Back תלויה בעמדה:

```
clubs
 ├── courts                יחידת ההכנסה של המועדון
 ├── stations              המיקום הפיזי הקבוע · יחידת המדידה העסקית
 │     └── device_assignments   ← איזו מכונה הייתה בעמדה ומתי
 └── screens               Display CMS

devices                    נכס פיזי נייד: Serial, Firmware, Token, מונים
```

---

## 3. אילוצים שנאכפים במסד

| אילוץ | טבלה | מה הוא מונע |
|---|---|---|
| `sessions_player_count_check` | `sessions` | יותר משני שחקנים לאימון |
| `session_players_slot_check` | `session_players` | יצירת slot שלישי |
| `session_players_max_two` (טריגר) | `session_players` | עקיפה דרך עדכון |
| `sessions_refund_not_over` | `sessions` | זיכוי מעבר לסכום ששולם |
| `sessions_amounts_non_negative` | `sessions` | סכומים שליליים |
| `payments_amount_positive` | `payments` | תשלום באפס או שלילי |
| `payments_idempotency_key` (UNIQUE) | `payments` | **חיוב כפול** |
| `refunds_idempotency_key` (UNIQUE) | `refunds` | **זיכוי כפול** |
| `credit_wallets_balance_non_negative` | `credit_wallets` | יתרת ארנק שלילית |
| `audit_logs_no_update` (טריגר) | `audit_logs` | שינוי או מחיקה של יומן הביקורת |
| `stations_qr_key` (UNIQUE) | `stations` | שני QR זהים |
| `devices_device_id_key` (UNIQUE) | `devices` | שני מכשירים עם אותו Device ID |

---

## 4. אינוונטר הטבלאות

### זהות והרשאות

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `users` | 22 | 5 |
| `auth_sessions` | 11 | 4 |
| `roles` | 8 | 2 |
| `permissions` | 8 | 3 |
| `role_permissions` | 4 | 1 |
| `user_roles` | 5 | 2 |
| `user_club_scopes` | 4 | 2 |
| `staff_profiles` | 11 | 2 |
| `player_profiles` | 21 | 4 |
| `consents` | 12 | 3 |

### רשת ומועדונים

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `clubs` | 24 | 5 |
| `club_contacts` | 12 | 2 |
| `club_contracts` | 23 | 5 |
| `club_operating_hours` | 9 | 2 |
| `courts` | 11 | 2 |
| `stations` | 21 | 5 |
| `screens` | 14 | 3 |

### צי מכשירים

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `devices` | 38 | 8 |
| `device_assignments` | 13 | 4 |
| `device_telemetry` | 12 | 4 |
| `firmware_versions` | 10 | 2 |
| `device_firmware_history` | 10 | 2 |

### ליבה תפעולית

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `sessions` | 51 | 10 |
| `session_events` | 11 | 3 |
| `session_players` | 9 | 3 |
| `court_bookings` | 21 | 5 |

### כספים

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `payments` | 31 | 8 |
| `payment_attempts` | 10 | 2 |
| `refunds` | 29 | 7 |
| `chargebacks` | 13 | 2 |
| `settlements` | 17 | 3 |
| `invoices` | 19 | 5 |
| `coupons` | 22 | 4 |
| `credit_wallets` | 7 | 2 |
| `wallet_transactions` | 13 | 3 |

### שירות ו־SLA

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `support_tickets` | 42 | 10 |
| `ticket_events` | 11 | 2 |
| `sla_policies` | 16 | 2 |

### תחזוקה ומלאי

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `maintenance_plans` | 15 | 2 |
| `maintenance_tasks` | 21 | 5 |
| `checklists` | 11 | 2 |
| `checklist_items` | 9 | 2 |
| `checklist_submissions` | 15 | 4 |
| `inventory_items` | 18 | 4 |
| `inventory_locations` | 12 | 3 |
| `inventory_movements` | 19 | 4 |
| `suppliers` | 14 | 2 |

### Earn-Back

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `earn_back_agreements` | 33 | 4 |
| `earn_back_conditions` | 14 | 3 |
| `earn_back_measurements` | 21 | 3 |
| `earn_back_adjustments` | 13 | 2 |

### מאמנים

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `coaches` | 26 | 5 |
| `coach_attributions` | 12 | 4 |
| `coach_commissions` | 21 | 5 |
| `homework_assignments` | 16 | 4 |

### תוכן

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `drills` | 12 | 3 |
| `drill_versions` | 29 | 4 |
| `programs` | 11 | 2 |
| `program_versions` | 22 | 3 |

### Rewards

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `rewards_accounts` | 15 | 2 |
| `rewards_transactions` | 16 | 5 |
| `challenges` | 18 | 3 |
| `referrals` | 15 | 4 |
| `subscriptions` | 17 | 3 |

### CRM

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `leads` | 30 | 5 |
| `crm_activities` | 13 | 3 |
| `tasks` | 19 | 5 |

### Display CMS

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `screens` | 14 | 3 |
| `screen_campaigns` | 22 | 3 |
| `media_assets` | 22 | 4 |
| `screen_playback_logs` | 8 | 3 |

### מערכת

| טבלה | עמודות | אינדקסים |
|---|---:|---:|
| `business_settings` | 18 | 3 |
| `setting_versions` | 13 | 4 |
| `metric_definitions` | 16 | 2 |
| `notifications` | 21 | 6 |
| `automation_rules` | 18 | 3 |
| `audit_logs` | 24 | 7 |
| `files` | 16 | 3 |
| `saved_views` | 11 | 2 |
---

## 5. הטבלאות המרכזיות בפירוט

### `sessions` — הישות המרכזית

השדות שמייצרים את ההבחנות הקריטיות:

| שדה | סוג | למה הוא קיים |
|---|---|---|
| `amount_gross` | `numeric(14,2)` | מה שהשחקן חויב, **כולל מע״מ** |
| `vat_amount` | `numeric(14,2)` | רכיב המע״מ — אינו הכנסה |
| `amount_net` | `numeric(14,2)` | הכנסה **לפני** מע״מ |
| `vat_rate_applied` | `numeric` | שיעור המע״מ בזמן העסקה — כדי שחישוב היסטורי יישאר נכון |
| `refunded_amount` | `numeric(14,2)` | סה״כ זוכה. `>= amount_gross` ⇒ אינו Paid Session |
| `actual_minutes` | `int` | דקות פעילות בפועל, בניכוי Pause — הבסיס ל־North Star |
| `started_without_staff_help` | `bool` | הבסיס ל־Start Success Rate |
| `peak_window` | enum | Peak / Off-Peak — הבסיס ל־Off-Peak Uplift |
| `session_token_hash` | `varchar` | **hash בלבד** — הטוקן עצמו לעולם אינו נשמר |
| `player_count` | `smallint` | 1 או 2 בלבד, נאכף ב־CHECK |

### `court_bookings` — הישות שמכריעה את Earn-Back

`link_type` הוא השדה שמפריד בין ארבע שכבות ההכנסה:

| ערך | משמעות | נספר ב־Earn-Back? |
|---|---|---|
| `machine_linked` | הזמנה עם `session_id` תואם | ✅ משוקלל במקדם |
| `incremental` | אומתה כהכנסה שלא הייתה קיימת ללא המכונה | ✅ במלואה |
| `baseline` | הייתה מתקיימת בכל מקרה | ❌ |
| `unverified` | טרם סווגה | ❌ |

### `business_settings` + `setting_versions` — הגדרות עם תאריך תחולה

```
business_settings     מטא־דאטה: שם, קטגוריה, סוג ערך, מקור, רמת אמינות, ערך סותר
setting_versions      ערך + effective_from + effective_until + תרחיש + מועדון + נימוק
```

`confidence` מקבל `verified` / `assumed` / `disputed` — כדי שכל צופה ידע אם המספר
מגובה במסמך, הוא הנחה, או שהמסמכים סותרים זה את זה.

### `audit_logs` — יומן ביקורת append-only

| שדה | תפקיד |
|---|---|
| `actor_user_id`, `actor_name`, `actor_role_keys` | מי ביצע |
| `impersonated_by_user_id` | האם בוצע תוך התחזות |
| `entity_type`, `entity_id`, `entity_label` | על מה |
| `before_value`, `after_value` (jsonb) | מה השתנה |
| `reason` | למה — חובה בכל פעולה רגישה |
| `amount`, `approved_by_user_id` | חובה בפעולות כספיות |
| `ip_address`, `user_agent`, `request_id` | מאיפה |

טריגר `audit_logs_immutable()` חוסם כל `UPDATE` ו־`DELETE` — גם ל־Super Admin.

---

## 6. Row Level Security

`FORCE ROW LEVEL SECURITY` על 20 טבלאות. פונקציות העזר:

```sql
app_current_user_id()          -- מזהה המשתמש מ־session variable
app_is_global()                -- true כשאין הגבלת מועדונים
app_can_access_club(uuid)      -- הרשאה למועדון ספציפי
```

**עיקרון:** משתמש ללא הקשר רואה **אפס שורות**, לא "הכל". הבדיקה
`משתמש ללא הקשר אינו רואה דבר` ב־`tests/integration/db.test.ts` מגנה על כך.

---

## 7. שינוי Schema

```bash
# 1. ערוך קובץ ב־src/db/schema/
# 2. ייצר migration
npm run db:generate
# 3. בדוק את ה־SQL שנוצר ב־drizzle/
# 4. הרץ
npm run db:migrate
```

⚠ `db:migrate` מריץ גם את `rls-policies.sql` בכל פעם. הקובץ כתוב כאידמפוטנטי
(`DROP POLICY IF EXISTS` לפני כל `CREATE`), ולכן הרצה חוזרת בטוחה.
