'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RANGE_PRESETS } from '@/lib/date-range';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  /** תווית לאפשרות "הכל" */
  allLabel?: string;
}

/**
 * שורת מסננים.
 *
 * כל שינוי נכתב ל־URL ולא ל־state מקומי — כך שכל תצוגה ניתנת לשיתוף,
 * לרענון ולסימניה. דרישת סעיף 29 בהנחיות: "URL state למסננים".
 */
export function FilterBar({
  filters,
  showDateRange = true,
  searchKey,
  searchPlaceholder = 'חיפוש…',
  className,
}: {
  filters?: FilterDef[];
  showDateRange?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const setParam = React.useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === 'all' || value === '') params.delete(key);
      else params.set(key, value);
      // כל שינוי מסנן מאפס את העימוד
      params.delete('page');
      startTransition(() => {
        router.replace(`${pathname}${params.toString() ? `?${params}` : ''}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // חיפוש עם Debounce
  const [searchValue, setSearchValue] = React.useState(
    searchKey ? (searchParams.get(searchKey) ?? '') : '',
  );

  React.useEffect(() => {
    if (!searchKey) return;
    const current = searchParams.get(searchKey) ?? '';
    if (searchValue === current) return;
    const timer = setTimeout(() => setParam(searchKey, searchValue || undefined), 320);
    return () => clearTimeout(timer);
  }, [searchValue, searchKey, searchParams, setParam]);

  const activeCount = [...searchParams.keys()].filter(
    (k) => !['page', 'range', 'from', 'to'].includes(k),
  ).length;

  const clearAll = () => {
    setSearchValue('');
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] bg-[var(--bg-raised)] p-2.5',
        'ring-1 ring-inset ring-[var(--border-subtle)]',
        isPending && 'opacity-70',
        className,
      )}
    >
      <Filter className="ms-1 size-3.5 shrink-0 text-[var(--fg-tertiary)]" aria-hidden />

      {showDateRange && (
        <Select
          value={searchParams.get('range') ?? '30d'}
          onValueChange={(v) => setParam('range', v)}
        >
          <SelectTrigger className="h-8 w-[168px] text-[13px]" aria-label="טווח תאריכים">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {searchKey && (
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 w-full max-w-[240px] text-[13px]"
          aria-label={searchPlaceholder}
        />
      )}

      {filters?.map((f) => (
        <Select
          key={f.key}
          value={searchParams.get(f.key) ?? 'all'}
          onValueChange={(v) => setParam(f.key, v)}
        >
          <SelectTrigger className="h-8 w-[164px] text-[13px]" aria-label={f.label}>
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.allLabel ?? `כל ה${f.label}`}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="ms-auto">
          <X />
          ניקוי מסננים
        </Button>
      )}
    </div>
  );
}
