#pragma once

/**
 * הגדרות השער.
 *
 * ⚠ מפתח השער מוצג פעם אחת בקונסולה בעת הרישום ואינו ניתן לשחזור.
 * אם אבד — יש לבצע סבב מפתח בקונסולה ולהזין את החדש כאן.
 */

// ─── רשת ───
#define WIFI_SSID      "CLUB-WIFI"
#define WIFI_PASSWORD  "..."

// ─── שרת ───
#define API_BASE       "https://velax-ops-console.netlify.app"
#define GATEWAY_KEY    "PASTE_GATEWAY_KEY_HERE"
#define FIRMWARE_VER   "1.0.0"

// ─── מכונה ───
// שם ה־BLE של המכונה, לפי פקודה 0x70. ריק = מתחבר לפי UUID השירות בלבד.
#define MACHINE_BLE_NAME ""

// ─── תזמונים ───
#define POLL_INTERVAL_MS       3000    // תדירות משיכת פקודות
#define TELEMETRY_INTERVAL_MS  60000   // תדירות דיווח סוללה
#define BLE_RETRY_MS           5000

/**
 * מצב אחזקת החיבור.
 *
 * HOLD_ALWAYS: השער מחזיק את חיבור ה־BLE תמיד.
 *   ⚠ המודול הוא slave ומקבל חיבור אחד בלבד, ולכן זה **חוסם** את
 *   אפליקציית הטלפון מלהתחבר ישירות. בחר בזה רק אם האפליקציה עוברת
 *   דרך הענן. מסלול א׳ ב־REMOTE_CONTROL.md.
 *
 * RELEASE_ON_SESSION: השער משחרר את החיבור כשמתחיל סשן ומתחבר מחדש
 *   כשהוא מסתיים. שומר על זרימת האפליקציה הקיימת. מסלול ב׳.
 */
#define CONNECTION_MODE_HOLD_ALWAYS  0
