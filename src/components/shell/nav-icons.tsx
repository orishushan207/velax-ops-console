'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgePercent,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Monitor,
  PiggyBank,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wrench,
} from 'lucide-react';
import type { NavIconName } from './nav-config';

/** מיפוי שם אייקון לרכיב. חי בצד הלקוח בלבד. */
export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  live: Radio,
  sessions: CalendarClock,
  tickets: LifeBuoy,
  maintenance: Wrench,
  clubs: Building2,
  stations: Boxes,
  players: Users,
  coaches: GraduationCap,
  payments: CreditCard,
  earnback: Target,
  finance: PiggyBank,
  crm: BarChart3,
  content: ClipboardCheck,
  rewards: BadgePercent,
  screens: Monitor,
  reports: Activity,
  users: ShieldCheck,
  audit: FileClock,
  settings: Settings,
  notifications: Sparkles,
};
