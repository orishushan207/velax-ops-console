/**
 * PUSUN PT-9001 — קידוד ופענוח פרוטוקול ה־BLE.
 *
 * מקור: "Pusun Tennis Machine Ble Communication Protocol", מסמך היצרן.
 *
 * ⚠ הפרוטוקול הוא בין **הטלפון למכונה** בלבד. למכונה אין קישוריות משלה,
 * ולכן הענן אינו יכול לפקד עליה ישירות. הטלפון הוא הגשר היחיד.
 *
 * ⚠ הפרוטוקול אינו כולל אימות, חתימה או הצפנה. כל לקוח BLE שמכיר את
 * ה־UUID יכול להפעיל את המכונה. אכיפת התשלום אינה יכולה להתבסס עליו.
 * ראה SECURITY_PUSUN.md.
 *
 * הקובץ הוא לוגיקה טהורה: ללא BLE, ללא רשת, ניתן לבדיקה מלאה.
 */

// ─────────────── קבועים מהמסמך ───────────────

/** שירות ה־BLE. UUID גנרי של מודול UART, לא ייעודי ליצרן. */
export const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
/** מכונה → טלפון (NOTIFY) */
export const BLE_NOTIFY_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
/** טלפון → מכונה (WRITE / WRITE NO RESPONSE) */
export const BLE_WRITE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

const APP_HEAD = 0xaa;
const APP_END = 0xa5;
const APP_FRAME_LEN = 10;

const DEV_HEAD = 0xbb;
const DEV_END = 0xb5;
const DEV_FRAME_LEN = 6;

/** המסמך מגדיר 28 נקודות קבועות, בפקודות 0x01..0x1C */
export const POINT_COUNT = 28;

/** טווחי הערכים החוקיים. חריגה מהם נדחית לפני שהפקודה נשלחת. */
export const RANGES = {
  /** מנוע צעד שמאל־ימין */
  lr: { min: 210, max: 2070 },
  /** מנוע מעלה־מטה */
  ud: { min: 300, max: 4200 },
  /** תדירות: הערך הוא 10 × השניות בין כדורים (18 = 1.8 שניות) */
  frequency: { min: 18, max: 88 },
  /** עוצמת סיבוב */
  spin: { min: 0, max: 30 },
  /** מהירות */
  velocity: { min: 80, max: 180 },
} as const;

export const CMD = {
  SET_POINT_BASE: 0x00, // נקודה n נשלחת כפקודה n (1..28)
  SET_DIRECTION: 0x6c,
  SET_FREQUENCY: 0x61,
  SET_SPIN: 0x62,
  SET_VELOCITY: 0x63,
  ALARM: 0x66,
  GET_BATTERY: 0x67,
  START: 0x6a,
  STOP: 0x6b,
  SET_PROGRAM: 0x6d,
  SET_NAME: 0x70,
} as const;

/** מצבי הגשה. 0x6A מקבל אחד מהם. */
export const SERVE_MODE = {
  fixed: 1,
  horizontal: 2,
  vertical: 3,
  random: 4,
  program: 5,
} as const;
export type ServeMode = keyof typeof SERVE_MODE;

export const SPIN_TYPE = {
  none: 0,
  topspin: 1,
  backspin: 2,
} as const;
export type SpinType = keyof typeof SPIN_TYPE;

// ─────────────── שגיאות ───────────────

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

function assertRange(value: number, range: { min: number; max: number }, label: string): void {
  if (!Number.isInteger(value)) {
    throw new ProtocolError(`${label} חייב להיות מספר שלם, התקבל ${value}`);
  }
  if (value < range.min || value > range.max) {
    throw new ProtocolError(`${label} מחוץ לטווח ${range.min}–${range.max}, התקבל ${value}`);
  }
}

// ─────────────── בניית מסגרת ───────────────

/**
 * מסגרת טלפון→מכונה: HEAD, COMMAND, DATA[6], END — עשרה בתים.
 * בתים שלא נעשה בהם שימוש נשלחים כאפס.
 */
function frame(command: number, data: number[] = []): Uint8Array {
  if (data.length > 6) {
    throw new ProtocolError(`DATA מוגבל ל־6 בתים, התקבלו ${data.length}`);
  }
  const bytes = new Uint8Array(APP_FRAME_LEN);
  bytes[0] = APP_HEAD;
  bytes[1] = command;
  for (let i = 0; i < data.length; i++) {
    const b = data[i]!;
    if (!Number.isInteger(b) || b < 0 || b > 0xff) {
      throw new ProtocolError(`בית ${i} אינו חוקי: ${b}`);
    }
    bytes[2 + i] = b;
  }
  bytes[APP_FRAME_LEN - 1] = APP_END;
  return bytes;
}

/** מפצל ערך 16 ביט לבית גבוה ובית נמוך — הגבוה ראשון, לפי המסמך */
function u16(value: number): [number, number] {
  return [(value >> 8) & 0xff, value & 0xff];
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new ProtocolError('מחרוזת hex באורך אי־זוגי');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new ProtocolError(`תו לא חוקי במחרוזת hex: ${hex}`);
    out[i] = byte;
  }
  return out;
}

// ─────────────── פקודות ───────────────

/** קובע את אחת מ־28 הנקודות הקבועות. מספר הנקודה הוא גם קוד הפקודה. */
export function setPoint(pointNumber: number, lr: number, ud: number): Uint8Array {
  if (!Number.isInteger(pointNumber) || pointNumber < 1 || pointNumber > POINT_COUNT) {
    throw new ProtocolError(`מספר נקודה חייב להיות 1–${POINT_COUNT}, התקבל ${pointNumber}`);
  }
  assertRange(lr, RANGES.lr, 'LR');
  assertRange(ud, RANGES.ud, 'UD');
  return frame(pointNumber, [...u16(lr), ...u16(ud)]);
}

/** קובע את כיוון ההגשה הנוכחי */
export function setDirection(lr: number, ud: number): Uint8Array {
  assertRange(lr, RANGES.lr, 'LR');
  assertRange(ud, RANGES.ud, 'UD');
  return frame(CMD.SET_DIRECTION, [...u16(lr), ...u16(ud)]);
}

/**
 * קובע תדירות הגשה.
 * @param secondsBetweenBalls שניות בין כדורים, 1.8–8.8
 */
export function setFrequency(secondsBetweenBalls: number): Uint8Array {
  const raw = Math.round(secondsBetweenBalls * 10);
  assertRange(raw, RANGES.frequency, 'תדירות (שניות ×10)');
  return frame(CMD.SET_FREQUENCY, [raw]);
}

export function setSpin(type: SpinType, amount: number): Uint8Array {
  assertRange(amount, RANGES.spin, 'עוצמת סיבוב');
  if (type === 'none' && amount !== 0) {
    throw new ProtocolError('ללא סיבוב חייב להיות בעוצמה 0');
  }
  return frame(CMD.SET_SPIN, [SPIN_TYPE[type], amount]);
}

export function setVelocity(velocity: number): Uint8Array {
  assertRange(velocity, RANGES.velocity, 'מהירות');
  return frame(CMD.SET_VELOCITY, [velocity]);
}

/** צפצוף אזהרה. המסמך מורה לשלוח אותו לפני תחילת הגשה. */
export function alarm(): Uint8Array {
  return frame(CMD.ALARM);
}

export function requestBattery(): Uint8Array {
  return frame(CMD.GET_BATTERY);
}

/**
 * מתחיל הגשה.
 * @param points במצב horizontal/vertical — עד 4 נקודות לרצף. רשימה ריקה = אקראי.
 */
export function start(mode: ServeMode, points: number[] = []): Uint8Array {
  if (points.length > 4) {
    throw new ProtocolError('ניתן לציין עד 4 נקודות לרצף');
  }
  for (const p of points) {
    if (!Number.isInteger(p) || p < 1 || p > POINT_COUNT) {
      throw new ProtocolError(`נקודה ${p} מחוץ לטווח 1–${POINT_COUNT}`);
    }
  }
  return frame(CMD.START, [SERVE_MODE[mode], ...points]);
}

export function stop(): Uint8Array {
  return frame(CMD.STOP);
}

/**
 * בונה את תוכנית ההגשה — שש פקודות, חמש נקודות בכל אחת.
 *
 * ⚠ המסמך דורש את כל שש הפקודות בכל פעם, גם כשנבחרו פחות נקודות.
 * מקומות פנויים נשלחים כאפס, אחרת המכונה משאירה תוכנית קודמת בזיכרון.
 */
export function setProgram(points: number[]): Uint8Array[] {
  if (points.length > POINT_COUNT) {
    throw new ProtocolError(`עד ${POINT_COUNT} נקודות בתוכנית, התקבלו ${points.length}`);
  }
  for (const p of points) {
    if (!Number.isInteger(p) || p < 1 || p > POINT_COUNT) {
      throw new ProtocolError(`נקודה ${p} מחוץ לטווח 1–${POINT_COUNT}`);
    }
  }
  const frames: Uint8Array[] = [];
  for (let item = 1; item <= 6; item++) {
    const slice = points.slice((item - 1) * 5, item * 5);
    const padded = [...slice, ...Array<number>(5 - slice.length).fill(0)];
    frames.push(frame(CMD.SET_PROGRAM, [item, ...padded]));
  }
  return frames;
}

/**
 * קובע את שם המכונה, למשל PT3230112009.
 * @param type ספרת סוג 0–9
 * @param date תאריך הייצור
 * @param serial מספר סידורי 1–255
 */
export function setName(type: number, date: Date, serial: number): Uint8Array {
  if (!Number.isInteger(type) || type < 0 || type > 9) {
    throw new ProtocolError(`סוג חייב להיות 0–9, התקבל ${type}`);
  }
  if (!Number.isInteger(serial) || serial < 1 || serial > 255) {
    throw new ProtocolError(`מספר סידורי חייב להיות 1–255, התקבל ${serial}`);
  }
  const year = date.getFullYear() % 100;
  return frame(CMD.SET_NAME, [type, year, date.getMonth() + 1, date.getDate(), serial]);
}

// ─────────────── פענוח הודעות מהמכונה ───────────────

export const NOTIFY = {
  BATTERY: 0x03,
  FAULT: 0x5e,
} as const;

/** קודי התקלה שהמכונה מדווחת, לפי המסמך */
export const FAULT_CODES: Record<number, string> = {
  1: 'הגנת גלגל',
  2: 'הגנת פתח הזנה',
  3: 'אין כדורים',
};

export type DeviceMessage =
  | { kind: 'battery'; batteryPct: number }
  | { kind: 'fault'; code: number; description: string }
  | { kind: 'unknown'; command: number; data: number[] };

/**
 * מפענח מסגרת מכונה→טלפון.
 *
 * ⚠ הבית החמישי אינו מרופד אלא ביקורת: הוא COMMAND XOR DATA1.
 * המסמך מכנה אותו DEFAULT, אך שתי הדוגמאות שבו מאששות את החישוב
 * (BB 03 43 00 **40** B5 ו־BB 5E 01 00 **5F** B5). בדיקתו מונעת פעולה
 * על מסגרת משובשת שהתקבלה ברעש BLE.
 */
export function decodeMessage(input: Uint8Array | string): DeviceMessage {
  const bytes = typeof input === 'string' ? fromHex(input) : input;

  if (bytes.length !== DEV_FRAME_LEN) {
    throw new ProtocolError(`אורך מסגרת ${bytes.length}, נדרש ${DEV_FRAME_LEN}`);
  }
  if (bytes[0] !== DEV_HEAD) {
    throw new ProtocolError(`HEAD שגוי: 0x${bytes[0]!.toString(16)}`);
  }
  if (bytes[DEV_FRAME_LEN - 1] !== DEV_END) {
    throw new ProtocolError(`END שגוי: 0x${bytes[DEV_FRAME_LEN - 1]!.toString(16)}`);
  }

  const command = bytes[1]!;
  const data1 = bytes[2]!;
  const data2 = bytes[3]!;
  const check = bytes[4]!;

  const expected = (command ^ data1) & 0xff;
  if (check !== expected) {
    throw new ProtocolError(
      `ביקורת שגויה: התקבל 0x${check.toString(16)}, צפוי 0x${expected.toString(16)}`,
    );
  }

  if (command === NOTIFY.BATTERY) {
    if (data1 > 100) throw new ProtocolError(`אחוז סוללה לא חוקי: ${data1}`);
    return { kind: 'battery', batteryPct: data1 };
  }

  if (command === NOTIFY.FAULT) {
    return {
      kind: 'fault',
      code: data1,
      description: FAULT_CODES[data1] ?? `תקלה לא מוכרת (${data1})`,
    };
  }

  return { kind: 'unknown', command, data: [data1, data2] };
}
