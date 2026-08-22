'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisTick, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * פלטת גרפים.
 * Lime הוא צבע המדד החיובי הראשי לפי שפת המותג; שאר הצבעים משמשים
 * לסדרות משניות ונבחרו לניגודיות מספקת גם במצב בהיר.
 */
/**
 * צבעי הגרפים מצביעים על טוקנים ולא על גוונים קבועים.
 * SVG תומך ב־CSS variables, ולכן אותו גרף מתאים את עצמו
 * לרקע כהה ולרקע לבן בלי שכפול קוד.
 */
export const CHART_COLORS = {
  primary: 'var(--chart-1)',
  secondary: 'var(--chart-2)',
  tertiary: 'var(--chart-3)',
  quaternary: 'var(--chart-4)',
  danger: 'var(--signal-danger)',
  muted: 'var(--fg-tertiary)',
} as const;

export const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

const AXIS_STYLE = { fontSize: 11, fill: 'var(--fg-tertiary)' } as const;

export type ValueFormat = 'number' | 'currency' | 'percent' | 'hours';

/**
 * תווית לציר. מקוצרת במכוון — הציר הוא סקאלה, לא דיווח סכום.
 * הערך המלא מוצג ב־Tooltip ובכל מקום אחר במערכת.
 */
export function formatAxisByType(value: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return `${formatAxisTick(value)} ₪`;
    case 'percent':
      return formatPercent(value, 0);
    case 'hours':
      return `${formatAxisTick(value)} ש׳`;
    default:
      return formatAxisTick(value);
  }
}

/** ערך מלא — ל־Tooltip, לתוויות ולכל מקום שבו המשתמש קורא מספר */
export function formatByType(value: number, format: ValueFormat): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value, 1);
    case 'hours':
      return `${formatNumber(value, 1)} ש׳`;
    default:
      return formatNumber(value, Number.isInteger(value) ? 0 : 1);
  }
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  format: ValueFormat;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="rounded-[var(--radius-control)] bg-[var(--bg-overlay)] px-3 py-2 text-[12px] ring-1 ring-inset ring-[var(--border-default)] shadow-xl"
    >
      {label && <p className="mb-1.5 font-medium text-[var(--fg-primary)]">{label}</p>}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span className="text-[var(--fg-secondary)]">{entry.name}</span>
            <span className="num ms-auto font-medium text-[var(--fg-primary)]">
              {formatByType(Number(entry.value ?? 0), format)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
  /** ציר משני, לסדרה ביחידות אחרות */
  yAxis?: 'left' | 'right';
}

export function ChartFrame({
  children,
  height = 260,
  className,
}: {
  children: React.ReactElement;
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** גרף קווים/שטח לאורך זמן */
export function TimeSeriesChart({
  data,
  series,
  format = 'number',
  height = 260,
  variant = 'area',
  secondaryFormat,
}: {
  data: Record<string, string | number>[];
  series: SeriesDef[];
  format?: ValueFormat;
  height?: number;
  variant?: 'area' | 'line';
  secondaryFormat?: ValueFormat;
}) {
  const hasRight = series.some((s) => s.yAxis === 'right');
  const Chart = variant === 'area' ? AreaChart : LineChart;

  return (
    <ChartFrame height={height}>
      <Chart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatAxisByType(v, format)}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatAxisByType(v, secondaryFormat ?? 'number')}
          />
        )}
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: 'var(--border-strong)' }} />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, color: 'var(--fg-secondary)' }}
        />
        {series.map((s, i) => {
          const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
          return variant === 'area' ? (
            <Area
              key={s.key}
              yAxisId={s.yAxis ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 3.5 }}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.yAxis ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5 }}
            />
          );
        })}
      </Chart>
    </ChartFrame>
  );
}

/** גרף עמודות — השוואה בין קטגוריות */
export function BarSeriesChart({
  data,
  series,
  format = 'number',
  height = 260,
  layout = 'vertical',
  stacked,
}: {
  data: Record<string, string | number>[];
  series: SeriesDef[];
  format?: ValueFormat;
  height?: number;
  /** vertical = עמודות עומדות; horizontal = עמודות שוכבות */
  layout?: 'vertical' | 'horizontal';
  stacked?: boolean;
}) {
  const isHorizontal = layout === 'horizontal';
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 6, right: 8, left: isHorizontal ? 8 : 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={isHorizontal} horizontal={!isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatAxisByType(v, format)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={110}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              minTickGap={12}
            />
            <YAxis
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => formatAxisByType(v, format)}
            />
          </>
        )}
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: 'var(--bg-hover)' }} />
        {series.length > 1 && (
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: 'var(--fg-secondary)' }}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
            maxBarSize={isHorizontal ? 18 : 44}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

/** התפלגות — טבעת */
export function DonutChart({
  data,
  format = 'number',
  height = 220,
}: {
  data: { label: string; value: number; color?: string }[];
  format?: ValueFormat;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip format={format} />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, color: 'var(--fg-secondary)' }}
        />
      </PieChart>
    </ChartFrame>
  );
}

/** Funnel — סריקה ← תשלום ← התחלה ← סיום ← חזרה */
export function ConversionFunnel({
  data,
  height = 260,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const withColor = data.map((d, i) => ({
    ...d,
    fill: SERIES_COLORS[i % SERIES_COLORS.length],
  }));
  return (
    <ChartFrame height={height}>
      <FunnelChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Tooltip content={<ChartTooltip format="number" />} />
        <Funnel dataKey="value" data={withColor} isAnimationActive={false}>
          <LabelList
            position="right"
            dataKey="label"
            style={{ fill: 'var(--fg-secondary)', fontSize: 11 }}
          />
          <LabelList
            position="center"
            dataKey="value"
            style={{ fill: 'var(--accent-fg)', fontSize: 12, fontWeight: 600 }}
          />
        </Funnel>
      </FunnelChart>
    </ChartFrame>
  );
}

/**
 * Heatmap — עומס לפי שעה ויום.
 * ממומש כרשת CSS ולא ב־Recharts, שאין לו רכיב Heatmap טבעי.
 */
export function Heatmap({
  rows,
  columns,
  values,
  format = 'number',
  ariaLabel,
}: {
  rows: string[];
  columns: string[];
  /** values[rowIndex][colIndex] */
  values: number[][];
  format?: ValueFormat;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...values.flat());

  return (
    <div className="overflow-x-auto" role="img" aria-label={ariaLabel}>
      <div className="min-w-[520px]">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          <div />
          {columns.map((c) => (
            <div key={c} className="num pb-1 text-center text-[10px] text-[var(--fg-tertiary)]">
              {c}
            </div>
          ))}
          {rows.map((r, ri) => (
            <React.Fragment key={r}>
              <div className="flex items-center pe-2 text-[11px] text-[var(--fg-tertiary)]">{r}</div>
              {columns.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                const intensity = v / max;
                return (
                  <div
                    key={`${r}-${c}`}
                    title={`${r} · ${c} — ${formatByType(v, format)}`}
                    className="aspect-[3/2] rounded-[3px] ring-1 ring-inset ring-[var(--border-subtle)] transition-transform hover:scale-105"
                    style={{
                      backgroundColor:
                        intensity === 0
                          ? 'var(--bg-hover)'
                          : `color-mix(in oklab, var(--chart-heat) ${Math.round(
                              12 + intensity * 88,
                            )}%, transparent)`,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-[var(--fg-tertiary)]">
          <span>נמוך</span>
          <div className="flex gap-[2px]">
            {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
              <span
                key={i}
                className="size-3 rounded-[2px]"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--chart-heat) ${Math.round(i * 100)}%, transparent)`,
                }}
              />
            ))}
          </div>
          <span>גבוה</span>
        </div>
      </div>
    </div>
  );
}
