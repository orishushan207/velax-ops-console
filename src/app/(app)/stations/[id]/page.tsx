import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, History, Wrench } from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { TimeSeriesChart } from '@/components/charts/primitives';
import { StationControls } from '../../live/station-controls';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getStationDetail } from '@/server/queries/fleet';
import { getStationFormValues } from '@/server/queries/record-forms';
import { listClubOptions } from '@/server/queries/clubs';
import { EditStationButton } from '@/components/forms/entity-buttons';
import { ArchiveStationButton } from '@/components/forms/archive-buttons';
import { stationFormSections } from '@/components/forms/entity-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('stations.view');
  const data = await getStationDetail(id, user);
  return { title: data ? `עמדה ${String(data.station.code)}` : 'עמדה' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission('stations.view');
  const data = await getStationDetail(id, user);
  if (!data) notFound();

  const canManageStations = user.permissions.has('stations.manage');
  const [stationForm, clubOptions] = await Promise.all([
    canManageStations ? getStationFormValues(id) : Promise.resolve(null),
    canManageStations ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const s = data.station;
  const totalHours = data.usage.reduce((sum, u) => sum + u.hours, 0);
  const totalSessions = data.usage.reduce((sum, u) => sum + u.sessions, 0);
  const openTickets = data.tickets.filter(
    (t) => !['resolved', 'closed'].includes(String(t.status)),
  ).length;
  const downtime = data.tickets.reduce((sum, t) => sum + num(t.downtime_minutes), 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'עמדות ומכונות', href: '/stations' },
          { label: String(s.code) },
        ]}
        title={String(s.name)}
        description={`${String(s.club_name)} · ${String(s.region)}${s.location_description ? ` · ${String(s.location_description)}` : ''}`}
        meta={
          <>
            <Badge tone="neutral">
              <span className="mono">{String(s.code)}</span>
            </Badge>
            <Badge
              tone={labels.stationStatus.tone(
                String(s.status) as Parameters<typeof labels.stationStatus.tone>[0],
              )}
              dot
            >
              {labels.stationStatus.label(
                String(s.status) as Parameters<typeof labels.stationStatus.label>[0],
              )}
            </Badge>
            <Badge tone="neutral">
              {labels.stationType.label(
                String(s.station_type) as Parameters<typeof labels.stationType.label>[0],
              )}
            </Badge>
          </>
        }
        actions={
          <>
            {stationForm && (
              <EditStationButton
                id={id}
                sections={stationFormSections(stationForm, clubOptions)}
                label="עריכת עמדה"
              />
            )}
            <StationControls
              stationId={String(s.id)}
              code={String(s.code)}
              status={String(s.status)}
              canSuspend={user.permissions.has('stations.suspend')}
            />
            {user.permissions.has('stations.archive') && (
              <ArchiveStationButton
                stationId={id}
                code={String(s.code)}
                name={String(s.name)}
              />
            )}
          </>
        }
      />

      {s.status === 'suspended' && (
        <Callout tone="danger" title="העמדה מושבתת" className="mb-4">
          {str(s.suspended_reason) ?? 'לא נרשמה סיבה'}
          {s.suspended_by_name ? ` · הושבתה על ידי ${String(s.suspended_by_name)}` : ''}
          {s.suspended_at ? ` · ${formatDateTime(String(s.suspended_at))}` : ''}
          <br />
          זמן ההשבתה נספר כ־Downtime ומשפיע על מדד הזמינות ועל חישוב ה־Earn-Back של המועדון.
        </Callout>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">שעות שימוש · 60 יום</p>
          <p className="num mt-1 text-2xl font-semibold">{formatNumber(totalHours, 1)}</p>
          <p className="mt-1 text-[10px] text-[var(--fg-tertiary)]">
            ממוצע {formatNumber(totalHours / 60, 2)} שעות ליום
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">סשנים · 60 יום</p>
          <p className="num mt-1 text-2xl font-semibold">{formatNumber(totalSessions)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">תקלות פתוחות</p>
          <p className={`num mt-1 text-2xl font-semibold ${openTickets > 0 ? 'text-[var(--signal-warning)]' : ''}`}>
            {openTickets}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">זמן השבתה מצטבר</p>
          <p className="num mt-1 text-2xl font-semibold">{formatDuration(downtime)}</p>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">סקירה</TabsTrigger>
          <TabsTrigger value="usage">שימוש</TabsTrigger>
          <TabsTrigger value="sessions">Sessions אחרונים</TabsTrigger>
          <TabsTrigger value="tickets">תקלות</TabsTrigger>
          <TabsTrigger value="maintenance">תחזוקה</TabsTrigger>
          <TabsTrigger value="history">היסטוריית מכונות</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>פרטי העמדה</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="קוד עמדה">
                    <span className="mono">{String(s.code)}</span>
                  </DetailRow>
                  <DetailRow label="מועדון">
                    <Link href={`/clubs/${s.club_uuid}`} className="hover:text-[var(--accent)]">
                      {String(s.club_name)}
                    </Link>
                  </DetailRow>
                  <DetailRow label="סוג עמדה">
                    {labels.stationType.label(
                      String(s.station_type) as Parameters<typeof labels.stationType.label>[0],
                    )}
                  </DetailRow>
                  <DetailRow label="תאריך התקנה">
                    {s.installed_at ? formatDate(String(s.installed_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="עלות התקנה">
                    <span className="num">{formatCurrency(num(s.installed_cost))}</span>
                  </DetailRow>
                  <DetailRow label="מגרשים משורתים">
                    <span className="num">
                      {Array.isArray(s.serves_court_ids) ? s.serves_court_ids.length : 0}
                    </span>
                  </DetailRow>
                  <DetailRow label="תג NFC">
                    <span className="mono text-[11px]">{str(s.nfc_tag_id) ?? '—'}</span>
                  </DetailRow>
                  <DetailRow label="QR">
                    <span className="text-[11px] text-[var(--fg-tertiary)]">
                      {s.qr_code_token ? 'מוגדר' : 'לא מוגדר'}
                    </span>
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>המכונה המוצבת</CardTitle>
              </CardHeader>
              <CardContent>
                {!s.device_uuid ? (
                  <EmptyState
                    icon={Boxes}
                    title="אין מכונה מוצבת בעמדה"
                    description="ניתן לשייך מכונה מהמלאי דרך עמוד המכונה."
                  />
                ) : (
                  <DetailList>
                    <DetailRow label="Device ID">
                      <Link
                        href={`/stations/devices/${s.device_uuid}`}
                        className="mono hover:text-[var(--accent)]"
                      >
                        {String(s.device_label)}
                      </Link>
                    </DetailRow>
                    <DetailRow label="מספר סידורי">
                      <span className="mono text-[11px]">{String(s.serial_number)}</span>
                    </DetailRow>
                    <DetailRow label="מצב חיבור">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot
                          tone={s.connectivity === 'online' ? 'positive' : 'danger'}
                          pulse={s.connectivity === 'online'}
                        />
                        {labels.deviceConnectivity.label(
                          String(s.connectivity ?? 'unknown') as Parameters<
                            typeof labels.deviceConnectivity.label
                          >[0],
                        )}
                      </span>
                    </DetailRow>
                    <DetailRow label="סוללה">
                      <span
                        className={num(s.battery_pct) < 20 ? 'num text-[var(--signal-danger)]' : 'num'}
                      >
                        {s.battery_pct === null ? '—' : `${num(s.battery_pct)}%`}
                      </span>
                    </DetailRow>
                    <DetailRow label="מצב מכונה">
                      <Badge
                        size="sm"
                        tone={labels.deviceStatus.tone(
                          String(s.device_status) as Parameters<
                            typeof labels.deviceStatus.tone
                          >[0],
                        )}
                      >
                        {labels.deviceStatus.label(
                          String(s.device_status) as Parameters<
                            typeof labels.deviceStatus.label
                          >[0],
                        )}
                      </Badge>
                    </DetailRow>
                  </DetailList>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>שימוש · 60 יום</CardTitle>
              <CardDescription>שעות אימון בתשלום ומספר סשנים לכל יום.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.usage.length === 0 ? (
                <EmptyState icon={Boxes} title="אין נתוני שימוש בתקופה" />
              ) : (
                <TimeSeriesChart
                  data={data.usage}
                  series={[
                    { key: 'hours', label: 'שעות בתשלום' },
                    { key: 'sessions', label: 'סשנים', yAxis: 'right', color: '#38bdf8' },
                  ]}
                  format="hours"
                  secondaryFormat="number"
                  height={300}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sessions אחרונים</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.recentSessions.length === 0 ? (
                <EmptyState icon={Boxes} title="לא נרשמו סשנים בעמדה" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מזהה</th>
                      <th className="py-2 text-start font-semibold">שחקן</th>
                      <th className="py-2 text-start font-semibold">התחלה</th>
                      <th className="py-2 text-end font-semibold">סכום</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSessions.map((sess) => (
                      <tr
                        key={String(sess.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)]"
                      >
                        <td className="py-2.5">
                          <Link
                            href={`/sessions/${sess.id}`}
                            className="mono hover:text-[var(--accent)]"
                          >
                            {String(sess.reference)}
                          </Link>
                        </td>
                        <td className="py-2.5 text-[var(--fg-secondary)]">
                          {String(sess.player_name)}
                        </td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-tertiary)]">
                          {sess.started_at ? formatDateTime(String(sess.started_at)) : '—'}
                        </td>
                        <td className="num py-2.5 text-end">
                          {formatCurrency(num(sess.amount_gross))}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            size="sm"
                            tone={labels.sessionStatus.tone(
                              String(sess.status) as Parameters<
                                typeof labels.sessionStatus.tone
                              >[0],
                            )}
                          >
                            {labels.sessionStatus.label(
                              String(sess.status) as Parameters<
                                typeof labels.sessionStatus.label
                              >[0],
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

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>תקלות בעמדה</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tickets.length === 0 ? (
                <EmptyState icon={Wrench} title="לא נפתחו תקלות בעמדה" />
              ) : (
                <ul className="space-y-1.5">
                  {data.tickets.map((t) => (
                    <li key={String(t.id)}>
                      <Link
                        href={`/tickets/${t.id}`}
                        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px] transition-colors hover:bg-[var(--bg-active)]"
                      >
                        <span className="mono shrink-0">{String(t.reference)}</span>
                        <span className="min-w-0 flex-1 truncate">{String(t.title)}</span>
                        <span className="num text-[11px] text-[var(--fg-tertiary)]">
                          {formatDuration(num(t.downtime_minutes))} השבתה
                        </span>
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

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>משימות תחזוקה</CardTitle>
            </CardHeader>
            <CardContent>
              {data.maintenance.length === 0 ? (
                <EmptyState icon={Wrench} title="אין משימות תחזוקה" />
              ) : (
                <ul className="space-y-1.5">
                  {data.maintenance.map((m) => (
                    <li
                      key={String(m.id)}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <span className="mono shrink-0">{String(m.reference)}</span>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>היסטוריית מכונות בעמדה</CardTitle>
              <CardDescription>
                איזו מכונה הייתה בעמדה ומתי. ההפרדה הזו מאפשרת לשמור מדידה רציפה של העמדה
                גם כשהמכונה מוחלפת.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.assignments.length === 0 ? (
                <EmptyState icon={History} title="אין היסטוריית שיוך" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מכונה</th>
                      <th className="py-2 text-start font-semibold">סיבה</th>
                      <th className="py-2 text-start font-semibold">משויך מ־</th>
                      <th className="py-2 text-start font-semibold">עד</th>
                      <th className="py-2 text-start font-semibold">בוצע על ידי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignments.map((a) => (
                      <tr
                        key={String(a.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="mono py-2.5">{String(a.device_label)}</td>
                        <td className="py-2.5 text-[var(--fg-secondary)]">{String(a.reason)}</td>
                        <td className="num py-2.5 text-[11px]">
                          {formatDateTime(String(a.assigned_at))}
                        </td>
                        <td className="num py-2.5 text-[11px]">
                          {a.unassigned_at ? formatDateTime(String(a.unassigned_at)) : 'פעיל'}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(a.assigned_by_name) ?? '—'}
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
