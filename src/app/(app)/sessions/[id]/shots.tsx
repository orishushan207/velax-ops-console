import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { formatNumber, formatTime } from '@/lib/format';
import { getSessionShotSummary, getSessionShots } from '@/server/queries/shots';

/**
 * חבטות הסשן.
 *
 * ⚠ הכותרת אומרת "פרמטרים שנשלחו" ולא "מדידות" במכוון. פרוטוקול PUSUN
 * אינו מדווח אירועי חבטה, ולכן אין אישור שהחבטה יצאה כפי שהוזמנה.
 * הצגתם כמדידה הייתה הופכת נתון שהוזמן לנתון שנמדד.
 */

const SPIN_LABEL: Record<number, string> = { 0: 'ללא', 1: 'טופספין', 2: 'בקספין' };
const MODE_LABEL: Record<string, string> = {
  fixed: 'נקודה קבועה',
  horizontal: 'אופקי',
  vertical: 'אנכי',
  random: 'אקראי',
  program: 'תוכנית',
};

export async function SessionShots({ sessionId }: { sessionId: string }) {
  const [summary, shots] = await Promise.all([
    getSessionShotSummary(sessionId),
    getSessionShots(sessionId, 200),
  ]);

  if (summary.total === 0) return null;

  const partialCalibration = summary.withDerived > 0 && summary.withDerived < summary.total;

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-[var(--accent)]" />
          <h3 className="text-[13px] font-semibold text-[var(--fg-primary)]">
            חבטות — פרמטרים שנשלחו למכונה
          </h3>
        </div>
        <Badge tone="neutral">
          <span className="num">{formatNumber(summary.total)}</span> חבטות
        </Badge>
      </div>

      <Callout tone="info" className="mt-3">
        ⚠ אלה הערכים ש<strong>נשלחו</strong> למכונה, לא מדידה של מה שיצא ממנה. פרוטוקול
        PUSUN מדווח אחוז סוללה וקודי תקלה בלבד — אין בו חיישן שמאשר ביצוע חבטה.
      </Callout>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="מהירות ממוצעת" value={summary.avgSpeedKmh} suffix=" קמ״ש" />
        <Stat label="מהירות מזערית" value={summary.minSpeedKmh} suffix=" קמ״ש" />
        <Stat label="מהירות מרבית" value={summary.maxSpeedKmh} suffix=" קמ״ש" />
        <div className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
          <p className="text-[11px] text-[var(--fg-tertiary)]">סיבוב</p>
          <p className="mt-1 text-[12px] text-[var(--fg-primary)]">
            <span className="num">{summary.spinBreakdown.topspin}</span> טופ ·{' '}
            <span className="num">{summary.spinBreakdown.backspin}</span> בק ·{' '}
            <span className="num">{summary.spinBreakdown.none}</span> ללא
          </p>
        </div>
      </div>

      {partialCalibration && (
        <Callout tone="warning" className="mt-3">
          רק <span className="num">{summary.withDerived}</span> מתוך{' '}
          <span className="num">{summary.total}</span> החבטות נושאות ערכים בקמ״ש. השאר נשלחו
          בערכי בקרה בלבד, ולכן הממוצעים מחושבים על חלק מהנתונים.
        </Callout>
      )}

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-control)] ring-1 ring-inset ring-[var(--border-subtle)]">
        <table className="w-max min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--fg-tertiary)]">
              <th className="whitespace-nowrap px-3 py-2 text-start">#</th>
              <th className="whitespace-nowrap px-3 py-2 text-start">שעה</th>
              <th className="whitespace-nowrap px-3 py-2 text-end">מהירות</th>
              <th className="whitespace-nowrap px-3 py-2 text-end">גובה</th>
              <th className="whitespace-nowrap px-3 py-2 text-end">זווית</th>
              <th className="whitespace-nowrap px-3 py-2 text-start">סיבוב</th>
              <th className="whitespace-nowrap px-3 py-2 text-start">מצב</th>
              <th className="whitespace-nowrap px-3 py-2 text-end">LR / UD</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((s) => (
              <tr key={s.sequence} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="num whitespace-nowrap px-3 py-1.5 text-[var(--fg-tertiary)]">
                  {s.sequence}
                </td>
                <td className="num whitespace-nowrap px-3 py-1.5">{formatTime(s.firedAt)}</td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-end">
                  {s.derivedSpeedKmh !== null
                    ? `${formatNumber(s.derivedSpeedKmh, 1)} קמ״ש`
                    : s.commandedVelocity !== null
                      ? `${s.commandedVelocity} (גולמי)`
                      : '—'}
                </td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-end">
                  {s.derivedHeightLevel ?? '—'}
                </td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-end">
                  {s.derivedAngleDegrees !== null ? `${s.derivedAngleDegrees}°` : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {s.commandedSpinType === null
                    ? '—'
                    : `${SPIN_LABEL[s.commandedSpinType] ?? '?'}${
                        s.commandedSpinAmount ? ` ${s.commandedSpinAmount}` : ''
                      }`}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-[var(--fg-secondary)]">
                  {s.serveMode ? (MODE_LABEL[s.serveMode] ?? s.serveMode) : '—'}
                  {s.pointIndex ? ` · נק׳ ${s.pointIndex}` : ''}
                </td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-end text-[var(--fg-tertiary)]">
                  {s.commandedLr ?? '—'} / {s.commandedUd ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.total > shots.length && (
        <p className="mt-2 text-[11px] text-[var(--fg-tertiary)]">
          מוצגות <span className="num">{shots.length}</span> חבטות ראשונות מתוך{' '}
          <span className="num">{formatNumber(summary.total)}</span>. הייצוא המלא זמין דרך ה־API.
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | null; suffix: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
      <p className="text-[11px] text-[var(--fg-tertiary)]">{label}</p>
      <p className="num mt-1 text-sm font-semibold text-[var(--fg-primary)]">
        {value === null ? '—' : `${formatNumber(value, 1)}${suffix}`}
      </p>
    </div>
  );
}
