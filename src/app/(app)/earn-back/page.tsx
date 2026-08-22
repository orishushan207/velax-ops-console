import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getEarnBackPortfolio, listEarnBackAgreements } from '@/server/metrics/earn-back';
import { getSettings } from '@/server/settings/service';

export const metadata: Metadata = { title: 'Earn-Back' };

export default async function EarnBackPage() {
  const user = await requirePermission('earnback.view');
  const [agreements, portfolio, settings] = await Promise.all([
    listEarnBackAgreements(user),
    getEarnBackPortfolio(user),
    getSettings(),
  ]);

  const incrementalityFactor = settings.num('earnback.incrementality_factor', 0.7);
  const atRisk = agreements.filter((a) => a.status === 'at_risk');

  return (
    <>
      <PageHeader
        title="Earn-Back — ערבות ההחזר"
        description="ערבות ששת החודשים למועדון. ההחזר נמדד מהכנסת המגרש המקושרת של המועדון, לא מהכנסת VELA-X."
        meta={
          <>
            {portfolio.atRiskAgreements > 0 && (
              <Badge tone="danger" dot>
                {portfolio.atRiskAgreements} מועדונים בסיכון
              </Badge>
            )}
            {portfolio.metAgreements > 0 && (
              <Badge tone="positive" dot>
                {portfolio.metAgreements} הושגו
              </Badge>
            )}
          </>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard label="הסכמי ערבות" value={formatNumber(portfolio.totalAgreements)} />
        <KpiCard label="פעילים" value={formatNumber(portfolio.activeAgreements)} />
        <KpiCard
          label="בסיכון"
          value={formatNumber(portfolio.atRiskAgreements)}
          higherIsBetter={false}
        />
        <KpiCard
          label="חשיפה נוכחית"
          metricKey="earn_back_exposure"
          value={formatCurrency(portfolio.totalExposure)}
          higherIsBetter={false}
          accent
        />
        <KpiCard
          label="רזרבה נדרשת"
          value={formatCurrency(portfolio.requiredReserve)}
          hint="לפי אחוז ההפרשה שנקבע בהסכמים. התוכנית מציעה 10%–15% מתקבולי ההתקנה."
        />
        <KpiCard
          label="חשיפה בתרחיש קיצון"
          value={formatCurrency(portfolio.worstCaseExposure)}
          higherIsBetter={false}
          hint="אם כל המועדונים הפעילים נכשלים בו-זמנית עד תקרת החשיפה."
        />
      </KpiGrid>

      <Callout tone="warning" icon={AlertTriangle} title="הסיכון כאן מתואם, לא מפוזר" className="mt-4">
        המודל הפיננסי מזהיר במפורש: אם הביקוש חלש, כל המועדונים נכשלים באותו רגע — זו אינה תיק
        סיכונים מפוזר אלא הימור אחד גדול. בנוסף, הערבות מבשילה בדיוק כשהחברה במקסימום שריפת
        מזומן. לכן מוצגות כאן גם החשיפה הנוכחית וגם תרחיש הקיצון.
      </Callout>

      {atRisk.length > 0 && (
        <Card className="mt-5 ring-[var(--signal-danger-ring)]">
          <CardHeader>
            <CardTitle className="text-[var(--signal-danger)]">מועדונים בסיכון</CardTitle>
            <CardDescription>
              התחזית מראה שההכנסה המצטברת לא תגיע למחיר הכניסה עד סוף התקופה.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {atRisk.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/earn-back/${a.id}`}
                    className="block rounded-[var(--radius-control)] bg-[var(--signal-danger-bg)] p-3 ring-1 ring-inset ring-[var(--signal-danger-ring)] transition-colors hover:bg-[var(--signal-danger-bg)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{a.clubName}</span>
                      <span className="num text-[12px] text-[var(--signal-danger)]">
                        פער {formatCurrency(a.remainingGap)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[var(--fg-secondary)]">
                      <span>
                        התקדמות: <span className="num">{formatPercent(a.progressPct, 0)}</span>
                      </span>
                      <span>
                        קצב נדרש:{' '}
                        <span className="num">{formatNumber(a.requiredRunRatePerDay, 2)}</span> ש׳/יום
                      </span>
                      <span>
                        נותרו <span className="num">{a.daysRemaining}</span> ימים
                      </span>
                      {a.conditionsNotMet > 0 && (
                        <span className="text-[var(--signal-warning)]">
                          {a.conditionsNotMet} תנאי סף לא מתקיימים
                        </span>
                      )}
                    </div>
                    <Progress value={a.progressPct * 100} tone="danger" className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>כל הסכמי הערבות</CardTitle>
          <CardDescription>
            מקדם האינקרמנטליות בברירת המחדל הוא {formatPercent(incrementalityFactor, 0)} — הנחה
            שדורשת אימות בפיילוט וניתנת לשינוי לכל הסכם בנפרד.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {agreements.length === 0 ? (
            <EmptyState
              icon={Target}
              title="אין הסכמי Earn-Back"
              description="הסכם ערבות נוצר יחד עם חתימת ההסכם המסחרי מול המועדון."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                  <th className="py-2 text-start font-semibold">מועדון</th>
                  <th className="py-2 text-end font-semibold">מחיר כניסה</th>
                  <th className="py-2 text-end font-semibold">הכנסה מאומתת</th>
                  <th className="py-2 text-end font-semibold">פער</th>
                  <th className="py-2 text-center font-semibold">התקדמות</th>
                  <th className="py-2 text-end font-semibold">קצב נדרש</th>
                  <th className="py-2 text-end font-semibold">ימים שנותרו</th>
                  <th className="py-2 text-center font-semibold">תנאי סף</th>
                  <th className="py-2 text-end font-semibold">חשיפה</th>
                  <th className="py-2 text-center font-semibold">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
                  >
                    <td className="py-2.5">
                      <Link href={`/earn-back/${a.id}`} className="font-medium hover:text-[var(--accent)]">
                        {a.clubName}
                      </Link>
                      <span className="block text-[10px] text-[var(--fg-tertiary)]">
                        {formatDate(a.startsOn)} — {formatDate(a.endsOn)}
                      </span>
                    </td>
                    <td className="num py-2.5 text-end">{formatCurrency(a.entryPrice)}</td>
                    <td className="num py-2.5 text-end">{formatCurrency(a.verifiedRevenue)}</td>
                    <td className="num py-2.5 text-end">
                      {a.remainingGap > 0 ? (
                        <span className="text-[var(--signal-warning)]">{formatCurrency(a.remainingGap)}</span>
                      ) : (
                        <span className="text-[var(--signal-positive)]">הושלם</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <Progress
                          value={a.progressPct * 100}
                          tone={
                            a.status === 'at_risk'
                              ? 'danger'
                              : a.progressPct >= 1
                                ? 'accent'
                                : 'info'
                          }
                          className="w-16"
                        />
                        <span className="num text-[11px]">{formatPercent(a.progressPct, 0)}</span>
                      </div>
                    </td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                      {formatNumber(a.requiredRunRatePerDay, 2)} ש׳
                    </td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                      {a.daysRemaining}
                    </td>
                    <td className="py-2.5 text-center">
                      {a.conditionsTotal === 0 ? (
                        <span className="text-[var(--fg-tertiary)]">—</span>
                      ) : a.conditionsNotMet > 0 ? (
                        <Badge size="sm" tone="warning">
                          {a.conditionsTotal - a.conditionsNotMet}/{a.conditionsTotal}
                        </Badge>
                      ) : (
                        <Badge size="sm" tone="positive">
                          {a.conditionsTotal}/{a.conditionsTotal}
                        </Badge>
                      )}
                    </td>
                    <td className="num py-2.5 text-end">
                      {a.exposure > 0 ? (
                        <span className="text-[var(--signal-danger)]">{formatCurrency(a.exposure)}</span>
                      ) : (
                        <span className="text-[var(--fg-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge
                        size="sm"
                        tone={labels.earnBackStatus.tone(
                          a.status as Parameters<typeof labels.earnBackStatus.tone>[0],
                        )}
                      >
                        {labels.earnBackStatus.label(
                          a.status as Parameters<typeof labels.earnBackStatus.label>[0],
                        )}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>איך ההכנסה נספרת</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-[13px] leading-relaxed">
            <li className="flex gap-3">
              <Badge size="sm" tone="muted">
                ❌
              </Badge>
              <span>
                <strong>הכנסת VELA-X מהסשן</strong> — מה שהשחקן שילם. אינה נספרת: זו ההכנסה שלנו,
                לא של המועדון.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge size="sm" tone="info">
                בסיס
              </Badge>
              <span>
                <strong>הזמנת מגרש מקושרת</strong> — הזמנה שיש לה Session ID תואם. זהו בסיס
                החישוב.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge size="sm" tone="positive">
                ✅
              </Badge>
              <span>
                <strong>הכנסה אינקרמנטלית</strong> — הזמנה שאומתה כהכנסה שלא הייתה מתקיימת ללא
                המכונה. נספרת במלואה.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge size="sm" tone="muted">
                ❌
              </Badge>
              <span>
                <strong>הזמנה בסיסית</strong> — הייתה מתקיימת בכל מקרה. אינה נספרת, גם אם היא
                מקושרת לסשן.
              </span>
            </li>
          </ul>
          <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
            הזמנות מקושרות שטרם סווגו ידנית משוקללות במקדם האינקרמנטליות
            ({formatPercent(incrementalityFactor, 0)}). התוכנית העסקית מודה בעצמה שהכנסת המגרש
            &laquo;אינה בהכרח כולה אינקרמנטלית&raquo; — ולכן הפרדה זו היא תנאי לחישוב הוגן.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
