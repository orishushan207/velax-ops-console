'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NAV_GROUPS, type NavItem } from './nav-config';
import { NAV_ICONS } from './nav-icons';
import { VelaXLogo, VelaXMark } from '@/components/brand/logo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem('velax.sidebar.collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem('velax.sidebar.collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  const groups = (Object.keys(NAV_GROUPS) as (keyof typeof NAV_GROUPS)[])
    .map((key) => ({ key, label: NAV_GROUPS[key], items: items.filter((i) => i.group === key) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-s-0 border-e border-[var(--border-subtle)] bg-[var(--bg-raised)] lg:flex',
        collapsed ? 'w-[68px]' : 'w-[248px]',
        'transition-[width] duration-200',
      )}
      aria-label="ניווט ראשי"
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-subtle)] px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          aria-label="VELA-X Ops Console — מרכז שליטה"
        >
          {collapsed ? (
            <VelaXMark className="size-7" />
          ) : (
            <span className="min-w-0">
              <VelaXLogo className="w-[104px]" />
              <span className="mt-0.5 block truncate text-[10px] leading-tight text-[var(--fg-tertiary)]">
                Ops Console
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.key} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = NAV_ICONS[item.iconName];
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] transition-colors',
                      active
                        ? 'bg-[var(--bg-hover)] font-medium text-[var(--fg-primary)]'
                        : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 -start-2 w-0.5 rounded-full bg-[var(--accent)]" />
                    )}
                    <Icon className={cn('size-[17px] shrink-0', active && 'text-[var(--accent)]')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.live && !collapsed && (
                      <span className="ms-auto size-1.5 shrink-0 rounded-full bg-[var(--accent)] pulse-live" />
                    )}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="left">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border-subtle)] p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'הרחבת סרגל הניווט' : 'צמצום סרגל הניווט'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[12px] text-[var(--fg-tertiary)]',
            'transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-secondary)]',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
          {!collapsed && <span>צמצום</span>}
        </button>
        {!collapsed && (
          <p
            dir="ltr"
            className="px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase leading-relaxed tracking-[0.14em] text-[var(--accent)]/70"
          >
            Train smarter.
            <br />
            Perform better.
          </p>
        )}
      </div>
    </aside>
  );
}

/** ניווט מובייל — מוצג כמגירה מתוך ה־Header */
export function MobileNav({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const groups = (Object.keys(NAV_GROUPS) as (keyof typeof NAV_GROUPS)[])
    .map((key) => ({ key, label: NAV_GROUPS[key], items: items.filter((i) => i.group === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="space-y-4" aria-label="ניווט ראשי">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = NAV_ICONS[item.iconName];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-[var(--bg-hover)] font-medium text-[var(--fg-primary)]'
                        : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    <Icon className={cn('size-4', active && 'text-[var(--accent)]')} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

