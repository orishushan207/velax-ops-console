import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Progress,
} from '@/components/ui/misc';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import {
  BarSeriesChart,
  ConversionFunnel,
  DonutChart,
  Heatmap,
  TimeSeriesChart,
} from '@/components/charts/primitives';
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { percentChange } from '@/lib/utils';
import { resolveRange } from '@/lib/date-range';
import { requireUser } from '@/server/auth/guard';
import { getSettings, type Scenario } from '@/server/settings/service';
import {
  getClubRevenueMetrics,
  getCoreVolume,
  getEconomicsMetrics,
  getLiabilityMetrics,
  getNetworkMetrics,
  getQualityMetrics,
  getRetentionMetrics,
  paidHoursPerActiveStationPerDay,
  type MetricScope,
} from '@/server/metrics/kpis';
import {
  getClubPerformance,
  getConversionFunnel,
  getRetentionCohorts,
  getRevenueTimeSeries,
  getRevenueVsCost,
  getTicketDistribution,
  getUsageHeatmap,
} from '@/server/metrics/dashboard';

/**
 * Dashboard הנהלה — סעיף 6 בהנחיות.
 *
 * כל KPI לחיץ ומוביל לפירוט הנתונים שממנו הוא חושב.
 * מדד שאין לו נתוני מקור (CAC, LTV, NPS) מוצג במפורש כ"אין נתונים"
 * ולא כאפס — סעיף 32.8 אוסר להציג נתונים מומצאים.
 */
export async function DashboardView({
  params,
  clubs,
}: {
  params: Record<string, string | undefined>;
  clubs: { id: string; name: string; region: string }[];
}) {
  const user = await requireUser();
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const scenario = (params.scenario as Scenario) ?? 'plan';

  const selectedClub = params.club && params.club !== 'all' ? params.club : null;
  const selectedRegion = params.region && params.region !== 'all' ? params.region : null;

  const scopedClubIds = (() => {
    if (selectedClub) return [selectedClub];
    if (selectedRegion) return clubs.filter((c) => c.region === selectedRegion).map((c) => c.id);
    return user.isGlobal ? null : (user.clubIds ?? []);
  })();

  const scope: MetricScope = { range, clubIds: scopedClubIds, scenario };
  const prevScope: MetricScope = {
    range: { from: range.previousFrom, to: range.previousTo },
    clubIds: scopedClubIds,
    scenario,
  };

  const [
    settings,
    volume,
    prevVolume,
    network,
    quality,
    prevQuality,
    retention,
    economics,
    clubRevenue,
    liabilities,
    timeSeries,
    heatmap,
    clubPerformance,
    funnel,
    cohorts,
    ticketDist,
  ] = await Promise.all([
    getSettings(scenario),
    getCoreVolume(scope),
    getCoreVolume(prevScope),
    getNetworkMetrics(scope),
    getQualityMetrics(scope),
    getQualityMetrics(prevScope),
    getRetentionMetrics(scope),
    getEconomicsMetrics(scope),
    getClubRevenueMetrics(scope),
    getLiabilityMetrics(scope),
    getRevenueTimeSeries(scope),
    getUsageHeatmap(scope),
    getClubPerformance(scope),
    getConversionFunnel(scope),
    getRetentionCohorts(scope),
    getTicketDistribution(scope),
  ]);

  const northStar = paidHoursPerActiveStationPerDay(
    volume.totalPaidHours,
    network.activeStations,
    range.days,
  );
  const prevNorthStar = paidHoursPerActiveStationPerDay(
    prevVolume.totalPaidHours,
    network.activeStations,
    range.days,
  );

  const northStarTarget = settings.num('quality.paid_hours_per_station_target', 1.5);
  const startSuccessTarget = settings.num('quality.start_success_target_pct', 0.95);
  const uptimeTarget = settings.num('sla.uptime_target_pct', 0.95);
  const refundTarget = settings.num('quality.refund_rate_alert_pct', 0.03);
  const d30Target = settings.num('quality.d30_retention_target_pct', 0.35);

  const revenueVsCost = await getRevenueVsCost(
    scope,
    economics.contributionPerHour > 0
      ? settings.num('pricing.consumer_price_per_hour_incl_vat', 90) /
          (1 + settings.num('finance.vat_rate', 0.18)) -
          economics.contributionPerHour
      : 0,
  );

  const arpu = volume.uniqueUsers > 0 ? volume.netRevenue / volume.uniqueUsers : null;
  const prevArpu =
    prevVolume.uniqueUsers > 0 ? prevVolume.netRevenue / prevVolume.uniqueUsers : null;

  const regions = [...new Set(clubs.map((c) => c.region))];

  return (
    <>
      <PageHeader
        title="מרכז שליטה"
        description={`${range.label} · ${network.activeClubs} מועדונים פעילים · ${network.activeStations} עמדות פעילות`}
        meta={
          <>
            <Badge tone={labels.scenario.tone(scenario)} dot>
              תרחיש: {labels.scenario.label(scenario)}
            </Badge>
            {liabilities.earnBackAtRiskClubs > 0 && (
              <Badge tone="danger" dot>
                {liabilities.earnBackAtRiskClubs} מועדונים בסיכון Earn-Back
              </Badge>
            )}
            {quality.criticalOpenTickets > 0 && (
              <Badge tone="danger" dot>
                {quality.criticalOpenTickets} תקלות קריטיות פתוחות
              </Badge>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/reports">
              דוחות מלאים
              <ArrowLeft />
            </Link>
          </Button>
        }
      />

      <FilterBar
        filters={[
          {
            key: 'club',
            label: 'מועדונים',
            options: clubs.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            key: 'region',
            label: 'אזורים',
            options: regions.map((r) => ({ value: r, label: r })),
          },
          {
            key: 'scenario',
            label: 'תרחיש',
            allLabel: 'תרחיש התוכנית',
            options: [
              { value: 'plan', label: 'תוכנית' },
              { value: 'realistic', label: 'ריאלי' },
              { value: 'conservative', label: 'שמרני' },
            ],
          },
        ]}
      />

      {/* ═══ מדד ה־North Star ═══ */}
      <section aria-labelledby="north-star" className="mb-5">
        <h2 id="north-star" className="sr-only">
          מדד מוביל
        </h2>
        <Card className="brand-edge overflow-hidden p-5 ps-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium text-[var(--fg-secondary)]">
                Paid Training Hours per Active Station per Day
              </p>
              <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                מדד ה־North Star · שעות אימון בתשלום לעמדה פעילה ליום
              </p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="num text-4xl font-bold tracking-tight text-[var(--accent)]">
                  {northStar === null ? '—' : formatNumber(northStar, 2)}
                </span>
                <span className="text-[13px] text-[var(--fg-secondary)]">שעות ליום</span>
                {prevNorthStar !== null && northStar !== null && (
                  <span className="text-[12px] text-[var(--fg-tertiary)]">
                    תקופה קודמת:{' '}
                    <span className="num">{formatNumber(prevNorthStar, 2)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-[240px] flex-1 md:max-w-sm">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-[var(--fg-tertiary)]">
                  יעד שער המעבר ל־PMF: <span className="num">{formatNumber(northStarTarget, 1)}</span>{' '}
                  שעות ליום
                </span>
                <span
                  className={
                    northStar !== null && northStar >= northStarTarget
                      ? 'text-[var(--signal-positive)]'
                      : 'text-[var(--signal-warning)]'
                  }
                >
                  {northStar !== null
                    ? formatPercent(northStar / northStarTarget, 0)
                    : '—'}
                </span>
              </div>
              <Progress
                value={northStar ?? 0}
                max={northStarTarget}
                tone={northStar !== null && northStar >= northStarTarget ? 'accent' : 'warning'}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-tertiary)]">
                נספרות רק שעות מסשנים שהושלמו, שולמו ולא זוכו במלואם, מחולקות בעמדות
                שעמדו בהגדרת &laquo;עמדה פעילה&raquo;.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ═══ מדדי על ═══ */}
      <section aria-labelledby="kpis" className="mb-5">
        <h2 id="kpis" className="mb-3 text-[13px] font-semibold text-[var(--fg-secondary)]">
          מדדי על
        </h2>
        <KpiGrid columns={6}>
          <KpiCard
            label="סשנים בתשלום"
            metricKey="paid_session"
            value={formatNumber(volume.paidSessions)}
            change={percentChange(volume.paidSessions, prevVolume.paidSessions)}
            href="/sessions?status=paid"
          />
          <KpiCard
            label="הכנסות ברוטו (כולל מע״מ)"
            value={formatCurrency(volume.grossRevenue)}
            change={percentChange(volume.grossRevenue, prevVolume.grossRevenue)}
            href="/payments"
            hint="סך הגבייה מהשחקנים כולל מע״מ. אינה הכנסה חשבונאית ואינה רווח."
          />
          <KpiCard
            label="הכנסה נטו (לפני מע״מ)"
            value={formatCurrency(volume.netRevenue)}
            change={percentChange(volume.netRevenue, prevVolume.netRevenue)}
            href="/finance"
            hint="הכנסה לפני מע״מ, לפני ניכוי כל עלות. אינה רווח."
          />
          <KpiCard
            label="תרומה כוללת"
            metricKey="contribution_per_hour"
            value={formatCurrency(economics.totalContribution)}
            href="/finance"
            accent
          />
          <KpiCard
            label="תרומה לשעת שימוש"
            metricKey="contribution_per_hour"
            value={formatCurrency(economics.contributionPerHour, true)}
            href="/finance"
            hint={`לפי הנחות תרחיש ${labels.scenario.label(scenario)}`}
          />
          <KpiCard
            label="שיעור תרומה"
            metricKey="contribution_margin"
            value={formatPercent(economics.contributionMarginPct)}
            href="/finance"
          />

          <KpiCard
            label="עמדות פעילות"
            metricKey="active_station"
            value={`${formatNumber(network.activeStations)} / ${formatNumber(network.installedStations)}`}
            href="/stations"
          />
          <KpiCard
            label="מועדונים פעילים"
            value={formatNumber(network.activeClubs)}
            href="/clubs"
          />
          <KpiCard
            label="זמינות ממוצעת"
            metricKey="uptime"
            value={quality.uptimePct === null ? '—' : formatPercent(quality.uptimePct)}
            change={
              quality.uptimePct !== null && prevQuality.uptimePct !== null
                ? percentChange(quality.uptimePct, prevQuality.uptimePct)
                : null
            }
            target={formatPercent(uptimeTarget, 0)}
            targetMet={quality.uptimePct !== null ? quality.uptimePct >= uptimeTarget : null}
            href="/stations"
          />
          <KpiCard
            label="Start Success Rate"
            metricKey="start_success_rate"
            value={quality.startSuccessRate === null ? '—' : formatPercent(quality.startSuccessRate)}
            change={
              quality.startSuccessRate !== null && prevQuality.startSuccessRate !== null
                ? percentChange(quality.startSuccessRate, prevQuality.startSuccessRate)
                : null
            }
            target={formatPercent(startSuccessTarget, 0)}
            targetMet={
              quality.startSuccessRate !== null
                ? quality.startSuccessRate >= startSuccessTarget
                : null
            }
            href="/sessions?status=failed_to_start"
          />
          <KpiCard
            label="שיעור זיכויים"
            metricKey="refund_rate"
            value={quality.refundRate === null ? '—' : formatPercent(quality.refundRate)}
            higherIsBetter={false}
            change={
              quality.refundRate !== null && prevQuality.refundRate !== null
                ? percentChange(quality.refundRate, prevQuality.refundRate)
                : null
            }
            target={`< ${formatPercent(refundTarget, 0)}`}
            targetMet={quality.refundRate !== null ? quality.refundRate < refundTarget : null}
            href="/payments/refunds"
          />
          <KpiCard
            label="תקלות פתוחות"
            value={formatNumber(quality.openTickets)}
            higherIsBetter={false}
            href="/tickets?status=open"
          />

          <KpiCard
            label="D7 Retention"
            metricKey="retained_user"
            value={retention.d7 === null ? '—' : formatPercent(retention.d7)}
            unavailableReason={retention.d7 === null ? 'טרם חלפו 7 ימים מספיקים בקוהורט' : undefined}
            href="/reports/retention"
          />
          <KpiCard
            label="D30 Retention"
            metricKey="retained_user"
            value={retention.d30 === null ? '—' : formatPercent(retention.d30)}
            target={formatPercent(d30Target, 0)}
            targetMet={retention.d30 !== null ? retention.d30 >= d30Target : null}
            unavailableReason={retention.d30 === null ? 'טרם חלפו 30 ימים בקוהורט' : undefined}
            href="/reports/retention"
          />
          <KpiCard
            label="D90 Retention"
            metricKey="retained_user"
            value={retention.d90 === null ? '—' : formatPercent(retention.d90)}
            unavailableReason={retention.d90 === null ? 'טרם חלפו 90 ימים בקוהורט' : undefined}
            href="/reports/retention"
          />
          <KpiCard
            label="סשנים למשתמש"
            metricKey="sessions_per_user"
            value={retention.sessionsPerUser === null ? '—' : formatNumber(retention.sessionsPerUser, 1)}
            href="/players"
          />
          <KpiCard
            label="משתמשים חדשים"
            value={formatNumber(volume.newUsers)}
            change={percentChange(volume.newUsers, prevVolume.newUsers)}
            href="/players?sort=newest"
          />
          <KpiCard
            label="משתמשים חוזרים"
            value={formatNumber(volume.returningUsers)}
            change={percentChange(volume.returningUsers, prevVolume.returningUsers)}
            href="/players"
          />

          <KpiCard
            label="הכנסה ממוצעת למשתמש"
            metricKey="arpu"
            value={arpu === null ? '—' : formatCurrency(arpu)}
            change={arpu !== null && prevArpu !== null ? percentChange(arpu, prevArpu) : null}
            href="/players"
          />
          <KpiCard
            label="CAC"
            metricKey="cac"
            value="—"
            unavailableReason="דורש הזנת תקציב שיווק חודשי. לא קיים באף מסמך מקור."
          />
          <KpiCard
            label="LTV"
            metricKey="ltv"
            value="—"
            unavailableReason="נגזר מ־CAC ומ־Retention מלא. יחושב לאחר הזנת תקציב שיווק."
          />
          <KpiCard
            label="Payback Period"
            metricKey="payback_period"
            value="—"
            unavailableReason="תלוי ב־CAC."
          />
          <KpiCard
            label="NPS"
            metricKey="nps"
            value="—"
            unavailableReason="אין מנגנון איסוף סקר NPS במערכת. יעד התוכנית: מעל 45."
          />
          <KpiCard
            label="זמן טיפול ממוצע"
            metricKey="mttr"
            value={quality.mttrHours === null ? '—' : formatDuration(quality.mttrHours * 60)}
            higherIsBetter={false}
            href="/tickets"
          />

          <KpiCard
            label="הכנסת מגרש מקושרת"
            metricKey="machine_linked_court_revenue"
            value={formatCurrency(clubRevenue.machineLinkedRevenue)}
            href="/earn-back"
          />
          <KpiCard
            label="הכנסה אינקרמנטלית"
            metricKey="incremental_court_revenue"
            value={formatCurrency(clubRevenue.incrementalRevenue)}
            href="/earn-back"
          />
          <KpiCard
            label="Off-Peak Uplift"
            metricKey="off_peak_uplift"
            value={
              clubRevenue.offPeakUpliftPct === null
                ? '—'
                : formatPercent(clubRevenue.offPeakUpliftPct)
            }
            href="/reports/usage"
          />
          <KpiCard
            label="חשיפת Earn-Back"
            metricKey="earn_back_exposure"
            value={formatCurrency(liabilities.earnBackExposure)}
            higherIsBetter={false}
            href="/earn-back"
          />
          <KpiCard
            label="התחייבות Rewards"
            metricKey="rewards_liability"
            value={formatCurrency(liabilities.rewardsOutstandingLiability)}
            higherIsBetter={false}
            href="/rewards"
          />
          <KpiCard
            label="עמלות מאמנים לתשלום"
            value={formatCurrency(liabilities.coachCommissionsPayable)}
            higherIsBetter={false}
            href="/coaches"
          />
        </KpiGrid>
      </section>

      {/* ═══ גרפים ═══ */}
      <section aria-labelledby="charts" className="space-y-4">
        <h2 id="charts" className="text-[13px] font-semibold text-[var(--fg-secondary)]">
          מגמות וניתוח
        </h2>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>הכנסות ושעות שימוש לאורך זמן</CardTitle>
              <CardDescription>
                הכנסה נטו לפני מע״מ ובניכוי זיכויים, מול שעות אימון בתשלום.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={timeSeries.map((p) => ({
                  label: p.label,
                  revenue: p.revenue,
                  hours: p.hours,
                }))}
                series={[
                  { key: 'revenue', label: 'הכנסה נטו (₪)' },
                  { key: 'hours', label: 'שעות בתשלום', yAxis: 'right', color: '#38bdf8' },
                ]}
                format="currency"
                secondaryFormat="hours"
                height={280}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funnel המרה</CardTitle>
              <CardDescription>סריקה ← תשלום ← התחלה ← סיום ← חזרה</CardDescription>
            </CardHeader>
            <CardContent>
              <ConversionFunnel data={funnel} height={280} />
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-tertiary)]">
                השלב הראשון נמדד מרגע פתיחת הסשן. סריקות QR שלא הבשילו לסשן אינן נמדדות —
                הדבר דורש אירוע ייעודי מהאפליקציה שטרם קיים.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>עומס לפי שעה ויום בשבוע</CardTitle>
            <CardDescription>
              שעות אימון בתשלום. חלון ה־Off-Peak המוגדר לרשת הוא 08:00–16:00 בימים א׳–ה׳.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Heatmap
              rows={heatmap.rows}
              columns={heatmap.columns}
              values={heatmap.values}
              format="hours"
              ariaLabel="מפת עומס שעות אימון לפי יום בשבוע ושעה ביום"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ביצועי מועדונים</CardTitle>
              <CardDescription>שעות בתשלום לעמדה ליום, לפי מועדון.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarSeriesChart
                layout="horizontal"
                data={clubPerformance.map((c) => ({
                  label: c.clubName,
                  value: c.hoursPerStationPerDay ?? 0,
                }))}
                series={[{ key: 'value', label: 'שעות/עמדה/יום' }]}
                format="hours"
                height={Math.max(200, clubPerformance.length * 42)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>הכנסות מול עלויות משתנות</CardTitle>
              <CardDescription>
                תרומה = הכנסה נטו פחות עלויות משתנות ישירות. אינה רווח.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                variant="line"
                data={revenueVsCost}
                series={[
                  { key: 'revenue', label: 'הכנסה נטו' },
                  { key: 'variableCost', label: 'עלות משתנה', color: '#fb923c' },
                  { key: 'contribution', label: 'תרומה', color: '#38bdf8' },
                ]}
                format="currency"
                height={260}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>התפלגות תקלות</CardTitle>
              <CardDescription>לפי קטגוריה, בתקופה הנבחרת.</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketDist.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[var(--fg-tertiary)]">
                  לא נפתחו תקלות בתקופה זו
                </p>
              ) : (
                <DonutChart
                  data={ticketDist.map((t) => ({
                    label: labels.ticketCategory.label(
                      t.category as Parameters<typeof labels.ticketCategory.label>[0],
                    ),
                    value: t.count,
                  }))}
                  height={240}
                />
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Retention Cohorts</CardTitle>
              <CardDescription>
                לפי חודש הסשן הראשון. אחוז המשתמשים שחזרו והשלימו סשן נוסף.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cohorts.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-[var(--fg-tertiary)]">
                  אין מספיק נתונים לבניית קוהורטים
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">קוהורט</th>
                        <th className="py-2 text-end font-semibold">גודל</th>
                        <th className="py-2 text-end font-semibold">D7</th>
                        <th className="py-2 text-end font-semibold">D30</th>
                        <th className="py-2 text-end font-semibold">D90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((c) => (
                        <tr key={c.cohort} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="num py-2">{c.cohort}</td>
                          <td className="num py-2 text-end text-[var(--fg-secondary)]">{c.size}</td>
                          {[c.d7, c.d30, c.d90].map((v, i) => (
                            <td key={i} className="py-2 text-end">
                              <span
                                className="num inline-block rounded px-1.5 py-0.5"
                                style={{
                                  backgroundColor: `color-mix(in oklab, var(--chart-heat) ${Math.round(v * 70)}%, transparent)`,
                                  color: v > 0.35 ? 'var(--accent-fg)' : 'var(--fg-primary)',
                                }}
                              >
                                {formatPercent(v, 0)}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* טבלת מועדונים עם drill-down */}
        <Card>
          <CardHeader>
            <CardTitle>מועדונים — תמונת מצב</CardTitle>
            <CardDescription>לחיצה על מועדון פותחת את עמוד המועדון המלא.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                  <th className="py-2 text-start font-semibold">מועדון</th>
                  <th className="py-2 text-end font-semibold">שעות בתשלום</th>
                  <th className="py-2 text-end font-semibold">ש׳/עמדה/יום</th>
                  <th className="py-2 text-end font-semibold">הכנסה נטו</th>
                  <th className="py-2 text-end font-semibold">עמדות</th>
                  <th className="py-2 text-end font-semibold">תקלות</th>
                  <th className="py-2 text-end font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {clubPerformance.map((c) => (
                  <tr
                    key={c.clubId}
                    className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
                  >
                    <td className="py-2.5">
                      <Link href={`/clubs/${c.clubId}`} className="font-medium hover:text-[var(--accent)]">
                        {c.clubName}
                      </Link>
                      <span className="block text-[11px] text-[var(--fg-tertiary)]">{c.region}</span>
                    </td>
                    <td className="num py-2.5 text-end">{formatNumber(c.paidHours, 1)}</td>
                    <td className="num py-2.5 text-end">
                      <span
                        className={
                          c.hoursPerStationPerDay !== null &&
                          c.hoursPerStationPerDay >= northStarTarget
                            ? 'text-[var(--signal-positive)]'
                            : 'text-[var(--signal-warning)]'
                        }
                      >
                        {c.hoursPerStationPerDay === null
                          ? '—'
                          : formatNumber(c.hoursPerStationPerDay, 2)}
                      </span>
                    </td>
                    <td className="num py-2.5 text-end">{formatCurrency(c.netRevenue)}</td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                      {c.activeStations}
                    </td>
                    <td className="num py-2.5 text-end">
                      {c.openTickets > 0 ? (
                        <span className="text-[var(--signal-warning)]">{c.openTickets}</span>
                      ) : (
                        <span className="text-[var(--fg-tertiary)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-end">
                      {c.healthScore === null ? (
                        <span className="text-[var(--fg-tertiary)]">—</span>
                      ) : (
                        <Badge
                          size="sm"
                          tone={
                            c.healthScore >= 75
                              ? 'positive'
                              : c.healthScore >= 55
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {c.healthScore}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-[var(--signal-warning-bg)] ring-[var(--signal-warning-ring)]">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--signal-warning)]" />
            <div className="text-[12px] leading-relaxed text-[var(--fg-secondary)]">
              <p className="font-medium text-[var(--fg-primary)]">הבחנה שאסור לטשטש</p>
              <p className="mt-1">
                <span className="text-[var(--fg-primary)]">תרומה אינה רווח.</span> התרומה המוצגת כאן
                היא לפני כל הוצאה קבועה — שכר, שיווק, משפטי, ביטוח ותחזוקת תוכנה. הרווח התפעולי
                המלא מוצג במסך{' '}
                <Link href="/finance" className="text-[var(--accent)] hover:underline">
                  כספים וכלכלת יחידה
                </Link>
                , יחד עם נקודת האיזון וניתוח התרחישים.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
