import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { BarSeriesChart, Heatmap, TimeSeriesChart } from '@/components/charts/primitives';
import { resolveRange } from '@/lib/date-range';
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import {
  getClubPerformance,
  getPerformanceByLevel,
  getRetentionCohorts,
  getRevenueTimeSeries,
  getTicketDistribution,
  getUsageHeatmap,
} from '@/server/metrics/dashboard';
import {
  getClubRevenueMetrics,
  getCoreVolume,
  getEconomicsMetrics,
  getNetworkMetrics,
  getQualityMetrics,
  getRetentionMetrics,
  paidHoursPerActiveStationPerDay,
} from '@/server/metrics/kpis';
import { getSettings } from '@/server/settings/service';

export const metadata: Metadata = { title: 'דוחות ו־Analytics' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('reports.view');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '90d', params.from, params.to);
  const clubIds = user.isGlobal ? null : (user.clubIds ?? []);
  const scope = { range, clubIds };

  const [
    volume,
    prevVolume,
    network,
    quality,
    retention,
    economics,
    clubRevenue,
    settings,
    series,
    heatmap,
    clubPerf,
    cohorts,
    ticketDist,
    byLevel,
  ] = await Promise.all([
    getCoreVolume(scope),
    getCoreVolume({ range: { from: range.previousFrom, to: range.previousTo }, clubIds }),
    getNetworkMetrics(scope),
    getQualityMetrics(scope),
    getRetentionMetrics(scope),
    getEconomicsMetrics(scope),
    getClubRevenueMetrics(scope),
    getSettings(),
    getRevenueTimeSeries(scope),
    getUsageHeatmap(scope),
    getClubPerformance(scope),
    getRetentionCohorts(scope),
    getTicketDistribution(scope),
    getPerformanceByLevel(scope),
  ]);

  const northStar = paidHoursPerActiveStationPerDay(
    volume.totalPaidHours,
    network.activeStations,
    range.days,
  );

  // ספי הפיילוט מפרק 15.3 בתוכנית העסקית
  const pilotGates = [
    {
      name: 'שעות בתשלום לעמדה ליום',
      actual: northStar,
      target: settings.num('quality.paid_hours_per_station_target', 1.5),
      format: (v: number | null) => (v === null ? '—' : formatNumber(v, 2)),
      higherIsBetter: true,
      action: 'שינוי מחיר, מיקום ו־Onboarding',
    },
    {
      name: 'חזרה תוך 30 יום',
      actual: retention.d30,
      target: settings.num('quality.d30_retention_target_pct', 0.35),
      format: (v: number | null) => (v === null ? '—' : formatPercent(v)),
      higherIsBetter: true,
      action: 'שיפור תוכן ו־Rewards',
    },
    {
      name: 'Start Success',
      actual: quality.startSuccessRate,
      target: settings.num('quality.start_success_target_pct', 0.95),
      format: (v: number | null) => (v === null ? '—' : formatPercent(v)),
      higherIsBetter: true,
      action: 'פישוט Guest Flow ו־BLE',
    },
    {
      name: 'זמינות',
      actual: quality.uptimePct,
      target: settings.num('sla.uptime_target_pct', 0.95),
      format: (v: number | null) => (v === null ? '—' : formatPercent(v)),
      higherIsBetter: true,
      action: 'מלאי חלפים ותחזוקה מונעת',
    },
    {
      name: 'שיעור זיכויים',
      actual: quality.refundRate,
      target: settings.num('quality.refund_rate_alert_pct', 0.03),
      format: (v: number | null) => (v === null ? '—' : formatPercent(v)),
      higherIsBetter: false,
      action: 'אבחון תקלות וסליקה',
    },
  ];

  return (
    <>
      <PageHeader
        title="דוחות ו־Analytics"
        description={`ניתוח מעמיק של ${range.label}. כל דוח ניתן לייצוא ל־CSV ול־XLSX.`}
        meta={
          <Badge tone="neutral">
            <Download className="size-3" />
            &nbsp;ייצוא זמין בכל טבלה
          </Badge>
        }
      />

      <FilterBar />

      <KpiGrid columns={6}>
        <KpiCard
          label="שעות בתשלום"
          value={`${formatNumber(volume.totalPaidHours, 1)} ש׳`}
          change={
            prevVolume.totalPaidHours > 0
              ? (volume.totalPaidHours - prevVolume.totalPaidHours) / prevVolume.totalPaidHours
              : null
          }
        />
        <KpiCard
          label="North Star"
          metricKey="paid_training_hours_per_active_station_per_day"
          value={northStar === null ? '—' : formatNumber(northStar, 2)}
          accent
        />
        <KpiCard label="סשנים בתשלום" value={formatNumber(volume.paidSessions)} />
        <KpiCard label="משתמשים ייחודיים" value={formatNumber(volume.uniqueUsers)} />
        <KpiCard label="הכנסה נטו" value={formatCurrency(volume.netRevenue)} />
        <KpiCard
          label="תרומה"
          value={formatCurrency(economics.totalContribution)}
          hint="אינה רווח — לפני ההוצאה הקבועה."
        />
      </KpiGrid>

      <Tabs defaultValue="pilot" className="mt-5">
        <TabsList>
          <TabsTrigger value="pilot">ספי הפיילוט</TabsTrigger>
          <TabsTrigger value="usage">שימוש ותפוסה</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="clubs">מועדונים</TabsTrigger>
          <TabsTrigger value="quality">איכות ותקלות</TabsTrigger>
        </TabsList>

        <TabsContent value="pilot">
          <Card>
            <CardHeader>
              <CardTitle>ההשערות שחייבים להוכיח</CardTitle>
              <CardDescription>
                חמשת ספי ההצלחה מפרק 15.3 בתוכנית העסקית, מול הביצועים בפועל.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">השערה</th>
                    <th className="py-2 text-end font-semibold">סף הצלחה</th>
                    <th className="py-2 text-end font-semibold">בפועל</th>
                    <th className="py-2 text-center font-semibold">מצב</th>
                    <th className="py-2 text-start font-semibold">פעולה אם לא הושג</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotGates.map((g) => {
                    const met =
                      g.actual === null
                        ? null
                        : g.higherIsBetter
                          ? g.actual >= g.target
                          : g.actual <= g.target;
                    return (
                      <tr key={g.name} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5 font-medium">{g.name}</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {g.higherIsBetter ? '≥ ' : '< '}
                          {g.format(g.target)}
                        </td>
                        <td className="num py-2.5 text-end font-medium">{g.format(g.actual)}</td>
                        <td className="py-2.5 text-center">
                          {met === null ? (
                            <Badge size="sm" tone="muted">
                              אין נתונים
                            </Badge>
                          ) : met ? (
                            <Badge size="sm" tone="positive">
                              הושג
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="danger">
                              לא הושג
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {met === false ? g.action : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-[var(--border-subtle)]">
                    <td className="py-2.5 font-medium">NPS</td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">&gt; 45</td>
                    <td className="py-2.5 text-end text-[var(--fg-tertiary)]">אין נתונים</td>
                    <td className="py-2.5 text-center">
                      <Badge size="sm" tone="muted">
                        לא נמדד
                      </Badge>
                    </td>
                    <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                      נדרש מנגנון איסוף סקר שטרם נבנה
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>הכנסות ושעות לאורך התקופה</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={series}
                series={[
                  { key: 'revenue', label: 'הכנסה נטו' },
                  { key: 'hours', label: 'שעות בתשלום', yAxis: 'right', color: '#38bdf8' },
                ]}
                format="currency"
                secondaryFormat="hours"
                height={300}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>עומס לפי שעה ויום</CardTitle>
              <CardDescription>
                Off-Peak Uplift:{' '}
                {clubRevenue.offPeakUpliftPct === null
                  ? '—'
                  : formatPercent(clubRevenue.offPeakUpliftPct)}{' '}
                מהשעות התרחשו בחלון השפל. זו הצעת הערך המרכזית למועדון.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Heatmap
                rows={heatmap.rows}
                columns={heatmap.columns}
                values={heatmap.values}
                format="hours"
                ariaLabel="מפת עומס לפי יום ושעה"
              />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>שימוש לפי רמת שחקן</CardTitle>
              <CardDescription>
                מספר סשנים והכנסה לפי רמה. אלה מדדי פעילות בלבד — לא מדדי שיפור מקצועי.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">רמה</th>
                    <th className="py-2 text-end font-semibold">סשנים</th>
                    <th className="py-2 text-end font-semibold">משך ממוצע</th>
                    <th className="py-2 text-end font-semibold">הכנסה נטו</th>
                    <th className="py-2 text-end font-semibold">הכנסה לסשן</th>
                  </tr>
                </thead>
                <tbody>
                  {byLevel.map((l) => (
                    <tr key={l.level} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2.5">
                        {l.level === 'לא צוין'
                          ? l.level
                          : labels.playerLevel.label(
                              l.level as Parameters<typeof labels.playerLevel.label>[0],
                            )}
                      </td>
                      <td className="num py-2.5 text-end">{formatNumber(l.sessions)}</td>
                      <td className="num py-2.5 text-end">{formatDuration(l.avgMinutes)}</td>
                      <td className="num py-2.5 text-end">{formatCurrency(l.netRevenue)}</td>
                      <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                        {l.sessions > 0 ? formatCurrency(l.netRevenue / l.sessions) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention">
          <Card>
            <CardHeader>
              <CardTitle>Retention Cohorts</CardTitle>
              <CardDescription>
                לפי חודש הסשן הראשון. &laquo;חזרה&raquo; היא השלמת סשן נוסף בתשלום — לא פתיחת
                אפליקציה.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
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
                      <td className="num py-2.5">{c.cohort}</td>
                      <td className="num py-2.5 text-end text-[var(--fg-secondary)]">{c.size}</td>
                      {[c.d7, c.d30, c.d90].map((v, i) => (
                        <td key={i} className="py-2.5 text-end">
                          <span
                            className="num inline-block rounded px-2 py-0.5"
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
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">משתמשים מופעלים</p>
              <p className="num mt-1 text-2xl font-semibold">{formatNumber(retention.activatedUsers)}</p>
              <p className="mt-1 text-[10px] text-[var(--fg-tertiary)]">
                השלימו 2 סשנים בתשלום תוך 30 יום
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">סשנים למשתמש</p>
              <p className="num mt-1 text-2xl font-semibold">
                {retention.sessionsPerUser === null
                  ? '—'
                  : formatNumber(retention.sessionsPerUser, 1)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">משתמשים חוזרים</p>
              <p className="num mt-1 text-2xl font-semibold">{formatNumber(volume.returningUsers)}</p>
              <p className="mt-1 text-[10px] text-[var(--fg-tertiary)]">
                מתוך {formatNumber(volume.uniqueUsers)} ייחודיים
              </p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clubs">
          <Card>
            <CardHeader>
              <CardTitle>ביצועי מועדונים</CardTitle>
              <CardDescription>
                שעות בתשלום לעמדה ליום — המדד שקובע אם המועדון עומד ביעד ה־PMF.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">מועדון</th>
                    <th className="py-2 text-start font-semibold">אזור</th>
                    <th className="py-2 text-end font-semibold">עמדות</th>
                    <th className="py-2 text-end font-semibold">סשנים</th>
                    <th className="py-2 text-end font-semibold">שעות</th>
                    <th className="py-2 text-end font-semibold">ש׳/עמדה/יום</th>
                    <th className="py-2 text-end font-semibold">הכנסה נטו</th>
                    <th className="py-2 text-end font-semibold">הכנסה לשעה</th>
                    <th className="py-2 text-end font-semibold">תקלות</th>
                    <th className="py-2 text-center font-semibold">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {clubPerf.map((c) => (
                    <tr key={c.clubId} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2.5">
                        <Link href={`/clubs/${c.clubId}`} className="font-medium hover:text-[var(--accent)]">
                          {c.clubName}
                        </Link>
                      </td>
                      <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">{c.region}</td>
                      <td className="num py-2.5 text-end">{c.activeStations}</td>
                      <td className="num py-2.5 text-end">{formatNumber(c.sessions)}</td>
                      <td className="num py-2.5 text-end">{formatNumber(c.paidHours, 1)}</td>
                      <td className="num py-2.5 text-end font-medium">
                        {c.hoursPerStationPerDay === null
                          ? '—'
                          : formatNumber(c.hoursPerStationPerDay, 2)}
                      </td>
                      <td className="num py-2.5 text-end">{formatCurrency(c.netRevenue)}</td>
                      <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                        {c.paidHours > 0 ? formatCurrency(c.netRevenue / c.paidHours) : '—'}
                      </td>
                      <td className="num py-2.5 text-end">
                        {c.openTickets > 0 ? (
                          <span className="text-[var(--signal-warning)]">{c.openTickets}</span>
                        ) : (
                          <span className="text-[var(--fg-tertiary)]">0</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {c.healthScore === null ? (
                          '—'
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
        </TabsContent>

        <TabsContent value="quality">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>התפלגות תקלות</CardTitle>
              </CardHeader>
              <CardContent>
                {ticketDist.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-[var(--fg-tertiary)]">
                    לא נפתחו תקלות בתקופה
                  </p>
                ) : (
                  <BarSeriesChart
                    layout="horizontal"
                    data={ticketDist.map((t) => ({
                      label: labels.ticketCategory.label(
                        t.category as Parameters<typeof labels.ticketCategory.label>[0],
                      ),
                      count: t.count,
                    }))}
                    series={[{ key: 'count', label: 'תקלות', color: '#fb923c' }]}
                    height={Math.max(180, ticketDist.length * 34)}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מדדי איכות</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">Start Success</td>
                      <td className="num py-2 text-end">
                        {quality.startSuccessRate === null
                          ? '—'
                          : formatPercent(quality.startSuccessRate)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">זמינות</td>
                      <td className="num py-2 text-end">
                        {quality.uptimePct === null ? '—' : formatPercent(quality.uptimePct)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">שיעור זיכויים</td>
                      <td className="num py-2 text-end">
                        {quality.refundRate === null ? '—' : formatPercent(quality.refundRate)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">תקלות פתוחות</td>
                      <td className="num py-2 text-end">{quality.openTickets}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">הפרות SLA</td>
                      <td className="num py-2 text-end">{quality.slaBreaches}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">זמן טיפול ממוצע</td>
                      <td className="num py-2 text-end">
                        {quality.mttrHours === null ? '—' : formatDuration(quality.mttrHours * 60)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[var(--fg-secondary)]">השבתה מצטברת</td>
                      <td className="num py-2 text-end">
                        {formatDuration(quality.totalDowntimeMinutes)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Callout tone="info" icon={BarChart3} className="mt-4">
            כל מדד במסך זה מוגדר ב־Metric Dictionary ומחושב מנוסחה אחת בלבד. את ההגדרה המלאה,
            הנוסחה ומקור הנתונים ניתן לראות במסך{' '}
            <Link href="/settings" className="text-[var(--accent)] hover:underline">
              ההגדרות
            </Link>
            , בלשונית מילון המדדים.
          </Callout>
        </TabsContent>
      </Tabs>
    </>
  );
}
