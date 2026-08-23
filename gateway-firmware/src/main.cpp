#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

#include "config.h"
#include "pusun_protocol.h"

/**
 * VELA-X — שער BLE בעמדה.
 *
 * גשר בין הענן למכונה. הענן אינו יכול להגיע ל־PT-9001 כי אין לה קישוריות
 * משלה; השער מחזיק את הצד השני של ה־BLE ומאפשר שליטה מרחוק.
 *
 * לולאה: מושך פקודות → משדר ב־BLE → מדווח תוצאה → מדווח טלמטריה.
 *
 * ⚠ השער אינו מכיר סשנים, שחקנים או תשלומים. הוא מבצע פקודות שהשרת
 * כבר אישר. כל ההיגיון העסקי נשאר בשרת.
 */

static NimBLEClient*          bleClient  = nullptr;
static NimBLERemoteCharacteristic* writeChar  = nullptr;
static NimBLERemoteCharacteristic* notifyChar = nullptr;

static uint32_t lastPoll = 0;
static uint32_t lastTelemetry = 0;
static uint32_t lastBleAttempt = 0;

/** מסגרות notify שהתקבלו וטרם דווחו */
static String pendingFrames[8];
static uint8_t pendingFrameCount = 0;

/** מצב ההגשה האחרון, כדי ש־resume ידע לְמה לחזור */
static uint8_t lastServeMode = pusun::MODE_FIXED;

// ─────────────── BLE ───────────────

static void onNotify(NimBLERemoteCharacteristic* /*chr*/, uint8_t* data, size_t len, bool /*isNotify*/) {
  // ⚠ נשמר גולמי. הפענוח נעשה בשרת כדי שיהיה מקור אמת אחד לפרוטוקול,
  // ותיקון באג לא ידרוש עדכון קושחה בכל העמדות.
  if (pendingFrameCount < 8) {
    pendingFrames[pendingFrameCount++] = pusun::toHex(data, len);
  }
  pusun::Notify n = pusun::decodeNotify(data, len);
  if (n.valid && n.isFault) {
    Serial.printf("[BLE] קוד תקלה מהמכונה: %u\n", n.faultCode);
  }
}

static bool bleConnected() {
  return bleClient != nullptr && bleClient->isConnected() && writeChar != nullptr;
}

static bool connectToMachine() {
  if (millis() - lastBleAttempt < BLE_RETRY_MS) return false;
  lastBleAttempt = millis();

  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setActiveScan(true);
  NimBLEScanResults results = scan->start(5, false);

  NimBLEAdvertisedDevice* target = nullptr;
  for (int i = 0; i < results.getCount(); i++) {
    NimBLEAdvertisedDevice d = results.getDevice(i);
    if (!d.isAdvertisingService(NimBLEUUID(pusun::SERVICE_UUID))) continue;
    if (strlen(MACHINE_BLE_NAME) > 0 && d.getName() != MACHINE_BLE_NAME) continue;
    target = new NimBLEAdvertisedDevice(d);
    break;
  }
  if (!target) {
    Serial.println("[BLE] לא נמצאה מכונה בטווח");
    return false;
  }

  if (!bleClient) bleClient = NimBLEDevice::createClient();
  if (!bleClient->connect(target)) {
    Serial.println("[BLE] החיבור נכשל");
    return false;
  }

  NimBLERemoteService* svc = bleClient->getService(pusun::SERVICE_UUID);
  if (!svc) { bleClient->disconnect(); return false; }

  writeChar  = svc->getCharacteristic(pusun::WRITE_UUID);
  notifyChar = svc->getCharacteristic(pusun::NOTIFY_UUID);
  if (!writeChar) { bleClient->disconnect(); return false; }

  if (notifyChar && notifyChar->canNotify()) {
    notifyChar->subscribe(true, onNotify);
  }
  Serial.println("[BLE] מחובר למכונה");
  return true;
}

/** ⚠ WRITE NO RESPONSE לפי המפרט. המסמך מורה על 50ms בין פקודות ברצף. */
static bool sendFrame(const uint8_t* frame) {
  if (!bleConnected()) return false;
  bool ok = writeChar->writeValue(const_cast<uint8_t*>(frame), pusun::APP_FRAME_LEN, false);
  delay(50);
  return ok;
}

// ─────────────── ביצוע פקודות ───────────────

struct CommandResult {
  bool success;
  const char* failureReason;
};

/**
 * מתרגם פקודה מופשטת מהשרת לפרוטוקול המכונה.
 *
 * ⚠ פקודה שאין לה מקבילה בפרוטוקול מדווחת ככישלון מפורש ולא כהצלחה.
 * אישור שקרי גרוע מכישלון: הוא גורם לקונסולה להציג שהמכונה צייתה.
 */
static CommandResult executeCommand(const String& command, JsonObjectConst payload) {
  uint8_t frame[pusun::APP_FRAME_LEN];

  if (command == "stop" || command == "force_stop" || command == "pause") {
    // ⚠ אין "השהיה" בפרוטוקול. עצירה היא הקירוב היחיד, וחידוש יתחיל מחדש.
    pusun::stop(frame);
    return { sendFrame(frame), "שידור נכשל" };
  }

  if (command == "start" || command == "resume") {
    uint8_t mode = lastServeMode;
    if (!payload.isNull() && payload["serveMode"].is<const char*>()) {
      String m = payload["serveMode"].as<const char*>();
      if (m == "fixed") mode = pusun::MODE_FIXED;
      else if (m == "horizontal") mode = pusun::MODE_HORIZONTAL;
      else if (m == "vertical") mode = pusun::MODE_VERTICAL;
      else if (m == "random") mode = pusun::MODE_RANDOM;
      else if (m == "program") mode = pusun::MODE_PROGRAM;
    }
    lastServeMode = mode;

    // המסמך מורה על צפצוף אזהרה לפני תחילת הגשה
    pusun::alarm(frame);
    sendFrame(frame);

    if (!pusun::start(frame, mode)) return { false, "מצב הגשה לא חוקי" };
    return { sendFrame(frame), "שידור נכשל" };
  }

  if (command == "apply_settings") {
    if (payload.isNull()) return { false, "אין פרמטרים" };

    if (payload["velocity"].is<int>()) {
      if (!pusun::setVelocity(frame, payload["velocity"].as<int>()))
        return { false, "מהירות מחוץ לטווח 80–180" };
      if (!sendFrame(frame)) return { false, "שידור מהירות נכשל" };
    }
    if (payload["secondsBetweenBalls"].is<float>()) {
      int raw = (int)round(payload["secondsBetweenBalls"].as<float>() * 10);
      if (!pusun::setFrequency(frame, raw))
        return { false, "תדירות מחוץ לטווח 1.8–8.8 שניות" };
      if (!sendFrame(frame)) return { false, "שידור תדירות נכשל" };
    }
    if (payload["spin"]["type"].is<const char*>()) {
      String t = payload["spin"]["type"].as<const char*>();
      uint8_t type = t == "topspin" ? 1 : t == "backspin" ? 2 : 0;
      uint8_t amount = payload["spin"]["amount"] | 0;
      if (!pusun::setSpin(frame, type, amount))
        return { false, "ערכי סיבוב אינם חוקיים" };
      if (!sendFrame(frame)) return { false, "שידור סיבוב נכשל" };
    }
    return { true, nullptr };
  }

  if (command == "ping") {
    pusun::requestBattery(frame);
    return { sendFrame(frame), "שידור נכשל" };
  }

  // ⚠ lock/unlock אינם קיימים בפרוטוקול PUSUN. נעילה פיזית היא מנגנון
  // חיצוני למכונה, ולכן השער מדווח שאינו יכול לבצע.
  return { false, "הפקודה אינה נתמכת בפרוטוקול המכונה" };
}

// ─────────────── שרת ───────────────

static bool httpJson(const char* method, const String& path, const String& body, String& out) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(String(API_BASE) + path);
  http.addHeader("Authorization", String("Bearer ") + GATEWAY_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-ble-connected", bleConnected() ? "true" : "false");
  http.addHeader("x-gateway-firmware", FIRMWARE_VER);
  http.setTimeout(10000);

  int code = (strcmp(method, "POST") == 0) ? http.POST(body) : http.GET();
  out = http.getString();
  http.end();

  if (code == 401) Serial.println("[API] מפתח השער נדחה — בדוק את GATEWAY_KEY");
  return code >= 200 && code < 300;
}

static void reportResult(const String& commandId, bool success, const char* reason) {
  JsonDocument doc;
  doc["commandId"] = commandId;
  doc["success"] = success;
  if (!success && reason) doc["failureReason"] = reason;

  String body, resp;
  serializeJson(doc, body);
  httpJson("POST", "/api/gateway/v1/commands", body, resp);
}

static void pollCommands() {
  String resp;
  if (!httpJson("GET", "/api/gateway/v1/commands", "", resp)) return;

  JsonDocument doc;
  if (deserializeJson(doc, resp)) return;

  JsonArrayConst commands = doc["commands"].as<JsonArrayConst>();
  for (JsonObjectConst c : commands) {
    String id = c["id"].as<const char*>();
    String name = c["command"].as<const char*>();

    if (!bleConnected() && !connectToMachine()) {
      // ⚠ מדווח כישלון ולא שותק: פקודה שנאספה ולא בוצעה חייבת להיראות
      // בקונסולה, אחרת המפעיל חושב שהיא בדרך
      reportResult(id, false, "אין חיבור BLE למכונה");
      continue;
    }

    Serial.printf("[CMD] מבצע %s\n", name.c_str());
    CommandResult r = executeCommand(name, c["payload"].as<JsonObjectConst>());
    reportResult(id, r.success, r.success ? nullptr : r.failureReason);
  }
}

static void sendTelemetry() {
  uint8_t frame[pusun::APP_FRAME_LEN];
  if (bleConnected()) {
    pusun::requestBattery(frame);
    sendFrame(frame);
    delay(500);  // שהות לתשובת ה־notify
  }
  if (pendingFrameCount == 0) return;

  JsonDocument doc;
  JsonArray frames = doc["frames"].to<JsonArray>();
  for (uint8_t i = 0; i < pendingFrameCount; i++) frames.add(pendingFrames[i]);
  if (bleClient && bleClient->isConnected()) doc["rssi"] = bleClient->getRssi();

  String body, resp;
  serializeJson(doc, body);
  if (httpJson("POST", "/api/gateway/v1/telemetry", body, resp)) {
    pendingFrameCount = 0;
  }
}

// ─────────────── מחזור חיים ───────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[VELA-X] שער עמדה מתחיל");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] מתחבר");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\n[WiFi] מחובר: %s\n", WiFi.localIP().toString().c_str());

  NimBLEDevice::init("VELAX-GW");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  connectToMachine();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
    return;
  }

#if CONNECTION_MODE_HOLD_ALWAYS
  // ⚠ אחיזה קבועה בחיבור חוסמת מתחברים אחרים — כולל אפליקציית הטלפון
  if (!bleConnected()) connectToMachine();
#endif

  uint32_t now = millis();

  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollCommands();
  }

  if (now - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
    lastTelemetry = now;
    sendTelemetry();
  }

  delay(50);
}
