import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Calculator, FileText, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { TimeSeriesChart } from '@/components/charts/primitives';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { computeEarnBack, getEarnBackDetail } from '@/server/metrics/earn-back';
import { ConditionControl, EarnBackActions } from './earn-back-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('earnback.view');
  const data = await getEarnBackDetail(id, user);
  return { title: data ? `Earn-Back · ${String(data.agreement.club_name)}` : 'Earn-Back' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function EarnBackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('earnback.view');
  const data = await getEarnBackDetail(id, user);
  if (!data) notFound();

  const a = data.agreement;
  const live = await computeEarnBack(id);

  const entryPrice = num(a.entry_price);
  const progress = live ? Math.min(1, live.countedRevenue / entryPrice) : 0;

  const measurementSeries = data.measurements.map((m) => ({
    label: formatDate(String(m.period_start)),
    counted: num(m.counted_revenue),
    cumulative: num(m.cumulative_counted_revenue),
    hours: num(m.paid_session_hours),
  }));

  const conditionsMet = data.conditions.filter((c) => c.status === 'met' || c.status === 'waived').length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Earn-Back', href: '/earn-back' }, { label: String(a.club_name) }]}
        title={`ערבות Earn-Back · ${String(a.club_name)}`}
        description={`${formatDate(String(a.starts_on))} — ${formatDate(String(a.ends_on))} · ${num(a.operating_days_in_period)} ימי פעילות`}
        meta={
          <>
            <Badge
              tone={labels.earnBackStatus.tone(
                String(a.status) as Parameters<typeof labels.earnBackStatus.tone>[0],
              )}
              dot
            >
              {labels.earnBackStatus.label(
                String(a.status) as Parameters<typeof labels.earnBackStatus.label>[0],
              )}
            </Badge>
            <Link href={`/clubs/${a.club_id}`}>
              <Badge tone="neutral">{String(a.club_code)}</Badge>
            </Link>
            {a.contract_number ? (
              <Badge tone="muted">
                <span className="mono">{String(a.contract_number)}</span>
              </Badge>
            ) : null}
          </>
        }
        actions={
          <EarnBackActions
            agreementId={id}
            status={String(a.status)}
            maxSettlement={live?.remainingGap ?? 0}
            can={{
              adjust: user.permissions.has('earnback.adjust'),
              manage: user.permissions.has('earnback.manage'),
            }}
          />
        }
      />

      {live && !live.willMeet && live.remainingOperatingDays > 0 && (
        <Callout tone="danger" icon={AlertTriangle} title="המועדון בסיכון" className="mb-4">
          לפי הקצב הנוכחי, ההכנסה המצטברת תגיע ל־{formatCurrency(live.forecastRevenue)} מתוך{' '}
          {formatCurrency(entryPrice)} — פער של {formatCurrency(entryPrice - live.forecastRevenue)}.
          כדי לסגור את הפער נדרש קצב של{' '}
          <span className="num">{formatNumber(live.requiredRunRatePerDay, 2)}</span> שעות ליום,
          לעומת <span className="num">{formatNumber(live.actualRunRatePerDay, 2)}</span> בפועל.
        </Callout>
      )}

      {live && live.conditionsNotMet > 0 && (
        <Callout tone="warning" icon={AlertTriangle} title="תנאי סף שאינם מתקיימים" className="mb-4">
          {live.conditionsNotMet} מתוך {data.conditions.length} תנאי הסף אינם מתקיימים. אי-עמידה
          בתנאי סף היא עילה חוזית לביטול הערבות — אך היא דורשת החלטה מסחרית מפורשת ולא נאכפת
          אוטומטית על ידי המערכת.
        </Callout>
      )}

      {/* ═══ מצב הערבות ═══ */}
      <Card className="mb-5 brand-edge ps-6">
        <CardContent className="pt-5">
          <div className="grid gap-6 lg:grid-cols-4">
            <div>
              <p className="text-[12px] text-[var(--fg-secondary)]">מחיר כניסה להחזר</p>
              <p className="num mt-1 text-2xl font-semibold">{formatCurrency(entryPrice)}</p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--fg-secondary)]">הכנסה מאומתת</p>
              <p className="num mt-1 text-2xl font-semibold text-[var(--accent)]">
                {formatCurrency(live?.countedRevenue ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--fg-secondary)]">פער נותר</p>
              <p
                className={`num mt-1 text-2xl font-semibold ${(live?.remainingGap ?? 0) > 0 ? 'text-[var(--signal-warning)]' : 'text-[var(--signal-positive)]'}`}
              >
                {formatCurrency(live?.remainingGap ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--fg-secondary)]">ימי פעילות שנותרו</p>
              <p className="num mt-1 text-2xl font-semibold">
                {live?.remainingOperatingDays ?? 0}
              </p>
              {live && live.extraDays > 0 && (
                <p className="mt-0.5 text-[10px] text-[var(--fg-tertiary)]">
                  כולל {live.extraDays} ימי הארכה מאושרים
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="text-[var(--fg-tertiary)]">התקדמות ההחזר</span>
              <span className="num">{formatPercent(progress, 0)}</span>
            </div>
            <Progress
              value={progress * 100}
              tone={progress >= 1 ? 'accent' : live?.willMeet ? 'info' : 'danger'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ─── פירוק החישוב ─── */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="size-4" />
              פירוק החישוב
            </CardTitle>
            <CardDescription>
              כל שורה כאן ניתנת לאימות מול הזמנות המגרש בפועל. אין מספר שמגיע מהערכה.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 text-[var(--fg-secondary)]">
                    הכנסת מגרש מהזמנות מקושרות למכונה
                  </td>
                  <td className="num py-2 text-end">
                    {formatCurrency(live?.machineLinkedRevenue ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 ps-4 text-[var(--fg-secondary)]">
                    ↳ מתוכה סווגה כאינקרמנטלית
                  </td>
                  <td className="num py-2 text-end text-[var(--signal-positive)]">
                    {formatCurrency(live?.incrementalRevenue ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 ps-4 text-[var(--fg-secondary)]">
                    ↳ טרם סווגה, משוקללת במקדם{' '}
                    {formatPercent(num(a.incrementality_factor), 0)}
                  </td>
                  <td className="num py-2 text-end text-[var(--fg-secondary)]">
                    {formatCurrency(
                      (live?.rawCountedRevenue ?? 0) - (live?.incrementalRevenue ?? 0),
                    )}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 ps-4 text-[var(--fg-tertiary)]">
                    ↳ סווגה כבסיסית — אינה נספרת
                  </td>
                  <td className="num py-2 text-end text-[var(--fg-tertiary)]">
                    −{formatCurrency(live?.baselineRevenue ?? 0)}
                  </td>
                </tr>
                {data.adjustments.length > 0 && (
                  <tr className="border-b border-[var(--border-subtle)]">
                    <td className="py-2 text-[var(--fg-secondary)]">התאמות ידניות מאושרות</td>
                    <td className="num py-2 text-end">
                      {formatCurrency(
                        (live?.countedRevenue ?? 0) - (live?.rawCountedRevenue ?? 0),
                      )}
                    </td>
                  </tr>
                )}
                <tr className="border-b-2 border-[var(--border-default)]">
                  <td className="py-2.5 font-medium">הכנסה שנספרת לטובת הערבות</td>
                  <td className="num py-2.5 text-end font-semibold text-[var(--accent)]">
                    {formatCurrency(live?.countedRevenue ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 text-[var(--fg-secondary)]">
                    עלות כדורים שהמועדון סופג ({formatCurrency(num(a.club_ball_cost_per_hour))}/שעה)
                  </td>
                  <td className="num py-2 text-end text-[var(--signal-warning)]">
                    −{formatCurrency(live?.clubBallCostTotal ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium">תועלת נטו למועדון</td>
                  <td className="num py-2.5 text-end font-semibold">
                    {formatCurrency(live?.netClubBenefit ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>

            <Callout tone="info" className="mt-4">
              עלות הכדורים שהמועדון סופג אינה מופיעה בחישוב שבתוכנית העסקית, אך היא מאריכה
              משמעותית את ההחזר האמיתי שלו. היא מוצגת כאן בשקיפות ואינה מנוכה מהחישוב החוזי —
              אלא אם נקבע אחרת בהסכם.
            </Callout>
          </CardContent>
        </Card>

        {/* ─── פרמטרים ─── */}
        <Card>
          <CardHeader>
            <CardTitle>פרמטרי ההסכם</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="מחיר כניסה">
                <span className="num">{formatCurrency(entryPrice)}</span>
              </DetailRow>
              <DetailRow label="הכנסת מגרש לשעה">
                <span className="num">{formatCurrency(num(a.court_revenue_per_hour_net))}</span>
              </DetailRow>
              <DetailRow label="שעות נדרשות להחזר">
                <span className="num">{formatNumber(num(a.required_hours), 1)}</span>
              </DetailRow>
              <DetailRow label="שעות ליום נדרשות">
                <span className="num">{formatNumber(num(a.required_hours_per_day), 3)}</span>
              </DetailRow>
              <DetailRow label="שעות שהושגו">
                <span className="num">{formatNumber(live?.achievedHours ?? 0, 1)}</span>
              </DetailRow>
              <DetailRow label="מקדם אינקרמנטליות">
                <span className="num">{formatPercent(num(a.incrementality_factor), 0)}</span>
              </DetailRow>
              <DetailRow label="ימי פעילות בתקופה">
                <span className="num">{num(a.operating_days_in_period)}</span>
              </DetailRow>
              <DetailRow label="תקרת חשיפה">
                <span className="num">
                  {a.exposure_cap ? formatCurrency(num(a.exposure_cap)) : 'ללא תקרה'}
                </span>
              </DetailRow>
              <DetailRow label="אחוז הפרשה">
                <span className="num">{formatPercent(num(a.reserve_pct), 1)}</span>
              </DetailRow>
              <DetailRow label="חושב לאחרונה">
                {a.last_calculated_at ? formatDateTime(String(a.last_calculated_at)) : '—'}
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>
      </div>

      {/* ─── תנאי סף ─── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>תנאי סף לערבות</CardTitle>
          <CardDescription>
            {conditionsMet} מתוך {data.conditions.length} תנאים מתקיימים. תנאי הסף מגיעים מפרק 8.4
            בתוכנית העסקית.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.conditions.length === 0 ? (
            <EmptyState icon={Target} title="לא הוגדרו תנאי סף" />
          ) : (
            <ul className="space-y-2">
              {data.conditions.map((c) => (
                <li
                  key={String(c.id)}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3"
                >
                  <Badge
                    size="sm"
                    tone={labels.earnBackConditionStatus.tone(
                      String(c.status) as Parameters<
                        typeof labels.earnBackConditionStatus.tone
                      >[0],
                    )}
                    dot
                  >
                    {labels.earnBackConditionStatus.label(
                      String(c.status) as Parameters<
                        typeof labels.earnBackConditionStatus.label
                      >[0],
                    )}
                  </Badge>
                  <span className="min-w-0 flex-1 text-[13px]">{String(c.name_he)}</span>
                  {c.target_value !== null && (
                    <span className="num text-[11px] text-[var(--fg-tertiary)]">
                      יעד {formatNumber(num(c.target_value), 2)} {str(c.unit) ?? ''}
                      {c.measured_value !== null &&
                        ` · נמדד ${formatNumber(num(c.measured_value), 2)}`}
                    </span>
                  )}
                  {c.waived_reason ? (
                    <span className="text-[11px] text-[var(--signal-warning)]">
                      ויתור: {String(c.waived_reason)}
                    </span>
                  ) : null}
                  <ConditionControl
                    conditionId={String(c.id)}
                    nameHe={String(c.name_he)}
                    currentStatus={String(c.status)}
                    canManage={user.permissions.has('earnback.manage')}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ─── מדידות חודשיות ─── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>מדידות חודשיות</CardTitle>
          <CardDescription>
            כל מדידה היא Snapshot שאינו משתנה רטרואקטיבית, יחד עם ההנחות שבהן חושבה.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {measurementSeries.length === 0 ? (
            <EmptyState icon={Target} title="טרם בוצעו מדידות" />
          ) : (
            <>
              <TimeSeriesChart
                data={measurementSeries}
                series={[
                  { key: 'cumulative', label: 'הכנסה מצטברת' },
                  { key: 'counted', label: 'הכנסה בתקופה', color: '#38bdf8' },
                ]}
                format="currency"
                height={240}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">תקופה</th>
                      <th className="py-2 text-end font-semibold">שעות VELA-X</th>
                      <th className="py-2 text-end font-semibold">מקושרת</th>
                      <th className="py-2 text-end font-semibold">אינקרמנטלית</th>
                      <th className="py-2 text-end font-semibold">בסיסית</th>
                      <th className="py-2 text-end font-semibold">נספרה</th>
                      <th className="py-2 text-end font-semibold">מצטבר</th>
                      <th className="py-2 text-end font-semibold">Off-Peak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.measurements.map((m) => (
                      <tr
                        key={String(m.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="num py-2">{formatDate(String(m.period_start))}</td>
                        <td className="num py-2 text-end">
                          {formatNumber(num(m.paid_session_hours), 1)}
                        </td>
                        <td className="num py-2 text-end">
                          {formatCurrency(num(m.machine_linked_revenue))}
                        </td>
                        <td className="num py-2 text-end text-[var(--signal-positive)]">
                          {formatCurrency(num(m.incremental_revenue))}
                        </td>
                        <td className="num py-2 text-end text-[var(--fg-tertiary)]">
                          {formatCurrency(num(m.baseline_revenue))}
                        </td>
                        <td className="num py-2 text-end font-medium">
                          {formatCurrency(num(m.counted_revenue))}
                        </td>
                        <td className="num py-2 text-end">
                          {formatCurrency(num(m.cumulative_counted_revenue))}
                        </td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {formatNumber(num(m.off_peak_hours), 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Audit Trail של החישוב ─── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            התאמות ידניות
          </CardTitle>
          <CardDescription>
            כל שינוי ידני בחישוב הערבות, עם מאשר, סכום ונימוק מלא.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.adjustments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="לא בוצעו התאמות ידניות"
              description="החישוב מתבסס במלואו על הזמנות המגרש בפועל."
            />
          ) : (
            <ul className="space-y-2">
              {data.adjustments.map((adj) => (
                <li
                  key={String(adj.id)}
                  className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3 text-[12px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge size="sm" tone="warning">
                      {String(adj.adjustment_type)}
                    </Badge>
                    <span className="num font-medium">
                      {num(adj.amount) > 0 && formatCurrency(num(adj.amount))}
                      {num(adj.days) > 0 && `${num(adj.days)} ימים`}
                      {num(adj.hours) > 0 && `${formatNumber(num(adj.hours), 1)} שעות`}
                    </span>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-[var(--fg-secondary)]">
                    {String(adj.reason)}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                    אושר על ידי {str(adj.approved_by_name) ?? '—'} ·{' '}
                    {formatDateTime(String(adj.approved_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
