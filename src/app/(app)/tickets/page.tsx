import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatCurrency, formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { clubScopeSql } from '@/server/queries/sessions';
import { getTicketStats, listTickets, listTechnicians, type TicketListRow } from '@/server/queries/tickets';
import { NewTicketButton } from './ticket-actions';

export const metadata: Metadata = { title: 'תקלות ושירות' };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('tickets.view');
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const [result, stats, technicians, clubRows, stationRows, deviceRows] = await Promise.all([
    listTickets(user, {
      status: params.status ?? 'open',
      severity: params.severity,
      category: params.category,
      club: params.club,
      assignee: params.assignee,
      q: params.q,
      page,
      pageSize: 30,
    }),
    getTicketStats(user),
    listTechnicians(),
    db.execute(sql`
      SELECT id, name FROM clubs WHERE deleted_at IS NULL AND ${clubScopeSql(user, 'id')} ORDER BY name
    `),
    db.execute(sql`
      SELECT st.id, st.code, st.club_id FROM stations st
      WHERE st.deleted_at IS NULL AND ${clubScopeSql(user, 'st.club_id')} ORDER BY st.code
    `),
    db.execute(sql`
      SELECT d.id, d.device_id, d.current_club_id FROM devices d
      WHERE d.deleted_at IS NULL AND (d.current_club_id IS NULL OR ${clubScopeSql(user, 'd.current_club_id')})
      ORDER BY d.device_id
    `),
  ]);

  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { id: String(row.id), label: String(row.name) };
  });

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/tickets?${p.toString()}`;
  };

  const columns: Column<TicketListRow>[] = [
    {
      key: 'reference',
      header: 'מזהה',
      width: 'w-32',
      render: (t) => <span className="mono">{t.reference}</span>,
      exportValue: (t) => t.reference,
    },
    {
      key: 'severity',
      header: 'חומרה',
      width: 'w-28',
      render: (t) => (
        <Badge
          size="sm"
          tone={labels.ticketSeverity.tone(t.severity as Parameters<typeof labels.ticketSeverity.tone>[0])}
          dot
        >
          {labels.ticketSeverity.label(t.severity as Parameters<typeof labels.ticketSeverity.label>[0])}
        </Badge>
      ),
      exportValue: (t) => t.severity,
    },
    {
      key: 'title',
      header: 'כותרת',
      render: (t) => <span className="truncate">{t.title}</span>,
      exportValue: (t) => t.title,
    },
    {
      key: 'category',
      header: 'קטגוריה',
      width: 'w-32',
      render: (t) => (
        <Badge size="sm" tone="neutral">
          {labels.ticketCategory.label(t.category as Parameters<typeof labels.ticketCategory.label>[0])}
        </Badge>
      ),
      exportValue: (t) => t.category,
    },
    {
      key: 'club',
      header: 'מועדון',
      render: (t) =>
        t.clubId ? (
          <Link href={`/clubs/${t.clubId}`} className="hover:text-[var(--accent)]">
            {t.clubName}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (t) => t.clubName ?? '',
    },
    {
      key: 'station',
      header: 'עמדה',
      width: 'w-28',
      render: (t) =>
        t.stationId ? (
          <Link href={`/stations/${t.stationId}`} className="mono hover:text-[var(--accent)]">
            {t.stationCode}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (t) => t.stationCode ?? '',
      hideable: true,
    },
    {
      key: 'assignee',
      header: 'אחראי',
      width: 'w-32',
      render: (t) =>
        t.assigneeName ? (
          <span className="text-[var(--fg-secondary)]">{t.assigneeName}</span>
        ) : (
          <Badge size="sm" tone="warning">
            לא הוקצה
          </Badge>
        ),
      exportValue: (t) => t.assigneeName ?? '',
    },
    {
      key: 'created',
      header: 'נפתחה',
      width: 'w-36',
      render: (t) => (
        <span className="num text-[11px] text-[var(--fg-secondary)]">
          {formatDateTime(t.createdAt)}
        </span>
      ),
      exportValue: (t) => formatDateTime(t.createdAt),
    },
    {
      key: 'sla',
      header: 'SLA',
      width: 'w-32',
      align: 'end',
      render: (t) => {
        if (t.resolvedAt) {
          return t.resolutionBreached ? (
            <Badge size="sm" tone="danger">
              הופר
            </Badge>
          ) : (
            <Badge size="sm" tone="positive">
              עמד
            </Badge>
          );
        }
        if (t.slaMinutesRemaining === null) {
          return <span className="text-[var(--fg-tertiary)]">—</span>;
        }
        if (t.slaMinutesRemaining < 0) {
          return (
            <Badge size="sm" tone="danger">
              חריגה {formatDuration(Math.abs(t.slaMinutesRemaining))}
            </Badge>
          );
        }
        return (
          <span
            className={
              t.slaMinutesRemaining < 240 ? 'num text-[var(--signal-warning)]' : 'num text-[var(--fg-secondary)]'
            }
          >
            נותרו {formatDuration(t.slaMinutesRemaining)}
          </span>
        );
      },
      exportValue: (t) => t.slaMinutesRemaining ?? '',
    },
    {
      key: 'downtime',
      header: 'השבתה',
      width: 'w-24',
      align: 'end',
      render: (t) => (
        <span className="num text-[var(--fg-secondary)]">
          {t.downtimeMinutes > 0 ? formatDuration(t.downtimeMinutes) : '—'}
        </span>
      ),
      exportValue: (t) => t.downtimeMinutes,
      hideable: true,
    },
    {
      key: 'cost',
      header: 'עלות תיקון',
      width: 'w-28',
      align: 'end',
      render: (t) => <span className="num">{formatCurrency(t.repairCost)}</span>,
      exportValue: (t) => t.repairCost,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-32',
      align: 'center',
      render: (t) => (
        <Badge
          size="sm"
          tone={labels.ticketStatus.tone(t.status as Parameters<typeof labels.ticketStatus.tone>[0])}
        >
          {labels.ticketStatus.label(t.status as Parameters<typeof labels.ticketStatus.label>[0])}
        </Badge>
      ),
      exportValue: (t) => t.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="תקלות ושירות"
        description="ניהול קריאות שירות מול התחייבות ה־SLA: מענה, תיקון תוך 24–48 שעות או מכונה חלופית, וזמינות מעל 95%."
        actions={
          user.permissions.has('tickets.create') ? (
            <NewTicketButton
              clubs={clubs}
              stations={stationRows.rows.map((r) => {
                const row = r as Record<string, string>;
                return { id: String(row.id), label: String(row.code), sub: String(row.club_id) };
              })}
              devices={deviceRows.rows.map((r) => {
                const row = r as Record<string, string | null>;
                return {
                  id: String(row.id),
                  label: String(row.device_id),
                  sub: row.current_club_id ? String(row.current_club_id) : undefined,
                };
              })}
            />
          ) : undefined
        }
        meta={
          <>
            {stats.criticalCount > 0 && (
              <Badge tone="danger" dot>
                {stats.criticalCount} קריטיות פתוחות
              </Badge>
            )}
            {stats.atRiskCount > 0 && (
              <Badge tone="warning" dot>
                {stats.atRiskCount} עומדות להפר SLA
              </Badge>
            )}
          </>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard label="קריאות פתוחות" value={formatNumber(stats.openCount)} higherIsBetter={false} />
        <KpiCard
          label="קריטיות"
          value={formatNumber(stats.criticalCount)}
          higherIsBetter={false}
          href="/tickets?severity=critical&status=open"
        />
        <KpiCard
          label="לא הוקצו"
          value={formatNumber(stats.unassignedCount)}
          higherIsBetter={false}
          href="/tickets?assignee=unassigned&status=open"
        />
        <KpiCard
          label="הפרות SLA"
          value={formatNumber(stats.breachedCount)}
          higherIsBetter={false}
          href="/tickets?status=breached"
        />
        <KpiCard
          label="זמן טיפול ממוצע"
          metricKey="mttr"
          value={stats.mttrHours === null ? '—' : formatDuration(stats.mttrHours * 60)}
          higherIsBetter={false}
          target="48:00 ש׳"
          targetMet={stats.mttrHours !== null ? stats.mttrHours <= 48 : null}
        />
        <KpiCard
          label="השבתה מצטברת · 30 יום"
          metricKey="downtime"
          value={formatDuration(stats.downtime30d)}
          higherIsBetter={false}
        />
      </KpiGrid>

      {stats.atRiskCount > 0 && (
        <Callout tone="warning" className="mt-4">
          {stats.atRiskCount} קריאות עומדות להפר את יעד התיקון בתוך פחות מ־4 שעות. הפרת SLA
          משפיעה על זמינות המועדון ועל חישוב ה־Earn-Back שלו.
        </Callout>
      )}

      <div className="mt-5">
        <FilterBar
          showDateRange={false}
          searchKey="q"
          searchPlaceholder="מזהה קריאה או כותרת…"
          filters={[
            {
              key: 'status',
              label: 'סטטוסים',
              allLabel: 'כל הסטטוסים',
              options: [
                { value: 'open', label: 'פתוחות בלבד' },
                { value: 'breached', label: 'הפרות SLA' },
                ...labels.ticketStatus.options(),
              ],
            },
            { key: 'severity', label: 'חומרה', options: labels.ticketSeverity.options() },
            { key: 'category', label: 'קטגוריות', options: labels.ticketCategory.options() },
            { key: 'club', label: 'מועדונים', options: clubs.map((c) => ({ value: c.id, label: c.label })) },
            {
              key: 'assignee',
              label: 'אחראים',
              options: [
                { value: 'unassigned', label: 'לא הוקצו' },
                ...technicians.map((t) => ({ value: t.id, label: t.name })),
              ],
            },
          ]}
        />

        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(t) => t.id}
            rowHref={(t) => `/tickets/${t.id}`}
            exportName="velax-tickets"
            emptyTitle="אין קריאות שירות"
            emptyDescription="נסה לשנות את המסננים או לפתוח קריאה חדשה."
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
