import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { formatCurrency, formatNumber } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { listCoaches, type CoachListRow } from '@/server/queries/people';
import { getSettings } from '@/server/settings/service';
import { listClubOptions } from '@/server/queries/clubs';
import { CreateCoachButton } from '@/components/forms/entity-buttons';
import { coachFormSections } from '@/components/forms/entity-forms';

export const metadata: Metadata = { title: 'מאמנים' };

export default async function CoachesPage() {
  const user = await requirePermission('coaches.view');
  const canManageCoaches = user.permissions.has('coaches.manage');
  const [coaches, settings, clubOptions] = await Promise.all([
    listCoaches(),
    getSettings(),
    canManageCoaches ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const totalPayable = coaches.reduce((s, c) => s + c.commissionPayable, 0);
  const totalPaid = coaches.reduce((s, c) => s + c.commissionPaid, 0);
  const verified = coaches.filter((c) => c.verification === 'verified').length;
  const totalAttributed = coaches.reduce((s, c) => s + c.attributedUsers, 0);

  const cap = settings.num('coach.commission_cap_pct_per_customer', 0.2);
  const window = settings.num('coach.attribution_window_days', 180);
  const holding = settings.num('coach.commission_holding_days', 30);

  const columns: Column<CoachListRow>[] = [
    {
      key: 'name',
      header: 'מאמן',
      render: (c) => c.displayName,
      exportValue: (c) => c.displayName,
    },
    {
      key: 'code',
      header: 'קוד הפניה',
      width: 'w-32',
      render: (c) => <span className="mono">{c.referralCode}</span>,
      exportValue: (c) => c.referralCode,
    },
    {
      key: 'club',
      header: 'מועדון בית',
      render: (c) =>
        c.homeClubId ? (
          <Link href={`/clubs/${c.homeClubId}`} className="hover:text-[var(--accent)]">
            {c.homeClubName}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (c) => c.homeClubName ?? '',
    },
    {
      key: 'rating',
      header: 'דירוג',
      width: 'w-28',
      align: 'end',
      render: (c) =>
        c.rating === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className="num">
            {formatNumber(c.rating, 1)}
            <span className="ms-1 text-[10px] text-[var(--fg-tertiary)]">({c.ratingCount})</span>
          </span>
        ),
      exportValue: (c) => c.rating ?? '',
    },
    {
      key: 'users',
      header: 'מתאמנים משויכים',
      width: 'w-32',
      align: 'end',
      render: (c) => <span className="num">{c.attributedUsers}</span>,
      exportValue: (c) => c.attributedUsers,
    },
    {
      key: 'sessions',
      header: 'סשנים משויכים',
      width: 'w-32',
      align: 'end',
      render: (c) => <span className="num">{c.attributedSessions}</span>,
      exportValue: (c) => c.attributedSessions,
    },
    {
      key: 'programs',
      header: 'תוכניות',
      width: 'w-24',
      align: 'end',
      render: (c) => <span className="num text-[var(--fg-secondary)]">{c.programsCreated}</span>,
      exportValue: (c) => c.programsCreated,
      hideable: true,
    },
    {
      key: 'homework',
      header: 'שיעורי בית',
      width: 'w-28',
      align: 'end',
      render: (c) => <span className="num text-[var(--fg-secondary)]">{c.homeworkAssigned}</span>,
      exportValue: (c) => c.homeworkAssigned,
      hideable: true,
    },
    {
      key: 'accrued',
      header: 'עמלה שנצברה',
      width: 'w-32',
      align: 'end',
      render: (c) => <span className="num">{formatCurrency(c.commissionAccrued)}</span>,
      exportValue: (c) => c.commissionAccrued,
    },
    {
      key: 'payable',
      header: 'יתרה לתשלום',
      width: 'w-32',
      align: 'end',
      render: (c) => (
        <span className={c.commissionPayable > 0 ? 'num text-[var(--signal-warning)]' : 'num'}>
          {formatCurrency(c.commissionPayable)}
        </span>
      ),
      exportValue: (c) => c.commissionPayable,
    },
    {
      key: 'paid',
      header: 'שולם',
      width: 'w-28',
      align: 'end',
      render: (c) => <span className="num text-[var(--fg-secondary)]">{formatCurrency(c.commissionPaid)}</span>,
      exportValue: (c) => c.commissionPaid,
      hideable: true,
    },
    {
      key: 'verification',
      header: 'אימות',
      width: 'w-32',
      align: 'center',
      render: (c) => (
        <Badge
          size="sm"
          tone={labels.coachVerification.tone(
            c.verification as Parameters<typeof labels.coachVerification.tone>[0],
          )}
          dot
        >
          {labels.coachVerification.label(
            c.verification as Parameters<typeof labels.coachVerification.label>[0],
          )}
        </Badge>
      ),
      exportValue: (c) => c.verification,
    },
  ];

  return (
    <>
      <PageHeader
        title="מאמנים"
        description="Coach Partner Economy — שיוך מתאמנים, תוכן ועמלות, עם מנגנוני Cap ו־Clawback."
        actions={
          canManageCoaches ? (
            <CreateCoachButton sections={coachFormSections({}, clubOptions)} />
          ) : undefined
        }
      />

      <KpiGrid columns={5}>
        <KpiCard label="מאמנים" value={formatNumber(coaches.length)} />
        <KpiCard label="מאומתים" value={`${verified} / ${coaches.length}`} accent />
        <KpiCard label="מתאמנים משויכים" value={formatNumber(totalAttributed)} />
        <KpiCard
          label="עמלות לתשלום"
          value={formatCurrency(totalPayable)}
          higherIsBetter={false}
        />
        <KpiCard label="עמלות ששולמו" value={formatCurrency(totalPaid)} />
      </KpiGrid>

      <Callout tone="info" title="כללי מניעת הונאה בעמלות" className="mt-4">
        עמלה משולמת רק על שימוש ששולם והושלם, לאחר תקופת המתנה של{' '}
        <span className="num">{formatNumber(holding)}</span> ימים שמכסה את חלון הזיכויים. חלון
        השיוך הוא <span className="num">{formatNumber(window)}</span> ימים, והתקרה הכוללת ללקוח
        אחד היא <span className="num">{(cap * 100).toFixed(0)}%</span> — כדי למנוע כפל תגמול על
        Referral, Homework ו־Content יחד. Self-referral נחסם, ואין עמלה על לקוח שכבר היה במערכת.
      </Callout>

      <Card className="mt-5 p-4">
        <DataTable
          columns={columns}
          rows={coaches}
          rowKey={(c) => c.id}
          rowHref={(c) => `/coaches/${c.id}`}
          exportName="velax-coaches"
          emptyTitle="אין מאמנים רשומים"
        />
      </Card>
    </>
  );
}
