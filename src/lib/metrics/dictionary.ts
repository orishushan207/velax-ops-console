/**
 * Metric Dictionary — סעיף 27 בהנחיות.
 *
 * מקור אמת יחיד להגדרת כל מדד במערכת. מטרתו למנוע מצב שבו שני מסכים
 * מציגים "Uptime" ומתכוונים לשני דברים שונים.
 *
 * כל מדד נטען ל־metric_definitions ב־Seed, וה־Tooltip בכל כרטיס KPI
 * נשלף מכאן ולא נכתב inline.
 */

export interface MetricDef {
  key: string;
  nameHe: string;
  definition: string;
  formula: string;
  dataSource: string;
  ownerRole: string;
  updateFrequency: 'realtime' | 'hourly' | 'daily' | 'monthly';
  unit?: string;
  tooltipHe: string;
  /** אזהרת שימוש — למשל: אסור להציג כהוכחת שיפור מקצועי */
  cautionHe?: string;
  version: number;
}

export const METRICS: MetricDef[] = [
  {
    key: 'paid_training_hours_per_active_station_per_day',
    nameHe: 'שעות אימון בתשלום לעמדה פעילה ליום',
    definition:
      'מדד ה־North Star. סך שעות האימון בסשנים שהושלמו ושולמו, חלקי מספר העמדות הפעילות כפול ימי התקופה.',
    formula:
      'Σ(actual_minutes של סשנים completed שאינם fully_refunded) / 60 ÷ (מספר עמדות פעילות × ימים בתקופה)',
    dataSource: 'sessions, stations',
    ownerRole: 'Product',
    updateFrequency: 'daily',
    unit: 'שעות',
    tooltipHe:
      'המדד המוביל של VELA-X. התוכנית העסקית קובעת ששער המעבר ל־PMF הוא 1.0–1.5 שעות ליום לעמדה. נספרות רק שעות מסשנים שהושלמו, שולמו ולא זוכו במלואם.',
    version: 1,
  },
  {
    key: 'paid_session',
    nameHe: 'סשן בתשלום',
    definition: 'סשן שהתשלום עבורו נקלט, שהופעל בפועל, ושלא זוכה במלואו.',
    formula:
      "status ∈ {active, paused, completed, partially_refunded} AND קיים payment עם status='captured' AND refunded_amount < amount_gross",
    dataSource: 'sessions, payments, refunds',
    ownerRole: 'Product',
    updateFrequency: 'realtime',
    tooltipHe:
      'סשן שזוכה במלואו אינו נספר כסשן בתשלום — לא בהכנסות, לא בשעות ולא ב־Retention. זהו כלל מחייב בסעיף 33 בהנחיות.',
    version: 1,
  },
  {
    key: 'active_station',
    nameHe: 'עמדה פעילה',
    definition: 'עמדה עם לפחות סשן אחד בשבוע וזמינות מעל הרף המוגדר.',
    formula:
      'station.status = active AND סשנים בתשלום בשבוע ≥ metrics.active_station_min_sessions_per_week AND uptime ≥ metrics.active_station_min_uptime_pct',
    dataSource: 'stations, sessions, support_tickets',
    ownerRole: 'Operations',
    updateFrequency: 'daily',
    tooltipHe:
      'עמדה מותקנת אינה בהכרח עמדה פעילה. שני הרפים — מספר סשנים וזמינות — ניתנים לשינוי במסך ההגדרות.',
    version: 1,
  },
  {
    key: 'start_success_rate',
    nameHe: 'שיעור התחלות מוצלחות',
    definition: 'אחוז הסשנים ששולמו והתחילו ללא עזרת צוות וללא כשל.',
    formula:
      'סשנים שהגיעו ל־active עם started_without_staff_help = true ÷ כל הסשנים שהגיעו למצב paid',
    dataSource: 'sessions, session_events',
    ownerRole: 'Engineering',
    updateFrequency: 'realtime',
    unit: '%',
    tooltipHe:
      'יעד התוכנית: ≥95%. זהו המדד שקובע אם המוצר עובד בלי מלווה. ירידה מתחת ליעד מפעילה התראה.',
    version: 1,
  },
  {
    key: 'uptime',
    nameHe: 'זמינות',
    definition:
      'אחוז השעות שבהן העמדה הייתה אמורה להיות זמינה ואכן הייתה מסוגלת לפעול.',
    formula: '(שעות זמינות מתוכננות − דקות השבתה ÷ 60) ÷ שעות זמינות מתוכננות',
    dataSource: 'stations, club_operating_hours, support_tickets.downtime_minutes',
    ownerRole: 'Operations',
    updateFrequency: 'hourly',
    unit: '%',
    tooltipHe:
      'Downtime הוא זמן שבו העמדה אמורה להיות זמינה אך אינה מסוגלת לפעול. יעד ההסכם: ≥95%.',
    version: 1,
  },
  {
    key: 'activated_user',
    nameHe: 'משתמש מופעל',
    definition: 'משתמש שהשלים שני סשנים בתשלום בתוך 30 יום מהסשן הראשון.',
    formula: 'COUNT(סשנים בתשלום שהושלמו) ≥ 2 בתוך חלון של 30 יום',
    dataSource: 'sessions',
    ownerRole: 'Product',
    updateFrequency: 'daily',
    tooltipHe:
      'לפי פרק 17.1 בתוכנית. שני הפרמטרים — מספר הסשנים וגודל החלון — ניתנים לשינוי בהגדרות.',
    version: 1,
  },
  {
    key: 'retained_user',
    nameHe: 'משתמש חוזר',
    definition: 'משתמש שחזר והשלים סשן נוסף בתוך חלון הזמן שנקבע (D7 / D30 / D90).',
    formula:
      'קיים סשן בתשלום שהושלם בתוך N ימים מהסשן הראשון של המשתמש. פתיחת האפליקציה אינה נספרת.',
    dataSource: 'sessions',
    ownerRole: 'Product',
    updateFrequency: 'daily',
    unit: '%',
    tooltipHe:
      'הגדרת התוכנית מדגישה: "חזר בחלון הזמן שנקבע; לא רק פתח אפליקציה". יעד D30: ≥35%.',
    version: 1,
  },
  {
    key: 'machine_linked_court_revenue',
    nameHe: 'הכנסת מגרש מקושרת למכונה',
    definition: 'הכנסה מהזמנת מגרש שיש לה Session ID תואם.',
    formula: 'Σ(court_bookings.revenue_net) WHERE session_id IS NOT NULL',
    dataSource: 'court_bookings, sessions',
    ownerRole: 'Club Success',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe:
      'זו הכנסת המועדון, לא הכנסת VELA-X. היא הבסיס לחישוב Earn-Back — אבל רק החלק שסווג כאינקרמנטלי נספר בפועל.',
    cautionHe:
      'אין להציג מדד זה כהכנסה של VELA-X. הכנסה מקושרת אינה בהכרח הכנסה אינקרמנטלית.',
    version: 1,
  },
  {
    key: 'incremental_court_revenue',
    nameHe: 'הכנסת מגרש אינקרמנטלית',
    definition:
      'הכנסת המגרש שסווגה כהכנסה שלא הייתה מתקיימת ללא המכונה, או שחושבה לפי מקדם האינקרמנטליות.',
    formula:
      'Σ(revenue_net WHERE link_type = incremental) + Σ(revenue_net WHERE link_type = machine_linked) × earnback.incrementality_factor',
    dataSource: 'court_bookings, business_settings',
    ownerRole: 'Club Success',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe:
      'מקדם האינקרמנטליות (ברירת מחדל 70%) הוא הנחה שדורשת אימות בפיילוט. הוא ניתן לשינוי לכל הסכם בנפרד.',
    version: 1,
  },
  {
    key: 'downtime',
    nameHe: 'זמן השבתה',
    definition: 'זמן שבו עמדה אמורה להיות זמינה אך אינה מסוגלת לפעול.',
    formula: 'Σ(support_tickets.downtime_minutes) בחפיפה לשעות הפעילות של המועדון',
    dataSource: 'support_tickets, club_operating_hours',
    ownerRole: 'Operations',
    updateFrequency: 'realtime',
    unit: 'דקות',
    tooltipHe: 'השבתה מעל הרף המוגדר מפעילה בדיקת זיכוי חלקי אוטומטי.',
    version: 1,
  },
  {
    key: 'contribution_per_hour',
    nameHe: 'תרומה לשעת שימוש',
    definition:
      'ההכנסה נטו לשעה בניכוי כל העלויות המשתנות הישירות. אינה רווח — אינה כוללת הוצאות קבועות.',
    formula:
      'הכנסה נטו − (סליקה + קרן תגמולים + עמלות מאמנים + זיכויים וסיכון + כדורים ובלאי + ענן + חלפים + רזרבת אחריות)',
    dataSource: 'business_settings, sessions, payments',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe:
      'שחזור מדויק של גיליון "כלכלת יחידה" במודל. בהנחות התוכנית: 51.66 ₪. בתרחיש ריאלי: 38.16 ₪.',
    cautionHe:
      'תרומה אינה רווח. שכר הטכנאי אינו נכלל כאן אלא בהוצאה הקבועה — אחרת הוא נספר פעמיים.',
    version: 1,
  },
  {
    key: 'contribution_margin',
    nameHe: 'שיעור תרומה',
    definition: 'התרומה לשעה כאחוז מההכנסה נטו לשעה.',
    formula: 'תרומה לשעה ÷ הכנסה נטו לשעה',
    dataSource: 'business_settings',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: '%',
    tooltipHe: 'בהנחות התוכנית 67.7%; בתרחיש ריאלי 50.0%; בשמרני 34.3%.',
    version: 1,
  },
  {
    key: 'refund_rate',
    nameHe: 'שיעור זיכויים',
    definition: 'אחוז הסשנים בתשלום שקיבלו זיכוי כלשהו.',
    formula: 'סשנים עם refunded_amount > 0 ÷ סשנים בתשלום',
    dataSource: 'sessions, refunds',
    ownerRole: 'Support',
    updateFrequency: 'realtime',
    unit: '%',
    tooltipHe: 'יעד התוכנית: מתחת ל־3%. חריגה מפעילה התראת Quality.',
    version: 1,
  },
  {
    key: 'off_peak_uplift',
    nameHe: 'Off-Peak Uplift',
    definition: 'שיעור שעות האימון שהתרחשו בחלון ה־Off-Peak של המועדון.',
    formula: 'שעות בתשלום ב־off_peak ÷ סך השעות בתשלום',
    dataSource: 'sessions, clubs.off_peak_start/end',
    ownerRole: 'Club Success',
    updateFrequency: 'daily',
    unit: '%',
    tooltipHe:
      'הצעת הערך המרכזית למועדון היא מילוי שעות שפל. חלון ה־Off-Peak מוגדר לכל מועדון בנפרד.',
    version: 1,
  },
  {
    key: 'earn_back_exposure',
    nameHe: 'חשיפת Earn-Back',
    definition: 'הסכום שבו VELA-X עלולה לשאת אם המועדון לא יעמוד ביעד ההחזר.',
    formula:
      'Σ(MAX(0, entry_price − counted_revenue)) על פני כל ההסכמים הפעילים, מוגבל ב־exposure_cap',
    dataSource: 'earn_back_agreements, earn_back_measurements',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe:
      'המודל מזהיר: הסיכון מתואם — אם הביקוש חלש, כל המועדונים נכשלים באותו רגע. זו אינה חשיפה מפוזרת.',
    version: 1,
  },
  {
    key: 'rewards_liability',
    nameHe: 'התחייבות Rewards שטרם מומשה',
    definition: 'העלות הכספית של נקודות והטבות שנצברו ועדיין לא מומשו ולא פגו.',
    formula: 'Σ(cost_to_company של תנועות earn) − Σ(של תנועות redeem ו־expire)',
    dataSource: 'rewards_transactions',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe: 'קרן התגמולים מתוקצבת ב־6% מההכנסה נטו. ההתחייבות היא מה שנצבר ועדיין פתוח.',
    version: 1,
  },
  {
    key: 'arpu',
    nameHe: 'הכנסה ממוצעת למשתמש',
    definition: 'הכנסה נטו חלקי מספר המשתמשים הפעילים בתקופה.',
    formula: 'Σ(sessions.amount_net − זיכויים) ÷ COUNT(DISTINCT user_id)',
    dataSource: 'sessions, refunds',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: '₪',
    tooltipHe: 'לפני מע״מ. אורח (Guest) נספר כמשתמש נפרד לפי מספר טלפון.',
    version: 1,
  },
  {
    key: 'cac',
    nameHe: 'עלות רכישת לקוח',
    definition: 'הוצאת השיווק בתקופה חלקי מספר המשתמשים החדשים שרכשו.',
    formula: 'הוצאת שיווק בתקופה ÷ משתמשים חדשים עם סשן בתשלום',
    dataSource: 'הזנה ידנית של תקציב שיווק, sessions',
    ownerRole: 'Marketing',
    updateFrequency: 'monthly',
    unit: '₪',
    tooltipHe:
      'לא קיים נתון הוצאת שיווק באף אחד ממסמכי המקור. עד להזנת תקציב שיווק המדד אינו מחושב ומוצג כ"אין נתונים".',
    cautionHe: 'דורש הזנת תקציב שיווק חודשי. ללא הזנה — לא מוצג ערך מומצא.',
    version: 1,
  },
  {
    key: 'ltv',
    nameHe: 'ערך חיי לקוח',
    definition: 'התרומה המצטברת הצפויה ממשתמש לאורך חייו במערכת.',
    formula: 'סשנים ממוצעים למשתמש × תרומה לשעה × מקדם שימור',
    dataSource: 'sessions, business_settings',
    ownerRole: 'Finance',
    updateFrequency: 'monthly',
    unit: '₪',
    tooltipHe:
      'מבוסס תרומה ולא הכנסה. עם 90 יום בלבד של נתונים, ההערכה תנודתית — הצג אותה כטווח ולא כמספר יחיד.',
    version: 1,
  },
  {
    key: 'payback_period',
    nameHe: 'תקופת החזר על רכישת לקוח',
    definition: 'כמה חודשים לוקח עד שהתרומה מהלקוח מכסה את עלות רכישתו.',
    formula: 'CAC ÷ תרומה חודשית ממוצעת ללקוח',
    dataSource: 'CAC, sessions',
    ownerRole: 'Finance',
    updateFrequency: 'monthly',
    unit: 'חודשים',
    tooltipHe: 'תלוי ב־CAC. ללא נתוני תקציב שיווק אינו מחושב.',
    version: 1,
  },
  {
    key: 'break_even_stations',
    nameHe: 'עמדות לנקודת איזון',
    definition:
      'כמה עמדות פעילות דרושות כדי שהתרומה תכסה את ההוצאה השנתית הקבועה.',
    formula: 'הוצאה שנתית קבועה ÷ (תרומה לשעה × שעות בתשלום ליום × ימי פעילות בשנה)',
    dataSource: 'business_settings',
    ownerRole: 'Finance',
    updateFrequency: 'daily',
    unit: 'עמדות',
    tooltipHe:
      'שחזור גיליון "נקודת איזון". בארכיטיפ רזה ו־1.5 שעות ליום: כ־30 עמדות. תקרת השוק הישראלי המחושבת: 98 עמדות.',
    version: 1,
  },
  {
    key: 'club_health_score',
    nameHe: 'ציון בריאות מועדון',
    definition: 'ציון משוקלל 0–100 המסכם את מצב המועדון על פני עשרה ממדים.',
    formula:
      'Σ(ציון רכיב × משקל) — זמינות, שעות שימוש, מגמת שימוש, תקלות, SLA, פעילות צוות, Checklist, טעינה וכדורים, שיווק והצגה, עמידה ב־Earn-Back',
    dataSource: 'stations, sessions, support_tickets, checklist_submissions, earn_back_agreements',
    ownerRole: 'Club Success',
    updateFrequency: 'daily',
    tooltipHe:
      'הנוסחה והמשקלים שקופים וניתנים לשינוי במסך ההגדרות. לחיצה על הציון מציגה את פירוק הרכיבים.',
    version: 1,
  },
  {
    key: 'sessions_per_user',
    nameHe: 'סשנים למשתמש',
    definition: 'ממוצע סשנים בתשלום למשתמש פעיל בתקופה.',
    formula: 'סשנים בתשלום ÷ משתמשים ייחודיים',
    dataSource: 'sessions',
    ownerRole: 'Product',
    updateFrequency: 'daily',
    tooltipHe: 'מדד עומק שימוש. נספרים רק סשנים שהושלמו ולא זוכו במלואם.',
    cautionHe:
      'מספר סשנים ושעות אימון אינם הוכחה לשיפור מקצועי. אסור להציג אותם ככאלה — כלל מוצרי מפרק 5.4 בתוכנית.',
    version: 1,
  },
  {
    key: 'mttr',
    nameHe: 'זמן טיפול ממוצע בתקלה',
    definition: 'הזמן הממוצע מפתיחת קריאת שירות ועד לפתרונה.',
    formula: 'AVG(resolved_at − created_at) על קריאות שנפתרו בתקופה',
    dataSource: 'support_tickets',
    ownerRole: 'Operations',
    updateFrequency: 'realtime',
    unit: 'שעות',
    tooltipHe: 'התחייבות ההסכם: תיקון תוך 24–48 שעות או אספקת מכונה חלופית.',
    version: 1,
  },
  {
    key: 'nps',
    nameHe: 'NPS',
    definition: 'Net Promoter Score — אחוז ממליצים פחות אחוז מבקרים.',
    formula: '(% ציונים 9-10) − (% ציונים 0-6)',
    dataSource: 'סקרי שחקנים',
    ownerRole: 'Product',
    updateFrequency: 'monthly',
    tooltipHe:
      'יעד התוכנית: מעל 45. אין מנגנון איסוף NPS במערכת הנוכחית — המדד מוצג כ"אין נתונים" עד לחיבור סקר.',
    cautionHe: 'דורש מנגנון איסוף שטרם נבנה. לא מוצג ערך מומצא.',
    version: 1,
  },
];

export const METRICS_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export function metricTooltip(key: string): string | undefined {
  return METRICS_BY_KEY.get(key)?.tooltipHe;
}

export function metricCaution(key: string): string | undefined {
  return METRICS_BY_KEY.get(key)?.cautionHe;
}
