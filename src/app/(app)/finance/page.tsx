import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { FilterBar } from '@/components/shell/filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { BarSeriesChart, TimeSeriesChart } from '@/components/charts/primitives';
import { resolveRange } from '@/lib/date-range';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { breakEvenStations, computeContribution, round2 } from '@/lib/money';
import { requirePermission } from '@/server/auth/guard';
import {
  getCoreVolume,
  getEconomicsMetrics,
  getLiabilityMetrics,
  getNetworkMetrics,
} from '@/server/metrics/kpis';
import { getRevenueTimeSeries } from '@/server/metrics/dashboard';
import { getEarnBackPortfolio } from '@/server/metrics/earn-back';
import { getSettings, type Scenario } from '@/server/settings/service';

export const metadata: Metadata = { title: 'כספים וכלכלת יחידה' };

const SCENARIOS: Scenario[] = ['plan', 'realistic', 'conservative'];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission('finance.view');
  const params = await searchParams;
  const range = resolveRange(params.range ?? '30d', params.from, params.to);
  const activeScenario = (params.scenario as Scenario) ?? 'plan';
  const clubIds = user.isGlobal ? null : (user.clubIds ?? []);

  // מריצים את שלושת התרחישים במקביל — זו הדרך היחידה לראות
  // כמה רגישה הכלכלה להנחות ולא רק מה קורה בתרחיש אחד
  const scenarioSettings = await Promise.all(SCENARIOS.map((s) => getSettings(s)));

  const scenarioBreakdowns = SCENARIOS.map((scenario, i) => {
    const s = scenarioSettings[i]!;
    return {
      scenario,
      settings: s,
      breakdown: computeContribution({
        priceGross: s.num('pricing.consumer_price_per_hour_incl_vat', 90),
        vatRate: s.num('finance.vat_rate', 0.18),
        pspPctFee: s.num('finance.psp_percentage_fee', 0.027),
        pspFixedFee: s.num('finance.psp_fixed_fee', 1),
        rewardsReservePct: s.num('finance.rewards_reserve_pct', 0.06),
        coachPoolPct: s.num('finance.coach_pool_pct', 0.05),
        refundRiskPct: s.num('finance.refund_risk_pct', 0.03),
        ballsAndWearPerHour: s.num('finance.balls_and_wear_per_hour', 8),
        cloudAndCommsPerHour: s.num('finance.cloud_and_comms_per_hour', 2.5),
        sparePartsPerHour: s.num('finance.spare_parts_per_hour', 0),
        warrantyReservePerHour: s.num('finance.warranty_reserve_per_hour', 0),
      }),
      annualFixedCost: s.num('finance.annual_fixed_cost', 730000),
    };
  });

  const active = scenarioBreakdowns.find((s) => s.scenario === activeScenario)!;
  const settings = active.settings;

  const [volume, economics, network, liabilities, earnBack, series] = await Promise.all([
    getCoreVolume({ range, clubIds, scenario: activeScenario }),
    getEconomicsMetrics({ range, clubIds, scenario: activeScenario }),
    getNetworkMetrics({ range, clubIds, scenario: activeScenario }),
    getLiabilityMetrics({ range, clubIds }),
    getEarnBackPortfolio(user),
    getRevenueTimeSeries({ range, clubIds }),
  ]);

  const operatingDays = settings.num('finance.operating_days_per_year', 312);
  const marketCourts = settings.num('market.padel_courts_israel', 350);
  const courtsPerStation = settings.num('station.courts_per_station', 2.5);
  const penetration = settings.num('market.club_penetration_rate', 0.7);
  const marketCeiling = Math.round((marketCourts / courtsPerStation) * penetration);

  const setupFee = settings.num('station.setup_fee', 6000);
  const leanCost = settings.num('station.installed_cost_lean', 5500);
  const fullCost = settings.num('station.installed_cost_full', 10000);

  // רגישות נקודת האיזון לשעות ליום
  const HOUR_LEVELS = [0.75, 1.0, 1.5, 2.0, 2.5, 3.0];
  const breakEvenMatrix: (Record<Scenario, number> & { label: string })[] = HOUR_LEVELS.map(
    (hours) => {
      const row = { label: `${hours.toFixed(2)} ש׳` } as Record<Scenario, number> & {
        label: string;
      };
      for (const s of scenarioBreakdowns) {
        row[s.scenario] = Math.round(
          breakEvenStations(
            s.annualFixedCost,
            s.breakdown.contributionPerHour,
            hours,
            operatingDays,
          ) ?? 0,
        );
      }
      return row;
    },
  );

  // רווח תפעולי שנתי לפי גודל רשת
  const NETWORK_SIZES = [25, 50, 70, 100, 150, 250];
  const currentHoursPerDay =
    network.activeStations > 0 ? volume.totalPaidHours / network.activeStations / range.days : 1.5;

  const profitMatrix: (Record<Scenario, number> & { label: string })[] = NETWORK_SIZES.map(
    (stations) => {
      const row = { label: `${stations} עמדות` } as Record<Scenario, number> & { label: string };
      for (const s of scenarioBreakdowns) {
        row[s.scenario] = round2(
          stations * currentHoursPerDay * operatingDays * s.breakdown.contributionPerHour -
            s.annualFixedCost,
        );
      }
      return row;
    },
  );

  // EBITDA בפועל בתקופה
  const periodFixedCost = round2((active.annualFixedCost / 365) * range.days);
  const periodEbitda = round2(economics.totalContribution - periodFixedCost);

  return (
    <>
      <PageHeader
        title="כספים וכלכלת יחידה"
        description="שחזור מלא של המודל הפיננסי, מחובר לנתונים בפועל. שלושת התרחישים רצים במקביל."
        meta={
          <>
            <Badge tone={labels.scenario.tone(activeScenario)} dot>
              תרחיש פעיל: {labels.scenario.label(activeScenario)}
            </Badge>
            <Badge tone="neutral">
              תרומה לשעה: {formatCurrency(active.breakdown.contributionPerHour, true)}
            </Badge>
          </>
        }
      />

      <FilterBar
        filters={[
          {
            key: 'scenario',
            label: 'תרחיש',
            allLabel: 'תרחיש התוכנית',
            options: [
              { value: 'plan', label: 'תוכנית — הנחות ארד' },
              { value: 'realistic', label: 'ריאלי' },
              { value: 'conservative', label: 'שמרני' },
            ],
          },
        ]}
      />

      <Callout tone="warning" icon={AlertTriangle} title="הבחנה שאסור לטשטש" className="mb-5">
        <strong className="text-[var(--fg-primary)]">גבייה ברוטו ≠ הכנסה ≠ תרומה ≠ רווח.</strong>{' '}
        גבייה כוללת מע״מ שאינו שלנו. הכנסה נטו היא לפני כל עלות. תרומה היא אחרי עלויות משתנות
        בלבד. רווח תפעולי הוא אחרי ההוצאה הקבועה. ארבעת המספרים מוצגים כאן בנפרד ולעולם אינם
        מעורבבים.
      </Callout>

      <KpiGrid columns={6}>
        <KpiCard
          label="גבייה ברוטו"
          value={formatCurrency(volume.grossRevenue)}
          hint="כולל מע״מ. אינה הכנסה."
        />
        <KpiCard
          label="הכנסה נטו"
          value={formatCurrency(volume.netRevenue)}
          hint="לפני מע״מ, לפני כל עלות."
        />
        <KpiCard
          label="עלויות משתנות"
          value={formatCurrency(economics.variableCostTotal)}
          higherIsBetter={false}
        />
        <KpiCard
          label="תרומה"
          metricKey="contribution_per_hour"
          value={formatCurrency(economics.totalContribution)}
          accent
        />
        <KpiCard
          label="הוצאה קבועה בתקופה"
          value={formatCurrency(periodFixedCost)}
          higherIsBetter={false}
          hint={`מבוסס על ${formatCurrency(active.annualFixedCost)} שנתי, יחסית ל־${range.days} ימים.`}
        />
        <KpiCard
          label="רווח תפעולי (EBITDA)"
          value={formatCurrency(periodEbitda)}
          accent={periodEbitda > 0}
          hint="תרומה פחות ההוצאה הקבועה היחסית. זהו הרווח, לא התרומה."
        />
      </KpiGrid>

      <Tabs defaultValue="unit" className="mt-5">
        <TabsList>
          <TabsTrigger value="unit">כלכלת שעת שימוש</TabsTrigger>
          <TabsTrigger value="breakeven">נקודת איזון</TabsTrigger>
          <TabsTrigger value="scenarios">ניתוח תרחישים</TabsTrigger>
          <TabsTrigger value="hardware">כלכלת החומרה</TabsTrigger>
          <TabsTrigger value="liabilities">התחייבויות וחשיפה</TabsTrigger>
          <TabsTrigger value="actual">בפועל מול תחזית</TabsTrigger>
        </TabsList>

        {/* ═══ כלכלת יחידה ═══ */}
        <TabsContent value="unit">
          <Card>
            <CardHeader>
              <CardTitle>כלכלת שעת שימוש — שלושת התרחישים</CardTitle>
              <CardDescription>
                אותה שעת שימוש, שלוש רמות של כנות לגבי העלויות. הכל בש״ח לשעה אחת.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">רכיב</th>
                    {scenarioBreakdowns.map((s) => (
                      <th key={s.scenario} className="py-2 text-end font-semibold">
                        {labels.scenario.label(s.scenario)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['מחיר לצרכן (כולל מע״מ)', 'priceGross', false],
                      ['בניכוי מע״מ', 'vatAmount', true],
                      ['הכנסה נטו', 'netRevenue', false],
                      ['עמלת סליקה', 'processingFee', true],
                      ['קרן תגמולים', 'rewardsReserve', true],
                      ['עמלות מאמנים', 'coachPool', true],
                      ['זיכויים וסיכון', 'refundRisk', true],
                      ['כדורים, בלאי ותחזוקה', 'ballsAndWear', true],
                      ['ענן ותקשורת', 'cloudAndComms', true],
                      ['חלפים ומתכלים', 'spareParts', true],
                      ['רזרבת אחריות והחלפה', 'warrantyReserve', true],
                    ] as [string, keyof (typeof scenarioBreakdowns)[number]['breakdown'], boolean][]
                  ).map(([label, key, isCost]) => (
                    <tr key={key} className="border-b border-[var(--border-subtle)]">
                      <td
                        className={`py-2 ${key === 'netRevenue' ? 'font-medium' : 'text-[var(--fg-secondary)]'}`}
                      >
                        {label}
                      </td>
                      {scenarioBreakdowns.map((s) => {
                        const value = s.breakdown[key] as number;
                        return (
                          <td
                            key={s.scenario}
                            className={`num py-2 text-end ${
                              isCost && value > 0
                                ? 'text-[var(--fg-secondary)]'
                                : key === 'netRevenue'
                                  ? 'font-medium'
                                  : ''
                            }`}
                          >
                            {isCost && value > 0 ? '−' : ''}
                            {formatNumber(value, 2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-b-2 border-[var(--border-default)]">
                    <td className="py-2.5 font-semibold">תרומה לשעה</td>
                    {scenarioBreakdowns.map((s) => (
                      <td
                        key={s.scenario}
                        className={`num py-2.5 text-end text-base font-bold ${
                          s.scenario === activeScenario ? 'text-[var(--accent)]' : ''
                        }`}
                      >
                        {formatNumber(s.breakdown.contributionPerHour, 2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 text-[var(--fg-secondary)]">שיעור תרומה מהכנסה נטו</td>
                    {scenarioBreakdowns.map((s) => (
                      <td key={s.scenario} className="num py-2 text-end">
                        {formatPercent(s.breakdown.contributionMarginPct)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <Callout tone="info" icon={Info} className="mt-4">
                <strong className="text-[var(--fg-primary)]">שכר הטכנאי אינו כאן.</strong> הוא יושב
                בהוצאה הקבועה בלבד — אחרת הוא נספר פעמיים. זו טעות שתוקנה במודל הפיננסי ונשמרת
                כאן בקפידה. באותו אופן, חלפים ומתכלים יושבים רק בעלות המשתנה.
              </Callout>

              <Callout tone="warning" className="mt-3">
                שני רכיבים — חלפים ורזרבת אחריות — אינם מופיעים כלל בחישוב שבתוכנית העסקית, אף
                שהם נובעים ישירות מהתחייבות ה־SLA (זמינות 95%, תיקון תוך 24–48 שעות). בתרחיש
                &laquo;תוכנית&raquo; הם 0; בתרחישים האחרים הם מתומחרים.
              </Callout>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ נקודת איזון ═══ */}
        <TabsContent value="breakeven">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>כמה עמדות צריך לאיזון</CardTitle>
                <CardDescription>
                  הוצאה שנתית קבועה ÷ (תרומה לשעה × שעות ליום × {formatNumber(operatingDays)} ימי
                  פעילות)
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">שעות בתשלום ליום</th>
                      {scenarioBreakdowns.map((s) => (
                        <th key={s.scenario} className="py-2 text-end font-semibold">
                          {labels.scenario.label(s.scenario)}
                        </th>
                      ))}
                      <th className="py-2 text-center font-semibold">נכנס בתקרת ישראל?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakEvenMatrix.map((row) => {
                      const activeValue = row[activeScenario];
                      const fits = activeValue <= marketCeiling;
                      return (
                        <tr key={row.label} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="num py-2.5">{row.label}</td>
                          {scenarioBreakdowns.map((s) => (
                            <td
                              key={s.scenario}
                              className={`num py-2.5 text-end ${
                                s.scenario === activeScenario ? 'font-medium' : 'text-[var(--fg-secondary)]'
                              }`}
                            >
                              {formatNumber(row[s.scenario])}
                            </td>
                          ))}
                          <td className="py-2.5 text-center">
                            {fits ? (
                              <Badge size="sm" tone="positive">
                                נכנס
                              </Badge>
                            ) : (
                              <Badge size="sm" tone="danger">
                                מחייב חו״ל
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>תקרת השוק הישראלי</CardTitle>
                <CardDescription>מגרשים אינם עמדות.</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">מגרשי פאדל בישראל</td>
                      <td className="num py-2 text-end">{formatNumber(marketCourts)}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">מגרשים לכל עמדה</td>
                      <td className="num py-2 text-end">{formatNumber(courtsPerStation, 1)}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">שיעור חדירה למועדונים</td>
                      <td className="num py-2 text-end">{formatPercent(penetration, 0)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium">תקרת עמדות</td>
                      <td className="num py-2.5 text-end text-lg font-bold text-[var(--accent)]">
                        {formatNumber(marketCeiling)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Callout tone="warning" className="mt-4">
                  ההנחה &laquo;מגרשים לכל עמדה&raquo; שנויה במחלוקת: המודל מניח 2.5, היזם מניח 2.
                  ההפרש משנה את תקרת השוק בעשרות עמדות ולכן גם את השאלה אם העסק הישראלי מגיע
                  לרווחיות לבדו.
                </Callout>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>רווח תפעולי שנתי לפי גודל רשת</CardTitle>
              <CardDescription>
                לפי שעות השימוש בפועל ({formatNumber(currentHoursPerDay, 2)} שעות לעמדה ליום)
                ובניכוי ההוצאה הקבועה של כל תרחיש.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarSeriesChart
                data={profitMatrix}
                series={scenarioBreakdowns.map((s, i) => ({
                  key: s.scenario,
                  label: labels.scenario.label(s.scenario),
                  color: ['var(--chart-1)', 'var(--signal-warning)', 'var(--signal-danger)'][i],
                }))}
                format="currency"
                height={300}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ תרחישים ═══ */}
        <TabsContent value="scenarios">
          <div className="grid gap-4 lg:grid-cols-3">
            {scenarioBreakdowns.map((s) => {
              const beStations = breakEvenStations(
                s.annualFixedCost,
                s.breakdown.contributionPerHour,
                settings.num('quality.paid_hours_per_station_target', 1.5),
                operatingDays,
              );
              const isActive = s.scenario === activeScenario;
              return (
                <Card
                  key={s.scenario}
                  className={isActive ? 'brand-edge ps-5 ring-[var(--accent)]/25' : ''}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {labels.scenario.label(s.scenario)}
                      {isActive && (
                        <Badge size="sm" tone="positive">
                          פעיל
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2.5 text-[13px]">
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">תרומה לשעה</dt>
                        <dd className="num font-semibold">
                          {formatCurrency(s.breakdown.contributionPerHour, true)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">שיעור תרומה</dt>
                        <dd className="num">{formatPercent(s.breakdown.contributionMarginPct)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">עלות משתנה לשעה</dt>
                        <dd className="num">{formatCurrency(s.breakdown.totalVariableCost, true)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2.5">
                        <dt className="text-[var(--fg-secondary)]">הוצאה שנתית קבועה</dt>
                        <dd className="num">{formatCurrency(s.annualFixedCost)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">עמדות לאיזון</dt>
                        <dd className="num font-semibold">
                          {beStations === null ? '—' : formatNumber(Math.ceil(beStations))}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">מול תקרת השוק</dt>
                        <dd>
                          {beStations !== null && beStations <= marketCeiling ? (
                            <Badge size="sm" tone="positive">
                              נכנס
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="danger">
                              מחייב חו״ל
                            </Badge>
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2.5">
                        <dt className="text-[var(--fg-secondary)]">כדורים ובלאי לשעה</dt>
                        <dd className="num">{formatCurrency(s.breakdown.ballsAndWear, true)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">חלפים + אחריות לשעה</dt>
                        <dd className="num">
                          {formatCurrency(s.breakdown.spareParts + s.breakdown.warrantyReserve, true)}
                        </dd>
                      </div>
                    </dl>
                    {!isActive && (
                      <Link
                        href={`/finance?scenario=${s.scenario}`}
                        className="mt-4 block text-center text-[12px] text-[var(--accent)] hover:underline"
                      >
                        הצג תרחיש זה
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Callout tone="danger" icon={AlertTriangle} title="ההבדל בין התרחישים אינו טכני" className="mt-4">
            המעבר מתרחיש התוכנית לתרחיש הריאלי מוריד את התרומה לשעה בכ־26% ומזיז את נקודת האיזון
            בעשרות עמדות. ההחלטה מי משלם על כדורים ובלאי היא, במילות המודל, &laquo;החלטה על שליש
            מהמרווח&raquo; — ולא פרט תפעולי.
          </Callout>
        </TabsContent>

        {/* ═══ חומרה ═══ */}
        <TabsContent value="hardware">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>מרווח החומרה לעמדה</CardTitle>
                <CardDescription>
                  דמי ההקמה מול עלות ההתקנה בפועל, לפי סוג העמדה.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">רכיב</th>
                      <th className="py-2 text-end font-semibold">עמדה רזה</th>
                      <th className="py-2 text-end font-semibold">עמדה מלאה</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">דמי הקמה מהמועדון</td>
                      <td className="num py-2 text-end">{formatCurrency(setupFee)}</td>
                      <td className="num py-2 text-end">{formatCurrency(setupFee)}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">עלות מותקנת</td>
                      <td className="num py-2 text-end">−{formatCurrency(leanCost)}</td>
                      <td className="num py-2 text-end">−{formatCurrency(fullCost)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium">מרווח גולמי</td>
                      <td
                        className={`num py-2.5 text-end font-semibold ${setupFee - leanCost >= 0 ? 'text-[var(--signal-positive)]' : 'text-[var(--signal-danger)]'}`}
                      >
                        {formatCurrency(setupFee - leanCost)}
                      </td>
                      <td
                        className={`num py-2.5 text-end font-semibold ${setupFee - fullCost >= 0 ? 'text-[var(--signal-positive)]' : 'text-[var(--signal-danger)]'}`}
                      >
                        {formatCurrency(setupFee - fullCost)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <Callout tone="danger" icon={AlertTriangle} className="mt-4">
                  <strong className="text-[var(--fg-primary)]">זו ההחלטה הקריטית:</strong> בעמדה
                  מלאה, כל התקנה היא הפסד של{' '}
                  {formatCurrency(Math.abs(setupFee - fullCost))} עוד לפני שעת שימוש אחת. גם
                  בעמדה רזה, מרווח של {formatCurrency(setupFee - leanCost)} הוא חד-פעמי ואינו
                  סוגר פער שנתי חוזר בתקורה.
                </Callout>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>סתירה בין מסמכי המקור</CardTitle>
                <CardDescription>
                  מחיר ההקמה הוא ההנחה שמשנה הכי הרבה — והיא שנויה במחלוקת.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-[13px]">
                  <li className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">המודל הפיננסי (עדכני)</span>
                      <span className="num font-semibold text-[var(--accent)]">
                        {formatCurrency(6000)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                      &laquo;עודכן לפי היזם, אוגוסט 2026&raquo;. זהו הערך הפעיל במערכת.
                    </p>
                  </li>
                  <li className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">התוכנית העסקית (ישן)</span>
                      <span className="num font-semibold text-[var(--fg-tertiary)]">
                        {formatCurrency(14900)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                      פרקים 8.5 ו־9.1. משנה את יעד ה־Earn-Back פי 2.5 — מ־66.7 שעות ל־165.6 שעות.
                    </p>
                  </li>
                </ul>
                <p className="mt-4 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                  שני הערכים מתועדים במסך{' '}
                  <Link href="/settings" className="text-[var(--accent)] hover:underline">
                    ההגדרות
                  </Link>{' '}
                  יחד עם מקורם. שינוי הערך משנה את כל החישובים במערכת מתאריך התחולה שייקבע —
                  ולא רטרואקטיבית.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ התחייבויות ═══ */}
        <TabsContent value="liabilities">
          <KpiGrid columns={4}>
            <KpiCard
              label="חשיפת Earn-Back נוכחית"
              metricKey="earn_back_exposure"
              value={formatCurrency(earnBack.totalExposure)}
              higherIsBetter={false}
              href="/earn-back"
            />
            <KpiCard
              label="חשיפה בתרחיש קיצון"
              value={formatCurrency(earnBack.worstCaseExposure)}
              higherIsBetter={false}
              hint="כל המועדונים הפעילים נכשלים בו-זמנית. המודל מזהיר שהסיכון מתואם."
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
            <KpiCard
              label="רזרבת Earn-Back נדרשת"
              value={formatCurrency(earnBack.requiredReserve)}
              hint="לפי אחוז ההפרשה בהסכמים."
            />
            <KpiCard
              label="זיכויים ממתינים"
              value={formatCurrency(liabilities.refundExposure)}
              higherIsBetter={false}
              href="/payments/refunds"
            />
            <KpiCard
              label="Rewards שנצברו"
              value={formatCurrency(liabilities.rewardsEarnedCost)}
            />
            <KpiCard
              label="Rewards שמומשו"
              value={formatCurrency(liabilities.rewardsRedeemedCost)}
            />
          </KpiGrid>

          <Callout tone="warning" className="mt-4">
            סך ההתחייבויות הפתוחות:{' '}
            <span className="num font-medium text-[var(--fg-primary)]">
              {formatCurrency(
                earnBack.totalExposure +
                  liabilities.rewardsOutstandingLiability +
                  liabilities.coachCommissionsPayable +
                  liabilities.refundExposure,
              )}
            </span>
            . זה סכום שיש להחזיק מולו מזומן או רזרבה — הוא אינו מופיע בדוח רווח והפסד אך הוא
            צריכת מזומן ודאית.
          </Callout>
        </TabsContent>

        {/* ═══ בפועל ═══ */}
        <TabsContent value="actual">
          <Card>
            <CardHeader>
              <CardTitle>הכנסה בפועל לאורך זמן</CardTitle>
              <CardDescription>
                הכנסה נטו לפני מע״מ, בניכוי זיכויים. {range.label}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                data={series.map((p) => ({
                  label: p.label,
                  revenue: p.revenue,
                  contribution: round2(p.hours * active.breakdown.contributionPerHour),
                }))}
                series={[
                  { key: 'revenue', label: 'הכנסה נטו' },
                  { key: 'contribution', label: 'תרומה מוערכת', color: '#38bdf8' },
                ]}
                format="currency"
                height={280}
              />
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>תרומה תיאורטית מול בפועל</CardTitle>
                <CardDescription>
                  ההנחות של המודל מול מה שהנתונים בשטח מראים.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">תרומה לשעה לפי ההנחות</td>
                      <td className="num py-2 text-end">
                        {formatCurrency(economics.contributionPerHour, true)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">תרומה לשעה בפועל</td>
                      <td className="num py-2 text-end font-medium">
                        {economics.actualContributionPerHour === null
                          ? '—'
                          : formatCurrency(economics.actualContributionPerHour, true)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">שעות בתשלום בתקופה</td>
                      <td className="num py-2 text-end">
                        {formatNumber(volume.totalPaidHours, 1)}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">זיכויים שניתנו</td>
                      <td className="num py-2 text-end text-[var(--signal-danger)]">
                        −{formatCurrency(volume.refundedAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium">תרומה כוללת בתקופה</td>
                      <td className="num py-2.5 text-end font-semibold text-[var(--accent)]">
                        {formatCurrency(economics.totalContribution)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מצב הרשת מול נקודת האיזון</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">עמדות פעילות כרגע</td>
                      <td className="num py-2 text-end">{network.activeStations}</td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">עמדות נדרשות לאיזון</td>
                      <td className="num py-2 text-end">
                        {economics.breakEvenStations === null
                          ? '—'
                          : formatNumber(Math.ceil(economics.breakEvenStations))}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 text-[var(--fg-secondary)]">פער</td>
                      <td className="num py-2 text-end text-[var(--signal-warning)]">
                        {economics.breakEvenStations === null
                          ? '—'
                          : formatNumber(
                              Math.max(
                                0,
                                Math.ceil(economics.breakEvenStations) - network.activeStations,
                              ),
                            )}{' '}
                        עמדות
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-[var(--fg-secondary)]">
                        שעות בתשלום שנתיות לאיזון
                      </td>
                      <td className="num py-2.5 text-end">
                        {economics.breakEvenPaidHours === null
                          ? '—'
                          : formatNumber(Math.ceil(economics.breakEvenPaidHours))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
