import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraduationCap, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getCoachDetail } from '@/server/queries/people';
import { getCoachFormValues } from '@/server/queries/record-forms';
import { listClubOptions } from '@/server/queries/clubs';
import { EditCoachButton } from '@/components/forms/entity-buttons';
import { coachFormSections } from '@/components/forms/entity-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  await requirePermission('coaches.view');
  const data = await getCoachDetail(id);
  return { title: data ? String(data.coach.display_name) : 'מאמן' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('coaches.view');
  const data = await getCoachDetail(id);
  if (!data) notFound();

  const canManageCoaches = user.permissions.has('coaches.manage');
  const [coachForm, clubOptions] = await Promise.all([
    canManageCoaches ? getCoachFormValues(id) : Promise.resolve(null),
    canManageCoaches ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const c = data.coach;
  const canSeeFinance = user.permissions.has('finance.view') || user.permissions.has('commissions.approve');

  const accrued = data.commissions.reduce((s, x) => s + num(x.commission_amount), 0);
  const paid = data.commissions
    .filter((x) => x.status === 'paid')
    .reduce((s, x) => s + num(x.commission_amount), 0);
  const payable = data.commissions
    .filter((x) => ['accrued', 'holding_period', 'approved'].includes(String(x.status)))
    .reduce((s, x) => s + num(x.commission_amount), 0);
  const clawedBack = data.commissions
    .filter((x) => x.status === 'clawed_back')
    .reduce((s, x) => s + num(x.commission_amount), 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'מאמנים', href: '/coaches' }, { label: String(c.display_name) }]}
        title={String(c.display_name)}
        description={str(c.bio) ?? ''}
        actions={
          coachForm ? (
            <EditCoachButton
              id={id}
              sections={coachFormSections(coachForm, clubOptions)}
              label="עריכת מאמן"
            />
          ) : undefined
        }
        meta={
          <>
            <Badge
              tone={labels.coachVerification.tone(
                String(c.verification) as Parameters<typeof labels.coachVerification.tone>[0],
              )}
              dot
            >
              {labels.coachVerification.label(
                String(c.verification) as Parameters<typeof labels.coachVerification.label>[0],
              )}
            </Badge>
            <Badge tone="neutral">
              <span className="mono">{String(c.referral_code)}</span>
            </Badge>
            {c.home_club_id ? (
              <Link href={`/clubs/${c.home_club_id}`}>
                <Badge tone="muted">{String(c.club_name)}</Badge>
              </Link>
            ) : null}
            {c.content_rights_granted ? (
              <Badge tone="positive">זכויות תוכן ניתנו</Badge>
            ) : (
              <Badge tone="warning">זכויות תוכן טרם ניתנו</Badge>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">מתאמנים משויכים</p>
          <p className="num mt-1 text-2xl font-semibold">{data.attributions.length}</p>
        </Card>
        {canSeeFinance && (
          <>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">עמלה שנצברה</p>
              <p className="num mt-1 text-2xl font-semibold">{formatCurrency(accrued)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">יתרה לתשלום</p>
              <p className="num mt-1 text-2xl font-semibold text-[var(--signal-warning)]">
                {formatCurrency(payable)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">שולם</p>
              <p className="num mt-1 text-2xl font-semibold text-[var(--accent)]">
                {formatCurrency(paid)}
              </p>
              {clawedBack > 0 && (
                <p className="num mt-0.5 text-[10px] text-[var(--signal-danger)]">
                  הוחזר {formatCurrency(clawedBack)}
                </p>
              )}
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">פרופיל ותעריפים</TabsTrigger>
          <TabsTrigger value="attributions">שיוכים ({data.attributions.length})</TabsTrigger>
          {canSeeFinance && (
            <TabsTrigger value="commissions">עמלות ({data.commissions.length})</TabsTrigger>
          )}
          <TabsTrigger value="content">תוכן ({data.programs.length})</TabsTrigger>
          <TabsTrigger value="homework">שיעורי בית ({data.homework.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>פרטי המאמן</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="שם תצוגה">{String(c.display_name)}</DetailRow>
                  <DetailRow label="שם מלא">{String(c.full_name)}</DetailRow>
                  <DetailRow label="קוד הפניה">
                    <span className="mono">{String(c.referral_code)}</span>
                  </DetailRow>
                  <DetailRow label="דירוג">
                    {c.rating === null
                      ? '—'
                      : `${formatNumber(num(c.rating), 1)} (${num(c.rating_count)} ביקורות)`}
                  </DetailRow>
                  <DetailRow label="אומת בתאריך">
                    {c.verified_at ? formatDate(String(c.verified_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="הסכם נחתם">
                    {c.agreement_signed_at ? formatDate(String(c.agreement_signed_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="זכויות שימוש בתוכן">
                    {c.content_rights_granted ? 'ניתנו' : 'טרם ניתנו'}
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            {canSeeFinance && (
              <Card>
                <CardHeader>
                  <CardTitle>תעריפי עמלה</CardTitle>
                  <CardDescription>
                    ארבעת מסלולי התגמול מפרק 10 בתוכנית העסקית.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DetailList>
                    <DetailRow label="בונוס הפניה (חד-פעמי)">
                      <span className="num">{formatCurrency(num(c.referral_bonus_amount))}</span>
                    </DetailRow>
                    <DetailRow label="עמלת שימור">
                      <span className="num">
                        {formatPercent(num(c.retention_commission_pct), 1)}
                      </span>
                    </DetailRow>
                    <DetailRow label="עמלת שיעורי בית">
                      <span className="num">
                        {formatPercent(num(c.homework_commission_pct), 1)}
                      </span>
                    </DetailRow>
                    <DetailRow label="תמלוגי תוכן">
                      <span className="num">{formatPercent(num(c.content_royalty_pct), 1)}</span>
                    </DetailRow>
                    <DetailRow label="תקרת עמלה ללקוח">
                      <span className="num">
                        {formatPercent(num(c.commission_cap_pct_per_customer), 0)}
                      </span>
                    </DetailRow>
                    <DetailRow label="חלון שיוך">
                      <span className="num">{num(c.attribution_window_days)} ימים</span>
                    </DetailRow>
                  </DetailList>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attributions">
          <Card>
            <CardHeader>
              <CardTitle>מתאמנים משויכים</CardTitle>
              <CardDescription>
                שיוך שנפסל בבדיקת הונאה מסומן במפורש ואינו מזכה בעמלה.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.attributions.length === 0 ? (
                <EmptyState icon={GraduationCap} title="אין שיוכים" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מתאמן</th>
                      <th className="py-2 text-start font-semibold">סוג שיוך</th>
                      <th className="py-2 text-start font-semibold">שויך בתאריך</th>
                      <th className="py-2 text-start font-semibold">תוקף עד</th>
                      <th className="py-2 text-center font-semibold">מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attributions.map((a) => (
                      <tr key={String(a.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">
                          <Link href={`/players/${a.user_id}`} className="hover:text-[var(--accent)]">
                            {String(a.user_name)}
                          </Link>
                        </td>
                        <td className="py-2.5">
                          <Badge size="sm" tone="neutral">
                            {labels.attributionType.label(
                              String(a.attribution_type) as Parameters<
                                typeof labels.attributionType.label
                              >[0],
                            )}
                          </Badge>
                        </td>
                        <td className="num py-2.5 text-[11px]">
                          {formatDate(String(a.attributed_at))}
                        </td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {a.expires_at ? formatDate(String(a.expires_at)) : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          {a.is_rejected ? (
                            <Badge size="sm" tone="danger">
                              נפסל
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="positive">
                              תקף
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeFinance && (
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>עמלות</CardTitle>
                <CardDescription>
                  עמלה נכנסת לתקופת המתנה עד תום חלון הזיכויים, ורק אז ניתנת לאישור ולתשלום.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.commissions.length === 0 ? (
                  <EmptyState icon={ScrollText} title="אין רשומות עמלה" />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">Session</th>
                        <th className="py-2 text-start font-semibold">מסלול</th>
                        <th className="py-2 text-end font-semibold">בסיס (נטו)</th>
                        <th className="py-2 text-end font-semibold">שיעור</th>
                        <th className="py-2 text-end font-semibold">עמלה</th>
                        <th className="py-2 text-start font-semibold">נצברה</th>
                        <th className="py-2 text-start font-semibold">שוחררה</th>
                        <th className="py-2 text-center font-semibold">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.commissions.map((cm) => (
                        <tr key={String(cm.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-2.5">
                            {cm.session_id ? (
                              <Link
                                href={`/sessions/${cm.session_id}`}
                                className="mono hover:text-[var(--accent)]"
                              >
                                {String(cm.session_reference)}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 text-[var(--fg-secondary)]">
                            {labels.attributionType.label(
                              String(cm.attribution_type) as Parameters<
                                typeof labels.attributionType.label
                              >[0],
                            )}
                          </td>
                          <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                            {formatCurrency(num(cm.base_amount_net), true)}
                          </td>
                          <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                            {formatPercent(num(cm.rate_pct), 1)}
                          </td>
                          <td className="num py-2.5 text-end font-medium">
                            {formatCurrency(num(cm.commission_amount), true)}
                          </td>
                          <td className="num py-2.5 text-[11px]">
                            {formatDate(String(cm.accrued_at))}
                          </td>
                          <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                            {cm.holding_until ? formatDate(String(cm.holding_until)) : '—'}
                          </td>
                          <td className="py-2.5 text-center">
                            <Badge
                              size="sm"
                              tone={labels.commissionStatus.tone(
                                String(cm.status) as Parameters<
                                  typeof labels.commissionStatus.tone
                                >[0],
                              )}
                            >
                              {labels.commissionStatus.label(
                                String(cm.status) as Parameters<
                                  typeof labels.commissionStatus.label
                                >[0],
                              )}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <Callout tone="info" className="mt-4">
                  אישור ותשלום עמלות בפועל דורשים חיבור למערכת תשלומים לספקים. הפעולה לא נבנתה
                  בשלב זה — ראה <span className="mono">REMAINING_WORK.md</span>.
                </Callout>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>תוכניות אימון שיצר</CardTitle>
            </CardHeader>
            <CardContent>
              {data.programs.length === 0 ? (
                <EmptyState icon={ScrollText} title="לא נוצרו תוכניות" />
              ) : (
                <ul className="space-y-1.5">
                  {data.programs.map((p) => (
                    <li
                      key={String(p.id)}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{String(p.name_he)}</span>
                      {p.level ? (
                        <Badge size="sm" tone="neutral">
                          {labels.playerLevel.label(
                            String(p.level) as Parameters<typeof labels.playerLevel.label>[0],
                          )}
                        </Badge>
                      ) : null}
                      <span className="num text-[11px] text-[var(--fg-tertiary)]">
                        {num(p.usage_count)} שימושים
                      </span>
                      {p.version_status ? (
                        <Badge
                          size="sm"
                          tone={labels.contentStatus.tone(
                            String(p.version_status) as Parameters<
                              typeof labels.contentStatus.tone
                            >[0],
                          )}
                        >
                          {labels.contentStatus.label(
                            String(p.version_status) as Parameters<
                              typeof labels.contentStatus.label
                            >[0],
                          )}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homework">
          <Card>
            <CardHeader>
              <CardTitle>שיעורי בית שהוקצו</CardTitle>
            </CardHeader>
            <CardContent>
              {data.homework.length === 0 ? (
                <EmptyState icon={GraduationCap} title="לא הוקצו שיעורי בית" />
              ) : (
                <ul className="space-y-1.5">
                  {data.homework.map((h) => (
                    <li
                      key={String(h.id)}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{String(h.title)}</span>
                      <Link href={`/players/${h.user_id}`} className="hover:text-[var(--accent)]">
                        {String(h.user_name)}
                      </Link>
                      <span className="num text-[11px] text-[var(--fg-tertiary)]">
                        {num(h.completed_sessions)}/{num(h.target_sessions)}
                      </span>
                      {h.due_on ? (
                        <span className="num text-[11px] text-[var(--fg-tertiary)]">
                          {formatDate(String(h.due_on))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
