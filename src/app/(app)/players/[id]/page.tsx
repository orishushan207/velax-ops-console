import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreditCard, ShieldCheck, Trophy, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getPlayerDetail } from '@/server/queries/people';
import { getPlayerFormValues } from '@/server/queries/record-forms';
import { listClubOptions } from '@/server/queries/clubs';
import { EditPlayerButton } from '@/components/forms/entity-buttons';
import { playerFormSections } from '@/components/forms/entity-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('players.view');
  const data = await getPlayerDetail(id, user);
  return { title: data ? String(data.player.full_name) : 'שחקן' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('players.view');
  const data = await getPlayerDetail(id, user);
  if (!data) notFound();

  const canEditPlayer = user.permissions.has('players.edit');
  const [playerForm, clubOptions] = await Promise.all([
    canEditPlayer ? getPlayerFormValues(id) : Promise.resolve(null),
    canEditPlayer ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const p = data.player;
  const canSeePii = user.permissions.has('players.view_pii');

  const totalMinutes = data.sessions.reduce(
    (s, x) => s + num(x.actual_minutes ?? x.scheduled_minutes),
    0,
  );
  const totalSpent = data.payments.reduce((s, x) => s + num(x.amount_gross), 0);
  const totalRefunded = data.refunds.reduce((s, x) => s + num(x.amount_gross), 0);
  const completedSessions = data.sessions.filter((s) => s.status === 'completed').length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'שחקנים', href: '/players' }, { label: String(p.full_name) }]}
        title={String(p.full_name)}
        description={
          canSeePii
            ? [str(p.phone), str(p.email)].filter(Boolean).join(' · ')
            : 'פרטי קשר מוסתרים — נדרשת הרשאת צפייה בפרטים מזהים'
        }
        actions={
          playerForm ? (
            <EditPlayerButton
              id={id}
              sections={playerFormSections(playerForm, clubOptions)}
              label="עריכת שחקן"
            />
          ) : undefined
        }
        meta={
          <>
            <Badge
              tone={labels.userStatus.tone(
                String(p.status) as Parameters<typeof labels.userStatus.tone>[0],
              )}
              dot
            >
              {labels.userStatus.label(
                String(p.status) as Parameters<typeof labels.userStatus.label>[0],
              )}
            </Badge>
            <Badge
              tone={labels.playerLevel.tone(
                String(p.level) as Parameters<typeof labels.playerLevel.tone>[0],
              )}
            >
              {labels.playerLevel.label(
                String(p.level) as Parameters<typeof labels.playerLevel.label>[0],
              )}
            </Badge>
            <Badge
              tone={labels.membershipTier.tone(
                String(p.membership_tier) as Parameters<typeof labels.membershipTier.tone>[0],
              )}
            >
              {labels.membershipTier.label(
                String(p.membership_tier) as Parameters<typeof labels.membershipTier.label>[0],
              )}
            </Badge>
            {((p.risk_flags as string[]) ?? []).length > 0 && (
              <Badge tone="danger" dot>
                אינדיקטור סיכון
              </Badge>
            )}
          </>
        }
      />

      <Callout tone="info" icon={ShieldCheck} className="mb-4">
        עריכת פרטי השחקן זמינה מכפתור העריכה, וכל שינוי נרשם ב־Audit Log עם הערך הקודם והחדש.
        פעולות רגישות — חסימה, איחוד חשבונות, מתן קרדיט, ייצוא ומחיקת מידע — דורשות הרשאות
        ייעודיות ותהליך אימות זהות, והן לא נבנו בשלב זה; ראה{' '}
        <span className="mono">REMAINING_WORK.md</span>. צפייה בפרטים מזהים נרשמת ב־Audit Log.
      </Callout>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">סשנים שהושלמו</p>
          <p className="num mt-1 text-2xl font-semibold">{completedSessions}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">דקות אימון</p>
          <p className="num mt-1 text-2xl font-semibold">{formatDuration(totalMinutes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">סה״כ שילם</p>
          <p className="num mt-1 text-2xl font-semibold">{formatCurrency(totalSpent)}</p>
          {totalRefunded > 0 && (
            <p className="num mt-0.5 text-[10px] text-[var(--signal-danger)]">
              זוכה {formatCurrency(totalRefunded)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">XP</p>
          <p className="num mt-1 text-2xl font-semibold text-[var(--accent)]">
            {formatNumber(num(p.xp_total))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">Streak</p>
          <p className="num mt-1 text-2xl font-semibold">
            {num(p.current_streak_weeks)} שב׳
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--fg-tertiary)]">
            שיא: {num(p.longest_streak_weeks)} שבועות
          </p>
        </Card>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">פרופיל</TabsTrigger>
          <TabsTrigger value="sessions">אימונים ({data.sessions.length})</TabsTrigger>
          <TabsTrigger value="payments">תשלומים וזיכויים</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="privacy">הסכמות ופרטיות</TabsTrigger>
          <TabsTrigger value="support">פניות תמיכה</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>פרטים בסיסיים</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="שם מלא">{String(p.full_name)}</DetailRow>
                  <DetailRow label="טלפון">
                    {canSeePii ? (
                      <span className="mono">{str(p.phone) ?? '—'}</span>
                    ) : (
                      <span className="text-[var(--fg-tertiary)]">מוסתר</span>
                    )}
                  </DetailRow>
                  <DetailRow label="אימייל">
                    {canSeePii ? (
                      <span className="mono text-[11px]">{str(p.email) ?? '—'}</span>
                    ) : (
                      <span className="text-[var(--fg-tertiary)]">מוסתר</span>
                    )}
                  </DetailRow>
                  <DetailRow label="שנת לידה">
                    {canSeePii ? (str(p.birth_year) ?? '—') : 'מוסתר'}
                  </DetailRow>
                  <DetailRow label="יד דומיננטית">
                    {p.dominant_hand === 'right' ? 'ימין' : p.dominant_hand === 'left' ? 'שמאל' : '—'}
                  </DetailRow>
                  <DetailRow label="מועדון מועדף">
                    {p.preferred_club_id ? (
                      <Link
                        href={`/clubs/${p.preferred_club_id}`}
                        className="hover:text-[var(--accent)]"
                      >
                        {String(p.club_name)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </DetailRow>
                  <DetailRow label="הצטרף">{formatDate(String(p.created_at))}</DetailRow>
                  <DetailRow label="מאמן משייך">{str(p.coach_name) ?? '—'}</DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>רכישה ושיוך</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="ערוץ רכישה">{str(p.acquisition_channel) ?? '—'}</DetailRow>
                  <DetailRow label="UTM Source">
                    <span className="mono text-[11px]">{str(p.utm_source) ?? '—'}</span>
                  </DetailRow>
                  <DetailRow label="UTM Campaign">
                    <span className="mono text-[11px]">{str(p.utm_campaign) ?? '—'}</span>
                  </DetailRow>
                  <DetailRow label="יתרת ארנק">
                    <span className="num">{formatCurrency(num(p.wallet_balance))}</span>
                  </DetailRow>
                  <DetailRow label="נקודות">
                    <span className="num">{formatNumber(num(p.points_balance))}</span>
                  </DetailRow>
                  <DetailRow label="MFA">
                    {p.mfa_enabled ? 'פעיל' : 'כבוי'}
                  </DetailRow>
                  <DetailRow label="קטין">
                    {p.is_minor ? (
                      <Badge size="sm" tone="warning">
                        כן — נדרש אישור הורה
                      </Badge>
                    ) : (
                      'לא'
                    )}
                  </DetailRow>
                  <DetailRow label="אינדיקטורי סיכון">
                    {((p.risk_flags as string[]) ?? []).length === 0 ? (
                      <span className="text-[var(--fg-tertiary)]">אין</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {((p.risk_flags as string[]) ?? []).map((f) => (
                          <Badge key={f} size="sm" tone="danger">
                            {f}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>היסטוריית אימונים</CardTitle>
              <CardDescription>
                מספר אימונים ודקות הם מדדי פעילות והתמדה בלבד — הם אינם מעידים על שיפור מקצועי.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.sessions.length === 0 ? (
                <EmptyState icon={User} title="אין אימונים" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מזהה</th>
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">עמדה</th>
                      <th className="py-2 text-start font-semibold">התחלה</th>
                      <th className="py-2 text-end font-semibold">משך</th>
                      <th className="py-2 text-end font-semibold">סכום</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map((s) => (
                      <tr key={String(s.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">
                          <Link href={`/sessions/${s.id}`} className="mono hover:text-[var(--accent)]">
                            {String(s.reference)}
                          </Link>
                        </td>
                        <td className="py-2.5 text-[var(--fg-secondary)]">{String(s.club_name)}</td>
                        <td className="mono py-2.5 text-[11px]">{String(s.station_code)}</td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {s.started_at ? formatDateTime(String(s.started_at)) : '—'}
                        </td>
                        <td className="num py-2.5 text-end">
                          {formatDuration(num(s.actual_minutes ?? s.scheduled_minutes))}
                        </td>
                        <td className="num py-2.5 text-end">
                          {formatCurrency(num(s.amount_gross))}
                          {num(s.refunded_amount) > 0 && (
                            <span className="ms-1 text-[10px] text-[var(--signal-danger)]">
                              −{formatCurrency(num(s.refunded_amount))}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            size="sm"
                            tone={labels.sessionStatus.tone(
                              String(s.status) as Parameters<typeof labels.sessionStatus.tone>[0],
                            )}
                          >
                            {labels.sessionStatus.label(
                              String(s.status) as Parameters<typeof labels.sessionStatus.label>[0],
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
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>תשלומים</CardTitle>
              </CardHeader>
              <CardContent>
                {data.payments.length === 0 ? (
                  <EmptyState icon={CreditCard} title="אין תשלומים" />
                ) : (
                  <ul className="space-y-1.5">
                    {data.payments.map((pay, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                      >
                        <span className="mono shrink-0">{String(pay.reference)}</span>
                        <span className="num flex-1 text-end font-medium">
                          {formatCurrency(num(pay.amount_gross))}
                        </span>
                        <Badge
                          size="sm"
                          tone={labels.paymentStatus.tone(
                            String(pay.status) as Parameters<typeof labels.paymentStatus.tone>[0],
                          )}
                        >
                          {labels.paymentStatus.label(
                            String(pay.status) as Parameters<typeof labels.paymentStatus.label>[0],
                          )}
                        </Badge>
                        <span className="num text-[10px] text-[var(--fg-tertiary)]">
                          {pay.captured_at ? formatDate(String(pay.captured_at)) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>זיכויים</CardTitle>
              </CardHeader>
              <CardContent>
                {data.refunds.length === 0 ? (
                  <EmptyState icon={CreditCard} title="אין זיכויים" />
                ) : (
                  <ul className="space-y-1.5">
                    {data.refunds.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="mono">{String(r.reference)}</span>
                          <span className="num flex-1 text-end font-medium text-[var(--signal-danger)]">
                            −{formatCurrency(num(r.amount_gross))}
                          </span>
                          <Badge size="sm" tone="neutral">
                            {labels.refundReason.label(
                              String(r.reason) as Parameters<typeof labels.refundReason.label>[0],
                            )}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--fg-secondary)]">
                          {String(r.reason_note)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle>תנועות Rewards</CardTitle>
              <CardDescription>
                XP נצבר רק על סשן שהושלם ושולם. אין XP על פתיחת סשן שלא הושלם ואין רכישה ישירה
                של מעמד.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.rewards.length === 0 ? (
                <EmptyState icon={Trophy} title="אין תנועות Rewards" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">סוג</th>
                      <th className="py-2 text-end font-semibold">XP</th>
                      <th className="py-2 text-end font-semibold">נקודות</th>
                      <th className="py-2 text-end font-semibold">יתרה</th>
                      <th className="py-2 text-end font-semibold">עלות ל־VELA-X</th>
                      <th className="py-2 text-start font-semibold">מתי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rewards.map((rw) => (
                      <tr key={String(rw.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2 text-[var(--fg-secondary)]">{String(rw.tx_type)}</td>
                        <td className="num py-2 text-end">+{num(rw.xp_delta)}</td>
                        <td className="num py-2 text-end">{num(rw.points_delta)}</td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {num(rw.points_balance_after)}
                        </td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {formatCurrency(num(rw.cost_to_company), true)}
                        </td>
                        <td className="num py-2 text-[11px] text-[var(--fg-tertiary)]">
                          {formatDate(String(rw.created_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>הסכמות מתועדות</CardTitle>
              <CardDescription>
                לפי תיקון 13 לחוק הגנת הפרטיות. כל הסכמה נשמרת עם גרסה, תאריך וכתובת IP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.consents.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="אין הסכמות מתועדות" />
              ) : (
                <ul className="space-y-1.5">
                  {data.consents.map((c) => (
                    <li
                      key={String(c.id)}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <Badge size="sm" tone={c.granted ? 'positive' : 'muted'}>
                        {c.granted ? 'ניתנה' : 'לא ניתנה'}
                      </Badge>
                      <span className="min-w-0 flex-1">{String(c.consent_type)}</span>
                      <span className="mono text-[10px] text-[var(--fg-tertiary)]">
                        v{String(c.version)}
                      </span>
                      <span className="num text-[11px] text-[var(--fg-tertiary)]">
                        {formatDate(String(c.granted_at))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Callout tone="info" className="mt-4">
                נתוני בריאות, דופק וקלוריות אינם נאספים במערכת זו ואינם משמשים לפרסום או
                לשיווק. אם ייאספו בעתיד, הם יבודדו בטבלה נפרדת עם הסכמה מפורשת נפרדת.
              </Callout>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle>פניות תמיכה</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tickets.length === 0 ? (
                <EmptyState icon={User} title="אין פניות תמיכה" />
              ) : (
                <ul className="space-y-1.5">
                  {data.tickets.map((t) => (
                    <li key={String(t.id)}>
                      <Link
                        href={`/tickets/${t.id}`}
                        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px] hover:bg-[var(--bg-active)]"
                      >
                        <span className="mono shrink-0">{String(t.reference)}</span>
                        <span className="min-w-0 flex-1 truncate">{String(t.title)}</span>
                        <Badge
                          size="sm"
                          tone={labels.ticketStatus.tone(
                            String(t.status) as Parameters<typeof labels.ticketStatus.tone>[0],
                          )}
                        >
                          {labels.ticketStatus.label(
                            String(t.status) as Parameters<typeof labels.ticketStatus.label>[0],
                          )}
                        </Badge>
                      </Link>
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
