/**
 * תרגום כל ה־enums לעברית + צבע סמנטי לתצוגה.
 * מקור אמת יחיד — אין מחרוזות עברית מפוזרות בקומפוננטות.
 *
 * tone: neutral | positive | warning | danger | info | muted
 */
export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'muted';

export interface LabelDef {
  he: string;
  tone: Tone;
}

function dict<T extends string>(map: Record<T, LabelDef>) {
  return {
    map,
    label: (key: T | null | undefined): string => (key ? (map[key]?.he ?? key) : '—'),
    tone: (key: T | null | undefined): Tone => (key ? (map[key]?.tone ?? 'neutral') : 'muted'),
    options: () => (Object.keys(map) as T[]).map((k) => ({ value: k, label: map[k].he })),
  };
}

export const sessionStatus = dict({
  draft: { he: 'טיוטה', tone: 'muted' },
  awaiting_payment: { he: 'ממתין לתשלום', tone: 'warning' },
  paid: { he: 'שולם', tone: 'info' },
  authorized: { he: 'מאושר', tone: 'info' },
  connecting: { he: 'מתחבר', tone: 'info' },
  active: { he: 'פעיל', tone: 'positive' },
  paused: { he: 'מושהה', tone: 'warning' },
  completed: { he: 'הושלם', tone: 'positive' },
  failed_to_start: { he: 'כשל בהתחלה', tone: 'danger' },
  interrupted: { he: 'הופסק', tone: 'danger' },
  cancelled: { he: 'בוטל', tone: 'muted' },
  partially_refunded: { he: 'זוכה חלקית', tone: 'warning' },
  fully_refunded: { he: 'זוכה במלואו', tone: 'danger' },
  disputed: { he: 'במחלוקת', tone: 'danger' },
} as const);

export const clubStatus = dict({
  prospect: { he: 'ליד', tone: 'muted' },
  pilot: { he: 'פיילוט', tone: 'info' },
  active: { he: 'פעיל', tone: 'positive' },
  paused: { he: 'מושהה', tone: 'warning' },
  churned: { he: 'נטש', tone: 'danger' },
} as const);

export const stationStatus = dict({
  planned: { he: 'מתוכננת', tone: 'muted' },
  installing: { he: 'בהתקנה', tone: 'info' },
  active: { he: 'פעילה', tone: 'positive' },
  suspended: { he: 'מושבתת', tone: 'danger' },
  decommissioned: { he: 'גרוטה', tone: 'muted' },
} as const);

export const stationType = dict({
  lean: { he: 'עמדה רזה', tone: 'neutral' },
  full: { he: 'עמדה מלאה', tone: 'neutral' },
} as const);

export const deviceStatus = dict({
  in_stock: { he: 'במלאי', tone: 'muted' },
  active: { he: 'פעילה', tone: 'positive' },
  maintenance: { he: 'בתחזוקה', tone: 'warning' },
  offline: { he: 'מנותקת', tone: 'danger' },
  quarantined: { he: 'בבידוד', tone: 'danger' },
  retired: { he: 'גרוטה', tone: 'muted' },
  lost: { he: 'אבודה', tone: 'danger' },
} as const);

export const deviceConnectivity = dict({
  online: { he: 'מחוברת', tone: 'positive' },
  offline: { he: 'מנותקת', tone: 'danger' },
  unknown: { he: 'לא ידוע', tone: 'muted' },
} as const);

export const paymentStatus = dict({
  pending: { he: 'ממתין', tone: 'warning' },
  authorized: { he: 'מאושר', tone: 'info' },
  captured: { he: 'נגבה', tone: 'positive' },
  failed: { he: 'נכשל', tone: 'danger' },
  voided: { he: 'בוטל', tone: 'muted' },
  refunded: { he: 'זוכה', tone: 'danger' },
  partially_refunded: { he: 'זוכה חלקית', tone: 'warning' },
  chargeback: { he: 'Chargeback', tone: 'danger' },
} as const);

export const paymentMethod = dict({
  card: { he: 'כרטיס אשראי', tone: 'neutral' },
  apple_pay: { he: 'Apple Pay', tone: 'neutral' },
  google_pay: { he: 'Google Pay', tone: 'neutral' },
  wallet_credit: { he: 'קרדיט בארנק', tone: 'neutral' },
  club_staff_manual: { he: 'ידני — צוות מועדון', tone: 'warning' },
  coupon_full: { he: 'קופון מלא', tone: 'neutral' },
} as const);

export const refundStatus = dict({
  pending_approval: { he: 'ממתין לאישור', tone: 'warning' },
  approved: { he: 'אושר', tone: 'info' },
  rejected: { he: 'נדחה', tone: 'muted' },
  processing: { he: 'בביצוע', tone: 'info' },
  completed: { he: 'הושלם', tone: 'positive' },
  failed: { he: 'נכשל', tone: 'danger' },
} as const);

export const refundReason = dict({
  failed_to_start: { he: 'הסשן לא התחיל', tone: 'danger' },
  device_malfunction: { he: 'תקלת מכונה', tone: 'danger' },
  station_unavailable: { he: 'עמדה לא זמינה', tone: 'danger' },
  ble_failure: { he: 'כשל חיבור BLE', tone: 'danger' },
  ball_shortage: { he: 'חוסר כדורים', tone: 'warning' },
  safety_incident: { he: 'אירוע בטיחות', tone: 'danger' },
  double_charge: { he: 'חיוב כפול', tone: 'danger' },
  customer_request: { he: 'בקשת לקוח', tone: 'neutral' },
  club_request: { he: 'בקשת מועדון', tone: 'neutral' },
  goodwill: { he: 'מחווה ללקוח', tone: 'info' },
  billing_error: { he: 'שגיאת חיוב', tone: 'warning' },
  chargeback_settlement: { he: 'הסדר Chargeback', tone: 'danger' },
  other: { he: 'אחר', tone: 'neutral' },
} as const);

export const refundType = dict({
  full: { he: 'זיכוי מלא', tone: 'danger' },
  partial: { he: 'זיכוי חלקי', tone: 'warning' },
} as const);

export const refundDestination = dict({
  original_method: { he: 'חזרה לאמצעי התשלום', tone: 'neutral' },
  wallet: { he: 'קרדיט לארנק', tone: 'neutral' },
} as const);

export const ticketStatus = dict({
  new: { he: 'חדשה', tone: 'danger' },
  triaged: { he: 'מוינה', tone: 'warning' },
  assigned: { he: 'הוקצתה', tone: 'info' },
  waiting_for_club: { he: 'ממתין למועדון', tone: 'warning' },
  waiting_for_customer: { he: 'ממתין ללקוח', tone: 'warning' },
  waiting_for_part: { he: 'ממתין לחלק', tone: 'warning' },
  technician_scheduled: { he: 'טכנאי מתוזמן', tone: 'info' },
  in_progress: { he: 'בטיפול', tone: 'info' },
  resolved: { he: 'נפתרה', tone: 'positive' },
  closed: { he: 'סגורה', tone: 'muted' },
  reopened: { he: 'נפתחה מחדש', tone: 'danger' },
} as const);

export const ticketSeverity = dict({
  low: { he: 'נמוכה', tone: 'muted' },
  medium: { he: 'בינונית', tone: 'info' },
  high: { he: 'גבוהה', tone: 'warning' },
  critical: { he: 'קריטית / בטיחות', tone: 'danger' },
} as const);

export const ticketCategory = dict({
  ble: { he: 'BLE', tone: 'neutral' },
  firmware: { he: 'Firmware', tone: 'neutral' },
  battery: { he: 'סוללה', tone: 'neutral' },
  charger: { he: 'מטען', tone: 'neutral' },
  feed_motor: { he: 'מנוע הזנה', tone: 'neutral' },
  wheels: { he: 'גלגלים', tone: 'neutral' },
  remote: { he: 'שלט', tone: 'neutral' },
  balls: { he: 'כדורים', tone: 'neutral' },
  lock: { he: 'נעילה', tone: 'neutral' },
  screen: { he: 'מסך', tone: 'neutral' },
  qr_nfc: { he: 'QR / NFC', tone: 'neutral' },
  payment: { he: 'סליקה', tone: 'neutral' },
  app: { he: 'אפליקציה', tone: 'neutral' },
  backend: { he: 'Backend', tone: 'neutral' },
  safety: { he: 'בטיחות', tone: 'danger' },
  physical_damage: { he: 'נזק פיזי', tone: 'danger' },
  theft_loss: { he: 'גניבה או אובדן', tone: 'danger' },
  other: { he: 'אחר', tone: 'neutral' },
} as const);

export const ticketSource = dict({
  player_app: { he: 'אפליקציית שחקן', tone: 'neutral' },
  club_staff: { he: 'צוות מועדון', tone: 'neutral' },
  ops_console: { he: 'Ops Console', tone: 'neutral' },
  telemetry_auto: { he: 'טלמטריה אוטומטית', tone: 'info' },
  support_agent: { he: 'נציג תמיכה', tone: 'neutral' },
  automation_rule: { he: 'כלל אוטומציה', tone: 'info' },
} as const);

export const earnBackStatus = dict({
  draft: { he: 'טיוטה', tone: 'muted' },
  active: { he: 'פעילה', tone: 'info' },
  met: { he: 'הושגה', tone: 'positive' },
  at_risk: { he: 'בסיכון', tone: 'warning' },
  breached_by_club: { he: 'הפרה של המועדון', tone: 'danger' },
  settled_topup: { he: 'הוסדרה בהשלמת פער', tone: 'neutral' },
  settled_buyback: { he: 'הוסדרה ב־Buyback', tone: 'danger' },
  cancelled: { he: 'בוטלה', tone: 'muted' },
} as const);

export const earnBackConditionStatus = dict({
  met: { he: 'עומד בתנאי', tone: 'positive' },
  not_met: { he: 'אינו עומד', tone: 'danger' },
  waived: { he: 'ויתור', tone: 'muted' },
  not_measured: { he: 'טרם נמדד', tone: 'muted' },
} as const);

export const bookingLinkType = dict({
  machine_linked: { he: 'מקושרת למכונה', tone: 'info' },
  incremental: { he: 'אינקרמנטלית', tone: 'positive' },
  baseline: { he: 'בסיסית — לא נספרת', tone: 'muted' },
  unverified: { he: 'לא אומתה', tone: 'warning' },
} as const);

export const leadStage = dict({
  lead: { he: 'ליד', tone: 'muted' },
  contacted: { he: 'יצרנו קשר', tone: 'muted' },
  qualified: { he: 'הוסמך', tone: 'info' },
  demo_scheduled: { he: 'הדגמה נקבעה', tone: 'info' },
  demo_completed: { he: 'הדגמה בוצעה', tone: 'info' },
  proposal_sent: { he: 'הצעה נשלחה', tone: 'info' },
  negotiation: { he: 'משא ומתן', tone: 'warning' },
  pilot_agreed: { he: 'סוכם פיילוט', tone: 'positive' },
  contract_sent: { he: 'חוזה נשלח', tone: 'info' },
  contract_signed: { he: 'חוזה נחתם', tone: 'positive' },
  installation_scheduled: { he: 'התקנה תוזמנה', tone: 'positive' },
  live: { he: 'פעיל', tone: 'positive' },
  lost: { he: 'אבד', tone: 'danger' },
  on_hold: { he: 'בהמתנה', tone: 'muted' },
} as const);

export const maintenanceTaskStatus = dict({
  scheduled: { he: 'מתוזמן', tone: 'muted' },
  due: { he: 'הגיע מועד', tone: 'warning' },
  overdue: { he: 'באיחור', tone: 'danger' },
  in_progress: { he: 'בביצוע', tone: 'info' },
  completed: { he: 'הושלם', tone: 'positive' },
  skipped: { he: 'דולג', tone: 'muted' },
} as const);

export const maintenanceTrigger = dict({
  calendar: { he: 'לפי זמן', tone: 'neutral' },
  operating_hours: { he: 'לפי שעות עבודה', tone: 'neutral' },
  session_count: { he: 'לפי מספר סשנים', tone: 'neutral' },
  ball_count: { he: 'לפי מספר כדורים', tone: 'neutral' },
  event_based: { he: 'לפי אירוע חריג', tone: 'neutral' },
} as const);

export const checklistFrequency = dict({
  daily: { he: 'יומי', tone: 'neutral' },
  weekly: { he: 'שבועי', tone: 'neutral' },
  monthly: { he: 'חודשי', tone: 'neutral' },
} as const);

export const checklistSubmissionStatus = dict({
  pending: { he: 'ממתין', tone: 'warning' },
  completed: { he: 'בוצע', tone: 'positive' },
  completed_with_issues: { he: 'בוצע עם חריגות', tone: 'warning' },
  missed: { he: 'לא בוצע', tone: 'danger' },
} as const);

export const inventoryCategory = dict({
  machine: { he: 'מכונה', tone: 'neutral' },
  spare_machine: { he: 'מכונה חלופית', tone: 'neutral' },
  balls: { he: 'כדורים', tone: 'neutral' },
  charger: { he: 'מטען', tone: 'neutral' },
  battery: { he: 'סוללה', tone: 'neutral' },
  wheels: { he: 'גלגלים', tone: 'neutral' },
  motor: { he: 'מנוע', tone: 'neutral' },
  cables: { he: 'כבלים', tone: 'neutral' },
  remote: { he: 'שלט', tone: 'neutral' },
  qr_nfc_tag: { he: 'תג QR/NFC', tone: 'neutral' },
  screen: { he: 'מסך', tone: 'neutral' },
  stand_part: { he: 'חלק סטנד', tone: 'neutral' },
  safety_equipment: { he: 'ציוד בטיחות', tone: 'neutral' },
  other: { he: 'אחר', tone: 'neutral' },
} as const);

export const inventoryMovementType = dict({
  purchase_in: { he: 'קליטת רכש', tone: 'positive' },
  transfer: { he: 'העברה', tone: 'neutral' },
  allocate_technician: { he: 'הקצאה לטכנאי', tone: 'info' },
  consume_ticket: { he: 'שימוש בקריאת שירות', tone: 'warning' },
  consume_maintenance: { he: 'שימוש בתחזוקה', tone: 'warning' },
  return: { he: 'החזרה', tone: 'neutral' },
  write_off: { he: 'גריעה', tone: 'danger' },
  stock_count_adjust: { he: 'התאמת ספירה', tone: 'warning' },
} as const);

export const shotSequence = dict({
  fixed: { he: 'רצף קבוע', tone: 'neutral' },
  random: { he: 'אקראי', tone: 'neutral' },
} as const);

export const contentStatus = dict({
  draft: { he: 'טיוטה', tone: 'muted' },
  review: { he: 'בבדיקה', tone: 'warning' },
  published: { he: 'פורסם', tone: 'positive' },
  archived: { he: 'בארכיון', tone: 'muted' },
} as const);

export const drillType = dict({
  single_stroke: { he: 'מכה בודדת', tone: 'neutral' },
  combination: { he: 'קומבינציה', tone: 'neutral' },
  custom_drill: { he: 'תרגיל מותאם', tone: 'neutral' },
  program: { he: 'תוכנית אימון', tone: 'neutral' },
  coach_homework: { he: 'שיעורי בית', tone: 'neutral' },
  quick_start: { he: 'Quick Start', tone: 'neutral' },
  challenge: { he: 'אתגר', tone: 'neutral' },
  screen_content: { he: 'תוכן למסך', tone: 'neutral' },
} as const);

export const coachVerification = dict({
  pending: { he: 'ממתין לאימות', tone: 'warning' },
  verified: { he: 'מאומת', tone: 'positive' },
  rejected: { he: 'נדחה', tone: 'danger' },
  suspended: { he: 'מושעה', tone: 'danger' },
} as const);

export const commissionStatus = dict({
  accrued: { he: 'נצברה', tone: 'info' },
  holding_period: { he: 'בתקופת המתנה', tone: 'warning' },
  approved: { he: 'אושרה', tone: 'info' },
  paid: { he: 'שולמה', tone: 'positive' },
  clawed_back: { he: 'הוחזרה', tone: 'danger' },
  rejected: { he: 'נדחתה', tone: 'muted' },
} as const);

export const attributionType = dict({
  referral: { he: 'הפניה', tone: 'neutral' },
  retention: { he: 'שימור', tone: 'neutral' },
  homework: { he: 'שיעורי בית', tone: 'neutral' },
  content_royalty: { he: 'תמלוגי תוכן', tone: 'neutral' },
} as const);

export const membershipTier = dict({
  X1: { he: 'X1 · MEMBER', tone: 'muted' },
  X2: { he: 'X2 · DRIVE', tone: 'info' },
  X3: { he: 'X3 · PRO', tone: 'info' },
  X4: { he: 'X4 · ELITE', tone: 'positive' },
  X5: { he: 'X5 · ICON', tone: 'positive' },
} as const);

export const dominantHand = dict({
  right: { he: 'יד ימין', tone: 'neutral' },
  left: { he: 'יד שמאל', tone: 'neutral' },
  unknown: { he: 'לא ידוע', tone: 'muted' },
} as const);

export const playerLevel = dict({
  '1': { he: 'רמה 1 · מתחיל', tone: 'muted' },
  '2': { he: 'רמה 2 · בינוני', tone: 'info' },
  '3': { he: 'רמה 3 · מתקדם', tone: 'positive' },
} as const);

export const userStatus = dict({
  active: { he: 'פעיל', tone: 'positive' },
  invited: { he: 'הוזמן', tone: 'info' },
  suspended: { he: 'מושעה', tone: 'warning' },
  blocked: { he: 'חסום', tone: 'danger' },
  deleted: { he: 'נמחק', tone: 'muted' },
} as const);

export const pricingModel = dict({
  setup_fee_usage: { he: 'דמי הקמה + גבייה לפי שעה', tone: 'neutral' },
  monthly_subscription: { he: 'דמי שימוש חודשיים', tone: 'neutral' },
  hybrid: { he: 'היברידי', tone: 'neutral' },
} as const);

export const contractStatus = dict({
  draft: { he: 'טיוטה', tone: 'muted' },
  sent: { he: 'נשלח', tone: 'info' },
  signed: { he: 'נחתם', tone: 'positive' },
  active: { he: 'פעיל', tone: 'positive' },
  expired: { he: 'פג תוקף', tone: 'warning' },
  terminated: { he: 'בוטל', tone: 'danger' },
} as const);

export const notificationSeverity = dict({
  info: { he: 'מידע', tone: 'info' },
  warning: { he: 'אזהרה', tone: 'warning' },
  critical: { he: 'קריטי', tone: 'danger' },
} as const);

export const scenario = dict({
  plan: { he: 'תוכנית', tone: 'positive' },
  realistic: { he: 'ריאלי', tone: 'warning' },
  conservative: { he: 'שמרני', tone: 'danger' },
} as const);

export const settingConfidence = dict({
  verified: { he: 'מאומת', tone: 'positive' },
  assumed: { he: 'הנחה', tone: 'warning' },
  disputed: { he: 'סתירה בין מסמכים', tone: 'danger' },
} as const);

export const purchaseChannel = dict({
  station_qr: { he: 'סריקת QR בעמדה', tone: 'neutral' },
  station_nfc: { he: 'NFC בעמדה', tone: 'neutral' },
  app: { he: 'אפליקציה', tone: 'neutral' },
  coach_link: { he: 'קישור ממאמן', tone: 'neutral' },
  club_staff: { he: 'צוות מועדון', tone: 'neutral' },
  referral: { he: 'הפניה', tone: 'neutral' },
} as const);

export const peakWindow = dict({
  peak: { he: 'שעת שיא', tone: 'warning' },
  off_peak: { he: 'Off-Peak', tone: 'positive' },
} as const);

export const taskStatus = dict({
  open: { he: 'פתוחה', tone: 'warning' },
  in_progress: { he: 'בביצוע', tone: 'info' },
  done: { he: 'הושלמה', tone: 'positive' },
  cancelled: { he: 'בוטלה', tone: 'muted' },
} as const);

export const taskPriority = dict({
  low: { he: 'נמוכה', tone: 'muted' },
  medium: { he: 'בינונית', tone: 'info' },
  high: { he: 'גבוהה', tone: 'warning' },
  urgent: { he: 'דחופה', tone: 'danger' },
} as const);

export const moderationStatus = dict({
  pending: { he: 'ממתין למודרציה', tone: 'warning' },
  approved: { he: 'אושר', tone: 'positive' },
  rejected: { he: 'נדחה', tone: 'danger' },
  blocked: { he: 'נחסם', tone: 'danger' },
} as const);

export const screenStatus = dict({
  online: { he: 'פעיל', tone: 'positive' },
  offline: { he: 'לא פעיל', tone: 'danger' },
  unknown: { he: 'לא ידוע', tone: 'muted' },
} as const);

export const auditAction = dict({
  create: { he: 'יצירה', tone: 'positive' },
  update: { he: 'עדכון', tone: 'info' },
  delete: { he: 'מחיקה', tone: 'danger' },
  soft_delete: { he: 'מחיקה רכה', tone: 'warning' },
  restore: { he: 'שחזור', tone: 'info' },
  login: { he: 'התחברות', tone: 'muted' },
  logout: { he: 'התנתקות', tone: 'muted' },
  login_failed: { he: 'כשל התחברות', tone: 'danger' },
  permission_denied: { he: 'גישה נדחתה', tone: 'danger' },
  export: { he: 'ייצוא נתונים', tone: 'warning' },
  impersonate_start: { he: 'תחילת התחזות', tone: 'danger' },
  impersonate_end: { he: 'סיום התחזות', tone: 'warning' },
  financial_action: { he: 'פעולה כספית', tone: 'danger' },
  device_command: { he: 'פקודה למכשיר', tone: 'warning' },
  setting_change: { he: 'שינוי הגדרה', tone: 'warning' },
  approval: { he: 'אישור', tone: 'info' },
} as const);

export const sessionEventType = dict({
  created: { he: 'נוצר', tone: 'muted' },
  payment_initiated: { he: 'תשלום הוזנק', tone: 'info' },
  payment_succeeded: { he: 'תשלום נקלט', tone: 'positive' },
  payment_failed: { he: 'תשלום נכשל', tone: 'danger' },
  token_issued: { he: 'הונפק Session Token', tone: 'info' },
  ble_connecting: { he: 'מתחבר ל־BLE', tone: 'info' },
  ble_connected: { he: 'BLE מחובר', tone: 'positive' },
  ble_failed: { he: 'כשל BLE', tone: 'danger' },
  started: { he: 'האימון התחיל', tone: 'positive' },
  paused: { he: 'הושהה', tone: 'warning' },
  resumed: { he: 'חודש', tone: 'info' },
  stopped: { he: 'נעצר', tone: 'warning' },
  completed: { he: 'הושלם', tone: 'positive' },
  force_ended: { he: 'סיום כפוי', tone: 'danger' },
  error: { he: 'שגיאה', tone: 'danger' },
  safety_alert: { he: 'התראת בטיחות', tone: 'danger' },
  marked_faulty: { he: 'סומן כתקול', tone: 'danger' },
  extended: { he: 'הוארך', tone: 'info' },
  refunded: { he: 'זוכה', tone: 'warning' },
  note: { he: 'הערה', tone: 'muted' },
} as const);

/** צבע Tailwind לפי tone — משמש ב־Badge וב־StatusDot */
/**
 * מחלקות הצבע לפי tone.
 *
 * הן מצביעות על טוקנים ולא על גוונים קבועים, כדי שאותו Badge
 * יעמוד בניגודיות תקינה גם על רקע כהה וגם על רקע לבן.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  positive:
    'bg-[var(--signal-positive-bg)] text-[var(--signal-positive)] ring-[var(--signal-positive-ring)]',
  warning:
    'bg-[var(--signal-warning-bg)] text-[var(--signal-warning)] ring-[var(--signal-warning-ring)]',
  danger:
    'bg-[var(--signal-danger-bg)] text-[var(--signal-danger)] ring-[var(--signal-danger-ring)]',
  info: 'bg-[var(--signal-info-bg)] text-[var(--signal-info)] ring-[var(--signal-info-ring)]',
  neutral:
    'bg-[var(--signal-neutral-bg)] text-[var(--signal-neutral)] ring-[var(--signal-neutral-ring)]',
  muted:
    'bg-[var(--signal-muted-bg)] text-[var(--signal-muted)] ring-[var(--signal-muted-ring)]',
};

export const TONE_DOT: Record<Tone, string> = {
  positive: 'bg-[var(--signal-positive)]',
  warning: 'bg-[var(--signal-warning)]',
  danger: 'bg-[var(--signal-danger)]',
  info: 'bg-[var(--signal-info)]',
  neutral: 'bg-[var(--signal-neutral)]',
  muted: 'bg-[var(--signal-muted)]',
};
