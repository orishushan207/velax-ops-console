import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { listClubs, type ClubListRow } from '@/server/queries/clubs';
import { CreateClubButton } from '@/components/forms/entity-buttons';
import { clubFormSections } from '@/components/forms/entity-forms';

export const metadata: Metadata = { title: 'מועדונים' };

export default async function ClubsPage() {
  const user = await requirePermission('clubs.view');
  const clubs = await listClubs(user, 30);

  const totals = clubs.reduce(
    (acc, c) => ({
      stations: acc.stations + c.stationCount,
      courts: acc.courts + c.courtCount,
      hours: acc.hours + c.paidHours,
      linkedRevenue: acc.linkedRevenue + c.linkedCourtRevenue,
      openTickets: acc.openTickets + c.openTickets,
    }),
    { stations: 0, courts: 0, hours: 0, linkedRevenue: 0, openTickets: 0 },
  );

  const activeClubs = clubs.filter((c) => c.status === 'active').length;
  const atRisk = clubs.filter((c) => c.earnBackStatus === 'at_risk').length;
  const avgHealth =
    clubs.filter((c) => c.healthScore !== null).length > 0
      ? clubs.reduce((s, c) => s + (c.healthScore ?? 0), 0) /
        clubs.filter((c) => c.healthScore !== null).length
      : null;

  const columns: Column<ClubListRow>[] = [
    {
      key: 'name',
      header: 'מועדון',
      render: (c) => (
        <span>
          {c.name}
          <span className="mono ms-2 text-[11px] text-[var(--fg-tertiary)]">{c.code}</span>
        </span>
      ),
      exportValue: (c) => c.name,
    },
    {
      key: 'region',
      header: 'אזור',
      width: 'w-32',
      render: (c) => <span className="text-[var(--fg-secondary)]">{c.region}</span>,
      exportValue: (c) => c.region,
    },
    {
      key: 'city',
      header: 'עיר',
      width: 'w-28',
      render: (c) => <span className="text-[var(--fg-secondary)]">{c.city}</span>,
      exportValue: (c) => c.city,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'contact',
      header: 'איש קשר',
      render: (c) => <span className="text-[var(--fg-secondary)]">{c.primaryContact ?? '—'}</span>,
      exportValue: (c) => c.primaryContact ?? '',
      hideable: true,
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-24',
      render: (c) => (
        <Badge
          size="sm"
          tone={labels.clubStatus.tone(c.status as Parameters<typeof labels.clubStatus.tone>[0])}
          dot
        >
          {labels.clubStatus.label(c.status as Parameters<typeof labels.clubStatus.label>[0])}
        </Badge>
      ),
      exportValue: (c) =>
        labels.clubStatus.label(c.status as Parameters<typeof labels.clubStatus.label>[0]),
    },
    {
      key: 'courts',
      header: 'מגרשים',
      width: 'w-20',
      align: 'end',
      render: (c) => <span className="num">{c.courtCount}</span>,
      exportValue: (c) => c.courtCount,
    },
    {
      key: 'stations',
      header: 'עמדות',
      width: 'w-20',
      align: 'end',
      render: (c) => <span className="num">{c.stationCount}</span>,
      exportValue: (c) => c.stationCount,
    },
    {
      key: 'joined',
      header: 'הצטרפות',
      width: 'w-28',
      render: (c) => <span className="num text-[var(--fg-secondary)]">{formatDate(c.joinedAt)}</span>,
      exportValue: (c) => c.joinedAt ?? '',
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'contract',
      header: 'סוג הסכם',
      width: 'w-40',
      render: (c) =>
        c.pricingModel ? (
          <Badge size="sm" tone="neutral">
            {labels.pricingModel.label(
              c.pricingModel as Parameters<typeof labels.pricingModel.label>[0],
            )}
          </Badge>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (c) => c.pricingModel ?? '',
      hideable: true,
    },
    {
      key: 'setupFee',
      header: 'דמי הקמה',
      width: 'w-28',
      align: 'end',
      render: (c) => <span className="num">{formatCurrency(c.setupFee)}</span>,
      exportValue: (c) => c.setupFee,
      hideable: true,
    },
    {
      key: 'retainer',
      header: 'ריטיינר חודשי',
      width: 'w-28',
      align: 'end',
      render: (c) =>
        c.monthlyRetainer > 0 ? (
          <span className="num">{formatCurrency(c.monthlyRetainer)}</span>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (c) => c.monthlyRetainer,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'linkedRevenue',
      header: 'הכנסת מגרש מקושרת',
      width: 'w-36',
      align: 'end',
      render: (c) => <span className="num">{formatCurrency(c.linkedCourtRevenue)}</span>,
      exportValue: (c) => c.linkedCourtRevenue,
    },
    {
      key: 'hours',
      header: 'שעות שימוש',
      width: 'w-28',
      align: 'end',
      render: (c) => <span className="num">{formatNumber(c.paidHours, 1)}</span>,
      exportValue: (c) => c.paidHours,
    },
    {
      key: 'uptime',
      header: 'Uptime',
      width: 'w-24',
      align: 'end',
      render: (c) =>
        c.uptimePct === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className={c.uptimePct >= 0.95 ? 'num text-[var(--signal-positive)]' : 'num text-[var(--signal-warning)]'}>
            {formatPercent(c.uptimePct, 0)}
          </span>
        ),
      exportValue: (c) => c.uptimePct ?? '',
    },
    {
      key: 'tickets',
      header: 'תקלות פתוחות',
      width: 'w-28',
      align: 'end',
      render: (c) =>
        c.openTickets > 0 ? (
          <span className="num text-[var(--signal-warning)]">{c.openTickets}</span>
        ) : (
          <span className="num text-[var(--fg-tertiary)]">0</span>
        ),
      exportValue: (c) => c.openTickets,
    },
    {
      key: 'earnBack',
      header: 'התקדמות Earn-Back',
      width: 'w-40',
      render: (c) =>
        c.earnBackProgressPct === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <Progress
              value={c.earnBackProgressPct * 100}
              tone={
                c.earnBackStatus === 'at_risk'
                  ? 'danger'
                  : c.earnBackProgressPct >= 1
                    ? 'accent'
                    : 'info'
              }
              className="w-16"
            />
            <span className="num text-[11px]">{formatPercent(c.earnBackProgressPct, 0)}</span>
          </div>
        ),
      exportValue: (c) => c.earnBackProgressPct ?? '',
    },
    {
      key: 'health',
      header: 'Health Score',
      width: 'w-28',
      align: 'center',
      render: (c) =>
        c.healthScore === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <Badge
            size="sm"
            tone={c.healthScore >= 75 ? 'positive' : c.healthScore >= 55 ? 'warning' : 'danger'}
          >
            {c.healthScore}
          </Badge>
        ),
      exportValue: (c) => c.healthScore ?? '',
    },
    {
      key: 'renewal',
      header: 'חידוש הסכם',
      width: 'w-28',
      render: (c) => <span className="num text-[var(--fg-secondary)]">{formatDate(c.renewalDate)}</span>,
      exportValue: (c) => c.renewalDate ?? '',
      hideable: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="מועדונים"
        description="כל מועדון ברשת, עם מצב ההסכם, השימוש, הזמינות וההתקדמות בערבות ההחזר."
        meta={
          atRisk > 0 ? (
            <Badge tone="danger" dot>
              {atRisk} מועדונים בסיכון Earn-Back
            </Badge>
          ) : undefined
        }
        actions={
          user.permissions.has('clubs.create') ? (
            <CreateClubButton sections={clubFormSections()} />
          ) : undefined
        }
      />

      <KpiGrid columns={6}>
        <KpiCard label="מועדונים" value={formatNumber(clubs.length)} />
        <KpiCard label="פעילים" value={formatNumber(activeClubs)} accent />
        <KpiCard label="עמדות" value={formatNumber(totals.stations)} href="/stations" />
        <KpiCard label="מגרשים" value={formatNumber(totals.courts)} />
        <KpiCard
          label="הכנסת מגרש מקושרת · 30 יום"
          metricKey="machine_linked_court_revenue"
          value={formatCurrency(totals.linkedRevenue)}
          href="/earn-back"
        />
        <KpiCard
          label="Health Score ממוצע"
          metricKey="club_health_score"
          value={avgHealth === null ? '—' : formatNumber(avgHealth, 0)}
        />
      </KpiGrid>

      <Card className="mt-5 p-4">
        <DataTable
          columns={columns}
          rows={clubs}
          rowKey={(c) => c.id}
          rowHref={(c) => `/clubs/${c.id}`}
          exportName="velax-clubs"
          emptyTitle="אין מועדונים"
          emptyDescription="מועדון נוצר בסיום תהליך המכירה במסך CRM."
        />
      </Card>

      <p className="mt-3 text-[11px] text-[var(--fg-tertiary)]">
        נתוני השימוש, ההכנסה וה־Uptime מחושבים על 30 הימים האחרונים.{' '}
        <Link href="/reports" className="text-[var(--accent)] hover:underline">
          לדוחות מפורטים
        </Link>
      </p>
    </>
  );
}
