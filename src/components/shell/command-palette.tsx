'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Building2,
  Boxes,
  CalendarClock,
  CreditCard,
  GraduationCap,
  LifeBuoy,
  Search,
  Target,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { NavItem } from './nav-config';
import { NAV_ICONS } from './nav-icons';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  session: { label: 'Sessions', icon: CalendarClock },
  player: { label: 'שחקנים', icon: User },
  club: { label: 'מועדונים', icon: Building2 },
  station: { label: 'עמדות', icon: Boxes },
  device: { label: 'מכונות', icon: Boxes },
  payment: { label: 'תשלומים', icon: CreditCard },
  ticket: { label: 'תקלות', icon: LifeBuoy },
  coach: { label: 'מאמנים', icon: GraduationCap },
  lead: { label: 'לידים', icon: Target },
};

/**
 * Command Palette — ⌘K / Ctrl+K.
 * משלב ניווט מהיר בין מסכים עם חיפוש גלובלי בנתונים.
 */
export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // '/' פותח חיפוש כשלא מקלידים בשדה
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // חיפוש עם Debounce — לא שולחים בקשה על כל הקשה
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        // ביטול בקשה אינו שגיאה
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return [...map.entries()];
  }, [results]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-overlay)] ring-1 ring-inset ring-[var(--border-default)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} loop dir="rtl" label="חיפוש וניווט מהיר">
          <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4">
            <Search className="size-4 shrink-0 text-[var(--fg-tertiary)]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="חפש Session, שחקן, מועדון, עמדה, מכונה, תשלום, תקלה, טלפון או מזהה עסקה…"
              className="h-12 flex-1 bg-transparent text-sm text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-tertiary)]"
            />
            <kbd className="hidden shrink-0 rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] text-[var(--fg-tertiary)] sm:block">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[52vh] overflow-y-auto p-2">
            {loading && (
              <p className="px-3 py-6 text-center text-[13px] text-[var(--fg-tertiary)]">מחפש…</p>
            )}

            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-[var(--fg-tertiary)]">
                לא נמצאו תוצאות עבור &laquo;{query}&raquo;
              </Command.Empty>
            )}

            {grouped.map(([type, items]) => {
              const meta = TYPE_META[type] ?? { label: type, icon: Search };
              return (
                <Command.Group
                  key={type}
                  heading={
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                      {meta.label}
                    </span>
                  }
                  className="mb-1"
                >
                  {items.map((r) => (
                    <Command.Item
                      key={`${r.type}-${r.id}`}
                      value={`${r.type}-${r.id}`}
                      onSelect={() => go(r.href)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px]',
                        'data-[selected=true]:bg-[var(--bg-hover)]',
                      )}
                    >
                      <meta.icon className="size-4 shrink-0 text-[var(--fg-tertiary)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--fg-primary)]">
                          {r.title}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--fg-tertiary)]">
                          {r.subtitle}
                        </span>
                      </span>
                      {r.badge && (
                        <Badge size="sm" tone="muted">
                          {r.badge}
                        </Badge>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}

            {query.trim().length < 2 && (
              <Command.Group
                heading={
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                    ניווט מהיר
                  </span>
                }
              >
                {navItems.map((item) => {
                  const Icon = NAV_ICONS[item.iconName];
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => go(item.href)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] data-[selected=true]:bg-[var(--bg-hover)]"
                    >
                      <Icon className="size-4 shrink-0 text-[var(--fg-tertiary)]" />
                      <span className="text-[var(--fg-primary)]">{item.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

/** כפתור החיפוש בכותרת — פותח את ה־Palette */
export function SearchTrigger() {
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'));
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
        );
      }}
      className={cn(
        'flex h-9 w-full max-w-sm items-center gap-2.5 rounded-[var(--radius-control)] bg-[var(--bg-input)] px-3',
        'text-[13px] text-[var(--fg-tertiary)] ring-1 ring-inset ring-[var(--border-default)]',
        'transition-colors hover:ring-[var(--border-strong)]',
      )}
      aria-label="חיפוש גלובלי"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate text-start">חיפוש בכל המערכת…</span>
      <kbd className="hidden shrink-0 rounded border border-[var(--border-default)] px-1.5 py-0.5 text-[10px] sm:block">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  );
}
