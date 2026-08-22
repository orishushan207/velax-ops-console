import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { TimeSeriesChart } from '@/components/charts/primitives';
import { db } from '@/db/client';
import { resolveRange } from '@/lib/date-range';
import { formatCurrency, formatDateTime, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getIntegrationStatus } from '@/server/providers';
import { clubScopeSql } from '@/server/queries/sessions';
import {
  getPaymentSeries,
  getPaymentStats,
  getRefundAnomalies,
  listPayments,
  type PaymentListRow,
} from '@/server/queries/finance';
import { getSettings } from '@/server/settings/service';

export const metadata: Metadata = { title: 'תשלומים וזיכויים' };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('payments.view');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const settings = await getSettings();
  const anomalyThreshold = settings.num('refund.club_anomaly_rate_pct', 0.08);
  const refundTarget = settings.num('quality.refund_rate_alert_pct', 0.03);

  const [result, stats, series, anomalies, clubRows] = await Promise.all([
    listPayments(user, {
      status: params.status,
      club: params.club,
      method: params.method,
      q: params.q,
      from: range.from,
      to: range.to,
      page,
    }),
    getPaymentStats(user, range.from, range.to),
    getPaymentSeries(user, range.from, range.to),
    getRefundAnomalies(user, anomalyThreshold),
    db.execute(sql`
      SELECT id, name FROM clubs WHERE deleted_at IS NULL AND ${clubScopeSql(user, 'id')} ORDER BY name
    `),
  ]);

  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { value: String(row.id), label: String(row.name) };
  });

  const paymentProvider = getIntegrationStatus().find((i) => i.key === 'payments');
  const refundRate =
    stats.capturedCount > 0 ? stats.refundCount / stats.capturedCount : null;

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/payments?${p.toString()}`;
  };

  const columns: Column<PaymentListRow>[] = [
    {
      key: 'reference',
      header: 'מזהה תשלום',
      width: 'w-36',
      render: (p) => <span className="mono">{p.reference}</span>,
      exportValue: (p) => p.reference,
    },
    {
      key: 'session',
      header: 'Session',
      width: 'w-36',
      render: (p) =>
        p.sessionId ? (
          <Link href={`/sessions/${p.sessionId}`} className="mono hover:text-[var(--accent)]">
            {p.sessionReference}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (p) => p.sessionReference ?? '',
    },
    {
      key: 'player',
      header: 'שחקן',
      render: (p) => <span className="truncate">{p.playerName ?? '—'}</span>,
      exportValue: (p) => p.playerName ?? '',
    },
    {
      key: 'club',
      header: 'מועדון',
      render: (p) =>
        p.clubId ? (
          <Link href={`/clubs/${p.clubId}`} className="hover:text-[var(--accent)]">
            {p.clubName}
          </Link>
        ) : (
          '—'
        ),
      exportValue: (p) => p.clubName ?? '',
      hideable: true,
    },
    {
      key: 'gross',
      header: 'ברוטו (כולל מע״מ)',
      width: 'w-36',
      align: 'end',
      render: (p) => <span className="num font-medium">{formatCurrency(p.amountGross, true)}</span>,
      exportValue: (p) => p.amountGross,
    },
    {
      key: 'vat',
      header: 'מע״מ',
      width: 'w-24',
      align: 'end',
      render: (p) => <span className="num text-[var(--fg-secondary)]">{formatCurrency(p.vatAmount, true)}</span>,
      exportValue: (p) => p.vatAmount,
      hideable: true,
    },
    {
      key: 'net',
      header: 'נטו (לפני מע״מ)',
      width: 'w-32',
      align: 'end',
      render: (p) => <span className="num">{formatCurrency(p.amountNet, true)}</span>,
      exportValue: (p) => p.amountNet,
    },
    {
      key: 'fee',
      header: 'עמלת סליקה',
      width: 'w-28',
      align: 'end',
      render: (p) => <span className="num text-[var(--fg-secondary)]">{formatCurrency(p.processingFee, true)}</span>,
      exportValue: (p) => p.processingFee,
      hideable: true,
    },
    {
      key: 'refunded',
      header: 'זוכה',
      width: 'w-24',
      align: 'end',
      render: (p) =>
        p.refundedAmount > 0 ? (
          <span className="num text-[var(--signal-danger)]">−{formatCurrency(p.refundedAmount, true)}</span>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (p) => p.refundedAmount,
    },
    {
      key: 'method',
      header: 'אמצעי',
      width: 'w-36',
      render: (p) => (
        <span className="text-[var(--fg-secondary)]">
          {labels.paymentMethod.label(p.method as Parameters<typeof labels.paymentMethod.label>[0])}
          {p.cardLast4 && <span className="mono ms-1.5 text-[10px]">••{p.cardLast4}</span>}
        </span>
      ),
      exportValue: (p) => p.method,
      hideable: true,
    },
    {
      key: 'txId',
      header: 'מזהה עסקה',
      width: 'w-44',
      render: (p) => (
        <span className="mono text-[10px] text-[var(--fg-tertiary)]">
          {p.providerTransactionId ?? '—'}
        </span>
      ),
      exportValue: (p) => p.providerTransactionId ?? '',
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'captured',
      header: 'נגבה',
      width: 'w-36',
      render: (p) => (
        <span className="num text-[11px] text-[var(--fg-secondary)]">
          {p.capturedAt ? formatDateTime(p.capturedAt) : '—'}
        </span>
      ),
      exportValue: (p) => (p.capturedAt ? formatDateTime(p.capturedAt) : ''),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-32',
      align: 'center',
      render: (p) => (
        <Badge
          size="sm"
          tone={labels.paymentStatus.tone(p.status as Parameters<typeof labels.paymentStatus.tone>[0])}
        >
          {labels.paymentStatus.label(p.status as Parameters<typeof labels.paymentStatus.label>[0])}
        </Badge>
      ),
      exportValue: (p) => p.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="תשלומים וזיכויים"
        description="ספר התשלומים המלא. כל שורה מפרידה בין ברוטו כולל מע״מ, מע״מ, נטו ועמלת סליקה."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/payments/refunds">
              מסך הזיכויים
              <ArrowLeft />
            </Link>
          </Button>
        }
        meta={
          paymentProvider?.isMock ? (
            <Badge tone="warning" dot>
              ספק סליקה במצב Mock — לא בוצעו חיובים אמיתיים
            </Badge>
          ) : undefined
        }
      />

      <KpiGrid columns={6}>
        <KpiCard
          label="גבייה ברוטו"
          value={formatCurrency(stats.grossRevenue)}
          hint="כולל מע״מ. אינה הכנסה חשבונאית ואינה רווח."
        />
        <KpiCard
          label="מע״מ"
          value={formatCurrency(stats.vatAmount)}
          hint="מועבר לרשות המסים ואינו הכנסה."
        />
        <KpiCard
          label="הכנסה נטו"
          value={formatCurrency(stats.netRevenue)}
          accent
          hint="לפני מע״מ, לפני ניכוי כל עלות."
        />
        <KpiCard
          label="עמלות סליקה"
          value={formatCurrency(stats.processingFees)}
          higherIsBetter={false}
        />
        <KpiCard
          label="זיכויים"
          value={formatCurrency(stats.refundedGross)}
          higherIsBetter={false}
          href="/payments/refunds"
        />
        <KpiCard
          label="שיעור זיכויים"
          metricKey="refund_rate"
          value={refundRate === null ? '—' : formatPercent(refundRate)}
          higherIsBetter={false}
          target={`< ${formatPercent(refundTarget, 0)}`}
          targetMet={refundRate !== null ? refundRate < refundTarget : null}
        />
      </KpiGrid>

      {stats.pendingRefundCount > 0 && (
        <Callout tone="warning" icon={AlertTriangle} className="mt-4">
          {stats.pendingRefundCount} בקשות זיכוי ממתינות לאישור, בסכום כולל של{' '}
          {formatCurrency(stats.pendingRefundGross)}.{' '}
          <Link href="/payments/refunds?status=pending_approval" className="underline">
            למסך האישורים
          </Link>
        </Callout>
      )}

      {anomalies.length > 0 && (
        <Callout tone="danger" icon={AlertTriangle} title="שיעור זיכויים חריג" className="mt-4">
          {anomalies.map((a) => (
            <span key={a.clubId} className="me-3 inline-block">
              <Link href={`/clubs/${a.clubId}`} className="underline">
                {a.clubName}
              </Link>{' '}
              — {formatPercent(a.rate)} ({a.refundedSessions}/{a.paidSessions})
            </span>
          ))}
          <br />
          שיעור מעל {formatPercent(anomalyThreshold, 0)} ב־30 יום מצביע על בעיית איכות בעמדה או
          על דפוס חריג שדורש בדיקה.
        </Callout>
      )}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>הכנסה, עמלות וזיכויים לאורך זמן</CardTitle>
          <CardDescription>הכנסה נטו לפני מע״מ, מול עמלות הסליקה והזיכויים שניתנו.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart
            data={series}
            series={[
              { key: 'net', label: 'הכנסה נטו' },
              { key: 'fees', label: 'עמלות סליקה', color: '#fb923c' },
              { key: 'refunds', label: 'זיכויים', color: '#ef4444' },
            ]}
            format="currency"
            height={260}
          />
        </CardContent>
      </Card>

      <div className="mt-5">
        <FilterBar
          searchKey="q"
          searchPlaceholder="מזהה תשלום, מזהה עסקה או Session…"
          filters={[
            { key: 'status', label: 'סטטוסים', options: labels.paymentStatus.options() },
            { key: 'method', label: 'אמצעי תשלום', options: labels.paymentMethod.options() },
            { key: 'club', label: 'מועדונים', options: clubs },
          ]}
        />
        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(p) => p.id}
            rowHref={(p) => (p.sessionId ? `/sessions/${p.sessionId}` : `/payments`)}
            exportName={`velax-payments-${range.preset}`}
            emptyTitle="אין תשלומים בתקופה"
            pagination={{
              page: result.page,
              pageSize: result.pageSize,
              total: result.total,
              buildHref,
            }}
          />
        </Card>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--fg-tertiary)]">
        <strong className="text-[var(--fg-secondary)]">הבהרה חשבונאית:</strong> גבייה ברוטו כוללת
        מע״מ ואינה הכנסה. הכנסה נטו היא לפני ניכוי עלויות משתנות וקבועות ואינה רווח. הרווח
        התפעולי מוצג במסך{' '}
        <Link href="/finance" className="text-[var(--accent)] hover:underline">
          כספים וכלכלת יחידה
        </Link>
        .
      </p>
    </>
  );
}
