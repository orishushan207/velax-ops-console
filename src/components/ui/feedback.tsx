import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * רכיבי משוב — מצב ריק ושלד טעינה.
 *
 * ⚠ הקובץ הזה אינו 'use client' במכוון.
 * הוא נטען גם ב־Server Components, וכך אפשר להעביר לו רכיב אייקון
 * ישירות בלי לחצות את גבול Server → Client (שאינו מאפשר העברת פונקציות).
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="rounded-full bg-[var(--bg-hover)] p-3">
          <Icon className="size-5 text-[var(--fg-tertiary)]" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-[var(--fg-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

/** הודעת מידע/אזהרה בתוך מסך */
export function Callout({
  tone = 'info',
  title,
  children,
  icon: Icon,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'positive';
  title?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const toneClasses = {
    info: 'bg-[var(--signal-info-bg)] ring-[var(--signal-info-ring)] text-[var(--signal-info)]',
    warning: 'bg-[var(--signal-warning-bg)] ring-[var(--signal-warning-ring)] text-[var(--signal-warning)]',
    danger: 'bg-[var(--signal-danger-bg)] ring-[var(--signal-danger-ring)] text-[var(--signal-danger)]',
    positive: 'bg-[var(--signal-positive-bg)] ring-[var(--signal-positive-ring)] text-[var(--signal-positive)]',
  } as const;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-card)] p-3.5 text-[12px] ring-1 ring-inset',
        toneClasses[tone],
        className,
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 text-[var(--fg-secondary)]">
        {title && <p className="font-medium text-[var(--fg-primary)]">{title}</p>}
        <div className={cn(title && 'mt-1', 'leading-relaxed')}>{children}</div>
      </div>
    </div>
  );
}
