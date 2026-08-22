import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, ClipboardList, FileText, Target, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { TimeSeriesChart } from '@/components/charts/primitives';
import { HEALTH_COMPONENT_LABELS, HEALTH_WEIGHTS } from '@/server/metrics/club-health';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  WEEKDAYS_HE,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getClubDetail, getClubRelated, getClubUsageSeries } from '@/server/queries/clubs';
import { getClubFormValues } from '@/server/queries/record-forms';
import { EditClubButton } from '@/components/forms/entity-buttons';
import { ArchiveClubButton } from '@/components/forms/archive-buttons';
import { clubFormSections } from '@/components/forms/entity-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('clubs.view');
  const club = await getClubDetail(id, user);
  return { title: club?.name ?? 'מועדון' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('clubs.view');

  const club = await getClubDetail(id, user);
  if (!club) notFound();

  const canEditClub = user.permissions.has('clubs.edit');
  const [related, usage, formValues] = await Promise.all([
    getClubRelated(id),
    getClubUsageSeries(id, 60),
    canEditClub ? getClubFormValues(id) : Promise.resolve(null),
  ]);

  const activeEarnBack = related.earnBack[0];
  const canSeeFinance = user.permissions.has('finance.view');

  const totalHours = usage.reduce((s, u) => s + u.hours, 0);
  const totalRevenue = usage.reduce((s, u) => s + u.revenue, 0);
  const activeStations = related.stations.filter((s) => s.status === 'active').length;
  const openTickets = related.tickets.filter(
    (t) => !['resolved', 'closed'].includes(String(t.status)),
  ).length;

  const checklistDone = related.checklists.filter((c) =>
    ['completed', 'completed_with_issues'].includes(String(c.status)),
  ).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'מועדונים', href: '/clubs' }, { label: club.name }]}
        title={club.name}
        description={`${club.city} · ${club.region}${club.address ? ` · ${club.address}` : ''}`}
        actions={
          <>
            {formValues && (
              <EditClubButton id={id} sections={clubFormSections(formValues)} label="עריכת מועדון" />
            )}
            {user.permissions.has('clubs.archive') && (
              <ArchiveClubButton clubId={id} code={club.code} name={club.name} />
            )}
          </>
        }
        meta={
          <>
            <Badge
              tone={labels.clubStatus.tone(club.status as Parameters<typeof labels.clubStatus.tone>[0])}
              dot
            >
              {labels.clubStatus.label(club.status as Parameters<typeof labels.clubStatus.label>[0])}
            </Badge>
            <Badge tone="neutral">
              <span className="mono">{club.code}</span>
            </Badge>
            {club.healthScore !== null && (
              <Badge
                tone={
                  club.healthScore >= 75 ? 'positive' : club.healthScore >= 55 ? 'warning' : 'danger'
                }
              >
                Health {club.healthScore}
              </Badge>
            )}
            {activeEarnBack && (
              <Badge
                tone={labels.earnBackStatus.tone(
                  String(activeEarnBack.status) as Parameters<typeof labels.earnBackStatus.tone>[0],
                )}
              >
                Earn-Back:{' '}
                {labels.earnBackStatus.label(
                  String(activeEarnBack.status) as Parameters<typeof labels.earnBackStatus.label>[0],
                )}
              </Badge>
            )}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">סקירה</TabsTrigger>
          <TabsTrigger value="stations">עמדות ומכונות</TabsTrigger>
          <TabsTrigger value="usage">שימוש והכנסות</TabsTrigger>
          <TabsTrigger value="tickets">תקלות ותחזוקה</TabsTrigger>
          <TabsTrigger value="earnback">Earn-Back</TabsTrigger>
          <TabsTrigger value="contacts">אנשי קשר</TabsTrigger>
          <TabsTrigger value="contracts">מסמכים והסכמים</TabsTrigger>
          <TabsTrigger value="tasks">משימות והערות</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>

        {/* ─── סקירה ─── */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>פרטי המועדון</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="קוד">
                    <span className="mono">{club.code}</span>
                  </DetailRow>
                  <DetailRow label="אזור">{club.region}</DetailRow>
                  <DetailRow label="עיר">{club.city}</DetailRow>
                  <DetailRow label="כתובת">{club.address ?? '—'}</DetailRow>
                  <DetailRow label="מגרשים">
                    <span className="num">{club.courtCount}</span>
                  </DetailRow>
                  <DetailRow label="עמדות פעילות">
                    <span className="num">
                      {activeStations} / {related.stations.length}
                    </span>
                  </DetailRow>
                  <DetailRow label="תאריך הצטרפות">{formatDate(club.joinedAt)}</DetailRow>
                  <DetailRow label="מנהל לקוח">{club.accountManagerName ?? '—'}</DetailRow>
                  <DetailRow label="חלון Off-Peak">
                    <span className="num">
                      {club.offPeakStart.slice(0, 5)}–{club.offPeakEnd.slice(0, 5)}
                    </span>
                    <span className="ms-1.5 text-[11px] text-[var(--fg-tertiary)]">
                      {club.offPeakDays.map((d) => WEEKDAYS_HE[d]?.slice(0, 1)).join(', ')}
                    </span>
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Club Health Score</CardTitle>
                <CardDescription>
                  ציון משוקלל 0–100. הנוסחה שקופה: כל רכיב מוצג עם המשקל שלו ועם הציון שקיבל.
                  {club.healthScoreAt && ` חושב לאחרונה ב־${formatDateTime(club.healthScoreAt)}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {club.healthScore === null || !club.healthScoreBreakdown ? (
                  <EmptyState
                    icon={Target}
                    title="הציון טרם חושב"
                    description="הציון מחושב אוטומטית מדי יום ובעת שינוי מהותי בנתוני המועדון."
                  />
                ) : (
                  <>
                    <div className="mb-4 flex items-baseline gap-3">
                      <span
                        className={`num text-4xl font-bold tracking-tight ${
                          club.healthScore >= 75
                            ? 'text-[var(--signal-positive)]'
                            : club.healthScore >= 55
                              ? 'text-[var(--signal-warning)]'
                              : 'text-[var(--signal-danger)]'
                        }`}
                      >
                        {club.healthScore}
                      </span>
                      <span className="text-[13px] text-[var(--fg-secondary)]">מתוך 100</span>
                    </div>
                    <ul className="space-y-2.5">
                      {(
                        Object.entries(HEALTH_WEIGHTS) as [
                          keyof typeof HEALTH_WEIGHTS,
                          number,
                        ][]
                      ).map(([key, weight]) => {
                        const score = club.healthScoreBreakdown?.[key] ?? 0;
                        return (
                          <li key={key}>
                            <div className="mb-1 flex items-center justify-between text-[12px]">
                              <span className="text-[var(--fg-secondary)]">
                                {HEALTH_COMPONENT_LABELS[key]}
                                <span className="ms-1.5 text-[10px] text-[var(--fg-tertiary)]">
                                  משקל {formatPercent(weight, 0)}
                                </span>
                              </span>
                              <span className="num font-medium">{Math.round(score)}</span>
                            </div>
                            <Progress
                              value={score}
                              tone={score >= 75 ? 'accent' : score >= 50 ? 'warning' : 'danger'}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">שעות שימוש · 60 יום</p>
              <p className="num mt-1 text-2xl font-semibold">{formatNumber(totalHours, 1)}</p>
            </Card>
            {canSeeFinance && (
              <Card className="p-4">
                <p className="text-[12px] text-[var(--fg-secondary)]">הכנסה נטו · 60 יום</p>
                <p className="num mt-1 text-2xl font-semibold">{formatCurrency(totalRevenue)}</p>
                <p className="mt-1 text-[10px] text-[var(--fg-tertiary)]">לפני מע״מ, אינה רווח</p>
              </Card>
            )}
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">תקלות פתוחות</p>
              <p
                className={`num mt-1 text-2xl font-semibold ${openTickets > 0 ? 'text-[var(--signal-warning)]' : ''}`}
              >
                {openTickets}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[12px] text-[var(--fg-secondary)]">Checklist · 30 יום</p>
              <p className="num mt-1 text-2xl font-semibold">
                {checklistDone} / {related.checklists.length}
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* ─── עמדות ומכונות ─── */}
        <TabsContent value="stations">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>עמדות</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {related.stations.length === 0 ? (
                  <EmptyState icon={Building2} title="אין עמדות במועדון" />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">קוד</th>
                        <th className="py-2 text-start font-semibold">סוג</th>
                        <th className="py-2 text-start font-semibold">מכונה</th>
                        <th className="py-2 text-end font-semibold">שעות 30 יום</th>
                        <th className="py-2 text-center font-semibold">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {related.stations.map((s) => (
                        <tr
                          key={String(s.id)}
                          className="border-b border-[var(--border-subtle)] last:border-0"
                        >
                          <td className="py-2.5">
                            <Link
                              href={`/stations/${s.id}`}
                              className="mono font-medium hover:text-[var(--accent)]"
                            >
                              {String(s.code)}
                            </Link>
                          </td>
                          <td className="py-2.5 text-[var(--fg-secondary)]">
                            {labels.stationType.label(
                              String(s.station_type) as Parameters<
                                typeof labels.stationType.label
                              >[0],
                            )}
                          </td>
                          <td className="py-2.5">
                            {s.device_uuid ? (
                              <Link
                                href={`/stations/devices/${s.device_uuid}`}
                                className="mono text-[11px] hover:text-[var(--accent)]"
                              >
                                {String(s.device_label)}
                              </Link>
                            ) : (
                              <span className="text-[var(--fg-tertiary)]">ללא מכונה</span>
                            )}
                          </td>
                          <td className="num py-2.5 text-end">
                            {formatNumber(num(s.hours_30d), 1)}
                          </td>
                          <td className="py-2.5 text-center">
                            <Badge
                              size="sm"
                              tone={labels.stationStatus.tone(
                                String(s.status) as Parameters<typeof labels.stationStatus.tone>[0],
                              )}
                            >
                              {labels.stationStatus.label(
                                String(s.status) as Parameters<typeof labels.stationStatus.label>[0],
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

            <Card>
              <CardHeader>
                <CardTitle>מכונות</CardTitle>
                <CardDescription>
                  מפתחות ההרשאה של המכשירים מוצפנים ואינם ניתנים לצפייה בשום מסך.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {related.devices.length === 0 ? (
                  <EmptyState icon={Wrench} title="אין מכונות משויכות" />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">Device ID</th>
                        <th className="py-2 text-start font-semibold">Firmware</th>
                        <th className="py-2 text-end font-semibold">סוללה</th>
                        <th className="py-2 text-end font-semibold">שעות</th>
                        <th className="py-2 text-center font-semibold">מצב</th>
                      </tr>
                    </thead>
                    <tbody>
                      {related.devices.map((d) => (
                        <tr
                          key={String(d.id)}
                          className="border-b border-[var(--border-subtle)] last:border-0"
                        >
                          <td className="py-2.5">
                            <Link
                              href={`/stations/devices/${d.id}`}
                              className="mono font-medium hover:text-[var(--accent)]"
                            >
                              {String(d.device_id)}
                            </Link>
                          </td>
                          <td className="mono py-2.5 text-[11px] text-[var(--fg-secondary)]">
                            {str(d.firmware_version) ?? '—'}
                          </td>
                          <td className="num py-2.5 text-end">
                            {d.battery_pct === null ? '—' : `${num(d.battery_pct)}%`}
                          </td>
                          <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                            {formatNumber(num(d.operating_hours), 0)}
                          </td>
                          <td className="py-2.5 text-center">
                            <Badge
                              size="sm"
                              tone={labels.deviceStatus.tone(
                                String(d.status) as Parameters<typeof labels.deviceStatus.tone>[0],
                              )}
                              dot
                            >
                              {labels.deviceStatus.label(
                                String(d.status) as Parameters<typeof labels.deviceStatus.label>[0],
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
          </div>
        </TabsContent>

        {/* ─── שימוש והכנסות ─── */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>שימוש והכנסה · 60 יום</CardTitle>
              <CardDescription>
                שעות אימון בתשלום והכנסה נטו לפני מע״מ, בניכוי זיכויים.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <EmptyState icon={Building2} title="אין נתוני שימוש בתקופה" />
              ) : (
                <TimeSeriesChart
                  data={usage}
                  series={[
                    { key: 'hours', label: 'שעות בתשלום' },
                    ...(canSeeFinance
                      ? [{ key: 'revenue', label: 'הכנסה נטו (₪)', yAxis: 'right' as const, color: '#38bdf8' }]
                      : []),
                  ]}
                  format="hours"
                  secondaryFormat="currency"
                  height={300}
                />
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>מגרשים</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {related.courts.map((c) => (
                  <li
                    key={String(c.id)}
                    className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[13px]"
                  >
                    <span>{String(c.name)}</span>
                    <span className="flex items-center gap-2">
                      {c.is_indoor ? (
                        <Badge size="sm" tone="neutral">
                          מקורה
                        </Badge>
                      ) : null}
                      <span className="num text-[11px] text-[var(--fg-tertiary)]">
                        {formatCurrency(num(c.revenue_per_hour_net))}/ש׳
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── תקלות ותחזוקה ─── */}
        <TabsContent value="tickets">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>קריאות שירות</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {related.tickets.length === 0 ? (
                  <EmptyState icon={Wrench} title="לא נפתחו קריאות שירות" />
                ) : (
                  <ul className="space-y-1.5">
                    {related.tickets.slice(0, 15).map((t) => (
                      <li key={String(t.id)}>
                        <Link
                          href={`/tickets/${t.id}`}
                          className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px] transition-colors hover:bg-[var(--bg-active)]"
                        >
                          <span className="mono shrink-0">{String(t.reference)}</span>
                          <span className="min-w-0 flex-1 truncate">{String(t.title)}</span>
                          <Badge
                            size="sm"
                            tone={labels.ticketSeverity.tone(
                              String(t.severity) as Parameters<
                                typeof labels.ticketSeverity.tone
                              >[0],
                            )}
                          >
                            {labels.ticketSeverity.label(
                              String(t.severity) as Parameters<
                                typeof labels.ticketSeverity.label
                              >[0],
                            )}
                          </Badge>
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

            <Card>
              <CardHeader>
                <CardTitle>תחזוקה ו־Checklists</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="mb-2 text-[12px] font-semibold text-[var(--fg-secondary)]">
                  משימות תחזוקה
                </h3>
                {related.maintenance.length === 0 ? (
                  <p className="text-[12px] text-[var(--fg-tertiary)]">אין משימות תחזוקה</p>
                ) : (
                  <ul className="space-y-1.5">
                    {related.maintenance.slice(0, 8).map((m) => (
                      <li
                        key={String(m.id)}
                        className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                      >
                        <span className="min-w-0 flex-1 truncate">{str(m.plan_name) ?? '—'}</span>
                        <span className="num text-[11px] text-[var(--fg-tertiary)]">
                          {formatDate(String(m.due_on))}
                        </span>
                        <Badge
                          size="sm"
                          tone={labels.maintenanceTaskStatus.tone(
                            String(m.status) as Parameters<
                              typeof labels.maintenanceTaskStatus.tone
                            >[0],
                          )}
                        >
                          {labels.maintenanceTaskStatus.label(
                            String(m.status) as Parameters<
                              typeof labels.maintenanceTaskStatus.label
                            >[0],
                          )}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                <h3 className="mb-2 mt-4 text-[12px] font-semibold text-[var(--fg-secondary)]">
                  הגשות Checklist אחרונות
                </h3>
                {related.checklists.length === 0 ? (
                  <p className="text-[12px] text-[var(--fg-tertiary)]">אין הגשות</p>
                ) : (
                  <ul className="space-y-1">
                    {related.checklists.slice(0, 8).map((c) => (
                      <li
                        key={String(c.id)}
                        className="flex items-center gap-2 px-1 py-1 text-[12px]"
                      >
                        <span className="num text-[var(--fg-tertiary)]">
                          {formatDate(String(c.for_date))}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--fg-secondary)]">
                          {String(c.checklist_name)}
                        </span>
                        <Badge
                          size="sm"
                          tone={labels.checklistSubmissionStatus.tone(
                            String(c.status) as Parameters<
                              typeof labels.checklistSubmissionStatus.tone
                            >[0],
                          )}
                        >
                          {labels.checklistSubmissionStatus.label(
                            String(c.status) as Parameters<
                              typeof labels.checklistSubmissionStatus.label
                            >[0],
                          )}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Earn-Back ─── */}
        <TabsContent value="earnback">
          {!activeEarnBack ? (
            <Card>
              <EmptyState
                icon={Target}
                title="אין הסכם Earn-Back למועדון"
                description="ערבות ההחזר נוצרת יחד עם חתימת ההסכם המסחרי."
              />
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>ערבות Earn-Back</CardTitle>
                <CardDescription>
                  ההחזר נמדד מהכנסת המגרש המקושרת של המועדון — לא מהכנסת VELA-X.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="מחיר כניסה">
                    <span className="num">{formatCurrency(num(activeEarnBack.entry_price))}</span>
                  </DetailRow>
                  <DetailRow label="תקופה">
                    {formatDate(String(activeEarnBack.starts_on))} —{' '}
                    {formatDate(String(activeEarnBack.ends_on))}
                  </DetailRow>
                  <DetailRow label="שעות נדרשות להחזר">
                    <span className="num">{formatNumber(num(activeEarnBack.required_hours), 1)}</span>
                  </DetailRow>
                  <DetailRow label="שעות ליום נדרשות">
                    <span className="num">
                      {formatNumber(num(activeEarnBack.required_hours_per_day), 2)}
                    </span>
                  </DetailRow>
                  <DetailRow label="הכנסה מאומתת מצטברת">
                    <span className="num">
                      {formatCurrency(num(activeEarnBack.verified_revenue))}
                    </span>
                  </DetailRow>
                  <DetailRow label="פער נותר">
                    <span className="num text-[var(--signal-warning)]">
                      {formatCurrency(num(activeEarnBack.remaining_gap))}
                    </span>
                  </DetailRow>
                  <DetailRow label="תחזית עמידה">
                    {activeEarnBack.forecast_will_meet ? (
                      <Badge size="sm" tone="positive">
                        צפוי לעמוד
                      </Badge>
                    ) : (
                      <Badge size="sm" tone="danger">
                        לא צפוי לעמוד
                      </Badge>
                    )}
                  </DetailRow>
                </DetailList>
                <div className="mt-4">
                  <Link
                    href={`/earn-back/${activeEarnBack.id}`}
                    className="text-[13px] text-[var(--accent)] hover:underline"
                  >
                    לניתוח Earn-Back המלא ←
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── אנשי קשר ─── */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>אנשי קשר</CardTitle>
            </CardHeader>
            <CardContent>
              {related.contacts.length === 0 ? (
                <EmptyState icon={Building2} title="לא הוגדרו אנשי קשר" />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {related.contacts.map((c) => (
                    <li
                      key={String(c.id)}
                      className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{String(c.full_name)}</span>
                        {c.is_primary ? (
                          <Badge size="sm" tone="positive">
                            ראשי
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--fg-secondary)]">
                        {str(c.role) ?? '—'}
                      </p>
                      <p className="mono mt-1 text-[11px] text-[var(--fg-tertiary)]">
                        {str(c.email) ?? ''} {c.phone ? `· ${String(c.phone)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>שעות פעילות</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {related.hours.map((h) => (
                  <li
                    key={String(h.id)}
                    className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                  >
                    <span>{WEEKDAYS_HE[num(h.day_of_week)]}</span>
                    <span className="num text-[var(--fg-secondary)]">
                      {h.is_closed
                        ? 'סגור'
                        : `${String(h.opens_at).slice(0, 5)}–${String(h.closes_at).slice(0, 5)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── הסכמים ─── */}
        <TabsContent value="contracts">
          {!user.permissions.has('contracts.view') ? (
            <Callout tone="warning">אין לך הרשאה לצפות בהסכמים.</Callout>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>הסכמים</CardTitle>
              </CardHeader>
              <CardContent>
                {related.contracts.length === 0 ? (
                  <EmptyState icon={FileText} title="אין הסכמים" />
                ) : (
                  <ul className="space-y-3">
                    {related.contracts.map((ct) => (
                      <li
                        key={String(ct.id)}
                        className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="mono text-[13px] font-medium">
                            {String(ct.contract_number)}
                          </span>
                          <Badge
                            size="sm"
                            tone={labels.contractStatus.tone(
                              String(ct.status) as Parameters<
                                typeof labels.contractStatus.tone
                              >[0],
                            )}
                          >
                            {labels.contractStatus.label(
                              String(ct.status) as Parameters<
                                typeof labels.contractStatus.label
                              >[0],
                            )}
                          </Badge>
                        </div>
                        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-2">
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">מודל גבייה</dt>
                            <dd>
                              {labels.pricingModel.label(
                                String(ct.pricing_model) as Parameters<
                                  typeof labels.pricingModel.label
                                >[0],
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">דמי הקמה</dt>
                            <dd className="num">{formatCurrency(num(ct.setup_fee))}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">ריטיינר חודשי</dt>
                            <dd className="num">{formatCurrency(num(ct.monthly_retainer))}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">מחיר לשחקן</dt>
                            <dd className="num">
                              {ct.consumer_price_per_hour
                                ? formatCurrency(num(ct.consumer_price_per_hour))
                                : 'לפי ההגדרה הגלובלית'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">תקופה</dt>
                            <dd className="num">
                              {formatDate(String(ct.starts_on))} —{' '}
                              {ct.ends_on ? formatDate(String(ct.ends_on)) : 'ללא סיום'}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--fg-tertiary)]">חידוש</dt>
                            <dd className="num">
                              {ct.renewal_date ? formatDate(String(ct.renewal_date)) : '—'}
                            </dd>
                          </div>
                        </dl>
                        {ct.terms ? (
                          <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                            {String(ct.terms)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── משימות ─── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>משימות והערות</CardTitle>
            </CardHeader>
            <CardContent>
              {related.tasks.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="אין משימות פתוחות"
                  description="משימות נוצרות ממסך CRM או מקריאת שירות."
                />
              ) : (
                <ul className="space-y-2">
                  {related.tasks.map((t) => (
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
        </TabsContent>

        {/* ─── Audit ─── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>כל פעולה רגישה שבוצעה בהקשר המועדון הזה.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {related.audit.length === 0 ? (
                <EmptyState icon={FileText} title="אין רשומות Audit" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מתי</th>
                      <th className="py-2 text-start font-semibold">מי</th>
                      <th className="py-2 text-start font-semibold">פעולה</th>
                      <th className="py-2 text-start font-semibold">ישות</th>
                      <th className="py-2 text-start font-semibold">סיבה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {related.audit.map((a) => (
                      <tr
                        key={String(a.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="num py-2 text-[11px] text-[var(--fg-tertiary)]">
                          {formatDateTime(String(a.occurred_at))}
                        </td>
                        <td className="py-2 text-[var(--fg-secondary)]">
                          {str(a.actor) ?? str(a.actor_name) ?? 'מערכת'}
                        </td>
                        <td className="mono py-2 text-[11px]">{String(a.action_key)}</td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(a.entity_label) ?? String(a.entity_type)}
                        </td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(a.reason) ?? '—'}
                        </td>
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
