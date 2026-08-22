import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { BarSeriesChart } from '@/components/charts/primitives';
import { formatCurrency, formatDate, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { listLeads, listSalesOwners, type LeadRow } from '@/server/queries/crm';
import { CreateLeadButton } from '@/components/forms/entity-buttons';
import { leadFormSections } from '@/components/forms/entity-forms';

export const metadata: Metadata = { title: 'CRM ומכירות' };

/** סדר שלבי ה־Pipeline לתצוגת Kanban */
const PIPELINE_STAGES = [
  'lead',
  'contacted',
  'qualified',
  'demo_scheduled',
  'demo_completed',
  'proposal_sent',
  'negotiation',
  'pilot_agreed',
  'contract_sent',
  'contract_signed',
  'installation_scheduled',
  'live',
] as const;

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('crm.view');
  const canManageCrm = user.permissions.has('crm.manage');
  const params = await searchParams;

  const [leads, owners] = await Promise.all([
    listLeads({ stage: params.stage, owner: params.owner, q: params.q }),
    listSalesOwners(),
  ]);

  const openLeads = leads.filter((l) => !['lost', 'live'].includes(l.stage));
  const wonLeads = leads.filter((l) => l.stage === 'live');
  const lostLeads = leads.filter((l) => l.stage === 'lost');
  const pipelineValue = openLeads.reduce((s, l) => s + l.dealValue, 0);
  const weightedValue = openLeads.reduce((s, l) => s + l.weightedValue, 0);
  const stationPotential = openLeads.reduce((s, l) => s + (l.stationPotential ?? 0), 0);
  const overdueFollowUps = openLeads.filter(
    (l) => l.nextFollowUpAt && l.nextFollowUpAt < new Date(),
  );

  const byStage = new Map<string, LeadRow[]>();
  for (const l of leads) {
    const list = byStage.get(l.stage) ?? [];
    list.push(l);
    byStage.set(l.stage, list);
  }

  const funnelData = PIPELINE_STAGES.map((stage) => ({
    label: labels.leadStage.label(stage),
    count: (byStage.get(stage) ?? []).length,
    value: (byStage.get(stage) ?? []).reduce((s, l) => s + l.dealValue, 0),
  })).filter((d) => d.count > 0);

  const columns: Column<LeadRow>[] = [
    { key: 'name', header: 'מועדון', render: (l) => l.clubName, exportValue: (l) => l.clubName },
    {
      key: 'stage',
      header: 'שלב',
      width: 'w-36',
      render: (l) => (
        <Badge
          size="sm"
          tone={labels.leadStage.tone(l.stage as Parameters<typeof labels.leadStage.tone>[0])}
          dot
        >
          {labels.leadStage.label(l.stage as Parameters<typeof labels.leadStage.label>[0])}
        </Badge>
      ),
      exportValue: (l) => l.stage,
    },
    {
      key: 'city',
      header: 'עיר',
      width: 'w-28',
      render: (l) => <span className="text-[var(--fg-secondary)]">{l.city ?? '—'}</span>,
      exportValue: (l) => l.city ?? '',
    },
    {
      key: 'courts',
      header: 'מגרשים',
      width: 'w-24',
      align: 'end',
      render: (l) => <span className="num">{l.courtCount ?? '—'}</span>,
      exportValue: (l) => l.courtCount ?? '',
    },
    {
      key: 'potential',
      header: 'פוטנציאל עמדות',
      width: 'w-32',
      align: 'end',
      render: (l) => <span className="num font-medium">{l.stationPotential ?? '—'}</span>,
      exportValue: (l) => l.stationPotential ?? '',
    },
    {
      key: 'offpeak',
      header: 'Off-Peak',
      width: 'w-28',
      align: 'end',
      render: (l) => (
        <span className="num text-[var(--fg-secondary)]">
          {l.offPeakAvailabilityHours === null ? '—' : `${formatNumber(l.offPeakAvailabilityHours, 1)} ש׳`}
        </span>
      ),
      exportValue: (l) => l.offPeakAvailabilityHours ?? '',
      hideable: true,
    },
    {
      key: 'contact',
      header: 'איש קשר',
      render: (l) => (
        <span className="text-[var(--fg-secondary)]">
          {l.contactName ?? '—'}
          {l.contactPhone && (
            <span className="mono block text-[10px] text-[var(--fg-tertiary)]">
              {l.contactPhone}
            </span>
          )}
        </span>
      ),
      exportValue: (l) => l.contactName ?? '',
      hideable: true,
    },
    {
      key: 'owner',
      header: 'אחראי',
      width: 'w-32',
      render: (l) => <span className="text-[var(--fg-secondary)]">{l.ownerName ?? '—'}</span>,
      exportValue: (l) => l.ownerName ?? '',
    },
    {
      key: 'probability',
      header: 'הסתברות',
      width: 'w-24',
      align: 'end',
      render: (l) => <span className="num">{formatPercent(l.closeProbability, 0)}</span>,
      exportValue: (l) => l.closeProbability,
    },
    {
      key: 'value',
      header: 'שווי עסקה',
      width: 'w-28',
      align: 'end',
      render: (l) => <span className="num">{formatCurrency(l.dealValue)}</span>,
      exportValue: (l) => l.dealValue,
    },
    {
      key: 'weighted',
      header: 'שווי משוקלל',
      width: 'w-32',
      align: 'end',
      render: (l) => <span className="num text-[var(--accent)]">{formatCurrency(l.weightedValue)}</span>,
      exportValue: (l) => l.weightedValue,
    },
    {
      key: 'followup',
      header: 'מעקב הבא',
      width: 'w-32',
      render: (l) => {
        if (!l.nextFollowUpAt) return <span className="text-[var(--fg-tertiary)]">—</span>;
        const overdue = l.nextFollowUpAt < new Date();
        return (
          <span className={overdue ? 'text-[11px] text-[var(--signal-danger)]' : 'text-[11px] text-[var(--fg-secondary)]'}>
            {formatRelative(l.nextFollowUpAt)}
          </span>
        );
      },
      exportValue: (l) => (l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : ''),
    },
    {
      key: 'close',
      header: 'סגירה צפויה',
      width: 'w-32',
      render: (l) => (
        <span className="num text-[11px] text-[var(--fg-secondary)]">
          {formatDate(l.expectedCloseDate)}
        </span>
      ),
      exportValue: (l) => l.expectedCloseDate ?? '',
      hideable: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="CRM ומכירות"
        description="Pipeline המועדונים — מליד ראשון ועד עמדה פעילה בשטח."
        meta={
          overdueFollowUps.length > 0 ? (
            <Badge tone="warning" dot>
              {overdueFollowUps.length} מעקבים באיחור
            </Badge>
          ) : undefined
        }
        actions={canManageCrm ? <CreateLeadButton sections={leadFormSections()} /> : undefined}
      />

      <KpiGrid columns={6}>
        <KpiCard label="לידים פתוחים" value={formatNumber(openLeads.length)} />
        <KpiCard
          label="שווי Pipeline"
          value={formatCurrency(pipelineValue)}
          hint="סכום כל העסקאות הפתוחות, ללא שקלול הסתברות."
        />
        <KpiCard
          label="שווי משוקלל"
          value={formatCurrency(weightedValue)}
          accent
          hint="שווי עסקה כפול הסתברות הסגירה — התחזית הריאלית."
        />
        <KpiCard
          label="פוטנציאל עמדות"
          value={formatNumber(stationPotential)}
          hint="סך העמדות שניתן להתקין אם כל הלידים ייסגרו."
        />
        <KpiCard label="נסגרו בהצלחה" value={formatNumber(wonLeads.length)} />
        <KpiCard label="אבדו" value={formatNumber(lostLeads.length)} higherIsBetter={false} />
      </KpiGrid>

      <div className="mt-5">
        <FilterBar
          showDateRange={false}
          searchKey="q"
          searchPlaceholder="שם מועדון או עיר…"
          filters={[
            { key: 'stage', label: 'שלבים', options: labels.leadStage.options() },
            { key: 'owner', label: 'אחראים', options: owners },
          ]}
        />

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">טבלה</TabsTrigger>
            <TabsTrigger value="forecast">תחזית מכירות</TabsTrigger>
            <TabsTrigger value="followups">מעקבים ({openLeads.filter((l) => l.nextFollowUpAt).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <div className="flex gap-3 overflow-x-auto pb-3">
              {PIPELINE_STAGES.map((stage) => {
                const items = byStage.get(stage) ?? [];
                const stageValue = items.reduce((s, l) => s + l.dealValue, 0);
                return (
                  <div key={stage} className="w-[230px] shrink-0">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-[12px] font-medium text-[var(--fg-secondary)]">
                        {labels.leadStage.label(stage)}
                      </span>
                      <span className="num text-[11px] text-[var(--fg-tertiary)]">
                        {items.length}
                      </span>
                    </div>
                    {stageValue > 0 && (
                      <p className="num mb-2 px-1 text-[10px] text-[var(--fg-tertiary)]">
                        {formatCurrency(stageValue)}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {items.map((l) => (
                        <li key={l.id}>
                          <Link
                            href={`/crm/${l.id}`}
                            className="block rounded-[var(--radius-control)] bg-[var(--bg-raised)] p-3 ring-1 ring-inset ring-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)]"
                          >
                            <p className="truncate text-[13px] font-medium">{l.clubName}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)]">
                              {l.city ?? '—'}
                              {l.courtCount ? ` · ${l.courtCount} מגרשים` : ''}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="num text-[11px] font-medium">
                                {formatCurrency(l.dealValue)}
                              </span>
                              <span className="num text-[10px] text-[var(--fg-tertiary)]">
                                {formatPercent(l.closeProbability, 0)}
                              </span>
                            </div>
                            {l.openTaskCount > 0 && (
                              <Badge size="sm" tone="warning" className="mt-2">
                                {l.openTaskCount} משימות
                              </Badge>
                            )}
                          </Link>
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-subtle)] p-4 text-center text-[11px] text-[var(--fg-tertiary)]">
                          ריק
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <Card className="p-4">
              <DataTable
                columns={columns}
                rows={leads}
                rowKey={(l) => l.id}
                rowHref={(l) => `/crm/${l.id}`}
                exportName="velax-leads"
                emptyTitle="אין לידים"
              />
            </Card>
          </TabsContent>

          <TabsContent value="forecast">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline לפי שלב</CardTitle>
                <CardDescription>
                  שווי העסקאות בכל שלב. השווי המשוקלל הוא הבסיס לתחזית ולא הסכום הגולמי.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {funnelData.length === 0 ? (
                  <EmptyState icon={Target} title="אין נתוני Pipeline" />
                ) : (
                  <BarSeriesChart
                    layout="horizontal"
                    data={funnelData}
                    series={[{ key: 'value', label: 'שווי עסקאות' }]}
                    format="currency"
                    height={Math.max(200, funnelData.length * 38)}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>תחזית סגירה</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">שלב</th>
                      <th className="py-2 text-end font-semibold">שווי</th>
                      <th className="py-2 text-end font-semibold">הסתברות</th>
                      <th className="py-2 text-end font-semibold">משוקלל</th>
                      <th className="py-2 text-start font-semibold">סגירה צפויה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openLeads
                      .slice()
                      .sort((a, b) => b.weightedValue - a.weightedValue)
                      .map((l) => (
                        <tr key={l.id} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-2.5">
                            <Link href={`/crm/${l.id}`} className="hover:text-[var(--accent)]">
                              {l.clubName}
                            </Link>
                          </td>
                          <td className="py-2.5">
                            <Badge
                              size="sm"
                              tone={labels.leadStage.tone(
                                l.stage as Parameters<typeof labels.leadStage.tone>[0],
                              )}
                            >
                              {labels.leadStage.label(
                                l.stage as Parameters<typeof labels.leadStage.label>[0],
                              )}
                            </Badge>
                          </td>
                          <td className="num py-2.5 text-end">{formatCurrency(l.dealValue)}</td>
                          <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                            {formatPercent(l.closeProbability, 0)}
                          </td>
                          <td className="num py-2.5 text-end font-medium text-[var(--accent)]">
                            {formatCurrency(l.weightedValue)}
                          </td>
                          <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                            {formatDate(l.expectedCloseDate)}
                          </td>
                        </tr>
                      ))}
                    <tr className="border-t-2 border-[var(--border-default)]">
                      <td colSpan={2} className="py-2.5 font-medium">
                        סה״כ
                      </td>
                      <td className="num py-2.5 text-end font-semibold">
                        {formatCurrency(pipelineValue)}
                      </td>
                      <td />
                      <td className="num py-2.5 text-end font-semibold text-[var(--accent)]">
                        {formatCurrency(weightedValue)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4" />
                  מעקבים מתוזמנים
                </CardTitle>
              </CardHeader>
              <CardContent>
                {openLeads.filter((l) => l.nextFollowUpAt).length === 0 ? (
                  <EmptyState icon={CalendarClock} title="אין מעקבים מתוזמנים" />
                ) : (
                  <ul className="space-y-1.5">
                    {openLeads
                      .filter((l) => l.nextFollowUpAt)
                      .sort(
                        (a, b) =>
                          (a.nextFollowUpAt?.getTime() ?? 0) - (b.nextFollowUpAt?.getTime() ?? 0),
                      )
                      .map((l) => {
                        const overdue = l.nextFollowUpAt! < new Date();
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/crm/${l.id}`}
                              className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] p-3 transition-colors ${
                                overdue
                                  ? 'bg-[var(--signal-danger-bg)] ring-1 ring-inset ring-[var(--signal-danger-ring)] hover:bg-[var(--signal-danger-bg)]'
                                  : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-active)]'
                              }`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium">
                                  {l.clubName}
                                </span>
                                <span className="block text-[11px] text-[var(--fg-tertiary)]">
                                  {l.ownerName ?? 'ללא אחראי'} ·{' '}
                                  {labels.leadStage.label(
                                    l.stage as Parameters<typeof labels.leadStage.label>[0],
                                  )}
                                </span>
                              </span>
                              <span
                                className={`num text-[12px] ${overdue ? 'text-[var(--signal-danger)]' : 'text-[var(--fg-secondary)]'}`}
                              >
                                {formatRelative(l.nextFollowUpAt)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
