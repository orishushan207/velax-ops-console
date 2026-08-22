'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      dir="rtl"
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs rounded-[var(--radius-control)] bg-[var(--bg-overlay)] px-3 py-2 text-[12px] leading-relaxed',
        'text-[var(--fg-primary)] ring-1 ring-inset ring-[var(--border-default)] shadow-xl',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

/**
 * הסבר למדד. הטקסט מגיע מ־Metric Dictionary ולא נכתב inline —
 * כך שכל מסך שמציג את אותו מדד מציג גם את אותו הסבר.
 */
export function MetricInfo({ text, caution }: { text?: string; caution?: string }) {
  if (!text && !caution) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="הסבר על המדד"
          className="rounded p-0.5 text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-secondary)]"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {text && <p>{text}</p>}
        {caution && (
          <p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[var(--signal-warning)]">⚠ {caution}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
