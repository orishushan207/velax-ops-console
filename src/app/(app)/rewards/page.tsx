import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { Gift, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { DonutChart } from '@/components/charts/primitives';
import { db } from '@/db/client';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getLiabilityMetrics } from '@/server/metrics/kpis';
import { resolveRange } from '@/lib/date-range';
import { getSettings } from '@/server/settings/service';

export const metadata: Metadata = { title: 'Rewards וקופונים' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function RewardsPage() {
  const user = await requirePermission('rewards.view');
  const range = resolveRange('90d');

  const [liabilities, settings, couponRows, challengeRows, tierRows, referralRows, subRows] =
    await Promise.all([
      getLiabilityMetrics({ range, clubIds: user.isGlobal ? null : (user.clubIds ?? []) }),
      getSettings(),
      db.execute(sql`
        SELECT c.*, u.full_name AS creator_name FROM coupons c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE c.deleted_at IS NULL ORDER BY c.is_active DESC, c.valid_from DESC
      `),
      db.execute(sql`
        SELECT * FROM challenges WHERE deleted_at IS NULL ORDER BY status, starts_at DESC
      `),
      db.execute(sql`
        SELECT ra.tier, COUNT(*)::int AS count,
               COALESCE(SUM(ra.points_balance), 0)::int AS points,
               COALESCE(SUM(ra.xp_total), 0)::int AS xp
        FROM rewards_accounts ra GROUP BY ra.tier ORDER BY ra.tier
      `),
      db.execute(sql`
        SELECT r.status, COUNT(*)::int AS count,
               COALESCE(SUM(r.reward_amount), 0)::numeric AS amount
        FROM referrals r GROUP BY r.status
      `),
      db.execute(sql`
        SELECT s.status, COUNT(*)::int AS count,
               COALESCE(SUM(s.monthly_price_gross), 0)::numeric AS mrr
        FROM subscriptions s WHERE s.deleted_at IS NULL GROUP BY s.status
      `),
    ]);

  const coupons = couponRows.rows as Record<string, unknown>[];
  const challenges = challengeRows.rows as Record<string, unknown>[];
  const tiers = tierRows.rows as Record<string, unknown>[];
  const referrals = referralRows.rows as Record<string, unknown>[];
  const subscriptions = subRows.rows as Record<string, unknown>[];

  const reservePct = settings.num('finance.rewards_reserve_pct', 0.06);
  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalRedemptions = coupons.reduce((s, c) => s + num(c.redemption_count), 0);
  const couponCost = coupons.reduce(
    (s, c) => s + num(c.redemption_count) * num(c.cost_to_company),
    0,
  );

  const redemptionRate =
    liabilities.rewardsEarnedCost > 0
      ? liabilities.rewardsRedeemedCost / liabilities.rewardsEarnedCost
      : null;

  return (
    <>
      <PageHeader
        title="Rewards וקופונים"
        description="XP, נקודות, Streaks, אתגרים וקופונים — עם מעקב מלא אחר עלות ההטבה ל־VELA-X."
        meta={
          <Badge tone="neutral">
            קרן תגמולים: {formatPercent(reservePct, 0)} מההכנסה נטו
          </Badge>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard
          label="התחייבות פתוחה"
          metricKey="rewards_liability"
          value={formatCurrency(liabilities.rewardsOutstandingLiability)}
          higherIsBetter={false}
          accent
        />
        <KpiCard label="נצבר" value={formatCurrency(liabilities.rewardsEarnedCost)} />
        <KpiCard label="מומש" value={formatCurrency(liabilities.rewardsRedeemedCost)} />
        <KpiCard
          label="פג תוקף"
          value={formatCurrency(liabilities.rewardsExpiredCost)}
          hint="הטבות שנצברו ולא מומשו עד לתאריך התפוגה."
        />
        <KpiCard
          label="שיעור מימוש"
          value={redemptionRate === null ? '—' : formatPercent(redemptionRate)}
          hint="מימוש נמוך מדי מעיד שההטבה אינה אטרקטיבית; גבוה מדי מעמיס על הקרן."
        />
        <KpiCard label="קופונים פעילים" value={`${activeCoupons} / ${coupons.length}`} />
      </KpiGrid>

      <Callout tone="warning" icon={Gift} title="ההתחייבות הזו היא צריכת מזומן" className="mt-4">
        נקודות והטבות שנצברו ולא מומשו הן התחייבות חשבונאית אמיתית. קרן התגמולים מתוקצבת
        ב־{formatPercent(reservePct, 0)} מההכנסה נטו, אך ההתחייבות בפועל תלויה בשיעור המימוש —
        ולכן היא נמדדת ומוצגת בנפרד מהתקצוב.
      </Callout>

      <Tabs defaultValue="tiers" className="mt-5">
        <TabsList>
          <TabsTrigger value="tiers">רמות חברות</TabsTrigger>
          <TabsTrigger value="coupons">קופונים ({coupons.length})</TabsTrigger>
          <TabsTrigger value="challenges">אתגרים ({challenges.length})</TabsTrigger>
          <TabsTrigger value="referrals">הפניות</TabsTrigger>
          <TabsTrigger value="subscriptions">מנויים</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>התפלגות רמות חברות</CardTitle>
                <CardDescription>
                  חמש רמות: X1 MEMBER, X2 DRIVE, X3 PRO, X4 ELITE, X5 ICON.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tiers.length === 0 ? (
                  <EmptyState icon={Trophy} title="אין נתוני רמות" />
                ) : (
                  <DonutChart
                    data={tiers.map((t) => ({
                      label: labels.membershipTier.label(
                        String(t.tier) as Parameters<typeof labels.membershipTier.label>[0],
                      ),
                      value: num(t.count),
                    }))}
                    height={240}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>XP ונקודות לפי רמה</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">רמה</th>
                      <th className="py-2 text-end font-semibold">שחקנים</th>
                      <th className="py-2 text-end font-semibold">XP מצטבר</th>
                      <th className="py-2 text-end font-semibold">נקודות פתוחות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={String(t.tier)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">
                          <Badge
                            size="sm"
                            tone={labels.membershipTier.tone(
                              String(t.tier) as Parameters<typeof labels.membershipTier.tone>[0],
                            )}
                          >
                            {labels.membershipTier.label(
                              String(t.tier) as Parameters<typeof labels.membershipTier.label>[0],
                            )}
                          </Badge>
                        </td>
                        <td className="num py-2.5 text-end">{num(t.count)}</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {formatNumber(num(t.xp))}
                        </td>
                        <td className="num py-2.5 text-end">{formatNumber(num(t.points))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Callout tone="info" className="mt-4">
                  הרמה הגבוהה אינה ניתנת לרכישה בכסף או בשעות. עלייה בין רמות תלויה בהתמדה, ברמת
                  משחק, במגוון ובהתנהגות — לפי פרק 11.3 בתוכנית העסקית.
                </Callout>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coupons">
          <Card>
            <CardHeader>
              <CardTitle>קופונים</CardTitle>
              <CardDescription>
                סה״כ {formatNumber(totalRedemptions)} מימושים בעלות של {formatCurrency(couponCost)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {coupons.length === 0 ? (
                <EmptyState icon={Gift} title="אין קופונים" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">קוד</th>
                      <th className="py-2 text-start font-semibold">שם</th>
                      <th className="py-2 text-start font-semibold">סוג</th>
                      <th className="py-2 text-end font-semibold">ערך</th>
                      <th className="py-2 text-end font-semibold">מימושים</th>
                      <th className="py-2 text-end font-semibold">מגבלה</th>
                      <th className="py-2 text-end font-semibold">עלות ל־VELA-X</th>
                      <th className="py-2 text-start font-semibold">תוקף</th>
                      <th className="py-2 text-center font-semibold">מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={String(c.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="mono py-2.5">{String(c.code)}</td>
                        <td className="py-2.5">
                          {String(c.name_he)}
                          {c.off_peak_only ? (
                            <Badge size="sm" tone="positive" className="ms-1.5">
                              Off-Peak
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {c.coupon_type === 'percentage'
                            ? 'אחוז'
                            : c.coupon_type === 'fixed_amount'
                              ? 'סכום קבוע'
                              : 'אימון חינם'}
                        </td>
                        <td className="num py-2.5 text-end">
                          {c.coupon_type === 'percentage'
                            ? formatPercent(num(c.value), 0)
                            : formatCurrency(num(c.value))}
                        </td>
                        <td className="num py-2.5 text-end">{num(c.redemption_count)}</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {c.max_redemptions ? num(c.max_redemptions) : '∞'}
                        </td>
                        <td className="num py-2.5 text-end">
                          {formatCurrency(num(c.redemption_count) * num(c.cost_to_company))}
                        </td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {formatDate(String(c.valid_from))}
                          {c.valid_until ? ` — ${formatDate(String(c.valid_until))}` : ''}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge size="sm" tone={c.is_active ? 'positive' : 'muted'}>
                            {c.is_active ? 'פעיל' : 'כבוי'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges">
          <div className="grid gap-4 lg:grid-cols-2">
            {challenges.length === 0 ? (
              <Card>
                <EmptyState icon={Trophy} title="אין אתגרים" />
              </Card>
            ) : (
              challenges.map((ch) => {
                const participants = num(ch.participant_count);
                const completions = num(ch.completion_count);
                const rate = participants > 0 ? completions / participants : 0;
                return (
                  <Card key={String(ch.id)}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {String(ch.name_he)}
                        <Badge
                          size="sm"
                          tone={
                            ch.status === 'active'
                              ? 'positive'
                              : ch.status === 'completed'
                                ? 'info'
                                : 'muted'
                          }
                        >
                          {String(ch.status)}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{str(ch.description) ?? ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-1.5 text-[12px]">
                        <div className="flex justify-between">
                          <dt className="text-[var(--fg-secondary)]">משתתפים</dt>
                          <dd className="num">{participants}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[var(--fg-secondary)]">השלימו</dt>
                          <dd className="num">{completions}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[var(--fg-secondary)]">תגמול</dt>
                          <dd className="num">
                            {num(ch.xp_reward)} XP · {num(ch.points_reward)} נק׳
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[var(--fg-secondary)]">עלות משוערת</dt>
                          <dd className="num">{formatCurrency(num(ch.estimated_cost))}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[var(--fg-secondary)]">תקופה</dt>
                          <dd className="num text-[11px]">
                            {formatDate(String(ch.starts_at))} — {formatDate(String(ch.ends_at))}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] text-[var(--fg-tertiary)]">
                          <span>שיעור השלמה</span>
                          <span className="num">{formatPercent(rate, 0)}</span>
                        </div>
                        <Progress value={rate * 100} tone={rate > 0.3 ? 'accent' : 'warning'} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>הפניות</CardTitle>
              <CardDescription>
                בונוס הפניה משולם רק לאחר שהמופנה השלים את מספר הסשנים הנדרש בתשלום.
                Self-referral, כרטיס זהה ומכשיר זהה נחסמים אוטומטית.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <EmptyState icon={Gift} title="אין הפניות" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">סטטוס</th>
                      <th className="py-2 text-end font-semibold">מספר</th>
                      <th className="py-2 text-end font-semibold">סכום תגמול</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={String(r.status)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">{String(r.status)}</td>
                        <td className="num py-2.5 text-end">{num(r.count)}</td>
                        <td className="num py-2.5 text-end">{formatCurrency(num(r.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>מנויים</CardTitle>
              <CardDescription>
                מנוי Elite הוא מנוע הכנסה של שלב מאוחר יותר (לאחר PMF), לפי פרק 7 בתוכנית.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="אין מנויים פעילים"
                  description="מודל המנויים מתוכנן לשלב שלאחר הוכחת ה־PMF ולכן אינו מאוכלס בנתוני ההדגמה."
                />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">סטטוס</th>
                      <th className="py-2 text-end font-semibold">מנויים</th>
                      <th className="py-2 text-end font-semibold">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={String(s.status)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">{String(s.status)}</td>
                        <td className="num py-2.5 text-end">{num(s.count)}</td>
                        <td className="num py-2.5 text-end">{formatCurrency(num(s.mrr))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
