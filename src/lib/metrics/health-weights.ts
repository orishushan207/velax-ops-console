/**
 * משקלי ציון בריאות המועדון.
 *
 * ⚠ סעיף 8 בהנחיות: "הצג את נוסחת הציון באופן שקוף וניתן להגדרה."
 * המשקלים חיים כאן, במודול טהור, כדי שהם יהיו ניתנים לבדיקה, להצגה במסך
 * ולשינוי — בלי לגעת בשאילתות.
 *
 * עשרת הרכיבים מגיעים ישירות מסעיף 8 בהנחיות המשימה.
 */
export const HEALTH_WEIGHTS = {
  stationAvailability: 0.18,
  usageHours: 0.16,
  usageTrend: 0.12,
  incidents: 0.11,
  slaCompliance: 0.09,
  staffActivity: 0.07,
  checklistCompletion: 0.09,
  chargingAndBalls: 0.06,
  marketingPresence: 0.05,
  earnBackCompliance: 0.07,
} as const;

export type HealthComponent = keyof typeof HEALTH_WEIGHTS;

export const HEALTH_COMPONENT_LABELS: Record<HealthComponent, string> = {
  stationAvailability: 'זמינות העמדות',
  usageHours: 'שעות שימוש',
  usageTrend: 'מגמת שימוש',
  incidents: 'תקלות',
  slaCompliance: 'עמידה ב־SLA',
  staffActivity: 'פעילות צוות המועדון',
  checklistCompletion: 'ביצוע Checklist',
  chargingAndBalls: 'טעינה וכדורים',
  marketingPresence: 'שיווק והצגת העמדה',
  earnBackCompliance: 'עמידה בתנאי Earn-Back',
};

export type HealthBreakdown = Record<HealthComponent, number> & { total: number };
