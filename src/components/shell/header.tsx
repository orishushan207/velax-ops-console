'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, LogOut, Menu, Moon, Sun, UserCircle2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { MobileNav } from './sidebar';
import { VelaXLogo, VelaXMark } from '@/components/brand/logo';
import { SearchTrigger } from './command-palette';
import type { NavItem } from './nav-config';
import { cn } from '@/lib/utils';

export interface HeaderUser {
  fullName: string;
  email: string | null;
  roleNames: string[];
  isImpersonating: boolean;
  scopeLabel: string;
}

export function Header({
  user,
  navItems,
  unreadNotifications,
  onLogout,
}: {
  user: HeaderUser;
  navItems: NavItem[];
  unreadNotifications: number;
  onLogout: () => Promise<void>;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  React.useEffect(() => {
    const stored = window.localStorage.getItem('velax.theme');
    if (stored === 'light') {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('velax.theme', next);
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };

  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('');

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-raised)]/85 px-4 backdrop-blur-md">
        <Button
          variant="ghost"
          size="iconSm"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="פתיחת תפריט"
        >
          <Menu />
        </Button>

        <Link href="/" className="flex items-center lg:hidden" aria-label="VELA-X">
          <VelaXMark className="size-7" />
        </Link>

        <div className="flex flex-1 justify-center px-2 lg:justify-start">
          <SearchTrigger />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {user.isImpersonating && (
            <Badge tone="danger" dot className="hidden sm:inline-flex">
              מצב התחזות פעיל
            </Badge>
          )}

          <Button variant="ghost" size="iconSm" onClick={toggleTheme} aria-label="החלפת ערכת נושא">
            {theme === 'dark' ? <Moon /> : <Sun />}
          </Button>

          <Button variant="ghost" size="iconSm" asChild aria-label="התראות">
            <Link href="/notifications" className="relative">
              <Bell />
              {unreadNotifications > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--signal-danger)] px-1 text-[9px] font-bold text-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 transition-colors hover:bg-[var(--bg-hover)]"
                aria-label="תפריט משתמש"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--fg-secondary)] ring-1 ring-inset ring-[var(--border-default)]">
                  {initials}
                </span>
                <span className="hidden min-w-0 text-start md:block">
                  <span className="block truncate text-[12px] font-medium leading-tight text-[var(--fg-primary)]">
                    {user.fullName}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-[var(--fg-tertiary)]">
                    {user.roleNames[0] ?? '—'}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
              <div className="px-2 pb-2 text-[11px] text-[var(--fg-tertiary)]">
                <p className="truncate">{user.email ?? '—'}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {user.roleNames.map((r) => (
                    <Badge key={r} size="sm" tone="neutral">
                      {r}
                    </Badge>
                  ))}
                </p>
                <p className="mt-1.5">{user.scopeLabel}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <UserCircle2 />
                  הגדרות
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => void onLogout()}>
                <LogOut />
                התנתקות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <div
            className={cn(
              'absolute inset-y-0 end-0 w-[280px] overflow-y-auto bg-[var(--bg-raised)] p-4',
              'ring-1 ring-inset ring-[var(--border-default)]',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <VelaXMark className="size-7" />
                <VelaXLogo className="w-[88px]" />
              </span>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setMobileOpen(false)}
                aria-label="סגירת תפריט"
              >
                <X />
              </Button>
            </div>
            <MobileNav items={navItems} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
