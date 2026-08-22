import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Boxes, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatRelative,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getTicketDetail, listTechnicians } from '@/server/queries/tickets';
import { TicketDetailActions } from '../ticket-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('tickets.view');
  const data = await getTicketDetail(id, user);
  return { title: data ? `קריאה ${String(data.ticket.reference)}` : 'קריאת שירות' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('tickets.view');
  const data = await getTicketDetail(id, user);
  if (!data) notFound();

  const t = data.ticket;
  const technicians = await listTechnicians();

  const isResolved = Boolean(t.resolved_at);
  const resolutionDue = t.resolution_due_at ? new Date(String(t.resolution_due_at)) : null;
  const minutesRemaining =
    !isResolved && resolutionDue
      ? Math.round((resolutionDue.getTime() - Date.now()) / 60000)
      : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'תקלות ושירות', href: '/tickets' }, { label: String(t.reference) }]}
        title={String(t.title)}
        description={`${String(t.reference)}${t.club_name ? ` · ${String(t.club_name)}` : ''}${t.station_code ? ` · עמדה ${String(t.station_code)}` : ''}`}
        meta={
          <>
            <Badge
              tone={labels.ticketSeverity.tone(
                String(t.severity) as Parameters<typeof labels.ticketSeverity.tone>[0],
              )}
              dot
            >
              {labels.ticketSeverity.label(
                String(t.severity) as Parameters<typeof labels.ticketSeverity.label>[0],
              )}
            </Badge>
            <Badge
              tone={labels.ticketStatus.tone(
                String(t.status) as Parameters<typeof labels.ticketStatus.tone>[0],
              )}
            >
              {labels.ticketStatus.label(
                String(t.status) as Parameters<typeof labels.ticketStatus.label>[0],
              )}
            </Badge>
            <Badge tone="neutral">
              {labels.ticketCategory.label(
                String(t.category) as Parameters<typeof labels.ticketCategory.label>[0],
              )}
            </Badge>
            <Badge tone="muted">
              {labels.ticketSource.label(
                String(t.source) as Parameters<typeof labels.ticketSource.label>[0],
              )}
            </Badge>
          </>
        }
        actions={
          <TicketDetailActions
            ticketId={String(t.id)}
            reference={String(t.reference)}
            status={String(t.status)}
            assigneeId={str(t.assignee_id)}
            technicians={technicians}
            can={{
              edit: user.permissions.has('tickets.edit'),
              assign: user.permissions.has('tickets.assign'),
              close: user.permissions.has('tickets.close'),
            }}
          />
        }
      />

      {(t.response_breached || t.resolution_breached) && (
        <Callout tone="danger" icon={AlertTriangle} title="הפרת SLA" className="mb-4">
          {t.response_breached ? 'יעד התגובה הופר. ' : ''}
          {t.resolution_breached ? 'יעד התיקון הופר. ' : ''}
          הפרת SLA נספרת מול המועדון ומשפיעה על ציון הבריאות שלו ועל חישוב ה־Earn-Back.
        </Callout>
      )}

      {!isResolved && minutesRemaining !== null && minutesRemaining < 240 && minutesRemaining >= 0 && (
        <Callout tone="warning" icon={AlertTriangle} title="SLA עומד להיפרץ" className="mb-4">
          נותרו {formatDuration(minutesRemaining)} עד יעד התיקון.
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>פרטי הקריאה</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="מזהה">
                  <span className="mono">{String(t.reference)}</span>
                </DetailRow>
                <DetailRow label="נפתחה">{formatDateTime(String(t.created_at))}</DetailRow>
                <DetailRow label="דווח על ידי">{str(t.reporter_name) ?? 'מערכת'}</DetailRow>
                <DetailRow label="אחראי">
                  {str(t.assignee_name) ?? (
                    <Badge size="sm" tone="warning">
                      לא הוקצה
                    </Badge>
                  )}
                </DetailRow>
                <DetailRow label="מועדון">
                  {t.club_id ? (
                    <Link href={`/clubs/${t.club_id}`} className="hover:text-[var(--accent)]">
                      {String(t.club_name)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="עמדה">
                  {t.station_id ? (
                    <Link
                      href={`/stations/${t.station_id}`}
                      className="mono hover:text-[var(--accent)]"
                    >
                      {String(t.station_code)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="מכונה">
                  {t.device_id ? (
                    <Link
                      href={`/stations/devices/${t.device_id}`}
                      className="mono hover:text-[var(--accent)]"
                    >
                      {String(t.device_label)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Session מקושר">
                  {t.session_id ? (
                    <Link
                      href={`/sessions/${t.session_id}`}
                      className="mono hover:text-[var(--accent)]"
                    >
                      {String(t.session_reference)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA</CardTitle>
              <CardDescription>{str(t.sla_policy_name) ?? 'מדיניות ברירת מחדל'}</CardDescription>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="יעד תגובה">
                  {t.response_due_at ? formatDateTime(String(t.response_due_at)) : '—'}
                </DetailRow>
                <DetailRow label="תגובה בפועל">
                  {t.first_response_at ? (
                    <span className={t.response_breached ? 'text-[var(--signal-danger)]' : 'text-[var(--signal-positive)]'}>
                      {formatDateTime(String(t.first_response_at))}
                    </span>
                  ) : (
                    <Badge size="sm" tone="warning">
                      טרם ניתנה
                    </Badge>
                  )}
                </DetailRow>
                <DetailRow label="יעד תיקון">
                  {t.resolution_due_at ? formatDateTime(String(t.resolution_due_at)) : '—'}
                </DetailRow>
                <DetailRow label="נפתרה">
                  {t.resolved_at ? (
                    <span className={t.resolution_breached ? 'text-[var(--signal-danger)]' : 'text-[var(--signal-positive)]'}>
                      {formatDateTime(String(t.resolved_at))}
                    </span>
                  ) : minutesRemaining !== null ? (
                    <span className={minutesRemaining < 0 ? 'text-[var(--signal-danger)]' : ''}>
                      {minutesRemaining < 0
                        ? `חריגה של ${formatDuration(Math.abs(minutesRemaining))}`
                        : `נותרו ${formatDuration(minutesRemaining)}`}
                    </span>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="זמן השבתה">
                  <span className="num">{formatDuration(num(t.downtime_minutes))}</span>
                </DetailRow>
                <DetailRow label="מכונה חלופית">
                  {t.replacement_device_provided ? (
                    <Badge size="sm" tone="positive">
                      סופקה{t.replacement_device_label ? ` · ${String(t.replacement_device_label)}` : ''}
                    </Badge>
                  ) : (
                    <span className="text-[var(--fg-tertiary)]">לא סופקה</span>
                  )}
                </DetailRow>
                <DetailRow label="עלות תיקון">
                  <span className="num">{formatCurrency(num(t.repair_cost))}</span>
                </DetailRow>
                <DetailRow label="זיכוי שניתן">
                  <span className="num">{formatCurrency(num(t.refund_issued_amount))}</span>
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>תיאור וטיפול</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-1 text-[12px] font-semibold text-[var(--fg-secondary)]">תיאור</h3>
                <p className="text-[13px] leading-relaxed text-[var(--fg-primary)]">
                  {str(t.description) ?? '—'}
                </p>
              </div>
              {t.root_cause ? (
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    Root Cause
                  </h3>
                  <p className="text-[13px] leading-relaxed">{String(t.root_cause)}</p>
                </div>
              ) : null}
              {t.actions_taken ? (
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    פעולות שבוצעו
                  </h3>
                  <p className="text-[13px] leading-relaxed">{String(t.actions_taken)}</p>
                </div>
              ) : null}
              {t.closure_reason ? (
                <div>
                  <h3 className="mb-1 text-[12px] font-semibold text-[var(--fg-secondary)]">
                    סיבת סגירה
                  </h3>
                  <p className="text-[13px]">{String(t.closure_reason)}</p>
                </div>
              ) : null}
              {t.follow_up_required ? (
                <Callout tone="warning">נדרש מעקב לאחר התיקון כדי לוודא שהפתרון החזיק.</Callout>
              ) : null}
            </CardContent>
          </Card>

          {data.parts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>חלקים שנוצלו</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {data.parts.map((p) => (
                    <li
                      key={String(p.id)}
                      className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <Package className="size-3.5 shrink-0 text-[var(--fg-tertiary)]" />
                      <span className="mono shrink-0 text-[11px]">{String(p.sku)}</span>
                      <span className="min-w-0 flex-1 truncate">{String(p.item_name)}</span>
                      <span className="num">{Math.abs(num(p.quantity))} יח׳</span>
                      <span className="num text-[var(--fg-secondary)]">
                        {formatCurrency(num(p.unit_cost) * Math.abs(num(p.quantity)))}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>כל שינוי סטטוס, הקצאה והערה על הקריאה.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.events.length === 0 ? (
                <EmptyState icon={Boxes} title="לא נרשמו אירועים" />
              ) : (
                <ol className="space-y-3">
                  {data.events.map((e) => (
                    <li key={String(e.id)} className="flex gap-3">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--border-strong)]"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium">
                            {e.event_type === 'status_change'
                              ? `סטטוס: ${labels.ticketStatus.label(
                                  String(e.to_status) as Parameters<
                                    typeof labels.ticketStatus.label
                                  >[0],
                                )}`
                              : e.event_type === 'assignment'
                                ? 'הקצאה'
                                : e.event_type === 'comment'
                                  ? 'הערה'
                                  : String(e.event_type)}
                          </span>
                          {e.is_internal && e.event_type === 'comment' ? (
                            <Badge size="sm" tone="muted">
                              פנימית
                            </Badge>
                          ) : null}
                          <span className="num ms-auto text-[11px] text-[var(--fg-tertiary)]">
                            {formatRelative(String(e.occurred_at))}
                          </span>
                        </div>
                        {e.message ? (
                          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                            {String(e.message)}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)]">
                          {str(e.actor_name) ?? 'מערכת'} · {formatDateTime(String(e.occurred_at))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
