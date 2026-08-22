/**
 * קטלוג ההרשאות — מקור אמת יחיד.
 *
 * הרשאות מוגדרות ברמת פעולה ולא ברמת מסך (סעיף 24 בהנחיות),
 * כדי שאפשר יהיה לתת גישת צפייה בכספים בלי גישת ביצוע זיכוי.
 *
 * ה־Seed טוען את הקטלוג הזה לטבלאות permissions / role_permissions.
 */

export const PERMISSION_CATEGORIES = {
  network: 'רשת ומועדונים',
  fleet: 'צי מכשירים',
  operations: 'תפעול ו־Sessions',
  finance: 'כספים',
  support: 'שירות ותחזוקה',
  inventory: 'מלאי',
  earnback: 'Earn-Back',
  crm: 'CRM ומכירות',
  coaches: 'מאמנים',
  content: 'תוכן',
  rewards: 'Rewards',
  marketing: 'מסכים וקמפיינים',
  players: 'שחקנים ופרטיות',
  system: 'מערכת והרשאות',
} as const;

export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;

export interface PermissionDef {
  key: string;
  nameHe: string;
  category: PermissionCategory;
  /** פעולה רגישה — מחייבת סיבה חופשית + רישום מפורט ב־Audit Log */
  sensitive?: boolean;
}

export const PERMISSIONS = [
  // ─── רשת ומועדונים ───
  { key: 'clubs.view', nameHe: 'צפייה במועדונים', category: 'network' },
  { key: 'clubs.create', nameHe: 'יצירת מועדון', category: 'network' },
  { key: 'clubs.edit', nameHe: 'עריכת מועדון', category: 'network' },
  { key: 'clubs.archive', nameHe: 'ארכוב מועדון', category: 'network', sensitive: true },
  { key: 'contracts.view', nameHe: 'צפייה בהסכמים', category: 'network' },
  { key: 'contracts.edit', nameHe: 'שינוי הסכם', category: 'network', sensitive: true },
  { key: 'stations.view', nameHe: 'צפייה בעמדות', category: 'network' },
  { key: 'stations.manage', nameHe: 'ניהול עמדות', category: 'network' },
  { key: 'stations.suspend', nameHe: 'השבתת עמדה', category: 'network', sensitive: true },
  { key: 'stations.archive', nameHe: 'ארכוב עמדה', category: 'network', sensitive: true },

  // ─── צי מכשירים ───
  { key: 'devices.view', nameHe: 'צפייה במכשירים', category: 'fleet' },
  { key: 'devices.register', nameHe: 'רישום מכשיר', category: 'fleet' },
  { key: 'devices.assign', nameHe: 'שיוך והעברת מכשיר', category: 'fleet' },
  { key: 'devices.quarantine', nameHe: 'בידוד או השבתת מכשיר', category: 'fleet', sensitive: true },
  { key: 'devices.firmware', nameHe: 'עדכון Firmware ו־Rollback', category: 'fleet', sensitive: true },
  { key: 'devices.retire', nameHe: 'גריעת מכשיר', category: 'fleet', sensitive: true },
  { key: 'devices.telemetry', nameHe: 'צפייה בטלמטריה', category: 'fleet' },

  // ─── תפעול ───
  { key: 'sessions.view', nameHe: 'צפייה ב־Sessions', category: 'operations' },
  { key: 'sessions.control', nameHe: 'שליטה בסשן פעיל (Pause/Stop/הארכה)', category: 'operations', sensitive: true },
  { key: 'sessions.force_end', nameHe: 'סיום כפוי של סשן', category: 'operations', sensitive: true },
  { key: 'sessions.mark_faulty', nameHe: 'סימון סשן כתקול', category: 'operations' },
  { key: 'sessions.message_player', nameHe: 'שליחת הודעה לשחקן', category: 'operations', sensitive: true },

  // ─── כספים ───
  { key: 'finance.view', nameHe: 'צפייה בנתונים כספיים', category: 'finance' },
  { key: 'finance.view_unit_economics', nameHe: 'צפייה בכלכלת יחידה והנחות', category: 'finance' },
  { key: 'finance.edit_assumptions', nameHe: 'שינוי הנחות עסקיות', category: 'finance', sensitive: true },
  { key: 'payments.view', nameHe: 'צפייה בתשלומים', category: 'finance' },
  { key: 'payments.retry', nameHe: 'ניסיון סליקה חוזר', category: 'finance', sensitive: true },
  { key: 'refunds.request', nameHe: 'בקשת זיכוי', category: 'finance' },
  { key: 'refunds.approve', nameHe: 'אישור זיכוי מעל הרף', category: 'finance', sensitive: true },
  { key: 'refunds.approve_any', nameHe: 'אישור זיכוי ללא הגבלת סכום', category: 'finance', sensitive: true },
  { key: 'settlements.reconcile', nameHe: 'התאמת סליקה', category: 'finance', sensitive: true },
  { key: 'finance.export', nameHe: 'ייצוא נתונים להנהלת חשבונות', category: 'finance', sensitive: true },

  // ─── שירות ותחזוקה ───
  { key: 'tickets.view', nameHe: 'צפייה בתקלות', category: 'support' },
  { key: 'tickets.create', nameHe: 'פתיחת קריאת שירות', category: 'support' },
  { key: 'tickets.edit', nameHe: 'עדכון קריאת שירות', category: 'support' },
  { key: 'tickets.assign', nameHe: 'הקצאת קריאה', category: 'support' },
  { key: 'tickets.close', nameHe: 'סגירת קריאה', category: 'support' },
  { key: 'sla.edit', nameHe: 'שינוי מדיניות SLA', category: 'support', sensitive: true },
  { key: 'maintenance.view', nameHe: 'צפייה בתחזוקה', category: 'support' },
  { key: 'maintenance.manage', nameHe: 'ניהול תחזוקה ו־Checklists', category: 'support' },
  { key: 'checklists.submit', nameHe: 'הגשת Checklist', category: 'support' },

  // ─── מלאי ───
  { key: 'inventory.view', nameHe: 'צפייה במלאי', category: 'inventory' },
  { key: 'inventory.manage', nameHe: 'ניהול מלאי ותנועות', category: 'inventory' },
  { key: 'inventory.write_off', nameHe: 'גריעת מלאי', category: 'inventory', sensitive: true },

  // ─── Earn-Back ───
  { key: 'earnback.view', nameHe: 'צפייה ב־Earn-Back', category: 'earnback' },
  { key: 'earnback.manage', nameHe: 'ניהול הסכמי Earn-Back', category: 'earnback', sensitive: true },
  { key: 'earnback.adjust', nameHe: 'שינוי חישוב Earn-Back', category: 'earnback', sensitive: true },
  { key: 'bookings.classify', nameHe: 'סיווג הזמנות מגרש', category: 'earnback' },

  // ─── CRM ───
  { key: 'crm.view', nameHe: 'צפייה ב־CRM', category: 'crm' },
  { key: 'crm.manage', nameHe: 'ניהול לידים ומשימות', category: 'crm' },

  // ─── מאמנים ───
  { key: 'coaches.view', nameHe: 'צפייה במאמנים', category: 'coaches' },
  { key: 'coaches.manage', nameHe: 'ניהול מאמנים ואימות', category: 'coaches' },
  { key: 'commissions.approve', nameHe: 'אישור ותשלום עמלות', category: 'coaches', sensitive: true },

  // ─── תוכן ───
  { key: 'content.view', nameHe: 'צפייה בתוכן', category: 'content' },
  { key: 'content.edit', nameHe: 'עריכת תוכן', category: 'content' },
  { key: 'content.publish', nameHe: 'פרסום תוכן', category: 'content', sensitive: true },

  // ─── Rewards ───
  { key: 'rewards.view', nameHe: 'צפייה ב־Rewards', category: 'rewards' },
  { key: 'rewards.manage', nameHe: 'ניהול קופונים ואתגרים', category: 'rewards' },
  { key: 'rewards.grant', nameHe: 'מתן הטבה ידנית', category: 'rewards', sensitive: true },

  // ─── מסכים וקמפיינים ───
  { key: 'screens.view', nameHe: 'צפייה במסכים', category: 'marketing' },
  { key: 'screens.manage', nameHe: 'ניהול קמפיינים ומסכים', category: 'marketing' },
  { key: 'content.moderate', nameHe: 'מודרציה של תוכן משתמשים', category: 'marketing', sensitive: true },

  // ─── שחקנים ופרטיות ───
  { key: 'players.view', nameHe: 'צפייה בשחקנים', category: 'players' },
  { key: 'players.view_pii', nameHe: 'צפייה בפרטים מזהים של שחקן', category: 'players', sensitive: true },
  { key: 'players.edit', nameHe: 'עריכת פרופיל שחקן', category: 'players' },
  { key: 'players.block', nameHe: 'חסימה או השעיה של שחקן', category: 'players', sensitive: true },
  { key: 'players.merge', nameHe: 'איחוד חשבונות כפולים', category: 'players', sensitive: true },
  { key: 'players.credit', nameHe: 'הוספת קרדיט לשחקן', category: 'players', sensitive: true },
  { key: 'players.export', nameHe: 'ייצוא מידע אישי', category: 'players', sensitive: true },
  { key: 'players.delete_data', nameHe: 'מחיקת מידע אישי', category: 'players', sensitive: true },
  { key: 'players.impersonate', nameHe: 'התחזות למשתמש', category: 'players', sensitive: true },

  // ─── מערכת ───
  { key: 'system.view_audit', nameHe: 'צפייה ב־Audit Log', category: 'system' },
  { key: 'system.manage_users', nameHe: 'ניהול משתמשי מערכת', category: 'system', sensitive: true },
  { key: 'system.manage_roles', nameHe: 'ניהול תפקידים והרשאות', category: 'system', sensitive: true },
  { key: 'system.manage_settings', nameHe: 'ניהול הגדרות מערכת', category: 'system', sensitive: true },
  { key: 'system.manage_automations', nameHe: 'ניהול כללי אוטומציה', category: 'system', sensitive: true },
  { key: 'system.export', nameHe: 'ייצוא נתוני מערכת', category: 'system', sensitive: true },
  { key: 'reports.view', nameHe: 'צפייה בדוחות', category: 'system' },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export function isSensitive(key: string): boolean {
  return PERMISSIONS.some((p) => p.key === key && 'sensitive' in p && p.sensitive === true);
}

// ─────────────────────────────────────────────────────────────
// תפקידים
// ─────────────────────────────────────────────────────────────

export interface RoleDef {
  key: string;
  nameHe: string;
  description: string;
  /** התפקיד רואה רק את המועדונים שהוקצו לו */
  clubScoped?: boolean;
  /** '*' = כל ההרשאות */
  permissions: readonly PermissionKey[] | '*';
}

const OPS_BASE = [
  'clubs.view', 'stations.view', 'stations.manage', 'devices.view', 'devices.assign',
  'devices.telemetry', 'sessions.view', 'sessions.control', 'sessions.mark_faulty',
  'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign',
  'maintenance.view', 'maintenance.manage', 'inventory.view', 'reports.view',
] as const satisfies readonly PermissionKey[];

export const ROLES = [
  {
    key: 'super_admin',
    nameHe: 'Super Admin',
    description: 'גישה מלאה לכל המערכת, כולל ניהול הרשאות ושינוי הנחות עסקיות.',
    permissions: '*',
  },
  {
    key: 'management',
    nameHe: 'הנהלה / מייסדים',
    description: 'ראייה מלאה של הרשת, הכספים וההנחות. ללא ניהול משתמשי מערכת.',
    permissions: [
      'clubs.view', 'clubs.create', 'clubs.edit', 'clubs.archive', 'contracts.view', 'contracts.edit',
      'stations.view', 'stations.manage', 'stations.archive', 'devices.view', 'devices.telemetry',
      'sessions.view', 'finance.view', 'finance.view_unit_economics', 'finance.edit_assumptions',
      'payments.view', 'refunds.request', 'refunds.approve', 'refunds.approve_any',
      'finance.export', 'tickets.view', 'maintenance.view', 'inventory.view',
      'earnback.view', 'earnback.manage', 'earnback.adjust', 'bookings.classify',
      'crm.view', 'crm.manage', 'coaches.view', 'coaches.manage', 'commissions.approve',
      'content.view', 'rewards.view', 'screens.view', 'players.view', 'reports.view',
      'system.view_audit', 'system.manage_settings',
    ],
  },
  {
    key: 'operations_manager',
    nameHe: 'מנהל תפעול',
    description: 'אחראי על הפעילות היומיומית: עמדות, סשנים, תקלות ותחזוקה.',
    permissions: [
      ...OPS_BASE, 'stations.suspend', 'sessions.force_end', 'sessions.message_player',
      'devices.quarantine', 'tickets.close', 'inventory.manage', 'checklists.submit',
      'earnback.view', 'players.view', 'payments.view', 'refunds.request',
      'system.view_audit',
    ],
  },
  {
    key: 'fleet_manager',
    nameHe: 'מנהל צי',
    description: 'ניהול מכשירים, Firmware, מלאי ותחזוקה מונעת.',
    permissions: [
      'clubs.view', 'stations.view', 'stations.manage', 'devices.view', 'devices.register',
      'devices.assign', 'devices.quarantine', 'devices.firmware', 'devices.retire',
      'devices.telemetry', 'sessions.view', 'tickets.view', 'tickets.create', 'tickets.edit',
      'maintenance.view', 'maintenance.manage', 'inventory.view', 'inventory.manage',
      'inventory.write_off', 'reports.view',
    ],
  },
  {
    key: 'support_agent',
    nameHe: 'נציג תמיכה',
    description: 'טיפול בפניות שחקנים, פתיחת תקלות ובקשת זיכויים עד הרף המאושר.',
    permissions: [
      'clubs.view', 'stations.view', 'devices.view', 'sessions.view', 'sessions.control',
      'sessions.mark_faulty', 'sessions.message_player', 'tickets.view', 'tickets.create',
      'tickets.edit', 'payments.view', 'refunds.request', 'players.view', 'players.view_pii',
      'rewards.view', 'reports.view',
    ],
  },
  {
    key: 'technician',
    nameHe: 'טכנאי שדה',
    description: 'ביצוע תיקונים, תחזוקה, החלפת מכונות ומשיכת חלפים.',
    permissions: [
      'clubs.view', 'stations.view', 'devices.view', 'devices.assign', 'devices.telemetry',
      'tickets.view', 'tickets.edit', 'tickets.close', 'maintenance.view', 'maintenance.manage',
      'checklists.submit', 'inventory.view', 'inventory.manage',
    ],
  },
  {
    key: 'finance',
    nameHe: 'כספים',
    description: 'תשלומים, זיכויים, התאמות סליקה, כלכלת יחידה ודיווח.',
    permissions: [
      'clubs.view', 'contracts.view', 'sessions.view', 'finance.view',
      'finance.view_unit_economics', 'payments.view', 'payments.retry', 'refunds.request',
      'refunds.approve', 'settlements.reconcile', 'finance.export', 'earnback.view',
      'commissions.approve', 'reports.view', 'system.view_audit',
    ],
  },
  {
    key: 'sales',
    nameHe: 'מכירות / CRM',
    description: 'ניהול Pipeline מועדונים, הצעות מחיר וחוזים.',
    permissions: [
      'clubs.view', 'clubs.create', 'clubs.edit', 'contracts.view', 'crm.view', 'crm.manage',
      'earnback.view', 'reports.view', 'stations.view',
    ],
  },
  {
    key: 'marketing',
    nameHe: 'שיווק ותוכן',
    description: 'קמפיינים, מסכים, תוכן אימון, Rewards ומודרציה.',
    permissions: [
      'clubs.view', 'content.view', 'content.edit', 'content.publish', 'content.moderate',
      'screens.view', 'screens.manage', 'rewards.view', 'rewards.manage', 'reports.view',
    ],
  },
  {
    key: 'club_manager',
    nameHe: 'מנהל מועדון',
    description: 'רואה רק את המועדונים שהוקצו לו. ללא גישה לכלכלת VELA-X.',
    clubScoped: true,
    permissions: [
      'clubs.view', 'stations.view', 'devices.view', 'sessions.view', 'tickets.view',
      'tickets.create', 'maintenance.view', 'checklists.submit', 'earnback.view',
      'bookings.classify', 'reports.view',
    ],
  },
  {
    key: 'coach',
    nameHe: 'מאמן',
    description: 'רואה רק את המתאמנים שלו ואת התוכן שיצר.',
    clubScoped: true,
    permissions: ['content.view', 'content.edit', 'sessions.view', 'reports.view'],
  },
  {
    key: 'auditor',
    nameHe: 'צפייה בלבד / מבקר',
    description: 'קריאה בלבד בכל המערכת, כולל Audit Log. ללא יכולת שינוי.',
    permissions: [
      'clubs.view', 'contracts.view', 'stations.view', 'devices.view', 'devices.telemetry',
      'sessions.view', 'finance.view', 'finance.view_unit_economics', 'payments.view',
      'tickets.view', 'maintenance.view', 'inventory.view', 'earnback.view', 'crm.view',
      'coaches.view', 'content.view', 'rewards.view', 'screens.view', 'players.view',
      'reports.view', 'system.view_audit',
    ],
  },
] as const satisfies readonly RoleDef[];

export type RoleKey = (typeof ROLES)[number]['key'];

export function permissionsForRole(roleKey: string): PermissionKey[] {
  const role = ROLES.find((r) => r.key === roleKey);
  if (!role) return [];
  if (role.permissions === '*') return ALL_PERMISSION_KEYS;
  return [...role.permissions];
}
