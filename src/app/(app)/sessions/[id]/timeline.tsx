'use client';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import * as labels from '@/lib/labels';
import { TONE_DOT } from '@/lib/labels';
import { cn } from '@/lib/utils';

export interface TimelineEventDto {
  id: string;
  eventType: string;
  occurredAt: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  source: string;
  message: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  system: 'מערכת',
  ops_console: 'Ops Console',
  device: 'מכשיר',
  player_app: 'אפליקציית שחקן',
  automation: 'אוטומציה',
};

export function SessionTimeline({ events }: { events: TimelineEventDto[] }) {
  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const tone = labels.sessionEventType.tone(
          e.eventType as Parameters<typeof labels.sessionEventType.tone>[0],
        );
        const isLast = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* קו מחבר */}
            {!isLast && (
              <span
                className="absolute top-4 h-full w-px bg-[var(--border-subtle)]"
                style={{ insetInlineStart: '5px' }}
                aria-hidden
              />
            )}
            <span
              className={cn('relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full', TONE_DOT[tone])}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--fg-primary)]">
                  {labels.sessionEventType.label(
                    e.eventType as Parameters<typeof labels.sessionEventType.label>[0],
                  )}
                </span>
                {e.toStatus && e.fromStatus && e.toStatus !== e.fromStatus && (
                  <Badge size="sm" tone="muted">
                    {labels.sessionStatus.label(
                      e.fromStatus as Parameters<typeof labels.sessionStatus.label>[0],
                    )}
                    {' ← '}
                    {labels.sessionStatus.label(
                      e.toStatus as Parameters<typeof labels.sessionStatus.label>[0],
                    )}
                  </Badge>
                )}
                <span className="num ms-auto text-[11px] text-[var(--fg-tertiary)]">
                  {formatDateTime(e.occurredAt)}
                </span>
              </div>
              {e.message && (
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                  {e.message}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)]">
                {SOURCE_LABELS[e.source] ?? e.source}
                {e.actorName && ` · ${e.actorName}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
