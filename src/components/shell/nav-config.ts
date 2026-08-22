import type { PermissionKey } from '@/lib/permissions';

/**
 * הגדרת הניווט.
 *
 * ⚠ הפריטים חוצים את גבול Server → Client (ה־Layout הוא Server Component
 * וה־Sidebar הוא Client Component), ולכן הם חייבים להיות סריאליזביליים.
 * במקום רכיב אייקון נשמר כאן שם האייקון בלבד, וה־Client ממפה אותו
 * לרכיב דרך NAV_ICONS.
 */

export type NavIconName =
  | 'dashboard'
  | 'live'
  | 'sessions'
  | 'tickets'
  | 'maintenance'
  | 'clubs'
  | 'stations'
  | 'players'
  | 'coaches'
  | 'payments'
  | 'earnback'
  | 'finance'
  | 'crm'
  | 'content'
  | 'rewards'
  | 'screens'
  | 'reports'
  | 'users'
  | 'audit'
  | 'settings'
  | 'notifications';

export interface NavItem {
  href: string;
  label: string;
  iconName: NavIconName;
  /** ההרשאה המינימלית לראות את הפריט. ללא הרשאה — הפריט אינו מוצג. */
  permission: PermissionKey;
  group: 'operations' | 'network' | 'commercial' | 'system';
  /** מציג נקודת "חי" ליד הפריט */
  live?: boolean;
}

export const NAV_GROUPS = {
  operations: 'תפעול',
  network: 'רשת וצי',
  commercial: 'מסחרי',
  system: 'מערכת',
} as const;

/**
 * עשרים אזורי הניווט מסעיף 5 בהנחיות, מקובצים לארבע קבוצות
 * כדי שסרגל של 20 פריטים יישאר קריא.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'מרכז שליטה', iconName: 'dashboard', permission: 'reports.view', group: 'operations' },
  { href: '/live', label: 'פעילות בזמן אמת', iconName: 'live', permission: 'sessions.view', group: 'operations', live: true },
  { href: '/sessions', label: 'Sessions והזמנות', iconName: 'sessions', permission: 'sessions.view', group: 'operations' },
  { href: '/tickets', label: 'תקלות ושירות', iconName: 'tickets', permission: 'tickets.view', group: 'operations' },
  { href: '/maintenance', label: 'תחזוקה ומלאי', iconName: 'maintenance', permission: 'maintenance.view', group: 'operations' },

  { href: '/clubs', label: 'מועדונים', iconName: 'clubs', permission: 'clubs.view', group: 'network' },
  { href: '/stations', label: 'עמדות ומכונות', iconName: 'stations', permission: 'stations.view', group: 'network' },
  { href: '/players', label: 'לקוחות ושחקנים', iconName: 'players', permission: 'players.view', group: 'network' },
  { href: '/coaches', label: 'מאמנים', iconName: 'coaches', permission: 'coaches.view', group: 'network' },
  { href: '/usage-audit', label: 'בקרת שימוש', iconName: 'stations', permission: 'devices.telemetry', group: 'network' },

  { href: '/payments', label: 'תשלומים וזיכויים', iconName: 'payments', permission: 'payments.view', group: 'commercial' },
  { href: '/earn-back', label: 'Earn-Back', iconName: 'earnback', permission: 'earnback.view', group: 'commercial' },
  { href: '/finance', label: 'כספים וכלכלת יחידה', iconName: 'finance', permission: 'finance.view', group: 'commercial' },
  { href: '/crm', label: 'CRM ומכירות', iconName: 'crm', permission: 'crm.view', group: 'commercial' },
  { href: '/content', label: 'תוכן ותוכניות אימון', iconName: 'content', permission: 'content.view', group: 'commercial' },
  { href: '/rewards', label: 'Rewards וקופונים', iconName: 'rewards', permission: 'rewards.view', group: 'commercial' },
  { href: '/screens', label: 'מסכים וקמפיינים', iconName: 'screens', permission: 'screens.view', group: 'commercial' },

  { href: '/reports', label: 'דוחות ו־Analytics', iconName: 'reports', permission: 'reports.view', group: 'system' },
  { href: '/notifications', label: 'התראות ואוטומציות', iconName: 'notifications', permission: 'reports.view', group: 'system' },
  { href: '/users', label: 'משתמשים והרשאות', iconName: 'users', permission: 'system.manage_users', group: 'system' },
  { href: '/audit', label: 'Audit Log', iconName: 'audit', permission: 'system.view_audit', group: 'system' },
  { href: '/settings', label: 'הגדרות', iconName: 'settings', permission: 'reports.view', group: 'system' },
];
