import type { PermissionKey } from './permissions';

/**
 * קטלוג ההגדרות העסקיות — כל הנחה במערכת מוגדרת כאן ונטענת ל־DB ב־Seed.
 *
 * ⚠ סעיף 33 בהנחיות: "אל תקבע הנחות עסקיות בתוך רכיבי UI."
 * שום קומפוננטה ושום חישוב אינם מכילים מספר עסקי קשיח.
 * הערכים כאן הם ברירת המחדל ההתחלתית בלבד; מרגע ה־Seed מקור האמת הוא ה־DB.
 *
 * confidence:
 *   verified  — מופיע במפורש באחד המסמכים ואין סתירה
 *   assumed   — הנחה שלי או ערך שלא ננקב במסמכים
 *   disputed  — שני המסמכים אומרים דברים שונים; שניהם מתועדים
 */

export type SettingValueType =
  | 'number'
  | 'percentage'
  | 'currency'
  | 'string'
  | 'boolean'
  | 'json'
  | 'duration_minutes';

export type SettingConfidence = 'verified' | 'assumed' | 'disputed';

export interface SettingDef {
  key: string;
  nameHe: string;
  category: string;
  valueType: SettingValueType;
  unit?: string;
  description?: string;
  confidence: SettingConfidence;
  sourceReference?: string;
  conflictingValue?: string;
  conflictingSource?: string;
  /** ערך גלובלי ברירת מחדל */
  defaultValue: string;
  /** ערכים לפי תרחיש, כאשר ההגדרה תלוית תרחיש */
  scenarioValues?: { plan: string; realistic: string; conservative: string };
  allowsClubOverride?: boolean;
  minValue?: string;
  maxValue?: string;
  /** ההרשאה הנדרשת לשינוי. ברירת מחדל: finance.edit_assumptions */
  editPermission?: PermissionKey;
}

export const SETTING_CATEGORIES = {
  pricing: 'תמחור',
  finance: 'כספים וכלכלת יחידה',
  station: 'עמדות וחומרה',
  earnback: 'Earn-Back',
  sla: 'SLA ושירות',
  quality: 'יעדי איכות',
  ops: 'תפעול והתראות',
  metrics: 'הגדרות מדדים',
  refund: 'מדיניות זיכויים',
  coach: 'מאמנים ועמלות',
  rewards: 'Rewards',
  market: 'שוק ותחזית',
} as const;

export const SETTINGS: SettingDef[] = [
  // ═══ תמחור ═══
  {
    key: 'pricing.consumer_price_per_hour_incl_vat',
    nameHe: 'מחיר לשעת שימוש לצרכן (כולל מע״מ)',
    category: 'pricing',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'PDF פרק 7 · XLSX הנחות!B7',
    description: 'המחיר שהשחקן משלם על שעת אימון. התוכנית מציעה A/B בטווח 80–100 ₪.',
    defaultValue: '90',
    allowsClubOverride: true,
    minValue: '0',
    maxValue: '500',
  },
  {
    key: 'pricing.ab_test_min',
    nameHe: 'טווח A/B — מחיר מינימלי',
    category: 'pricing',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.1',
    defaultValue: '80',
  },
  {
    key: 'pricing.ab_test_max',
    nameHe: 'טווח A/B — מחיר מקסימלי',
    category: 'pricing',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.1',
    defaultValue: '100',
  },
  {
    key: 'pricing.default_session_minutes',
    nameHe: 'משך סשן ברירת מחדל',
    category: 'pricing',
    valueType: 'duration_minutes',
    unit: 'דקות',
    confidence: 'assumed',
    sourceReference: 'לא ננקב במסמכים — נגזר מתמחור "לשעה"',
    defaultValue: '60',
  },

  // ═══ כספים ═══
  {
    key: 'finance.vat_rate',
    nameHe: 'שיעור מע״מ',
    category: 'finance',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!B8 · רשות המסים',
    defaultValue: '0.18',
    minValue: '0',
    maxValue: '1',
  },
  {
    key: 'finance.psp_percentage_fee',
    nameHe: 'עמלת סליקה — אחוז מהעסקה',
    category: 'finance',
    valueType: 'percentage',
    confidence: 'disputed',
    sourceReference: 'XLSX הנחות!B10 = 2.7%',
    conflictingValue: '0.019',
    conflictingSource: 'הערה בגיליון כלכלת יחידה G8: "קיבלתי תמחור על 2 שקל" — הצעת ספק לא חתומה',
    defaultValue: '0.027',
  },
  {
    key: 'finance.psp_fixed_fee',
    nameHe: 'עמלת סליקה — רכיב קבוע לעסקה',
    category: 'finance',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!B11',
    defaultValue: '1',
  },
  {
    key: 'finance.rewards_reserve_pct',
    nameHe: 'קרן תגמולים — אחוז מההכנסה נטו',
    category: 'finance',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 11.4 · XLSX הנחות!B12',
    description: 'הקרן שממנה מתוקצבות הטבות ה־Rewards. יוצרת התחייבות חשבונאית.',
    defaultValue: '0.06',
  },
  {
    key: 'finance.coach_pool_pct',
    nameHe: 'עמלות מאמנים — אחוז משוקלל מההכנסה נטו',
    category: 'finance',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 10 · XLSX הנחות!B13',
    defaultValue: '0.05',
  },
  {
    key: 'finance.refund_risk_pct',
    nameHe: 'זיכויים, ביטולים וסיכון — אחוז מההכנסה נטו',
    category: 'finance',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!B14',
    defaultValue: '0.03',
  },
  {
    key: 'finance.balls_and_wear_per_hour',
    nameHe: 'כדורים, בלאי ותחזוקת ציוד לשעה',
    category: 'finance',
    valueType: 'currency',
    unit: '₪/שעה',
    confidence: 'disputed',
    sourceReference: 'PDF פרק 9.2 = 8 ₪',
    conflictingValue: '15 (ריאלי) / 22 (שמרני)',
    conflictingSource: 'XLSX הנחות!C18/D18 — המודל קובע ש־8 ₪ "נמוך משמעותית מהמציאות של מכונה מסחרית"',
    description: 'העלות המשתנה הגדולה ביותר. גיליון כלכלת יחידה: "החלטה על שליש מהמרווח".',
    defaultValue: '8',
    scenarioValues: { plan: '8', realistic: '15', conservative: '22' },
  },
  {
    key: 'finance.cloud_and_comms_per_hour',
    nameHe: 'ענן, תקשורת ותשתית לסשן',
    category: 'finance',
    valueType: 'currency',
    unit: '₪/שעה',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!B19-D19',
    defaultValue: '2.5',
    scenarioValues: { plan: '2.5', realistic: '3', conservative: '4' },
  },
  {
    key: 'finance.spare_parts_per_hour',
    nameHe: 'חלפים ומתכלים בשירות',
    category: 'finance',
    valueType: 'currency',
    unit: '₪/שעה',
    confidence: 'disputed',
    sourceReference: 'XLSX הנחות!B20-D20',
    conflictingValue: 'לא קיים',
    conflictingSource: 'PDF פרק 9.2 אינו כולל רכיב זה כלל, למרות התחייבות SLA בפרק 14',
    defaultValue: '0',
    scenarioValues: { plan: '0', realistic: '3', conservative: '5' },
  },
  {
    key: 'finance.warranty_reserve_per_hour',
    nameHe: 'רזרבת אחריות והחלפת ציוד',
    category: 'finance',
    valueType: 'currency',
    unit: '₪/שעה',
    confidence: 'disputed',
    sourceReference: 'XLSX הנחות!B21-D21',
    conflictingValue: 'לא קיים',
    conflictingSource: 'PDF פרק 9.2 אינו כולל רכיב זה',
    defaultValue: '0',
    scenarioValues: { plan: '0', realistic: '3', conservative: '5' },
  },
  {
    key: 'finance.operating_days_per_year',
    nameHe: 'ימי פעילות בשנה',
    category: 'finance',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'assumed',
    sourceReference: 'XLSX הנחות!B32',
    defaultValue: '312',
  },
  {
    key: 'finance.annual_fixed_cost',
    nameHe: 'הוצאה שנתית קבועה (ארכיטיפ פעיל)',
    category: 'finance',
    valueType: 'currency',
    unit: '₪',
    confidence: 'disputed',
    sourceReference: 'XLSX ארכיטיפים!B29 — ארכיטיפ רזה',
    conflictingValue: '2,100,000 (ביניים) / 3,400,000 (ארצי)',
    conflictingSource: 'XLSX ארכיטיפים!C29/D29 — בחירת הארכיטיפ היא החלטה עסקית פתוחה',
    description: 'הבסיס לחישוב נקודת האיזון. אינו כולל עלויות משתנות.',
    defaultValue: '730000',
    scenarioValues: { plan: '730000', realistic: '2100000', conservative: '3400000' },
  },
  {
    key: 'finance.one_time_setup_cost',
    nameHe: 'הוצאות הקמה חד-פעמיות',
    category: 'finance',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'XLSX ארכיטיפים!B19-C19 — אמצע טווח 600K–1.23M',
    defaultValue: '915000',
  },

  // ═══ עמדות וחומרה ═══
  {
    key: 'station.setup_fee',
    nameHe: 'דמי הקמה למועדון (לפני מע״מ)',
    category: 'station',
    valueType: 'currency',
    unit: '₪',
    confidence: 'disputed',
    sourceReference: 'XLSX הנחות!B36 = 6,000 ₪ — "עודכן לפי היזם, אוגוסט 2026"',
    conflictingValue: '14900',
    conflictingSource: 'PDF פרק 8.5 ו־9.1 — המספר הישן. משנה את יעד ה־Earn-Back פי 2.5.',
    description: 'הערך הזה קובע ישירות כמה שעות המועדון צריך כדי להחזיר את ההשקעה.',
    defaultValue: '6000',
    allowsClubOverride: true,
  },
  {
    key: 'station.installed_cost_lean',
    nameHe: 'עלות עמדה רזה — מותקנת',
    category: 'station',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!B60 — מכונה 3,000 + נעילה 800 + כדורים 900 + התקנה 800',
    defaultValue: '5500',
  },
  {
    key: 'station.installed_cost_full',
    nameHe: 'עלות עמדה מלאה — מותקנת',
    category: 'station',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'XLSX הנחות!C60 — כולל מסך מסחרי ונעילה מלאה',
    description: 'בעמדה מלאה מול דמי הקמה של 6,000 ₪, כל התקנה היא הפסד של 4,000 ₪.',
    defaultValue: '10000',
  },
  {
    key: 'station.courts_per_station',
    nameHe: 'מגרשים שעמדה אחת משרתת',
    category: 'station',
    valueType: 'number',
    unit: 'מגרשים',
    confidence: 'disputed',
    sourceReference: 'XLSX ארכיטיפים!B7 = 2.5',
    conflictingValue: '2',
    conflictingSource: 'הערה בגיליון ארכיטיפים C7: "ארד - 2 לכל עמדה"',
    defaultValue: '2.5',
  },

  // ═══ Earn-Back ═══
  {
    key: 'earnback.guarantee_days',
    nameHe: 'תקופת הערבות',
    category: 'earnback',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'verified',
    sourceReference: 'PDF פרק 8.3 — Six-Month Earn-Back Guarantee',
    defaultValue: '180',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.operating_days_in_period',
    nameHe: 'ימי פעילות בתקופת הערבות',
    category: 'earnback',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'assumed',
    sourceReference: 'XLSX הנחות!B43 — 156 מתוך 180 יום קלנדריים',
    defaultValue: '156',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.court_revenue_per_hour',
    nameHe: 'הכנסת מגרש לשעת VELA-X (לפני מע״מ)',
    category: 'earnback',
    valueType: 'currency',
    unit: '₪',
    confidence: 'verified',
    sourceReference: 'PDF פרק 8.5 · XLSX הנחות!B41',
    defaultValue: '90',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.club_ball_cost_per_hour',
    nameHe: 'עלות כדורים שהמועדון סופג לשעה',
    category: 'earnback',
    valueType: 'currency',
    unit: '₪',
    confidence: 'disputed',
    sourceReference: 'XLSX הנחות!B46 = 20 ₪',
    conflictingValue: 'לא קיים',
    conflictingSource: 'PDF פרק 8.5 אינו מזכיר עלות זו כלל — והיא "מאריכה משמעותית את ההחזר האמיתי"',
    defaultValue: '20',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.incrementality_factor',
    nameHe: 'מקדם אינקרמנטליות של הכנסת המגרש',
    category: 'earnback',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'הנחה שלי. PDF עמ׳ 10 מודה: "הכנסה זו אינה בהכרח כולה אינקרמנטלית".',
    description:
      'איזה חלק מההכנסה המקושרת באמת לא היה מתקיים ללא המכונה. דורש אימות בפיילוט — עד אז זו ההנחה החשובה ביותר במודל הערבות.',
    defaultValue: '0.70',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.reserve_pct',
    nameHe: 'אחוז הפרשה מתקבולי ההתקנה',
    category: 'earnback',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 18.1 — "רזרבה של 10%-15%"; אמצע הטווח',
    defaultValue: '0.125',
  },
  {
    key: 'earnback.exposure_cap_per_club',
    nameHe: 'תקרת חשיפה כוללת למועדון',
    category: 'earnback',
    valueType: 'currency',
    unit: '₪',
    confidence: 'assumed',
    sourceReference: 'לא קיים באף מסמך. המלצת גיליון ערבות A37: "להגביל את החשיפה בתקרה מוחלטת".',
    defaultValue: '6000',
    allowsClubOverride: true,
  },
  {
    key: 'earnback.at_risk_threshold_pct',
    nameHe: 'רף סימון מועדון כ"בסיכון"',
    category: 'earnback',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'הנחה שלי — יחס בין קצב נדרש לקצב בפועל',
    description: 'כאשר הקצב הנדרש להשלמת הפער גבוה מהקצב בפועל ביותר מהאחוז הזה, המועדון מסומן בסיכון.',
    defaultValue: '0.20',
  },

  // ═══ SLA ═══
  {
    key: 'sla.response_hours',
    nameHe: 'זמן תגובה יעד (חומרה גבוהה)',
    category: 'sla',
    valueType: 'number',
    unit: 'שעות',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 14 אומר "אבחון תוך שעות" — ללא מספר מדויק',
    defaultValue: '4',
    allowsClubOverride: true,
  },
  {
    key: 'sla.resolution_hours',
    nameHe: 'זמן תיקון יעד',
    category: 'sla',
    valueType: 'number',
    unit: 'שעות',
    confidence: 'verified',
    sourceReference: 'PDF פרק 14 — "SLA של 24-48 שעות או מכונה חלופית"',
    defaultValue: '48',
    allowsClubOverride: true,
  },
  {
    key: 'sla.uptime_target_pct',
    nameHe: 'יעד זמינות',
    category: 'sla',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 14 ו־15.3 — "מעל 95% מהשעות שהעמדה מוצעת"',
    defaultValue: '0.95',
    allowsClubOverride: true,
  },

  // ═══ יעדי איכות ═══
  {
    key: 'quality.start_success_target_pct',
    nameHe: 'יעד Start Success',
    category: 'quality',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.3 — ">=95% סשנים מתחילים ללא עזרה"',
    defaultValue: '0.95',
  },
  {
    key: 'quality.refund_rate_alert_pct',
    nameHe: 'רף התראה על שיעור זיכויים',
    category: 'quality',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.3 — "פחות מ-3% מהסשנים"',
    defaultValue: '0.03',
  },
  {
    key: 'quality.nps_target',
    nameHe: 'יעד NPS',
    category: 'quality',
    valueType: 'number',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.3 — "מעל 45"',
    defaultValue: '45',
  },
  {
    key: 'quality.d30_retention_target_pct',
    nameHe: 'יעד חזרה תוך 30 יום',
    category: 'quality',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.3 — ">=35% חוזרים בתוך 30 יום"',
    defaultValue: '0.35',
  },
  {
    key: 'quality.paid_hours_per_station_target',
    nameHe: 'יעד שעות בתשלום לעמדה ליום (North Star)',
    category: 'quality',
    valueType: 'number',
    unit: 'שעות',
    confidence: 'verified',
    sourceReference: 'PDF פרק 15.3 ו־23 — ">=1.0-1.5 שעות/יום" כשער מעבר ל־PMF',
    defaultValue: '1.5',
  },

  // ═══ תפעול והתראות ═══
  {
    key: 'ops.device_offline_alert_minutes',
    nameHe: 'התראה על מכונה מנותקת אחרי',
    category: 'ops',
    valueType: 'duration_minutes',
    unit: 'דקות',
    confidence: 'assumed',
    sourceReference: 'סעיף 23 בהנחיות המשימה',
    defaultValue: '10',
  },
  {
    key: 'ops.paid_not_started_alert_minutes',
    nameHe: 'התראה על סשן ששולם ולא התחיל אחרי',
    category: 'ops',
    valueType: 'duration_minutes',
    unit: 'דקות',
    confidence: 'assumed',
    sourceReference: 'הנחה שלי — נגזר מדרישת Start Success',
    defaultValue: '10',
  },
  {
    key: 'ops.battery_low_threshold_pct',
    nameHe: 'רף סוללה נמוכה',
    category: 'ops',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'הנחה שלי',
    defaultValue: '0.20',
  },
  {
    key: 'ops.session_extension_max_minutes',
    nameHe: 'הארכת סשן מקסימלית',
    category: 'ops',
    valueType: 'duration_minutes',
    unit: 'דקות',
    confidence: 'assumed',
    sourceReference: 'הנחה שלי',
    defaultValue: '30',
  },

  // ═══ הגדרות מדדים ═══
  {
    key: 'metrics.active_station_min_sessions_per_week',
    nameHe: 'עמדה פעילה — מינימום סשנים בשבוע',
    category: 'metrics',
    valueType: 'number',
    confidence: 'verified',
    sourceReference: 'PDF פרק 17.1 — "עמדה עם לפחות סשן אחד בשבוע"',
    defaultValue: '1',
  },
  {
    key: 'metrics.active_station_min_uptime_pct',
    nameHe: 'עמדה פעילה — רף זמינות',
    category: 'metrics',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 17.1 אומר "זמינות מעל רף מוגדר" — הרף עצמו לא ננקב',
    defaultValue: '0.90',
  },
  {
    key: 'metrics.activated_user_sessions',
    nameHe: 'משתמש מופעל — מספר סשנים נדרש',
    category: 'metrics',
    valueType: 'number',
    confidence: 'verified',
    sourceReference: 'PDF פרק 17.1 — "השלים שני סשנים בתשלום בתוך 30 יום"',
    defaultValue: '2',
  },
  {
    key: 'metrics.activated_user_window_days',
    nameHe: 'משתמש מופעל — חלון זמן',
    category: 'metrics',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'verified',
    sourceReference: 'PDF פרק 17.1',
    defaultValue: '30',
  },

  // ═══ מדיניות זיכויים ═══
  {
    key: 'refund.approval_threshold_ils',
    nameHe: 'סכום שמעליו זיכוי דורש אישור',
    category: 'refund',
    valueType: 'currency',
    unit: '₪',
    confidence: 'assumed',
    sourceReference: 'סעיף 11 בהנחיות דורש "מאשר מעל רף מוגדר" — הסכום הוא הנחה שלי',
    defaultValue: '200',
  },
  {
    key: 'refund.auto_credit_downtime_minutes',
    nameHe: 'דקות השבתה שמפעילות זיכוי חלקי אוטומטי',
    category: 'refund',
    valueType: 'duration_minutes',
    unit: 'דקות',
    confidence: 'assumed',
    sourceReference: 'סעיף 11 בהנחיות — "השבתה מעל מספר דקות מוגדר"',
    defaultValue: '15',
  },
  {
    key: 'refund.auto_refund_failed_start',
    nameHe: 'זיכוי אוטומטי מלא בכשל התחלה',
    category: 'refund',
    valueType: 'boolean',
    confidence: 'assumed',
    sourceReference: 'סעיף 11 בהנחיות — "Session ששולם ולא התחיל עקב תקלה → בדיקת זיכוי אוטומטי"',
    description: 'כאשר פעיל, סשן שעבר ל־failed_to_start יוצר בקשת זיכוי מלא אוטומטית.',
    defaultValue: 'true',
  },
  {
    key: 'refund.club_anomaly_rate_pct',
    nameHe: 'שיעור זיכויים חריג למועדון',
    category: 'refund',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'סעיף 11 בהנחיות — "שיעור זיכויים חריג → התראת Fraud/Quality"',
    defaultValue: '0.08',
  },

  // ═══ מאמנים ═══
  {
    key: 'coach.referral_bonus_ils',
    nameHe: 'בונוס הפניה חד-פעמי',
    category: 'coach',
    valueType: 'currency',
    unit: '₪',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 10.1 מגדיר "בונוס חד-פעמי" ללא סכום',
    defaultValue: '50',
  },
  {
    key: 'coach.homework_commission_pct',
    nameHe: 'עמלת שיעורי בית',
    category: 'coach',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 10.1 — "5%-10% מההכנסה נטו של הסשן"; אמצע הטווח',
    defaultValue: '0.075',
  },
  {
    key: 'coach.content_royalty_pct',
    nameHe: 'תמלוגי תוכן',
    category: 'coach',
    valueType: 'percentage',
    confidence: 'verified',
    sourceReference: 'PDF פרק 10.1 — "15%-20% מההכנסות נטו של ה-Pool"; אמצע הטווח',
    defaultValue: '0.175',
  },
  {
    key: 'coach.commission_cap_pct_per_customer',
    nameHe: 'תקרת עמלה כוללת ללקוח',
    category: 'coach',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 10.2 — "לעמלה משוקללת Cap קיים" ללא מספר',
    defaultValue: '0.20',
  },
  {
    key: 'coach.attribution_window_days',
    nameHe: 'חלון שיוך לקוח למאמן',
    category: 'coach',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'verified',
    sourceReference: 'PDF פרק 10.2 — "לדוגמה 180 יום"',
    defaultValue: '180',
  },
  {
    key: 'coach.commission_holding_days',
    nameHe: 'תקופת המתנה לפני תשלום עמלה',
    category: 'coach',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 10.2 — "לאחר חלון זיכויים" ללא מספר',
    defaultValue: '30',
  },

  // ═══ Rewards ═══
  {
    key: 'rewards.xp_per_completed_session',
    nameHe: 'XP לסשן שהושלם',
    category: 'rewards',
    valueType: 'number',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 11.2 נותן עקרונות בלבד, ללא מספרים',
    description: 'התוכנית קובעת: אין XP על סשן שלא הושלם, ואין קנייה ישירה של מעמד.',
    defaultValue: '100',
  },
  {
    key: 'rewards.xp_daily_cap',
    nameHe: 'תקרת XP יומית',
    category: 'rewards',
    valueType: 'number',
    confidence: 'verified',
    sourceReference: 'PDF פרק 11.2 — "תקרה יומית למניעת ניצול XP"',
    defaultValue: '300',
  },
  {
    key: 'rewards.points_expiry_days',
    nameHe: 'תפוגת נקודות',
    category: 'rewards',
    valueType: 'number',
    unit: 'ימים',
    confidence: 'assumed',
    sourceReference: 'PDF פרק 11.4 דורש "תוקף, תנאים ושווי פנימי נשלט" ללא מספר',
    defaultValue: '365',
  },

  // ═══ שוק ותחזית ═══
  {
    key: 'market.padel_courts_israel',
    nameHe: 'מגרשי פאדל בישראל',
    category: 'market',
    valueType: 'number',
    confidence: 'assumed',
    sourceReference: 'XLSX ארכיטיפים!B5 = 250 היום, B6 = 350 בעוד שנתיים',
    defaultValue: '350',
  },
  {
    key: 'market.club_penetration_rate',
    nameHe: 'שיעור חדירה למועדונים',
    category: 'market',
    valueType: 'percentage',
    confidence: 'assumed',
    sourceReference: 'XLSX ארכיטיפים!B8',
    defaultValue: '0.70',
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]));

/** מפתחות מוקלדים לשימוש בקוד — טעות כתיב תיתפס בקומפילציה */
export type SettingKey = (typeof SETTINGS)[number]['key'];
