#pragma once
#include <Arduino.h>

/**
 * קידוד פרוטוקול PUSUN PT-9001.
 *
 * ⚠ חייב להישאר תואם ל־src/lib/pusun/protocol.ts בשרת. שם קיימות 23
 * בדיקות מול כל דוגמאות היצרן; כאן זו אותה לוגיקה בצד המשובץ.
 */

namespace pusun {

// UUID של מודול MinewSemi UART-C
static const char* SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
static const char* NOTIFY_UUID  = "0000fff1-0000-1000-8000-00805f9b34fb";  // מכונה → שער
static const char* WRITE_UUID   = "0000fff2-0000-1000-8000-00805f9b34fb";  // שער → מכונה

static const uint8_t APP_HEAD = 0xAA;
static const uint8_t APP_END  = 0xA5;
static const uint8_t DEV_HEAD = 0xBB;
static const uint8_t DEV_END  = 0xB5;
static const size_t  APP_FRAME_LEN = 10;
static const size_t  DEV_FRAME_LEN = 6;

// קודי פקודה
static const uint8_t CMD_SET_DIRECTION = 0x6C;
static const uint8_t CMD_SET_FREQUENCY = 0x61;
static const uint8_t CMD_SET_SPIN      = 0x62;
static const uint8_t CMD_SET_VELOCITY  = 0x63;
static const uint8_t CMD_ALARM         = 0x66;
static const uint8_t CMD_GET_BATTERY   = 0x67;
static const uint8_t CMD_START         = 0x6A;
static const uint8_t CMD_STOP          = 0x6B;
static const uint8_t CMD_SET_PROGRAM   = 0x6D;

// מצבי הגשה עבור 0x6A
static const uint8_t MODE_FIXED      = 1;
static const uint8_t MODE_HORIZONTAL = 2;
static const uint8_t MODE_VERTICAL   = 3;
static const uint8_t MODE_RANDOM     = 4;
static const uint8_t MODE_PROGRAM    = 5;

// טווחים מהמסמך. חריגה נדחית לפני שידור.
static const uint8_t FREQ_MIN = 18,  FREQ_MAX = 88;
static const uint8_t VELO_MIN = 80,  VELO_MAX = 180;
static const uint8_t SPIN_MAX = 30;

/** בונה מסגרת של עשרה בתים. בתים שאינם בשימוש נשלחים כאפס. */
inline void buildFrame(uint8_t* out, uint8_t command,
                       const uint8_t* data = nullptr, size_t dataLen = 0) {
  memset(out, 0, APP_FRAME_LEN);
  out[0] = APP_HEAD;
  out[1] = command;
  if (data && dataLen > 0) {
    memcpy(out + 2, data, dataLen > 6 ? 6 : dataLen);
  }
  out[APP_FRAME_LEN - 1] = APP_END;
}

inline void stop(uint8_t* out) { buildFrame(out, CMD_STOP); }
inline void alarm(uint8_t* out) { buildFrame(out, CMD_ALARM); }
inline void requestBattery(uint8_t* out) { buildFrame(out, CMD_GET_BATTERY); }

inline bool start(uint8_t* out, uint8_t mode) {
  if (mode < 1 || mode > 5) return false;
  uint8_t d[1] = { mode };
  buildFrame(out, CMD_START, d, 1);
  return true;
}

/** תדירות: הערך הוא עשירית שנייה בין כדורים (28 = 2.8 שניות) */
inline bool setFrequency(uint8_t* out, uint8_t rawTenths) {
  if (rawTenths < FREQ_MIN || rawTenths > FREQ_MAX) return false;
  uint8_t d[1] = { rawTenths };
  buildFrame(out, CMD_SET_FREQUENCY, d, 1);
  return true;
}

inline bool setVelocity(uint8_t* out, uint8_t velo) {
  if (velo < VELO_MIN || velo > VELO_MAX) return false;
  uint8_t d[1] = { velo };
  buildFrame(out, CMD_SET_VELOCITY, d, 1);
  return true;
}

/** spinType: 0 ללא, 1 טופספין, 2 בקספין */
inline bool setSpin(uint8_t* out, uint8_t spinType, uint8_t amount) {
  if (spinType > 2 || amount > SPIN_MAX) return false;
  if (spinType == 0 && amount != 0) return false;
  uint8_t d[2] = { spinType, amount };
  buildFrame(out, CMD_SET_SPIN, d, 2);
  return true;
}

/** הודעה מהמכונה */
struct Notify {
  bool valid = false;
  bool isBattery = false;
  bool isFault = false;
  uint8_t batteryPct = 0;
  uint8_t faultCode = 0;
};

/**
 * מפענח מסגרת מהמכונה.
 *
 * ⚠ הבית החמישי הוא ביקורת: COMMAND XOR DATA1. המסמך מכנה אותו DEFAULT
 * ואינו מתעד זאת, אך שתי דוגמאותיו מאששות את החישוב. פעולה על מסגרת
 * שהשתבשה ברעש BLE מסוכנת יותר מהתעלמות ממנה.
 */
inline Notify decodeNotify(const uint8_t* data, size_t len) {
  Notify n;
  if (len != DEV_FRAME_LEN) return n;
  if (data[0] != DEV_HEAD || data[DEV_FRAME_LEN - 1] != DEV_END) return n;

  uint8_t command = data[1];
  uint8_t d1 = data[2];
  if (data[4] != (uint8_t)(command ^ d1)) return n;

  n.valid = true;
  if (command == 0x03 && d1 <= 100) { n.isBattery = true; n.batteryPct = d1; }
  else if (command == 0x5E)         { n.isFault = true;   n.faultCode = d1; }
  return n;
}

inline String toHex(const uint8_t* data, size_t len) {
  String s;
  s.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    if (data[i] < 0x10) s += '0';
    s += String(data[i], HEX);
  }
  s.toUpperCase();
  return s;
}

}  // namespace pusun
