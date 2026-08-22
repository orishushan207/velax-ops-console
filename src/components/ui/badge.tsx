import * as React from 'react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, TONE_DOT, type Tone } from '@/lib/labels';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ className, tone = 'neutral', dot, size = 'md', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** נקודת סטטוס בלבד, לשימוש בטבלאות צפופות */
export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', TONE_DOT[tone], pulse && 'pulse-live')}
      aria-hidden
    />
  );
}
