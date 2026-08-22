import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { resolveRange } from '@/lib/date-range';
import { requirePermission } from '@/server/auth/guard';
import { getCoreVolume, getQualityMetrics } from '@/server/metrics/kpis';
import { clubScopeSql, listSessions, type SessionListRow } from '@/server/queries/sessions';

export const metadata: Metadata = { title: 'Sessions והזמנות' };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('sessions.view');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const clubRows = await db.execute(sql`
    SELECT id, name FROM clubs WHERE deleted_at IS NULL AND ${clubScopeSql(user, 'id')} ORDER BY name
  `);
  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { value: String(row.id), label: String(row.name) };
  });

  const scopedClubIds =
    params.club && params.club !== 'all'
      ? [params.club]
      : user.isGlobal
        ? null
        : (user.clubIds ?? []);

  const [result, volume, quality] = await Promise.all([
    listSessions(user, {
      status: params.status,
      club: params.club,
      q: params.q,
      from: range.from,
      to: range.to,
      page,
      pageSize: 30,
    }),
    getCoreVolume({ range, clubIds: scopedClubIds }),
    getQualityMetrics({ range, clubIds: scopedClubIds }),
  ]);

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/sessions?${p.toString()}`;
  };

  const columns: Column<SessionListRow>[] = [
    {
      key: 'reference',
      header: 'מזהה',
      width: 'w-36',
      render: (r) => <span className="mono">{r.reference}</span>,
      exportValue: (r) => r.reference,
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-32',
      render: (r) => (
        <Badge
          size="sm"
          tone={labels.sessionStatus.tone(r.status as Parameters<typeof labels.sessionStatus.tone>[0])}
          dot
        >
          {labels.sessionStatus.label(r.status as Parameters<typeof labels.sessionStatus.label>[0])}
        </Badge>
      ),
      exportValue: (r) =>
        labels.sessionStatus.label(r.status as Parameters<typeof labels.sessionStatus.label>[0]),
    },
    {
      key: 'player',
      header: 'שחקן',
      render: (r) => (
        <span className="truncate">
          {r.playerName}
          {r.playerCount === 2 && (
            <span className="ms-1.5 text-[11px] text-[var(--fg-tertiary)]">· זוג</span>
          )}
        </span>
      ),
      exportValue: (r) => r.playerName,
    },
    {
      key: 'club',
      header: 'מועדון',
      render: (r) => (
        <Link href={`/clubs/${r.clubId}`} className="hover:text-[var(--accent)]">
          {r.clubName}
        </Link>
      ),
      exportValue: (r) => r.clubName,
    },
    {
      key: 'station',
      header: 'עמדה',
      width: 'w-28',
      render: (r) => (
        <Link href={`/stations/${r.stationId}`} className="mono hover:text-[var(--accent)]">
          {r.stationCode}
        </Link>
      ),
      exportValue: (r) => r.stationCode,
      hideable: true,
    },
    {
      key: 'startedAt',
      header: 'התחלה',
      width: 'w-40',
      render: (r) => (
        <span className="num text-[var(--fg-secondary)]">
          {r.startedAt ? formatDateTime(r.startedAt) : '—'}
        </span>
      ),
      exportValue: (r) => (r.startedAt ? formatDateTime(r.startedAt) : ''),
    },
    {
      key: 'duration',
      header: 'משך',
      width: 'w-24',
      align: 'end',
      render: (r) => (
        <span className="num text-[var(--fg-secondary)]">
          {formatDuration(r.actualMinutes ?? r.scheduledMinutes)}
        </span>
      ),
      exportValue: (r) => r.actualMinutes ?? r.scheduledMinutes,
      hideable: true,
    },
    {
      key: 'peak',
      header: 'חלון',
      width: 'w-24',
      render: (r) =>
        r.peakWindow ? (
          <Badge
            size="sm"
            tone={labels.peakWindow.tone(r.peakWindow as Parameters<typeof labels.peakWindow.tone>[0])}
          >
            {labels.peakWindow.label(r.peakWindow as Parameters<typeof labels.peakWindow.label>[0])}
          </Badge>
        ) : (
          '—'
        ),
      exportValue: (r) => r.peakWindow ?? '',
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'amount',
      header: 'סכום (כולל מע״מ)',
      width: 'w-32',
      align: 'end',
      render: (r) => (
        <span className="num">
          {formatCurrency(r.amountGross)}
          {r.refundedAmount > 0 && (
            <span className="ms-1 text-[11px] text-[var(--signal-danger)]">
              −{formatCurrency(r.refundedAmount)}
            </span>
          )}
        </span>
      ),
      exportValue: (r) => r.amountGross,
    },
    {
      key: 'flags',
      header: '',
      width: 'w-16',
      align: 'center',
      render: (r) =>
        r.hasTicket ? (
          <Badge size="sm" tone="warning">
            תקלה
          </Badge>
        ) : null,
      exportValue: (r) => (r.hasTicket ? 'תקלה' : ''),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sessions והזמנות"
        description="כל אימון שנפתח במערכת — כולל כשלים, זיכויים והזמנות מגרש מקושרות."
      />

      <KpiGrid columns={6}>
        <KpiCard
          label="סשנים בתשלום"
          metricKey="paid_session"
          value={formatNumber(volume.paidSessions)}
        />
        <KpiCard label="הושלמו" value={formatNumber(volume.completedSessions)} />
        <KpiCard
          label="כשלו בהתחלה"
          value={formatNumber(volume.failedToStartSessions)}
          higherIsBetter={false}
          href="/sessions?status=failed_to_start"
        />
        <KpiCard
          label="Start Success"
          metricKey="start_success_rate"
          value={quality.startSuccessRate === null ? '—' : formatPercent(quality.startSuccessRate)}
        />
        <KpiCard
          label="שעות בתשלום"
          value={`${formatNumber(volume.totalPaidHours, 1)} ש׳`}
        />
        <KpiCard
          label="הכנסה נטו"
          value={formatCurrency(volume.netRevenue)}
          hint="לפני מע״מ, לפני ניכוי עלויות. אינה רווח."
        />
      </KpiGrid>

      <div className="mt-5">
        <FilterBar
          searchKey="q"
          searchPlaceholder="מזהה סשן, שם שחקן או טלפון…"
          filters={[
            {
              key: 'status',
              label: 'סטטוסים',
              options: [
                { value: 'open', label: 'פעילים כרגע' },
                { value: 'paid', label: 'בתשלום בלבד' },
                ...labels.sessionStatus.options(),
              ],
            },
            { key: 'club', label: 'מועדונים', options: clubs },
          ]}
        />

        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(r) => r.id}
            rowHref={(r) => `/sessions/${r.id}`}
            exportName={`velax-sessions-${range.preset}`}
            emptyTitle="לא נמצאו סשנים"
            emptyDescription="נסה להרחיב את טווח התאריכים או לנקות את המסננים."
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
