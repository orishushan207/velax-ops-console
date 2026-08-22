import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Cpu,
  Receipt,
  Ticket as TicketIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { SessionControls } from '../../live/session-controls';
import { SessionTimeline } from './timeline';
import { PendingCommands } from './pending-commands';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import {
  getSessionDetail,
  getSessionFinancials,
  getSessionTimeline,
} from '@/server/queries/sessions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('sessions.view');
  const session = await getSessionDetail(id, user);
  return { title: session ? `Session ${session.reference}` : 'Session' };
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('sessions.view');

  const session = await getSessionDetail(id, user);
  if (!session) notFound();

  const [timeline, financials] = await Promise.all([
    getSessionTimeline(id),
    getSessionFinancials(id),
  ]);

  const netAfterRefund = session.amountGross - session.refundedAmount;
  const isRunning = ['active', 'paused', 'connecting', 'authorized'].includes(session.status);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Sessions', href: '/sessions' },
          { label: session.reference },
        ]}
        title={session.reference}
        description={`${session.clubName} · עמדה ${session.stationCode}`}
        meta={
          <>
            <Badge
              tone={labels.sessionStatus.tone(
                session.status as Parameters<typeof labels.sessionStatus.tone>[0],
              )}
              dot
            >
              {labels.sessionStatus.label(
                session.status as Parameters<typeof labels.sessionStatus.label>[0],
              )}
            </Badge>
            {session.peakWindow && (
              <Badge
                tone={labels.peakWindow.tone(
                  session.peakWindow as Parameters<typeof labels.peakWindow.tone>[0],
                )}
              >
                {labels.peakWindow.label(
                  session.peakWindow as Parameters<typeof labels.peakWindow.label>[0],
                )}
              </Badge>
            )}
            {session.playerCount === 2 && <Badge tone="neutral">אימון זוגי</Badge>}
            {session.isDemo && <Badge tone="warning">נתוני הדגמה</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clubs/${session.clubId}`}>
                <Building2 />
                עמוד המועדון
              </Link>
            </Button>
            {session.deviceId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/stations/devices/${session.deviceId}`}>
                  <Cpu />
                  עמוד המכונה
                </Link>
              </Button>
            )}
          </>
        }
      />

      {session.status === 'failed_to_start' && (
        <Callout tone="danger" icon={AlertTriangle} title="הסשן שולם ולא התחיל" className="mb-4">
          סיבת הכשל שנרשמה: <span className="mono">{session.failureReason ?? 'לא צוינה'}</span>.
          לפי כללי המערכת, סשן כזה הוא מועמד לזיכוי מלא אוטומטי, והוא נספר לרעה במדד
          Start Success.
        </Callout>
      )}

      {/* ⚠ מוצג לפני הפרטים: מפעיל שלחץ "עצור" חייב לראות שהפקודה
          עדיין לא הגיעה למכונה, לפני כל מידע אחר */}
      <PendingCommands sessionId={id} />

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* ─── פרטי הסשן ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>פרטי האימון</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="שחקן">
                  {session.userId ? (
                    <Link
                      href={`/players/${session.userId}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {session.playerName}
                    </Link>
                  ) : (
                    session.playerName
                  )}
                </DetailRow>
                {session.playerPhone && user.permissions.has('players.view_pii') && (
                  <DetailRow label="טלפון">
                    <span className="mono">{session.playerPhone}</span>
                  </DetailRow>
                )}
                <DetailRow label="מספר שחקנים">
                  <span className="num">{session.playerCount}</span>
                </DetailRow>
                <DetailRow label="רמה">
                  {session.level
                    ? labels.playerLevel.label(
                        session.level as Parameters<typeof labels.playerLevel.label>[0],
                      )
                    : '—'}
                </DetailRow>
                <DetailRow label="תוכנית אימון">{session.programName ?? '—'}</DetailRow>
                <DetailRow label="מקור רכישה">
                  {labels.purchaseChannel.label(
                    session.purchaseChannel as Parameters<typeof labels.purchaseChannel.label>[0],
                  )}
                </DetailRow>
                {session.coachId && (
                  <DetailRow label="שיוך למאמן">
                    <Link
                      href={`/coaches/${session.coachId}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {session.coachName}
                    </Link>
                  </DetailRow>
                )}
                {session.referralCode && (
                  <DetailRow label="קוד הפניה">
                    <span className="mono">{session.referralCode}</span>
                  </DetailRow>
                )}
                {(session.utmSource || session.utmCampaign) && (
                  <DetailRow label="UTM">
                    <span className="mono text-[11px]">
                      {[session.utmSource, session.utmCampaign].filter(Boolean).join(' / ')}
                    </span>
                  </DetailRow>
                )}
              </DetailList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>זמנים ומדידה</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="נוצר">{formatDateTime(session.createdAt)}</DetailRow>
                <DetailRow label="התחיל בפועל">
                  {session.startedAt ? formatDateTime(session.startedAt) : '—'}
                </DetailRow>
                <DetailRow label="הסתיים">
                  {session.endedAt ? formatDateTime(session.endedAt) : '—'}
                </DetailRow>
                <DetailRow label="זמן מתוכנן">
                  {formatDuration(session.scheduledMinutes)}
                </DetailRow>
                <DetailRow label="זמן בפועל">
                  {session.actualMinutes === null ? '—' : formatDuration(session.actualMinutes)}
                </DetailRow>
                {session.pausedMinutes > 0 && (
                  <DetailRow label="זמן השהיה">
                    {formatDuration(session.pausedMinutes)}
                  </DetailRow>
                )}
                <DetailRow label="כדורים משוער">
                  {session.estimatedBalls === null ? '—' : formatNumber(session.estimatedBalls)}
                </DetailRow>
                <DetailRow label="התחיל ללא עזרת צוות">
                  {session.startedWithoutStaffHelp === null ? (
                    '—'
                  ) : session.startedWithoutStaffHelp ? (
                    <Badge size="sm" tone="positive">
                      כן
                    </Badge>
                  ) : (
                    <Badge size="sm" tone="warning">
                      לא
                    </Badge>
                  )}
                </DetailRow>
                {session.endReason && (
                  <DetailRow label="סיבת סיום">
                    <span className="mono text-[11px]">{session.endReason}</span>
                  </DetailRow>
                )}
              </DetailList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>תשתית</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="מועדון">
                  <Link href={`/clubs/${session.clubId}`} className="hover:text-[var(--accent)]">
                    {session.clubName}
                  </Link>
                </DetailRow>
                <DetailRow label="עמדה">
                  <Link
                    href={`/stations/${session.stationId}`}
                    className="mono hover:text-[var(--accent)]"
                  >
                    {session.stationCode}
                  </Link>
                </DetailRow>
                <DetailRow label="מכונה">
                  {session.deviceId ? (
                    <Link
                      href={`/stations/devices/${session.deviceId}`}
                      className="mono hover:text-[var(--accent)]"
                    >
                      {session.deviceLabel}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                {session.deviceSerial && (
                  <DetailRow label="מספר סידורי">
                    <span className="mono text-[11px]">{session.deviceSerial}</span>
                  </DetailRow>
                )}
              </DetailList>
            </CardContent>
          </Card>
        </div>

        {/* ─── כספים + Timeline ─── */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>כספים</CardTitle>
              <CardDescription>
                הפרדה מלאה בין הסכום כולל מע״מ להכנסה נטו. תרומה אינה מוצגת ברמת סשן בודד —
                היא נגזרת רק ברמת תקופה.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailList>
                  <DetailRow label="מחיר מחירון">
                    <span className="num">{formatCurrency(session.listPriceGross, true)}</span>
                  </DetailRow>
                  {session.discountAmount > 0 && (
                    <DetailRow label="הנחה">
                      <span className="num text-[var(--signal-warning)]">
                        −{formatCurrency(session.discountAmount, true)}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="חויב (כולל מע״מ)">
                    <span className="num font-medium">
                      {formatCurrency(session.amountGross, true)}
                    </span>
                  </DetailRow>
                  <DetailRow label="מתוכו מע״מ">
                    <span className="num text-[var(--fg-secondary)]">
                      {formatCurrency(session.vatAmount, true)}
                    </span>
                  </DetailRow>
                  <DetailRow label="הכנסה נטו (לפני מע״מ)">
                    <span className="num">{formatCurrency(session.amountNet, true)}</span>
                  </DetailRow>
                </DetailList>

                <DetailList>
                  {financials.payment && (
                    <>
                      <DetailRow label="סטטוס תשלום">
                        <Badge
                          size="sm"
                          tone={labels.paymentStatus.tone(
                            financials.payment.status as Parameters<
                              typeof labels.paymentStatus.tone
                            >[0],
                          )}
                        >
                          {labels.paymentStatus.label(
                            financials.payment.status as Parameters<
                              typeof labels.paymentStatus.label
                            >[0],
                          )}
                        </Badge>
                      </DetailRow>
                      <DetailRow label="אמצעי תשלום">
                        {labels.paymentMethod.label(
                          financials.payment.method as Parameters<
                            typeof labels.paymentMethod.label
                          >[0],
                        )}
                        {financials.payment.cardLast4 && (
                          <span className="mono ms-1.5 text-[11px] text-[var(--fg-tertiary)]">
                            •••• {financials.payment.cardLast4}
                          </span>
                        )}
                      </DetailRow>
                      <DetailRow label="עמלת סליקה">
                        <span className="num text-[var(--fg-secondary)]">
                          {formatCurrency(financials.payment.processingFee, true)}
                        </span>
                      </DetailRow>
                      <DetailRow label="מזהה עסקה">
                        <span className="mono text-[11px]">
                          {financials.payment.providerTransactionId ?? '—'}
                        </span>
                      </DetailRow>
                      <DetailRow label="ספק סליקה">
                        <Badge size="sm" tone={financials.payment.provider === 'mock' ? 'warning' : 'neutral'}>
                          {financials.payment.provider === 'mock'
                            ? 'Mock — לא בוצע חיוב אמיתי'
                            : financials.payment.provider}
                        </Badge>
                      </DetailRow>
                    </>
                  )}
                  {session.refundedAmount > 0 && (
                    <DetailRow label="סה״כ זוכה">
                      <span className="num text-[var(--signal-danger)]">
                        −{formatCurrency(session.refundedAmount, true)}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="נשאר בפועל">
                    <span className="num font-medium">{formatCurrency(netAfterRefund, true)}</span>
                  </DetailRow>
                </DetailList>
              </div>

              {financials.refunds.length > 0 && (
                <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  <h3 className="mb-2 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    זיכויים
                  </h3>
                  <ul className="space-y-2">
                    {financials.refunds.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3 text-[12px]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="mono">{r.reference}</span>
                          <span className="num font-medium text-[var(--signal-danger)]">
                            −{formatCurrency(r.amountGross, true)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge size="sm" tone={labels.refundType.tone(r.refundType as 'full')}>
                            {labels.refundType.label(r.refundType as 'full')}
                          </Badge>
                          <Badge size="sm" tone="neutral">
                            {labels.refundReason.label(
                              r.reason as Parameters<typeof labels.refundReason.label>[0],
                            )}
                          </Badge>
                          <Badge size="sm" tone="muted">
                            {labels.refundDestination.label(
                              r.destination as Parameters<typeof labels.refundDestination.label>[0],
                            )}
                          </Badge>
                          {r.isAutomatic && (
                            <Badge size="sm" tone="info">
                              אוטומטי
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 text-[var(--fg-secondary)]">{r.reasonNote}</p>
                        <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                          {r.requestedByName && `בוצע: ${r.requestedByName}`}
                          {r.approvedByName && ` · אושר: ${r.approvedByName}`}
                          {r.processedAt && ` · ${formatDateTime(r.processedAt)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {financials.linkedBookings.length > 0 && (
                <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  <h3 className="mb-1 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    הזמנות מגרש מקושרות
                  </h3>
                  <p className="mb-2 text-[11px] text-[var(--fg-tertiary)]">
                    זו הכנסת המועדון, לא הכנסת VELA-X. רק החלק שסווג כאינקרמנטלי נספר ב־Earn-Back.
                  </p>
                  <ul className="space-y-1.5">
                    {financials.linkedBookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                      >
                        <span>{b.courtName ?? 'מגרש'}</span>
                        <Badge
                          size="sm"
                          tone={labels.bookingLinkType.tone(
                            b.linkType as Parameters<typeof labels.bookingLinkType.tone>[0],
                          )}
                        >
                          {labels.bookingLinkType.label(
                            b.linkType as Parameters<typeof labels.bookingLinkType.label>[0],
                          )}
                        </Badge>
                        <span className="num text-[var(--fg-secondary)]">
                          {formatDuration(b.durationMinutes)}
                        </span>
                        <span className="num font-medium">{formatCurrency(b.revenueNet)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {financials.tickets.length > 0 && (
                <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                  <h3 className="mb-2 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    קריאות שירות מקושרות
                  </h3>
                  <ul className="space-y-1.5">
                    {financials.tickets.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/tickets/${t.id}`}
                          className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px] transition-colors hover:bg-[var(--bg-active)]"
                        >
                          <TicketIcon className="size-3.5 shrink-0 text-[var(--fg-tertiary)]" />
                          <span className="mono">{t.reference}</span>
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <Badge
                            size="sm"
                            tone={labels.ticketSeverity.tone(
                              t.severity as Parameters<typeof labels.ticketSeverity.tone>[0],
                            )}
                          >
                            {labels.ticketSeverity.label(
                              t.severity as Parameters<typeof labels.ticketSeverity.label>[0],
                            )}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* פעולות */}
              <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                <h3 className="mb-2 text-[12px] font-semibold text-[var(--fg-secondary)]">
                  פעולות
                </h3>
                {isRunning || session.amountGross > 0 ? (
                  <SessionControls
                    sessionId={session.id}
                    reference={session.reference}
                    status={session.status}
                    amountGross={session.amountGross - session.refundedAmount}
                    can={{
                      control: user.permissions.has('sessions.control') && isRunning,
                      forceEnd: user.permissions.has('sessions.force_end') && isRunning,
                      refund:
                        user.permissions.has('refunds.request') &&
                        session.amountGross - session.refundedAmount > 0,
                      message: user.permissions.has('sessions.message_player'),
                      markFaulty: user.permissions.has('sessions.mark_faulty'),
                      createTicket: user.permissions.has('tickets.create'),
                    }}
                  />
                ) : (
                  <p className="text-[12px] text-[var(--fg-tertiary)]">
                    אין פעולות זמינות לסשן בסטטוס זה.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                כל אירוע שנרשם על הסשן, לפי סדר כרונולוגי — כולל מקור האירוע ומבצע הפעולה.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState icon={Receipt} title="לא נרשמו אירועים" />
              ) : (
                <SessionTimeline events={timeline.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() }))} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
