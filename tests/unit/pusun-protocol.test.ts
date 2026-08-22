import { describe, expect, it } from 'vitest';
import {
  ProtocolError,
  RANGES,
  alarm,
  decodeMessage,
  requestBattery,
  setDirection,
  setFrequency,
  setName,
  setPoint,
  setProgram,
  setSpin,
  setVelocity,
  start,
  stop,
  toHex,
} from '@/lib/pusun/protocol';

/**
 * כל וקטור בדיקה כאן לקוח מילולית ממסמך היצרן.
 * הם מקור האמת: אם המימוש סוטה מהם, הוא שגוי — לא הבדיקה.
 */

const hex = (b: Uint8Array) => toHex(b);

describe('טלפון → מכונה — דוגמאות מהמסמך', () => {
  it('נקודה 1 ונקודה 28', () => {
    // AA01081603E8000000A5  Pt1, LR:0x0816=2070, UD:0x03E8=1000
    expect(hex(setPoint(1, 2070, 1000))).toBe('AA01081603E8000000A5');
    // AA1C00D20514000000A5  Pt28, LR:0x00D2=210, UD:0x0514=1300
    expect(hex(setPoint(28, 210, 1300))).toBe('AA1C00D20514000000A5');
  });

  it('כיוון הגשה', () => {
    // AA6C047403E8000000A5
    expect(hex(setDirection(0x0474, 0x03e8))).toBe('AA6C047403E8000000A5');
  });

  it('תדירות — הערך הוא עשרה מונים לשנייה', () => {
    // AA611C000000000000A5  → 0x1C = 28 = 2.8 שניות
    expect(hex(setFrequency(2.8))).toBe('AA611C000000000000A5');
  });

  it('סיבוב — שלוש הדוגמאות', () => {
    expect(hex(setSpin('none', 0))).toBe('AA6200000000000000A5');
    // AA62021E0000000000A5  02 backspin 1E=30
    expect(hex(setSpin('backspin', 30))).toBe('AA62021E0000000000A5');
    // AA62010F0000000000A5  01 topspin 0F=15
    expect(hex(setSpin('topspin', 15))).toBe('AA62010F0000000000A5');
  });

  it('מהירות', () => {
    // AA63A0000000000000A5  velo A0 = 160
    expect(hex(setVelocity(160))).toBe('AA63A0000000000000A5');
  });

  it('צפצוף ובקשת סוללה', () => {
    expect(hex(alarm())).toBe('AA6600000000000000A5');
    expect(hex(requestBattery())).toBe('AA6700000000000000A5');
  });

  it('חמשת מצבי ההגשה', () => {
    expect(hex(start('fixed'))).toBe('AA6A01000000000000A5');
    // AA6A02101400000000A5  horizontal, נקודות 0x10 ו־0x14
    expect(hex(start('horizontal', [0x10, 0x14]))).toBe('AA6A02101400000000A5');
    expect(hex(start('vertical'))).toBe('AA6A03000000000000A5');
    expect(hex(start('random'))).toBe('AA6A04000000000000A5');
    expect(hex(start('program'))).toBe('AA6A05000000000000A5');
  });

  it('עצירה', () => {
    expect(hex(stop())).toBe('AA6B00000000000000A5');
  });

  it('שם מכונה — PT3230112009', () => {
    // AA700317010C090000A5 → type 03, year 0x17=23, month 01, day 0x0C=12, serial 09
    expect(hex(setName(3, new Date(2023, 0, 12), 9))).toBe('AA700317010C090000A5');
  });
});

describe('תוכנית הגשה', () => {
  it('שולחת תמיד שש פקודות, גם עבור נקודה אחת', () => {
    // ⚠ המסמך דורש שש; פחות מכך משאיר תוכנית קודמת בזיכרון המכונה
    const frames = setProgram([0x16, 0x04]);
    expect(frames).toHaveLength(6);
    expect(hex(frames[0]!)).toBe('AA6D01160400000000A5');
    expect(hex(frames[1]!)).toBe('AA6D02000000000000A5');
    expect(hex(frames[5]!)).toBe('AA6D06000000000000A5');
  });

  it('מפזרת 28 נקודות על פני שש הפקודות', () => {
    const points = Array.from({ length: 28 }, (_, i) => i + 1);
    const frames = setProgram(points);
    expect(frames).toHaveLength(6);
    // פריט 1 נושא את הנקודות 1–5; פריט 6 את נקודות 26–28 ואז ריפוד
    expect(hex(frames[0]!)).toBe('AA6D01010203040500A5');
    expect(hex(frames[5]!)).toBe('AA6D061A1B1C000000A5');
  });
});

describe('אימות טווחים — נדחה לפני שהפקודה נשלחת', () => {
  it('דוחה LR ו־UD מחוץ לטווח', () => {
    expect(() => setPoint(1, RANGES.lr.min - 1, 1000)).toThrow(ProtocolError);
    expect(() => setPoint(1, RANGES.lr.max + 1, 1000)).toThrow(ProtocolError);
    expect(() => setPoint(1, 1000, RANGES.ud.min - 1)).toThrow(ProtocolError);
    expect(() => setPoint(1, 1000, RANGES.ud.max + 1)).toThrow(ProtocolError);
  });

  it('דוחה מספר נקודה לא חוקי', () => {
    expect(() => setPoint(0, 1000, 1000)).toThrow(ProtocolError);
    expect(() => setPoint(29, 1000, 1000)).toThrow(ProtocolError);
  });

  it('דוחה תדירות מחוץ ל־1.8–8.8 שניות', () => {
    expect(() => setFrequency(1.7)).toThrow(ProtocolError);
    expect(() => setFrequency(8.9)).toThrow(ProtocolError);
    expect(hex(setFrequency(1.8))).toBe('AA6112000000000000A5');
    expect(hex(setFrequency(8.8))).toBe('AA6158000000000000A5');
  });

  it('דוחה מהירות וסיבוב מחוץ לטווח', () => {
    expect(() => setVelocity(79)).toThrow(ProtocolError);
    expect(() => setVelocity(181)).toThrow(ProtocolError);
    expect(() => setSpin('topspin', 31)).toThrow(ProtocolError);
  });

  it('דוחה סיבוב none עם עוצמה', () => {
    expect(() => setSpin('none', 5)).toThrow(ProtocolError);
  });

  it('דוחה יותר מארבע נקודות ברצף', () => {
    expect(() => start('horizontal', [1, 2, 3, 4, 5])).toThrow(ProtocolError);
  });
});

describe('מכונה → טלפון — פענוח', () => {
  it('סוללה, לפי דוגמת המסמך', () => {
    // BB03430040B5  SOC 0x43 = 67
    expect(decodeMessage('BB03430040B5')).toEqual({ kind: 'battery', batteryPct: 67 });
  });

  it('תקלה, לפי דוגמת המסמך', () => {
    // BB5E01005FB5  wheel protection
    expect(decodeMessage('BB5E01005FB5')).toEqual({
      kind: 'fault',
      code: 1,
      description: 'הגנת גלגל',
    });
  });

  it('שלושת קודי התקלה מזוהים', () => {
    expect(decodeMessage('BB5E02005CB5')).toMatchObject({ code: 2, description: 'הגנת פתח הזנה' });
    expect(decodeMessage('BB5E03005DB5')).toMatchObject({ code: 3, description: 'אין כדורים' });
  });

  it('דוחה מסגרת עם ביקורת שגויה', () => {
    // ⚠ רעש BLE יכול לשבש בית; פעולה על מסגרת משובשת מסוכנת יותר משגיאה
    expect(() => decodeMessage('BB03430041B5')).toThrow(/ביקורת/);
  });

  it('דוחה HEAD, END ואורך שגויים', () => {
    expect(() => decodeMessage('AA03430040B5')).toThrow(/HEAD/);
    expect(() => decodeMessage('BB03430040A5')).toThrow(/END/);
    expect(() => decodeMessage('BB034300B5')).toThrow(/אורך/);
  });

  it('דוחה אחוז סוללה בלתי אפשרי', () => {
    expect(() => decodeMessage('BB03650066B5')).toThrow(/סוללה/);
  });
});
