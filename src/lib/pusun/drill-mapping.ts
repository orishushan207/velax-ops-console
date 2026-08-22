import {
  RANGES,
  type ServeMode,
  type SpinType,
  ProtocolError,
} from './protocol';

/**
 * תרגום פרמטרי תרגיל לערכי הפרוטוקול של PUSUN.
 *
 * התרגיל במערכת מתואר במונחים שמאמן מבין — קמ״ש, כדורים לדקה, רמת סיבוב.
 * המכונה מקבלת ערכי בקרה גולמיים. כאן נמצא הגשר, והוא לוגיקה טהורה.
 *
 * ⚠ שלושה מהמימדים ניתנים לגזירה מדויקת מהמסמך. הרביעי — מהירות — אינו.
 * ראה CALIBRATION להלן.
 */

// ─────────────── תדירות ───────────────

/**
 * כדורים לדקה → הערך שהמכונה מצפה לו.
 *
 * המסמך: "Value: 10 * serve interval". הטווח 18–88 מתורגם ל־1.8–8.8 שניות
 * בין כדורים, כלומר 6.8–33.3 כדורים לדקה. זו גזירה מתמטית ודאית.
 */
export const FREQUENCY_LIMITS = {
  minBallsPerMinute: 60 / (RANGES.frequency.max / 10),
  maxBallsPerMinute: 60 / (RANGES.frequency.min / 10),
} as const;

export function ballsPerMinuteToSeconds(ballsPerMinute: number): number {
  if (!Number.isFinite(ballsPerMinute) || ballsPerMinute <= 0) {
    throw new ProtocolError(`תדירות חייבת להיות חיובית, התקבל ${ballsPerMinute}`);
  }
  const seconds = 60 / ballsPerMinute;
  const raw = Math.round(seconds * 10);
  if (raw < RANGES.frequency.min || raw > RANGES.frequency.max) {
    throw new ProtocolError(
      `תדירות ${ballsPerMinute} כדורים לדקה מחוץ ליכולת המכונה ` +
        `(${FREQUENCY_LIMITS.minBallsPerMinute.toFixed(1)}–${FREQUENCY_LIMITS.maxBallsPerMinute.toFixed(1)})`,
    );
  }
  return raw / 10;
}

// ─────────────── סיבוב ───────────────

/**
 * רמת סיבוב במערכת → סוג ועוצמה בפרוטוקול.
 * חיובי = טופספין, שלילי = בקספין, אפס = ללא. הטווח המוחלט 0–30.
 */
export function spinLevelToProtocol(spinLevel: number): { type: SpinType; amount: number } {
  if (!Number.isInteger(spinLevel)) {
    throw new ProtocolError(`רמת סיבוב חייבת להיות שלם, התקבל ${spinLevel}`);
  }
  const amount = Math.abs(spinLevel);
  if (amount > RANGES.spin.max) {
    throw new ProtocolError(`עוצמת סיבוב ${amount} חורגת מ־${RANGES.spin.max}`);
  }
  if (spinLevel === 0) return { type: 'none', amount: 0 };
  return { type: spinLevel > 0 ? 'topspin' : 'backspin', amount };
}

// ─────────────── רצף ───────────────

/**
 * רצף המכות של התרגיל → מצב ההגשה של המכונה.
 *
 * ⚠ 'combination' אינו נתמך ישירות: המכונה מכירה רק רצף נקודות קבוע.
 * הוא ממופה ל־program, שדורש טעינת הנקודות מראש בפקודה 0x6D.
 */
const SEQUENCE_TO_MODE: Record<string, ServeMode> = {
  fixed: 'fixed',
  horizontal: 'horizontal',
  vertical: 'vertical',
  random: 'random',
  combination: 'program',
};

export function sequenceToServeMode(sequence: string): ServeMode {
  const mode = SEQUENCE_TO_MODE[sequence];
  if (!mode) throw new ProtocolError(`רצף מכות לא מוכר: ${sequence}`);
  return mode;
}

// ─────────────── מהירות ───────────────

/**
 * ⚠ **המרת קמ״ש לערך המכונה אינה ידועה.**
 *
 * מסמך היצרן מגדיר "Velo value: 80-180" ואינו מציין יחידות, לא נקודת ייחוס
 * ולא עקומה. אין בו שום דבר שממנו אפשר לגזור קמ״ש.
 *
 * הצגת נוסחת המרה כאן הייתה המצאת נתון והצגתו כמדידה — בדיוק מה שהמערכת
 * אמורה למנוע. לכן ההמרה דורשת טבלת כיול שנמדדת בשטח: מודדים מהירות
 * כדור בפועל מול מספר ערכי velo, ומזינים את התוצאות.
 *
 * עד לכיול, יש להזין `machineVelocity` ישירות בתרגיל.
 */
export interface VelocityCalibrationPoint {
  /** הערך שנשלח למכונה */
  velo: number;
  /** המהירות שנמדדה בפועל */
  measuredKmh: number;
}

export interface VelocityCalibration {
  /** מזהה דגם, כדי שכיול לא יוחל על דגם אחר */
  model: string;
  measuredAt: string;
  points: VelocityCalibrationPoint[];
}

/**
 * ממיר קמ״ש לערך המכונה לפי כיול מדוד, באינטרפולציה לינארית בין נקודות.
 *
 * ⚠ אינו מבצע אקסטרפולציה. בקשה מחוץ לתחום שנמדד נדחית, כדי שלא יוצג
 * ניחוש כאילו נמדד.
 */
export function kmhToVelocity(kmh: number, calibration: VelocityCalibration): number {
  const points = [...calibration.points].sort((a, b) => a.measuredKmh - b.measuredKmh);
  if (points.length < 2) {
    throw new ProtocolError('נדרשות לפחות שתי נקודות כיול');
  }

  const lowest = points[0]!;
  const highest = points[points.length - 1]!;
  if (kmh < lowest.measuredKmh || kmh > highest.measuredKmh) {
    throw new ProtocolError(
      `${kmh} קמ״ש מחוץ לתחום שנמדד ` +
        `(${lowest.measuredKmh}–${highest.measuredKmh} קמ״ש). נדרש כיול נוסף.`,
    );
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (kmh >= a.measuredKmh && kmh <= b.measuredKmh) {
      const span = b.measuredKmh - a.measuredKmh;
      const ratio = span === 0 ? 0 : (kmh - a.measuredKmh) / span;
      const velo = Math.round(a.velo + ratio * (b.velo - a.velo));
      if (velo < RANGES.velocity.min || velo > RANGES.velocity.max) {
        throw new ProtocolError(`ערך מהירות מחושב ${velo} מחוץ לטווח המכונה`);
      }
      return velo;
    }
  }
  throw new ProtocolError('לא נמצא מקטע כיול מתאים');
}

// ─────────────── תרגום תרגיל שלם ───────────────

export interface DrillMachineParams {
  frequencyPerMinute: number | null;
  spinLevel: number | null;
  sequence: string;
  /** ערך המכונה הישיר. עדיף על קמ״ש כל עוד אין כיול. */
  machineVelocity?: number | null;
  speedKmh?: number | null;
}

export interface MachineSettings {
  serveMode: ServeMode;
  secondsBetweenBalls: number;
  spin: { type: SpinType; amount: number };
  velocity: number;
  /** אזהרות שאינן חוסמות — מוצגות למפעיל */
  warnings: string[];
}

/**
 * מתרגם תרגיל להגדרות מכונה.
 *
 * ⚠ נכשל במפורש כשחסר נתון, במקום להשלים ברירת מחדל שקטה: תרגיל שרץ
 * במהירות שגויה הוא סיכון בטיחותי, לא אי־נוחות.
 */
export function drillToMachineSettings(
  drill: DrillMachineParams,
  calibration?: VelocityCalibration,
): MachineSettings {
  const warnings: string[] = [];

  if (drill.frequencyPerMinute === null) {
    throw new ProtocolError('לתרגיל אין תדירות מוגדרת');
  }
  const secondsBetweenBalls = ballsPerMinuteToSeconds(drill.frequencyPerMinute);

  const spin = spinLevelToProtocol(drill.spinLevel ?? 0);
  if (drill.spinLevel === null) warnings.push('לא הוגדרה רמת סיבוב — נשלח ללא סיבוב');

  const serveMode = sequenceToServeMode(drill.sequence);

  let velocity: number;
  if (drill.machineVelocity !== null && drill.machineVelocity !== undefined) {
    if (
      !Number.isInteger(drill.machineVelocity) ||
      drill.machineVelocity < RANGES.velocity.min ||
      drill.machineVelocity > RANGES.velocity.max
    ) {
      throw new ProtocolError(
        `ערך מהירות ${drill.machineVelocity} מחוץ לטווח ${RANGES.velocity.min}–${RANGES.velocity.max}`,
      );
    }
    velocity = drill.machineVelocity;
  } else if (drill.speedKmh !== null && drill.speedKmh !== undefined) {
    if (!calibration) {
      throw new ProtocolError(
        'התרגיל מוגדר בקמ״ש אך אין טבלת כיול לדגם. ' +
          'יש להזין ערך מכונה ישיר, או לבצע כיול מדוד.',
      );
    }
    velocity = kmhToVelocity(drill.speedKmh, calibration);
    warnings.push(`מהירות נגזרה מכיול שנמדד ב־${calibration.measuredAt}`);
  } else {
    throw new ProtocolError('לתרגיל אין מהירות מוגדרת');
  }

  return { serveMode, secondsBetweenBalls, spin, velocity, warnings };
}
