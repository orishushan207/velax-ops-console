import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { Cpu, History, Radio, ShieldCheck, Wrench } from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailList, DetailRow, PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { maskSecret } from '@/server/auth/crypto';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getDeviceDetail, listFirmwareVersions } from '@/server/queries/fleet';
import { getDeviceFormValues } from '@/server/queries/record-forms';
import { EditDeviceButton } from '@/components/forms/entity-buttons';
import { deviceFormSections } from '@/components/forms/entity-forms';
import { clubScopeSql } from '@/server/queries/sessions';
import { DeviceControls } from './device-controls';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requirePermission('devices.view');
  const data = await getDeviceDetail(id, user);
  return { title: data ? `מכונה ${String(data.device.device_id)}` : 'מכונה' };
}

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('devices.view');
  const data = await getDeviceDetail(id, user);
  if (!data) notFound();

  const deviceForm = user.permissions.has('devices.assign') ? await getDeviceFormValues(id) : null;

  const d = data.device;
  const firmwares = await listFirmwareVersions();

  const stationRows = await db.execute(sql`
    SELECT st.id, st.code, c.name AS club_name,
      EXISTS (SELECT 1 FROM devices dv WHERE dv.current_station_id = st.id
        AND dv.deleted_at IS NULL AND dv.id <> ${id}::uuid) AS occupied
    FROM stations st JOIN clubs c ON c.id = st.club_id
    WHERE st.deleted_at IS NULL AND st.status IN ('planned','installing','active')
      AND ${clubScopeSql(user, 'st.club_id')}
    ORDER BY c.name, st.code
  `);

  const openTickets = data.tickets.filter(
    (t) => !['resolved', 'closed'].includes(String(t.status)),
  ).length;
  const isQuarantined = String(d.status) === 'quarantined';
  const nextServiceOverdue =
    d.next_service_due && new Date(String(d.next_service_due)) < new Date();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'עמדות ומכונות', href: '/stations' },
          { label: String(d.device_id) },
        ]}
        title={String(d.device_id)}
        description={`${String(d.model)} · מספר סידורי ${String(d.serial_number)}`}
        meta={
          <>
            <Badge
              tone={labels.deviceStatus.tone(
                String(d.status) as Parameters<typeof labels.deviceStatus.tone>[0],
              )}
              dot
            >
              {labels.deviceStatus.label(
                String(d.status) as Parameters<typeof labels.deviceStatus.label>[0],
              )}
            </Badge>
            <Badge tone={d.connectivity === 'online' ? 'positive' : 'danger'} dot>
              {labels.deviceConnectivity.label(
                String(d.connectivity) as Parameters<typeof labels.deviceConnectivity.label>[0],
              )}
            </Badge>
            {d.is_spare ? <Badge tone="info">מכונה חלופית</Badge> : null}
            {d.is_authorized ? (
              <Badge tone="positive">מורשית</Badge>
            ) : (
              <Badge tone="danger">אינה מורשית</Badge>
            )}
          </>
        }
        actions={
          <>
            {deviceForm && (
              <EditDeviceButton
                id={id}
                sections={deviceFormSections(deviceForm)}
                label="עריכת מכונה"
              />
            )}
            <DeviceControls
              deviceId={String(d.id)}
              deviceLabel={String(d.device_id)}
              status={String(d.status)}
              isAssigned={Boolean(d.current_station_id)}
              stations={stationRows.rows.map((r) => {
                const row = r as Record<string, unknown>;
                return {
                  id: String(row.id),
                  code: String(row.code),
                  clubName: String(row.club_name),
                  occupied: Boolean(row.occupied),
                };
              })}
              firmwares={firmwares.map((f) => ({
                id: String(f.id),
                version: String(f.version),
                channel: String(f.channel),
                isCurrent: String(f.id) === String(d.firmware_version_id),
              }))}
              can={{
                assign: user.permissions.has('devices.assign'),
                quarantine: user.permissions.has('devices.quarantine'),
                firmware: user.permissions.has('devices.firmware'),
                retire: user.permissions.has('devices.retire'),
                telemetry: user.permissions.has('devices.telemetry'),
              }}
            />
          </>
        }
      />

      {isQuarantined && (
        <Callout tone="danger" title="המכונה בבידוד" icon={ShieldCheck} className="mb-4">
          {str(d.quarantine_reason) ?? 'לא נרשמה סיבה'}
          {d.quarantined_by_name ? ` · בודדה על ידי ${String(d.quarantined_by_name)}` : ''}
          {d.quarantined_at ? ` · ${formatDateTime(String(d.quarantined_at))}` : ''}
          <br />
          המכונה אינה יכולה לקבל Session Token ולכן לא ניתן להפעיל אותה דרך האפליקציה.
        </Callout>
      )}

      {nextServiceOverdue && (
        <Callout tone="warning" title="טיפול באיחור" icon={Wrench} className="mb-4">
          מועד הטיפול הבא היה {formatDate(String(d.next_service_due))} והוא טרם בוצע.
        </Callout>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">סוללה</p>
          <p
            className={`num mt-1 text-2xl font-semibold ${num(d.battery_pct) < 20 ? 'text-[var(--signal-danger)]' : ''}`}
          >
            {d.battery_pct === null ? '—' : `${num(d.battery_pct)}%`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">מונה שעות</p>
          <p className="num mt-1 text-2xl font-semibold">
            {formatNumber(num(d.operating_hours), 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">מונה כדורים</p>
          <p className="num mt-1 text-2xl font-semibold">{formatNumber(num(d.ball_count))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">כדורים משוער</p>
          <p className="num mt-1 text-2xl font-semibold">
            {d.estimated_balls_remaining === null
              ? '—'
              : formatNumber(num(d.estimated_balls_remaining))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-[var(--fg-secondary)]">תקלות פתוחות</p>
          <p
            className={`num mt-1 text-2xl font-semibold ${openTickets > 0 ? 'text-[var(--signal-warning)]' : ''}`}
          >
            {openTickets}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">סקירה</TabsTrigger>
          <TabsTrigger value="telemetry">טלמטריה</TabsTrigger>
          <TabsTrigger value="firmware">היסטוריית Firmware</TabsTrigger>
          <TabsTrigger value="assignments">היסטוריית הצבה</TabsTrigger>
          <TabsTrigger value="tickets">תקלות</TabsTrigger>
          <TabsTrigger value="maintenance">תחזוקה</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>זהות ומיקום</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="Device ID">
                    <span className="mono">{String(d.device_id)}</span>
                  </DetailRow>
                  <DetailRow label="מספר סידורי">
                    <span className="mono text-[11px]">{String(d.serial_number)}</span>
                  </DetailRow>
                  <DetailRow label="דגם">{String(d.model)}</DetailRow>
                  <DetailRow label="גרסת חומרה">{str(d.hardware_version) ?? '—'}</DetailRow>
                  <DetailRow label="גרסת Firmware">
                    <span className="mono">{str(d.firmware_version) ?? '—'}</span>
                    {d.firmware_channel && d.firmware_channel !== 'stable' ? (
                      <Badge size="sm" tone="warning" className="ms-1.5">
                        {String(d.firmware_channel)}
                      </Badge>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="מועדון">
                    {d.club_uuid ? (
                      <Link href={`/clubs/${d.club_uuid}`} className="hover:text-[var(--accent)]">
                        {String(d.club_name)}
                      </Link>
                    ) : (
                      <span className="text-[var(--fg-tertiary)]">במלאי</span>
                    )}
                  </DetailRow>
                  <DetailRow label="עמדה">
                    {d.station_uuid ? (
                      <Link
                        href={`/stations/${d.station_uuid}`}
                        className="mono hover:text-[var(--accent)]"
                      >
                        {String(d.station_code)}
                      </Link>
                    ) : (
                      <span className="text-[var(--fg-tertiary)]">אינה מוצבת</span>
                    )}
                  </DetailRow>
                  <DetailRow label="נראתה לאחרונה">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot tone={d.connectivity === 'online' ? 'positive' : 'danger'} />
                      {d.last_seen_at ? formatRelative(String(d.last_seen_at)) : '—'}
                    </span>
                  </DetailRow>
                </DetailList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>אבטחה, רכש ואחריות</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList>
                  <DetailRow label="מפתח הרשאה">
                    <span className="mono text-[var(--fg-tertiary)]">
                      {maskSecret(str(d.auth_key_encrypted))}
                    </span>
                  </DetailRow>
                  <DetailRow label="הוחלף לאחרונה">
                    {d.auth_key_rotated_at ? formatDate(String(d.auth_key_rotated_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="הורשה בתאריך">
                    {d.authorized_at ? formatDate(String(d.authorized_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="ספק">{str(d.supplier_name) ?? '—'}</DetailRow>
                  <DetailRow label="תאריך רכישה">
                    {d.purchase_date ? formatDate(String(d.purchase_date)) : '—'}
                  </DetailRow>
                  <DetailRow label="עלות רכישה">
                    <span className="num">{formatCurrency(num(d.purchase_cost))}</span>
                  </DetailRow>
                  <DetailRow label="אחריות עד">
                    {d.warranty_until ? formatDate(String(d.warranty_until)) : '—'}
                  </DetailRow>
                  <DetailRow label="טיפול אחרון">
                    {d.last_service_at ? formatDate(String(d.last_service_at)) : '—'}
                  </DetailRow>
                  <DetailRow label="טיפול הבא">
                    <span className={nextServiceOverdue ? 'text-[var(--signal-danger)]' : ''}>
                      {d.next_service_due ? formatDate(String(d.next_service_due)) : '—'}
                    </span>
                  </DetailRow>
                </DetailList>
                <Callout tone="info" icon={ShieldCheck} className="mt-4">
                  מפתח ההרשאה של המכשיר מוצפן ב־AES-256-GCM ואינו מוחזר מאף endpoint. גם משתמש Super
                  Admin אינו יכול לצפות בו — זו הגנה מכוונת נגד דליפת מפתחות.
                </Callout>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="telemetry">
          <Card>
            <CardHeader>
              <CardTitle>טלמטריה אחרונה</CardTitle>
              <CardDescription>
                50 הדגימות האחרונות. ⚠ שכבת ה־BLE במצב Mock — הדגימות נוצרו על ידי ספק מדומה ואינן
                נתוני חיישן אמיתיים.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.telemetry.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="אין דגימות טלמטריה"
                  description="ניתן למשוך דגימה עדכנית בכפתור בראש המסך."
                />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--fg-tertiary)] uppercase">
                      <th className="py-2 text-start font-semibold">זמן</th>
                      <th className="py-2 text-end font-semibold">סוללה</th>
                      <th className="py-2 text-end font-semibold">RSSI</th>
                      <th className="py-2 text-end font-semibold">כדורים</th>
                      <th className="py-2 text-end font-semibold">טמפ׳ מנוע</th>
                      <th className="py-2 text-start font-semibold">שגיאה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.telemetry.map((t) => (
                      <tr
                        key={String(t.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="num py-2 text-[11px] text-[var(--fg-tertiary)]">
                          {formatDateTime(String(t.recorded_at))}
                        </td>
                        <td className="num py-2 text-end">{num(t.battery_pct)}%</td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {t.rssi === null ? '—' : `${num(t.rssi)} dBm`}
                        </td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {t.balls_fired === null ? '—' : formatNumber(num(t.balls_fired))}
                        </td>
                        <td className="num py-2 text-end text-[var(--fg-secondary)]">
                          {t.motor_temp_c === null ? '—' : `${num(t.motor_temp_c)}°`}
                        </td>
                        <td className="mono py-2 text-[11px] text-[var(--signal-danger)]">
                          {str(t.error_code) ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firmware">
          <Card>
            <CardHeader>
              <CardTitle>היסטוריית Firmware</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.firmwareHistory.length === 0 ? (
                <EmptyState icon={Cpu} title="לא בוצעו עדכוני Firmware" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--fg-tertiary)] uppercase">
                      <th className="py-2 text-start font-semibold">מתי</th>
                      <th className="py-2 text-start font-semibold">מגרסה</th>
                      <th className="py-2 text-start font-semibold">לגרסה</th>
                      <th className="py-2 text-center font-semibold">סוג</th>
                      <th className="py-2 text-center font-semibold">תוצאה</th>
                      <th className="py-2 text-start font-semibold">בוצע על ידי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.firmwareHistory.map((h) => (
                      <tr
                        key={String(h.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="num py-2 text-[11px]">
                          {formatDateTime(String(h.performed_at))}
                        </td>
                        <td className="mono py-2 text-[11px]">{str(h.from_version) ?? '—'}</td>
                        <td className="mono py-2 text-[11px]">{String(h.to_version)}</td>
                        <td className="py-2 text-center">
                          {h.is_rollback ? (
                            <Badge size="sm" tone="warning">
                              Rollback
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="neutral">
                              עדכון
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {h.succeeded ? (
                            <Badge size="sm" tone="positive">
                              הצליח
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="danger">
                              נכשל
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(h.performed_by_name) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>היסטוריית הצבה</CardTitle>
              <CardDescription>
                כל העברה של המכונה בין עמדות ומועדונים, כולל סיבת ההעברה ומי ביצע אותה.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.assignments.length === 0 ? (
                <EmptyState icon={History} title="המכונה טרם הוצבה בעמדה" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--fg-tertiary)] uppercase">
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">עמדה</th>
                      <th className="py-2 text-start font-semibold">סיבה</th>
                      <th className="py-2 text-start font-semibold">מתאריך</th>
                      <th className="py-2 text-start font-semibold">עד</th>
                      <th className="py-2 text-start font-semibold">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignments.map((a) => (
                      <tr
                        key={String(a.id)}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="py-2.5">{str(a.club_name) ?? '—'}</td>
                        <td className="mono py-2.5">{str(a.station_code) ?? '—'}</td>
                        <td className="py-2.5 text-[var(--fg-secondary)]">{String(a.reason)}</td>
                        <td className="num py-2.5 text-[11px]">
                          {formatDateTime(String(a.assigned_at))}
                        </td>
                        <td className="num py-2.5 text-[11px]">
                          {a.unassigned_at ? formatDateTime(String(a.unassigned_at)) : 'פעיל'}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(a.notes) ?? '—'}
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
              <CardTitle>תקלות במכונה</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tickets.length === 0 ? (
                <EmptyState icon={Wrench} title="לא נפתחו תקלות במכונה" />
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
                        <Badge
                          size="sm"
                          tone={labels.ticketCategory.tone(
                            String(t.category) as Parameters<typeof labels.ticketCategory.tone>[0],
                          )}
                        >
                          {labels.ticketCategory.label(
                            String(t.category) as Parameters<typeof labels.ticketCategory.label>[0],
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
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>תחזוקה</CardTitle>
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
                      {m.completed_at ? (
                        <span className="num text-[11px] text-[var(--fg-tertiary)]">
                          בוצע {formatDate(String(m.completed_at))}
                        </span>
                      ) : null}
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
      </Tabs>
    </>
  );
}
