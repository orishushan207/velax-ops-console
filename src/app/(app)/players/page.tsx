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
import { formatCurrency, formatDuration, formatNumber, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { listPlayers, type PlayerListRow } from '@/server/queries/people';
import { clubScopeSql } from '@/server/queries/sessions';
import { listClubOptions } from '@/server/queries/clubs';
import { CreatePlayerButton } from '@/components/forms/entity-buttons';
import { playerFormSections } from '@/components/forms/entity-forms';

export const metadata: Metadata = { title: 'לקוחות ושחקנים' };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('players.view');
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;
  const canSeePii = user.permissions.has('players.view_pii');
  const canEditPlayers = user.permissions.has('players.edit');

  const [result, clubRows, statsRows, clubOptions] = await Promise.all([
    listPlayers(user, {
      q: params.q,
      level: params.level,
      status: params.status,
      club: params.club,
      page,
    }),
    db.execute(sql`
      SELECT id, name FROM clubs WHERE deleted_at IS NULL AND ${clubScopeSql(user, 'id')} ORDER BY name
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE u.status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE u.status IN ('blocked','suspended'))::int AS blocked,
        COUNT(*) FILTER (WHERE u.created_at >= now() - interval '30 days')::int AS new_30d
      FROM users u JOIN player_profiles p ON p.user_id = u.id
      WHERE u.is_player = true AND u.deleted_at IS NULL
    `),
    canEditPlayers ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const stats = (statsRows.rows[0] ?? {}) as Record<string, number>;
  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { value: String(row.id), label: String(row.name) };
  });

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/players?${p.toString()}`;
  };

  const columns: Column<PlayerListRow>[] = [
    {
      key: 'name',
      header: 'שחקן',
      render: (p) => (
        <span>
          {p.fullName}
          {p.riskFlags.length > 0 && (
            <Badge size="sm" tone="danger" className="ms-1.5">
              סיכון
            </Badge>
          )}
        </span>
      ),
      exportValue: (p) => p.fullName,
    },
    {
      key: 'contact',
      header: 'פרטי קשר',
      width: 'w-44',
      render: (p) =>
        canSeePii ? (
          <span className="mono text-[11px] text-[var(--fg-secondary)]">
            {p.phone ?? p.email ?? '—'}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--fg-tertiary)]">מוסתר — נדרשת הרשאה</span>
        ),
      exportValue: (p) => (canSeePii ? (p.phone ?? p.email ?? '') : 'מוסתר'),
    },
    {
      key: 'level',
      header: 'רמה',
      width: 'w-32',
      render: (p) => (
        <Badge
          size="sm"
          tone={labels.playerLevel.tone(p.level as Parameters<typeof labels.playerLevel.tone>[0])}
        >
          {labels.playerLevel.label(p.level as Parameters<typeof labels.playerLevel.label>[0])}
        </Badge>
      ),
      exportValue: (p) => p.level,
    },
    {
      key: 'tier',
      header: 'רמת חברות',
      width: 'w-32',
      render: (p) => (
        <Badge
          size="sm"
          tone={labels.membershipTier.tone(
            p.membershipTier as Parameters<typeof labels.membershipTier.tone>[0],
          )}
        >
          {labels.membershipTier.label(
            p.membershipTier as Parameters<typeof labels.membershipTier.label>[0],
          )}
        </Badge>
      ),
      exportValue: (p) => p.membershipTier,
      hideable: true,
    },
    {
      key: 'club',
      header: 'מועדון מועדף',
      render: (p) =>
        p.preferredClubId ? (
          <Link href={`/clubs/${p.preferredClubId}`} className="hover:text-[var(--accent)]">
            {p.preferredClubName}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (p) => p.preferredClubName ?? '',
    },
    {
      key: 'sessions',
      header: 'סשנים',
      width: 'w-24',
      align: 'end',
      render: (p) => <span className="num">{p.sessionCount}</span>,
      exportValue: (p) => p.sessionCount,
    },
    {
      key: 'minutes',
      header: 'דקות אימון',
      width: 'w-28',
      align: 'end',
      render: (p) => <span className="num text-[var(--fg-secondary)]">{formatDuration(p.paidMinutes)}</span>,
      exportValue: (p) => p.paidMinutes,
    },
    {
      key: 'spent',
      header: 'הכנסה נטו',
      width: 'w-28',
      align: 'end',
      render: (p) => (
        <span className="num">
          {formatCurrency(p.totalSpentNet)}
          {p.refundedTotal > 0 && (
            <span className="ms-1 text-[10px] text-[var(--signal-danger)]">−{formatCurrency(p.refundedTotal)}</span>
          )}
        </span>
      ),
      exportValue: (p) => p.totalSpentNet,
    },
    {
      key: 'xp',
      header: 'XP',
      width: 'w-24',
      align: 'end',
      render: (p) => <span className="num text-[var(--fg-secondary)]">{formatNumber(p.xpTotal)}</span>,
      exportValue: (p) => p.xpTotal,
      hideable: true,
    },
    {
      key: 'streak',
      header: 'Streak',
      width: 'w-24',
      align: 'end',
      render: (p) => (
        <span className="num text-[var(--fg-secondary)]">
          {p.streakWeeks > 0 ? `${p.streakWeeks} שב׳` : '—'}
        </span>
      ),
      exportValue: (p) => p.streakWeeks,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'coach',
      header: 'מאמן משייך',
      width: 'w-36',
      render: (p) => <span className="text-[11px] text-[var(--fg-secondary)]">{p.coachName ?? '—'}</span>,
      exportValue: (p) => p.coachName ?? '',
      hideable: true,
    },
    {
      key: 'last',
      header: 'אימון אחרון',
      width: 'w-32',
      render: (p) => (
        <span className="text-[11px] text-[var(--fg-secondary)]">
          {p.lastSessionAt ? formatRelative(p.lastSessionAt) : 'מעולם'}
        </span>
      ),
      exportValue: (p) => (p.lastSessionAt ? p.lastSessionAt.toISOString() : ''),
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-24',
      align: 'center',
      render: (p) => (
        <Badge
          size="sm"
          tone={labels.userStatus.tone(p.status as Parameters<typeof labels.userStatus.tone>[0])}
        >
          {labels.userStatus.label(p.status as Parameters<typeof labels.userStatus.label>[0])}
        </Badge>
      ),
      exportValue: (p) => p.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="לקוחות ושחקנים"
        description="פרופיל השחקן, היסטוריית האימונים, התשלומים וההטבות."
        actions={
          canEditPlayers ? (
            <CreatePlayerButton sections={playerFormSections({}, clubOptions)} />
          ) : undefined
        }
      />

      <KpiGrid columns={4}>
        <KpiCard label="שחקנים רשומים" value={formatNumber(Number(stats.total ?? 0))} />
        <KpiCard label="פעילים" value={formatNumber(Number(stats.active ?? 0))} accent />
        <KpiCard label="חדשים · 30 יום" value={formatNumber(Number(stats.new_30d ?? 0))} />
        <KpiCard
          label="חסומים או מושעים"
          value={formatNumber(Number(stats.blocked ?? 0))}
          higherIsBetter={false}
        />
      </KpiGrid>

      {!canSeePii && (
        <Callout tone="info" className="mt-4">
          פרטים מזהים (טלפון ואימייל) מוסתרים. הצגתם דורשת הרשאת{' '}
          <span className="mono">players.view_pii</span> — וכל צפייה בהם נרשמת ב־Audit Log.
        </Callout>
      )}

      <div className="mt-5">
        <FilterBar
          showDateRange={false}
          searchKey="q"
          searchPlaceholder="שם, טלפון או אימייל…"
          filters={[
            { key: 'level', label: 'רמות', options: labels.playerLevel.options() },
            { key: 'status', label: 'סטטוסים', options: labels.userStatus.options() },
            { key: 'club', label: 'מועדונים', options: clubs },
          ]}
        />
        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(p) => p.userId}
            rowHref={(p) => `/players/${p.userId}`}
            exportName="velax-players"
            emptyTitle="לא נמצאו שחקנים"
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
