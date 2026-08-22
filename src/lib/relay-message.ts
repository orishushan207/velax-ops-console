/**
 * ניסוח תוצאת פקודה שנשלחה למכונה.
 *
 * ⚠ הפרדה מ־relay.ts במכוון: זו לוגיקה טהורה ללא תלות בשרת, ולכן ניתנת
 * לבדיקה. הניסוח הוא דרישה בטיחותית — ראה tests/unit/relay-message.test.ts.
 */

export type RelayState =
  | { state: 'queued'; commandId: string; expiresAt: Date }
  | { state: 'no_device'; message: string };

/**
 * ⚠ "נעצר" הוא שקר כשהפקודה רק נכנסה לתור. הניסוח מפריד בין ההחלטה
 * התפעולית, שנרשמה, לבין השפעתה על המכונה, שתלויה בטלפון מחובר.
 */
export function relayMessage(outcome: RelayState, actionLabel: string): string {
  if (outcome.state === 'no_device') {
    return `${actionLabel}. ${outcome.message}.`;
  }
  return `${actionLabel}. הפקודה ממתינה ותגיע למכונה כשהאפליקציה תתחבר אליה.`;
}
