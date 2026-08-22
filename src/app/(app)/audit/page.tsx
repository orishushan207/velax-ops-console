import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { resolveRange } from '@/lib/date-range';
import { formatDateTime, formatNumber } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { clubScopeSql } from '@/server/queries/sessions';

export const metadata: Metadata = { title: 'Audit Log' };

interface AuditRow {
  id: string;
  occurredAt: Date;
  action: string;
  actionKey: string;
  actorName: string | null;
  actorRoleKeys: string[];
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  clubId: string | null;
  clubName: string | null;
  reason: string | null;
  amount: string | null;
  approvedByName: string | null;
  impersonatedByName: string | null;
  ipAddress: string | null;
  succeeded: boolean;
  errorMessage: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('system.view_audit');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const page = Number.parseInt(params.page ?? '1', 10) || 1;
  const pageSize = 50;

  const conditions = [
    sql`a.occurred_at >= ${range.from}`,
    sql`a.occurred_at < ${range.to}`,
    sql`(a.club_id IS NULL OR ${clubScopeSql(user, 'a.club_id')})`,
  ];
  if (params.action && params.action !== 'all') conditions.push(sql`a.action = ${params.action}`);
  if (params.entity && params.entity !== 'all') {
    conditions.push(sql`a.entity_type = ${params.entity}`);
  }
  if (params.actor && params.actor !== 'all') {
    conditions.push(sql`a.actor_user_id = ${params.actor}::uuid`);
  }
  if (params.q) {
    const like = `%${params.q}%`;
    conditions.push(
      sql`(a.action_key ILIKE ${like} OR a.entity_label ILIKE ${like} OR a.reason ILIKE ${like})`,
    );
  }
  const where = sql.join(conditions, sql` AND `);

  const [countRows, rows, statsRows, actorRows, entityRows] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS total FROM audit_logs a WHERE ${where}`),
    db.execute(sql`
      SELECT a.*, u.full_name AS actor_full_name, c.name AS club_name,
             app.full_name AS approved_by_name, imp.full_name AS impersonated_by_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      LEFT JOIN users app ON app.id = a.approved_by_user_id
      LEFT JOIN users imp ON imp.id = a.impersonated_by_user_id
      LEFT JOIN clubs c ON c.id = a.club_id
      WHERE ${where}
      ORDER BY a.occurred_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.action = 'financial_action')::int AS financial,
        COUNT(*) FILTER (WHERE a.action = 'setting_change')::int AS settings,
        COUNT(*) FILTER (WHERE NOT a.succeeded)::int AS failed,
        COUNT(*) FILTER (WHERE a.action = 'permission_denied')::int AS denied,
        COUNT(*) FILTER (WHERE a.action IN ('impersonate_start','impersonate_end'))::int AS impersonation
      FROM audit_logs a WHERE ${where}
    `),
    db.execute(sql`
      SELECT DISTINCT u.id, u.full_name FROM audit_logs a
      JOIN users u ON u.id = a.actor_user_id
      WHERE a.occurred_at >= ${range.from} ORDER BY u.full_name
    `),
    db.execute(sql`
      SELECT DISTINCT entity_type FROM audit_logs WHERE occurred_at >= ${range.from}
      ORDER BY entity_type
    `),
  ]);

  const total = Number((countRows.rows[0] as { total: number }).total ?? 0);
  const stats = (statsRows.rows[0] ?? {}) as Record<string, number>;

  const items: AuditRow[] = rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      occurredAt: new Date(row.occurred_at as string),
      action: String(row.action),
      actionKey: String(row.action_key),
      actorName: row.actor_full_name
        ? String(row.actor_full_name)
        : row.actor_name
          ? String(row.actor_name)
          : null,
      actorRoleKeys: (row.actor_role_keys as string[]) ?? [],
      entityType: String(row.entity_type),
      entityId: row.entity_id ? String(row.entity_id) : null,
      entityLabel: row.entity_label ? String(row.entity_label) : null,
      clubId: row.club_id ? String(row.club_id) : null,
      clubName: row.club_name ? String(row.club_name) : null,
      reason: row.reason ? String(row.reason) : null,
      amount: row.amount ? String(row.amount) : null,
      approvedByName: row.approved_by_name ? String(row.approved_by_name) : null,
      impersonatedByName: row.impersonated_by_name ? String(row.impersonated_by_name) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      succeeded: Boolean(row.succeeded),
      errorMessage: row.error_message ? String(row.error_message) : null,
      beforeValue: (row.before_value as Record<string, unknown>) ?? null,
      afterValue: (row.after_value as Record<string, unknown>) ?? null,
    };
  });

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    p.set('page', String(nextPage));
    return `/audit?${p.toString()}`;
  };

  const entityHref = (r: AuditRow): string | null => {
    if (!r.entityId) return null;
    const map: Record<string, string> = {
      session: '/sessions',
      support_ticket: '/tickets',
      device: '/stations/devices',
      station: '/stations',
      club: '/clubs',
      earn_back_agreement: '/earn-back',
      lead: '/crm',
    };
    const base = map[r.entityType];
    return base ? `${base}/${r.entityId}` : null;
  };

  const columns: Column<AuditRow>[] = [
    {
      key: 'time',
      header: 'מתי',
      width: 'w-40',
      render: (r) => (
        <span className="num text-[11px] text-[var(--fg-secondary)]">
          {formatDateTime(r.occurredAt)}
        </span>
      ),
      exportValue: (r) => formatDateTime(r.occurredAt),
    },
    {
      key: 'actor',
      header: 'מי',
      width: 'w-40',
      render: (r) => (
        <span>
          {r.actorName ?? 'מערכת'}
          {r.impersonatedByName && (
            <Badge size="sm" tone="danger" className="ms-1.5">
              התחזות
            </Badge>
          )}
          {r.actorRoleKeys.length > 0 && (
            <span className="block text-[10px] text-[var(--fg-tertiary)]">
              {r.actorRoleKeys.join(', ')}
            </span>
          )}
        </span>
      ),
      exportValue: (r) => r.actorName ?? 'מערכת',
    },
    {
      key: 'action',
      header: 'סוג פעולה',
      width: 'w-36',
      render: (r) => (
        <Badge
          size="sm"
          tone={labels.auditAction.tone(r.action as Parameters<typeof labels.auditAction.tone>[0])}
        >
          {labels.auditAction.label(r.action as Parameters<typeof labels.auditAction.label>[0])}
        </Badge>
      ),
      exportValue: (r) => r.action,
    },
    {
      key: 'actionKey',
      header: 'פעולה',
      width: 'w-44',
      render: (r) => <span className="mono text-[11px]">{r.actionKey}</span>,
      exportValue: (r) => r.actionKey,
    },
    {
      key: 'entity',
      header: 'ישות',
      render: (r) => {
        const href = entityHref(r);
        const label = r.entityLabel ?? r.entityType;
        return href ? (
          <Link href={href} className="hover:text-[var(--accent)]">
            {label}
          </Link>
        ) : (
          <span className="text-[var(--fg-secondary)]">{label}</span>
        );
      },
      exportValue: (r) => r.entityLabel ?? r.entityType,
    },
    {
      key: 'club',
      header: 'מועדון',
      width: 'w-32',
      render: (r) =>
        r.clubId ? (
          <Link href={`/clubs/${r.clubId}`} className="hover:text-[var(--accent)]">
            {r.clubName}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (r) => r.clubName ?? '',
      hideable: true,
    },
    {
      key: 'amount',
      header: 'סכום',
      width: 'w-24',
      align: 'end',
      render: (r) =>
        r.amount ? (
          <span className="num font-medium">{Number(r.amount).toLocaleString('he-IL')} ₪</span>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (r) => r.amount ?? '',
    },
    {
      key: 'reason',
      header: 'סיבה',
      render: (r) => (
        <span className="truncate text-[11px] text-[var(--fg-secondary)]">{r.reason ?? '—'}</span>
      ),
      exportValue: (r) => r.reason ?? '',
    },
    {
      key: 'approver',
      header: 'מאשר',
      width: 'w-32',
      render: (r) => (
        <span className="text-[11px] text-[var(--fg-secondary)]">{r.approvedByName ?? '—'}</span>
      ),
      exportValue: (r) => r.approvedByName ?? '',
      hideable: true,
    },
    {
      key: 'change',
      header: 'שינוי',
      render: (r) => {
        if (!r.beforeValue && !r.afterValue) return <span className="text-[var(--fg-tertiary)]">—</span>;
        const keys = new Set([
          ...Object.keys(r.beforeValue ?? {}),
          ...Object.keys(r.afterValue ?? {}),
        ]);
        return (
          <span className="mono block max-w-xs truncate text-[10px] text-[var(--fg-tertiary)]">
            {[...keys]
              .slice(0, 3)
              .map(
                (k) =>
                  `${k}: ${JSON.stringify(r.beforeValue?.[k] ?? null)} → ${JSON.stringify(r.afterValue?.[k] ?? null)}`,
              )
              .join(' · ')}
          </span>
        );
      },
      exportValue: (r) => JSON.stringify({ before: r.beforeValue, after: r.afterValue }),
      hideable: true,
    },
    {
      key: 'ip',
      header: 'IP',
      width: 'w-28',
      render: (r) => <span className="mono text-[10px] text-[var(--fg-tertiary)]">{r.ipAddress ?? '—'}</span>,
      exportValue: (r) => r.ipAddress ?? '',
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'result',
      header: 'תוצאה',
      width: 'w-24',
      align: 'center',
      render: (r) =>
        r.succeeded ? (
          <Badge size="sm" tone="positive">
            הצליחה
          </Badge>
        ) : (
          <Badge size="sm" tone="danger" title={r.errorMessage ?? undefined}>
            נכשלה
          </Badge>
        ),
      exportValue: (r) => (r.succeeded ? 'הצליחה' : 'נכשלה'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="כל פעולה רגישה במערכת: מי ביצע, מתי, מאיזה IP, איזו ישות השתנתה, מה הערך הקודם והחדש, ומה הסיבה."
      />

      <Callout tone="info" icon={ShieldCheck} title="הטבלה הזו אינה ניתנת לשינוי" className="mb-4">
        Audit Log הוא append-only. טריגר במסד הנתונים חוסם כל UPDATE וכל DELETE על הטבלה —
        גם עבור Super Admin. זו הגנה מכוונת כדי שהיומן יהיה קביל לביקורת.
      </Callout>

      <KpiGrid columns={6}>
        <KpiCard label="רשומות בתקופה" value={formatNumber(Number(stats.total ?? 0))} />
        <KpiCard
          label="פעולות כספיות"
          value={formatNumber(Number(stats.financial ?? 0))}
          href="/audit?action=financial_action"
        />
        <KpiCard
          label="שינויי הגדרות"
          value={formatNumber(Number(stats.settings ?? 0))}
          href="/audit?action=setting_change"
        />
        <KpiCard
          label="פעולות שנכשלו"
          value={formatNumber(Number(stats.failed ?? 0))}
          higherIsBetter={false}
        />
        <KpiCard
          label="גישה שנדחתה"
          value={formatNumber(Number(stats.denied ?? 0))}
          higherIsBetter={false}
          href="/audit?action=permission_denied"
        />
        <KpiCard
          label="אירועי התחזות"
          value={formatNumber(Number(stats.impersonation ?? 0))}
          higherIsBetter={false}
        />
      </KpiGrid>

      <div className="mt-5">
        <FilterBar
          searchKey="q"
          searchPlaceholder="פעולה, ישות או סיבה…"
          filters={[
            { key: 'action', label: 'סוגי פעולה', options: labels.auditAction.options() },
            {
              key: 'entity',
              label: 'ישויות',
              options: entityRows.rows.map((r) => {
                const row = r as Record<string, string>;
                return { value: String(row.entity_type), label: String(row.entity_type) };
              }),
            },
            {
              key: 'actor',
              label: 'משתמשים',
              options: actorRows.rows.map((r) => {
                const row = r as Record<string, string>;
                return { value: String(row.id), label: String(row.full_name) };
              }),
            },
          ]}
        />

        <Card className="p-4">
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            exportName={`velax-audit-${range.preset}`}
            emptyTitle="אין רשומות Audit בתקופה"
            dense
            pagination={{ page, pageSize, total, buildHref }}
          />
        </Card>
      </div>
    </>
  );
}
