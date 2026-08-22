import { describe, expect, it } from 'vitest';
import { ProtocolError } from '@/lib/pusun/protocol';
import {
  FREQUENCY_LIMITS,
  ballsPerMinuteToSeconds,
  drillToMachineSettings,
  kmhToVelocity,
  sequenceToServeMode,
  spinLevelToProtocol,
  type VelocityCalibration,
} from '@/lib/pusun/drill-mapping';

describe('תדירות — גזירה מתמטית מהמסמך', () => {
  it('גבולות היכולת נגזרים מטווח 18–88', () => {
    // 8.8 שניות → 6.8 כדורים לדקה;  1.8 שניות → 33.3
    expect(FREQUENCY_LIMITS.minBallsPerMinute).toBeCloseTo(6.82, 1);
    expect(FREQUENCY_LIMITS.maxBallsPerMinute).toBeCloseTo(33.3, 1);
  });

  it('ממיר כדורים לדקה לשניות', () => {
    expect(ballsPerMinuteToSeconds(30)).toBe(2);
    expect(ballsPerMinuteToSeconds(20)).toBe(3);
    expect(ballsPerMinuteToSeconds(12)).toBe(5);
  });

  it('דוחה תדירות שהמכונה אינה מסוגלת לה', () => {
    expect(() => ballsPerMinuteToSeconds(60)).toThrow(/מחוץ ליכולת/);
    expect(() => ballsPerMinuteToSeconds(3)).toThrow(/מחוץ ליכולת/);
    expect(() => ballsPerMinuteToSeconds(0)).toThrow(ProtocolError);
  });
});

describe('סיבוב', () => {
  it('הסימן קובע את הסוג', () => {
    expect(spinLevelToProtocol(15)).toEqual({ type: 'topspin', amount: 15 });
    expect(spinLevelToProtocol(-30)).toEqual({ type: 'backspin', amount: 30 });
    expect(spinLevelToProtocol(0)).toEqual({ type: 'none', amount: 0 });
  });

  it('דוחה עוצמה מעל 30', () => {
    expect(() => spinLevelToProtocol(31)).toThrow(ProtocolError);
    expect(() => spinLevelToProtocol(-31)).toThrow(ProtocolError);
  });
});

describe('רצף מכות', () => {
  it('combination ממופה ל־program', () => {
    expect(sequenceToServeMode('combination')).toBe('program');
    expect(sequenceToServeMode('fixed')).toBe('fixed');
    expect(sequenceToServeMode('random')).toBe('random');
  });

  it('דוחה רצף לא מוכר', () => {
    expect(() => sequenceToServeMode('spiral')).toThrow(ProtocolError);
  });
});

describe('מהירות — רק לפי כיול מדוד', () => {
  const calibration: VelocityCalibration = {
    model: 'PT-9001',
    measuredAt: '2026-08-22',
    points: [
      { velo: 80, measuredKmh: 40 },
      { velo: 130, measuredKmh: 70 },
      { velo: 180, measuredKmh: 110 },
    ],
  };

  it('מאנטרפל בין נקודות שנמדדו', () => {
    expect(kmhToVelocity(40, calibration)).toBe(80);
    expect(kmhToVelocity(70, calibration)).toBe(130);
    expect(kmhToVelocity(55, calibration)).toBe(105);
  });

  it('⚠ אינו מבצע אקסטרפולציה — ניחוש אינו מדידה', () => {
    expect(() => kmhToVelocity(120, calibration)).toThrow(/מחוץ לתחום שנמדד/);
    expect(() => kmhToVelocity(30, calibration)).toThrow(/מחוץ לתחום שנמדד/);
  });

  it('דורש לפחות שתי נקודות', () => {
    expect(() =>
      kmhToVelocity(50, { ...calibration, points: [{ velo: 100, measuredKmh: 50 }] }),
    ).toThrow(/שתי נקודות/);
  });
});

describe('תרגום תרגיל שלם', () => {
  const base = { frequencyPerMinute: 20, spinLevel: 10, sequence: 'fixed' as const };

  it('מתרגם תרגיל עם ערך מכונה ישיר', () => {
    const result = drillToMachineSettings({ ...base, machineVelocity: 160 });
    expect(result).toMatchObject({
      serveMode: 'fixed',
      secondsBetweenBalls: 3,
      spin: { type: 'topspin', amount: 10 },
      velocity: 160,
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('⚠ מסרב לתרגם קמ״ש בלי כיול, במקום לנחש', () => {
    expect(() => drillToMachineSettings({ ...base, speedKmh: 60 })).toThrow(/כיול/);
  });

  it('נכשל כשחסרה מהירות — ולא משלים ברירת מחדל', () => {
    // תרגיל שרץ במהירות שגויה הוא סיכון בטיחותי
    expect(() => drillToMachineSettings(base)).toThrow(/מהירות/);
  });

  it('נכשל כשחסרה תדירות', () => {
    expect(() =>
      drillToMachineSettings({ ...base, frequencyPerMinute: null, machineVelocity: 120 }),
    ).toThrow(/תדירות/);
  });

  it('דוחה ערך מכונה מחוץ לטווח', () => {
    expect(() => drillToMachineSettings({ ...base, machineVelocity: 200 })).toThrow(/מחוץ לטווח/);
  });

  it('מזהיר כשסיבוב לא הוגדר, אך אינו חוסם', () => {
    const result = drillToMachineSettings({ ...base, spinLevel: null, machineVelocity: 100 });
    expect(result.spin).toEqual({ type: 'none', amount: 0 });
    expect(result.warnings[0]).toMatch(/סיבוב/);
  });
});
