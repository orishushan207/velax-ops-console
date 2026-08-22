import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MetricInfo } from '@/components/ui/tooltip';
import { metricCaution, metricTooltip } from '@/lib/metrics/dictionary';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  label: string;
  value: string;
  /** מפתח מ־Metric Dictionary — מזין את ה־Tooltip ואת אזהרת השימוש */
  metricKey?: string;
  /** שינוי מול התקופה הקודמת, כשבר עשרוני. null = אין בסיס להשוואה. */
  change?: number | null;
  /** האם עלייה היא דבר טוב. עבור Refund Rate למשל — לא. */
  higherIsBetter?: boolean;
  /** יעד להשוואה, לתצוגת "מול יעד" */
  target?: string;
  targetMet?: boolean | null;
  /** ניווט לפירוט הנתונים שמהם המדד חושב */
  href?: string;
  hint?: string;
  /** ערך לא זמין — מוצג כ"אין נתונים" ולא כאפס */
  unavailableReason?: string;
  accent?: boolean;
  className?: string;
}

/**
 * כרטיס KPI.
 *
 * ⚠ סעיף 6 בהנחיות: "כל KPI צריך להיות לחיץ ולהוביל לפירוט הנתונים שמהם הוא מחושב."
 * כרטיס עם href הופך לקישור. כרטיס בלי href הוא מדד סיכום שאין לו drill-down טבעי.
 *
 * ⚠ כאשר אין נתונים אמיתיים לחישוב — מוצג "אין נתונים" ולא 0.
 * סעיף 32.8: "ודא שאין נתונים מומצאים המוצגים כנתוני Production."
 */
export function KpiCard({
  label,
  value,
  metricKey,
  change,
  higherIsBetter = true,
  target,
  targetMet,
  href,
  hint,
  unavailableReason,
  accent,
  className,
}: KpiCardProps) {
  const tooltip = metricKey ? metricTooltip(metricKey) : hint;
  const caution = metricKey ? metricCaution(metricKey) : undefined;

  const changeTone =
    change === null || change === undefined || Math.abs(change) < 0.005
      ? 'flat'
      : (change > 0) === higherIsBetter
        ? 'good'
        : 'bad';

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium leading-tight text-[var(--fg-secondary)]">{label}</span>
          {(tooltip || caution) && <MetricInfo text={tooltip} caution={caution} />}
        </div>
        {change !== undefined && change !== null && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
              changeTone === 'good' && 'bg-[var(--signal-positive-bg)] text-[var(--signal-positive)]',
              changeTone === 'bad' && 'bg-[var(--signal-danger-bg)] text-[var(--signal-danger)]',
              changeTone === 'flat' && 'bg-white/5 text-[var(--fg-tertiary)]',
            )}
          >
            {changeTone === 'flat' ? (
              <Minus className="size-3" />
            ) : change > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            <span className="num">{formatPercent(Math.abs(change), 0)}</span>
          </span>
        )}
      </div>

      <div className="mt-2">
        {unavailableReason ? (
          <p className="text-sm text-[var(--fg-tertiary)]">אין נתונים</p>
        ) : (
          <p
            className={cn(
              'num text-2xl font-semibold leading-none tracking-tight',
              accent ? 'text-[var(--accent)]' : 'text-[var(--fg-primary)]',
            )}
          >
            {value}
          </p>
        )}
      </div>

      {unavailableReason ? (
        <p className="mt-2 text-[11px] leading-snug text-[var(--fg-tertiary)]">{unavailableReason}</p>
      ) : target ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--fg-tertiary)]">
          <span>יעד: </span>
          <span className="num">{target}</span>
          {targetMet !== null && targetMet !== undefined && (
            <span
              className={cn(
                'size-1.5 rounded-full',
                targetMet ? 'bg-[var(--signal-positive)]' : 'bg-[var(--signal-warning)]',
              )}
              aria-label={targetMet ? 'עומד ביעד' : 'מתחת ליעד'}
            />
          )}
        </p>
      ) : null}
    </>
  );

  const cardClass = cn(
    'relative p-4 transition-colors',
    href && 'hover:bg-[var(--bg-hover)] cursor-pointer',
    accent && 'brand-edge ps-5',
    className,
  );

  if (href) {
    return (
      <Card className={cardClass}>
        <Link href={href} className="block h-full">
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className={cardClass}>{body}</Card>;
}

/** רשת כרטיסי KPI רספונסיבית */
export function KpiGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 3 | 4 | 5 | 6;
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        'grid-cols-2 md:grid-cols-3',
        columns === 4 && 'lg:grid-cols-4',
        columns === 5 && 'lg:grid-cols-5',
        columns === 6 && 'lg:grid-cols-4 xl:grid-cols-6',
        columns === 3 && 'lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}
