import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, ClipboardList, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getLeadDetail } from '@/server/queries/crm';
import { getLeadFormValues } from '@/server/queries/record-forms';
import { EditLeadButton } from '@/components/forms/entity-buttons';
import { leadFormSections } from '@/components/forms/entity-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  await requirePermission('crm.view');
  const data = await getLeadDetail(id);
  return { title: data ? String(data.lead.club_name) : 'ליד' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('crm.view');
  const data = await getLeadDetail(id);
  if (!data) notFound();

  const leadForm = user.permissions.has('crm.manage') ? await getLeadFormValues(id) : null;

  const l = data.lead;
  const dealValue = num(l.deal_value);
  const probability = num(l.close_probability);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'CRM', href: '/crm' }, { label: String(l.club_name) }]}
        title={String(l.club_name)}
        description={[str(l.city), str(l.region), str(l.audience_type)].filter(Boolean).join(' · ')}
        actions={
          leadForm ? (
            <EditLeadButton id={id} sections={leadFormSections(leadForm)} label="עריכת ליד" />
          ) : undefined
        }
        meta={
          <>
            <Badge
              tone={labels.leadStage.tone(
                String(l.stage) as Parameters<typeof labels.leadStage.tone>[0],
              )}
              dot
            >
              {labels.leadStage.label(
                String(l.stage) as Parameters<typeof labels.leadStage.label>[0],
              )}
            </Badge>
            <Badge tone="neutral">
              <span className="num">{formatCurrency(dealValue)}</span>
            </Badge>
            <Badge tone="muted">
              הסתברות <span className="num">{formatPercent(probability, 0)}</span>
            </Badge>
            {l.club_id ? (
              <Link href={`/clubs/${l.club_id}`}>
                <Badge tone="positive">מועדון פעיל: {String(l.linked_club_name)}</Badge>
              </Link>
            ) : null}
          </>
        }
      />

      {l.stage === 'lost' && (
        <Callout tone="danger" title="הליד אבד" className="mb-4">
          {str(l.lost_reason) ?? 'לא נרשמה סיבה'}
          {l.lost_at ? ` · ${formatDate(String(l.lost_at))}` : ''}
        </Callout>
      )}

      <Callout tone="info" className="mb-4">
        עדכון שלב ופרטי הליד זמינים מכפתור העריכה, וכל שינוי נרשם ב־Audit Log. רישום פעילות
        ומשימות מתוך המסך עדיין לא נבנה — ראה <span className="mono">REMAINING_WORK.md</span>.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>פרטי הליד</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="עיר">{str(l.city) ?? '—'}</DetailRow>
                <DetailRow label="אזור">{str(l.region) ?? '—'}</DetailRow>
                <DetailRow label="סוג קהל">{str(l.audience_type) ?? '—'}</DetailRow>
                <DetailRow label="מספר מגרשים">
                  <span className="num">{l.court_count === null ? '—' : num(l.court_count)}</span>
                </DetailRow>
                <DetailRow label="פוטנציאל עמדות">
                  <span className="num font-medium">
                    {l.station_potential === null ? '—' : num(l.station_potential)}
                  </span>
                </DetailRow>
                <DetailRow label="זמינות Off-Peak">
                  <span className="num">
                    {l.off_peak_availability_hours === null
                      ? '—'
                      : `${formatNumber(num(l.off_peak_availability_hours), 1)} שעות/יום`}
                  </span>
                </DetailRow>
                <DetailRow label="מקור הליד">{str(l.source) ?? '—'}</DetailRow>
                <DetailRow label="נוצר">{formatDate(String(l.created_at))}</DetailRow>
              </DetailList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>איש קשר</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="שם">{str(l.contact_name) ?? '—'}</DetailRow>
                <DetailRow label="תפקיד">{str(l.contact_role) ?? '—'}</DetailRow>
                <DetailRow label="טלפון">
                  <span className="mono">{str(l.contact_phone) ?? '—'}</span>
                </DetailRow>
                <DetailRow label="אימייל">
                  <span className="mono text-[11px]">{str(l.contact_email) ?? '—'}</span>
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>עסקה</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="אחראי">{str(l.owner_name) ?? '—'}</DetailRow>
                <DetailRow label="שווי עסקה">
                  <span className="num">{formatCurrency(dealValue)}</span>
                </DetailRow>
                <DetailRow label="הסתברות סגירה">
                  <span className="num">{formatPercent(probability, 0)}</span>
                </DetailRow>
                <DetailRow label="שווי משוקלל">
                  <span className="num font-medium text-[var(--accent)]">
                    {formatCurrency(dealValue * probability)}
                  </span>
                </DetailRow>
                <DetailRow label="סגירה צפויה">
                  {formatDate(str(l.expected_close_date))}
                </DetailRow>
                <DetailRow label="מעקב הבא">
                  {l.next_follow_up_at ? formatDateTime(String(l.next_follow_up_at)) : '—'}
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                היסטוריית פעילות
              </CardTitle>
              <CardDescription>כל שיחה, פגישה, הדגמה והצעה שנרשמו על הליד.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.activities.length === 0 ? (
                <EmptyState icon={MessageSquare} title="לא נרשמה פעילות" />
              ) : (
                <ol className="space-y-3">
                  {data.activities.map((a) => (
                    <li key={String(a.id)} className="flex gap-3">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--border-strong)]"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge size="sm" tone="neutral">
                            {String(a.activity_type)}
                          </Badge>
                          <span className="text-[13px] font-medium">{str(a.subject) ?? '—'}</span>
                          <span className="num ms-auto text-[11px] text-[var(--fg-tertiary)]">
                            {formatDateTime(String(a.occurred_at))}
                          </span>
                        </div>
                        {a.body ? (
                          <p className="mt-0.5 text-[12px] text-[var(--fg-secondary)]">
                            {String(a.body)}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)]">
                          {str(a.performer_name) ?? 'מערכת'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                משימות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.tasks.length === 0 ? (
                <EmptyState icon={CalendarClock} title="אין משימות פתוחות" />
              ) : (
                <ul className="space-y-2">
                  {data.tasks.map((t) => (
                    <li
                      key={String(t.id)}
                      className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3 text-[13px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{String(t.title)}</span>
                        <span className="flex items-center gap-1.5">
                          <Badge
                            size="sm"
                            tone={labels.taskPriority.tone(
                              String(t.priority) as Parameters<typeof labels.taskPriority.tone>[0],
                            )}
                          >
                            {labels.taskPriority.label(
                              String(t.priority) as Parameters<typeof labels.taskPriority.label>[0],
                            )}
                          </Badge>
                          <Badge
                            size="sm"
                            tone={labels.taskStatus.tone(
                              String(t.status) as Parameters<typeof labels.taskStatus.tone>[0],
                            )}
                          >
                            {labels.taskStatus.label(
                              String(t.status) as Parameters<typeof labels.taskStatus.label>[0],
                            )}
                          </Badge>
                        </span>
                      </div>
                      {t.description ? (
                        <p className="mt-1 text-[12px] text-[var(--fg-secondary)]">
                          {String(t.description)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                        {str(t.assignee_name) ?? 'לא הוקצה'}
                        {t.due_at ? ` · יעד ${formatDate(String(t.due_at))}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
