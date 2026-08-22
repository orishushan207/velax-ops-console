import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { BarSeriesChart } from '@/components/charts/primitives';
import { db } from '@/db/client';
import { resolveRange } from '@/lib/date-range';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { clubScopeSql } from '@/server/queries/sessions';
import {
  getPaymentStats,
  getRefundReasonBreakdown,
  listRefunds,
  type RefundListRow,
} from '@/server/queries/finance';
import { getSettings } from '@/server/settings/service';

export const metadata: Metadata = { title: 'זיכויים' };

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('payments.view');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const [result, stats, breakdown, settings, clubRows] = await Promise.all([
    listRefunds(user, {
      status: params.status,
      reason: params.reason,
      club: params.club,
      from: range.from,
      to: range.to,
      page,
    }),
    getPaymentStats(user, range.from, range.to),
    getRefundReasonBreakdown(user, range.from, range.to),
    getSettings(),
    db.execute(sql`
      SELECT id, name FROM clubs WHERE deleted_at IS NULL AND ${clubScopeSql(user, 'id')} ORDER BY name
    `),
  ]);

  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { value: String(row.id), label: String(row.name) };
  });

  const threshold = settings.num('refund.approval_threshold_ils', 200);

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/payments/refunds?${p.toString()}`;
  };

  const columns: Column<RefundListRow>[] = [
    {
      key: 'reference',
      header: 'מזהה זיכוי',
      width: 'w-36',
      render: (r) => <span className="mono">{r.reference}</span>,
      exportValue: (r) => r.reference,
    },
    {
      key: 'session',
      header: 'Session',
      width: 'w-36',
      render: (r) =>
        r.sessionId ? (
          <Link href={`/sessions/${r.sessionId}`} className="mono hover:text-[var(--accent)]">
            {r.sessionReference}
          </Link>
        ) : (
          '—'
        ),
      exportValue: (r) => r.sessionReference ?? '',
    },
    {
      key: 'amount',
      header: 'סכום (כולל מע״מ)',
      width: 'w-36',
      align: 'end',
      render: (r) => (
        <span className="num font-medium text-[var(--signal-danger)]">−{formatCurrency(r.amountGross, true)}</span>
      ),
      exportValue: (r) => r.amountGross,
    },
    {
      key: 'net',
      header: 'נטו',
      width: 'w-28',
      align: 'end',
      render: (r) => <span className="num text-[var(--fg-secondary)]">{formatCurrency(r.amountNet, true)}</span>,
      exportValue: (r) => r.amountNet,
      hideable: true,
    },
    {
      key: 'type',
      header: 'סוג',
      width: 'w-28',
      render: (r) => (
        <Badge size="sm" tone={labels.refundType.tone(r.refundType as 'full')}>
          {labels.refundType.label(r.refundType as 'full')}
        </Badge>
      ),
      exportValue: (r) => r.refundType,
    },
    {
      key: 'reason',
      header: 'סיבה',
      width: 'w-40',
      render: (r) => (
        <Badge
          size="sm"
          tone={labels.refundReason.tone(r.reason as Parameters<typeof labels.refundReason.tone>[0])}
        >
          {labels.refundReason.label(r.reason as Parameters<typeof labels.refundReason.label>[0])}
        </Badge>
      ),
      exportValue: (r) => r.reason,
    },
    {
      key: 'note',
      header: 'פירוט',
      render: (r) => <span className="truncate text-[var(--fg-secondary)]">{r.reasonNote}</span>,
      exportValue: (r) => r.reasonNote,
    },
    {
      key: 'destination',
      header: 'יעד',
      width: 'w-40',
      render: (r) => (
        <span className="text-[11px] text-[var(--fg-secondary)]">
          {labels.refundDestination.label(
            r.destination as Parameters<typeof labels.refundDestination.label>[0],
          )}
        </span>
      ),
      exportValue: (r) => r.destination,
      hideable: true,
    },
    {
      key: 'club',
      header: 'מועדון',
      render: (r) =>
        r.clubId ? (
          <Link href={`/clubs/${r.clubId}`} className="hover:text-[var(--accent)]">
            {r.clubName}
          </Link>
        ) : (
          '—'
        ),
      exportValue: (r) => r.clubName ?? '',
      hideable: true,
    },
    {
      key: 'actor',
      header: 'מבצע / מאשר',
      width: 'w-44',
      render: (r) => (
        <span className="text-[11px] text-[var(--fg-secondary)]">
          {r.isAutomatic ? (
            <Badge size="sm" tone="info">
              אוטומטי
            </Badge>
          ) : (
            <>
              {r.requestedByName ?? '—'}
              {r.approvedByName && ` · אישר: ${r.approvedByName}`}
            </>
          )}
        </span>
      ),
      exportValue: (r) => `${r.requestedByName ?? ''} ${r.approvedByName ?? ''}`.trim(),
    },
    {
      key: 'processed',
      header: 'בוצע',
      width: 'w-36',
      render: (r) => (
        <span className="num text-[11px] text-[var(--fg-secondary)]">
          {r.processedAt ? formatDateTime(r.processedAt) : '—'}
        </span>
      ),
      exportValue: (r) => (r.processedAt ? formatDateTime(r.processedAt) : ''),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-32',
      align: 'center',
      render: (r) => (
        <Badge
          size="sm"
          tone={labels.refundStatus.tone(r.status as Parameters<typeof labels.refundStatus.tone>[0])}
        >
          {labels.refundStatus.label(r.status as Parameters<typeof labels.refundStatus.label>[0])}
        </Badge>
      ),
      exportValue: (r) => r.status,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'תשלומים', href: '/payments' }, { label: 'זיכויים' }]}
        title="זיכויים"
        description={`כל זיכוי נושא סיבה מובנית, פירוט, מבצע ומאשר. זיכוי מעל ${formatCurrency(threshold)} דורש אישור.`}
      />

      <KpiGrid columns={5}>
        <KpiCard
          label="סה״כ זיכויים"
          value={formatCurrency(stats.refundedGross)}
          higherIsBetter={false}
        />
        <KpiCard label="מספר זיכויים" value={formatNumber(stats.refundCount)} higherIsBetter={false} />
        <KpiCard
          label="ממתינים לאישור"
          value={formatNumber(stats.pendingRefundCount)}
          higherIsBetter={false}
          href="/payments/refunds?status=pending_approval"
        />
        <KpiCard
          label="זיכויים אוטומטיים"
          value={formatNumber(stats.automaticRefundCount)}
          hint="נוצרו על ידי כללי המערכת — למשל סשן ששולם ולא התחיל."
        />
        <KpiCard
          label="Chargebacks"
          value={formatNumber(stats.chargebackCount)}
          higherIsBetter={false}
        />
      </KpiGrid>

      {breakdown.length > 0 && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>סיבות הזיכוי</CardTitle>
            <CardDescription>
              הפילוח הזה הוא כלי איכות: סיבה שחוזרת מצביעה על בעיה במוצר או בעמדה, לא על לקוחות.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              layout="horizontal"
              data={breakdown.map((b) => ({
                label: labels.refundReason.label(
                  b.reason as Parameters<typeof labels.refundReason.label>[0],
                ),
                amount: b.amount,
              }))}
              series={[{ key: 'amount', label: 'סכום זיכוי', color: '#ef4444' }]}
              format="currency"
              height={Math.max(180, breakdown.length * 36)}
            />
          </CardContent>
        </Card>
      )}

      <div className="mt-5">
        <FilterBar
          filters={[
            { key: 'status', label: 'סטטוסים', options: labels.refundStatus.options() },
            { key: 'reason', label: 'סיבות', options: labels.refundReason.options() },
            { key: 'club', label: 'מועדונים', options: clubs },
          ]}
        />
        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(r) => r.id}
            exportName={`velax-refunds-${range.preset}`}
            emptyTitle="אין זיכויים בתקופה"
            pagination={{
              page: result.page,
              pageSize: result.pageSize,
              total: result.total,
              buildHref,
            }}
          />
        </Card>
      </div>
    </>
  );
}
