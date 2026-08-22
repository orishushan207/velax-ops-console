import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { formatNumber, formatPercent } from '@/lib/format';
import { DEFAULT_DRAIN_MODEL } from '@/lib/pusun/usage-reconciliation';
import { requirePermission } from '@/server/auth/guard';
import { auditStationUsage, type StationUsageAudit } from '@/server/queries/usage-audit';

export const metadata: Metadata = { title: 'בקרת שימוש' };

/**
 * שימוש שאינו מוסבר בסשנים משולמים.
 *
 * ⚠ המסך מציג הערכה ולא מדידה. הוא בנוי כך שאי אפשר לקרוא אותו אחרת:
 * האזהרה קודמת למספרים, והמונחים הם "בלתי מוסבר" ולא "גניבה".
 */
export default async function UsageAuditPage() {
  const user = await requirePermission('devices.telemetry');
  const rows = await auditStationUsage(user, 30);

  const flagged = rows.filter((r) => r.flaggedIntervals > 0);
  const totalUnexplained = rows.reduce((s, r) => s + r.unexplainedHours, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidHours, 0);
  const withoutData = rows.filter((r) => r.readingCount < 2);

  const columns: Column<StationUsageAudit>[] = [
    {
      key: 'station',
      header: 'עמדה',
      render: (r) => (
        <div>
          <span className="mono">{r.stationCode}</span>
          <span className="text-[var(--fg-tertiary)]"> · {r.stationName}</span>
        </div>
      ),
      exportValue: (r) => `${r.stationCode} ${r.stationName}`,
    },
    { key: 'club', header: 'מועדון', render: (r) => r.clubName, exportValue: (r) => r.clubName },
    {
      key: 'device',
      header: 'מכונה',
      render: (r) =>
        r.deviceId ? <span className="mono">{r.deviceId}</span> : <span className="text-[var(--fg-tertiary)]">—</span>,
      exportValue: (r) => r.deviceId ?? '',
    },
    {
      key: 'readings',
      header: 'קריאות סוללה',
      align: 'end',
      render: (r) =>
        r.readingCount < 2 ? (
          <Badge tone="muted">אין די נתונים</Badge>
        ) : (
          <span className="num">{formatNumber(r.readingCount)}</span>
        ),
      exportValue: (r) => r.readingCount,
    },
    {
      key: 'paid',
      header: 'שעות משולמות',
      align: 'end',
      render: (r) => <span className="num">{formatNumber(r.paidHours, 1)}</span>,
      exportValue: (r) => r.paidHours.toFixed(1),
    },
    {
      key: 'unexplained',
      header: 'שעות בלתי מוסברות',
      align: 'end',
      render: (r) =>
        r.unexplainedHours > 0 ? (
          <span className="num font-semibold text-[var(--signal-warning)]">
            {formatNumber(r.unexplainedHours, 1)}
          </span>
        ) : (
          <span className="num text-[var(--fg-tertiary)]">0</span>
        ),
      exportValue: (r) => r.unexplainedHours.toFixed(1),
    },
    {
      key: 'share',
      header: 'שיעור מהשימוש',
      align: 'end',
      render: (r) =>
        r.unexplainedShare === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className="num">{formatPercent(r.unexplainedShare, 0)}</span>
        ),
      exportValue: (r) => (r.unexplainedShare === null ? '' : r.unexplainedShare.toFixed(3)),
    },
    {
      key: 'intervals',
      header: 'מקטעים מסומנים',
      align: 'end',
      render: (r) =>
        r.flaggedIntervals > 0 ? (
          <Badge tone="warning" dot>
            {r.flaggedIntervals}
          </Badge>
        ) : (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ),
      exportValue: (r) => r.flaggedIntervals,
    },
  ];

  return (
    <>
      <PageHeader
        title="בקרת שימוש"
        description="השוואה בין צריכת הסוללה בפועל לבין הצריכה שהסשנים המשולמים מסבירים."
        meta={
          flagged.length > 0 ? (
            <Badge tone="warning" dot>
              {flagged.length} עמדות עם פער בלתי מוסבר
            </Badge>
          ) : (
            <Badge tone="positive" dot>
              אין פער בלתי מוסבר
            </Badge>
          )
        }
      />

      <Callout tone="warning" title="זו הערכת תחתון, לא מדידה" className="mb-4">
        פרוטוקול PUSUN מדווח אחוז סוללה וקודי תקלה בלבד — <strong>אין בו מונה כדורים</strong>.
        לכן שימוש שעוקף את האפליקציה אינו מדווח על עצמו, והאות היחיד שנותר הוא צריכת הסוללה
        שנמדדת בקריאה הבאה. המספרים כאן אומרים <strong>&ldquo;לפחות כך&rdquo;</strong> ולא
        &ldquo;בדיוק כך&rdquo;.
        <br />
        קצבי הצריכה שבשימוש —{' '}
        <span className="num">{DEFAULT_DRAIN_MODEL.activePctPerHour}%</span> לשעת הגשה ו־
        <span className="num">{DEFAULT_DRAIN_MODEL.standbyPctPerHour}%</span> לשעת המתנה — הם{' '}
        <strong>הערכה שטרם כוילה</strong>. עד לכיול מדוד יש להתייחס לדירוג בין עמדות, לא לערך
        המוחלט.
      </Callout>

      <KpiGrid columns={4}>
        <KpiCard
          label="שעות משולמות · 30 יום"
          value={formatNumber(totalPaid, 1)}
          hint="סך שעות ההגשה בסשנים שהושלמו"
        />
        <KpiCard
          label="שעות בלתי מוסברות"
          value={formatNumber(totalUnexplained, 1)}
          higherIsBetter={false}
          accent={totalUnexplained > 0}
          hint="הערכת תחתון, נגזרת מצריכת סוללה שאינה מוסברת בסשנים"
        />
        <KpiCard
          label="עמדות עם פער"
          value={`${flagged.length} / ${rows.length}`}
          higherIsBetter={false}
        />
        <KpiCard
          label="עמדות ללא די נתונים"
          value={formatNumber(withoutData.length)}
          hint="פחות משתי קריאות סוללה — לא ניתן להסיק דבר"
        />
      </KpiGrid>

      {withoutData.length > 0 && (
        <Callout tone="info" className="mt-4">
          <span className="num">{withoutData.length}</span> עמדות ללא די קריאות סוללה. קריאות
          מגיעות רק כשאפליקציה מחוברת למכונה, ולכן היעדר נתונים אינו עדות להיעדר שימוש — הוא
          היעדר יכולת לבדוק.
        </Callout>
      )}

      <Card className="mt-5 p-0">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.stationId}
          rowHref={(r) => `/stations/${r.stationId}`}
          exportName="velax-usage-audit"
          emptyTitle="אין עמדות בהיקף הגישה שלך"
        />
      </Card>

      <p className="mt-4 text-[12px] leading-relaxed text-[var(--fg-tertiary)]">
        פער עקבי בעמדה מסוימת הוא נקודת פתיחה לבירור מול המועדון, לא ראיה. הסבר אפשרי אחר:
        קצב צריכה שונה בפועל מהמודל, מכונה שהופעלה לצורכי תחזוקה, או קריאות סוללה רחוקות
        זו מזו. <Link href="/stations" className="text-[var(--accent)] hover:underline">מסך העמדות</Link>{' '}
        מציג את היסטוריית הטלמטריה המלאה.
      </p>
    </>
  );
}
