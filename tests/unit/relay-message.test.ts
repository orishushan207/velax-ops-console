import { describe, expect, it } from 'vitest';
import { relayMessage } from '@/lib/relay-message';

/**
 * ⚠ הניסוח הזה הוא דרישה, לא נוחות.
 * כפתור שאומר "המכונה נעצרה" כשבפועל הפקודה רק ממתינה בתור מטעה את
 * המפעיל במצב בטיחותי. הבדיקה נועלת את ההבחנה.
 */
describe('ניסוח תוצאת פקודה למפעיל', () => {
  it('אינו מבטיח שהמכונה קיבלה, אלא שהפקודה ממתינה', () => {
    const msg = relayMessage(
      { state: 'queued', commandId: 'x', expiresAt: new Date() },
      'הסשן הושהה',
    );
    expect(msg).toContain('הסשן הושהה');
    expect(msg).toContain('ממתינה');
    // אסור שיופיע ניסוח שמשתמע ממנו שהמכונה כבר הגיבה
    expect(msg).not.toMatch(/המכונה נעצרה|בוצע במכונה|נשלח למכונה/);
  });

  it('אומר במפורש כשאין מכונה משויכת', () => {
    const msg = relayMessage(
      { state: 'no_device', message: 'אין מכונה משויכת לסשן' },
      'הסשן הסתיים',
    );
    expect(msg).toContain('הסשן הסתיים');
    expect(msg).toContain('אין מכונה משויכת');
    expect(msg).not.toContain('ממתינה');
  });
});
