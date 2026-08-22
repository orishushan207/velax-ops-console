import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/data/data-table';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { Callout } from '@/components/ui/feedback';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import {
  listDevices,
  listStations,
  type DeviceListRow,
  type StationListRow,
} from '@/server/queries/fleet';
import { getSettings } from '@/server/settings/service';
import { RegisterDeviceButton } from './register-device';
import { CreateStationButton } from '@/components/forms/entity-buttons';
import { stationFormSections } from '@/components/forms/entity-forms';
import { listClubOptions } from '@/server/queries/clubs';

export const metadata: Metadata = { title: 'עמדות ומכונות' };

export default async function StationsPage() {
  const user = await requirePermission('stations.view');
  const canSeeDevices = user.permissions.has('devices.view');

  const canManageStations = user.permissions.has('stations.manage');

  const [stations, devices, settings, clubOptions] = await Promise.all([
    listStations(user),
    canSeeDevices ? listDevices(user) : Promise.resolve([]),
    getSettings(),
    canManageStations ? listClubOptions(user) : Promise.resolve([]),
  ]);

  const target = settings.num('quality.paid_hours_per_station_target', 1.5);
  const uptimeTarget = settings.num('sla.uptime_target_pct', 0.95);

  const activeStations = stations.filter((s) => s.status === 'active').length;
  const suspendedStations = stations.filter((s) => s.status === 'suspended').length;
  const totalHours = stations.reduce((s, st) => s + st.hours30d, 0);
  const avgHoursPerDay = activeStations > 0 ? totalHours / activeStations / 30 : 0;
  const onlineDevices = devices.filter((d) => d.connectivity === 'online').length;
  const spareDevices = devices.filter((d) => d.isSpare && d.status === 'in_stock').length;
  const outdatedFirmware = devices.filter((d) => d.isBelowMinimumFirmware).length;

  const stationColumns: Column<StationListRow>[] = [
    {
      key: 'code',
      header: 'עמדה',
      width: 'w-32',
      render: (s) => <span className="mono">{s.code}</span>,
      exportValue: (s) => s.code,
    },
    {
      key: 'club',
      header: 'מועדון',
      render: (s) => (
        <Link href={`/clubs/${s.clubId}`} className="hover:text-[var(--accent)]">
          {s.clubName}
        </Link>
      ),
      exportValue: (s) => s.clubName,
    },
    {
      key: 'region',
      header: 'אזור',
      width: 'w-32',
      render: (s) => <span className="text-[var(--fg-secondary)]">{s.region}</span>,
      exportValue: (s) => s.region,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'type',
      header: 'סוג',
      width: 'w-28',
      render: (s) => (
        <Badge size="sm" tone="neutral">
          {labels.stationType.label(s.stationType as Parameters<typeof labels.stationType.label>[0])}
        </Badge>
      ),
      exportValue: (s) => s.stationType,
    },
    {
      key: 'device',
      header: 'מכונה',
      width: 'w-36',
      render: (s) =>
        s.deviceUuid ? (
          <Link
            href={`/stations/devices/${s.deviceUuid}`}
            className="mono text-[11px] hover:text-[var(--accent)]"
          >
            {s.deviceLabel}
          </Link>
        ) : (
          <span className="text-[var(--fg-tertiary)]">ללא</span>
        ),
      exportValue: (s) => s.deviceLabel ?? '',
    },
    {
      key: 'connectivity',
      header: 'חיבור',
      width: 'w-20',
      align: 'center',
      render: (s) => (
        <StatusDot
          tone={
            s.connectivity === 'online'
              ? 'positive'
              : s.connectivity === 'offline'
                ? 'danger'
                : 'muted'
          }
        />
      ),
      exportValue: (s) => s.connectivity ?? '',
    },
    {
      key: 'battery',
      header: 'סוללה',
      width: 'w-20',
      align: 'end',
      render: (s) =>
        s.batteryPct === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className={s.batteryPct < 20 ? 'num text-[var(--signal-danger)]' : 'num'}>{s.batteryPct}%</span>
        ),
      exportValue: (s) => s.batteryPct ?? '',
      hideable: true,
    },
    {
      key: 'sessions',
      header: 'סשנים 30 יום',
      width: 'w-28',
      align: 'end',
      render: (s) => <span className="num">{s.sessions30d}</span>,
      exportValue: (s) => s.sessions30d,
    },
    {
      key: 'hours',
      header: 'שעות 30 יום',
      width: 'w-28',
      align: 'end',
      render: (s) => <span className="num">{formatNumber(s.hours30d, 1)}</span>,
      exportValue: (s) => s.hours30d,
    },
    {
      key: 'hoursPerDay',
      header: 'שעות/יום',
      width: 'w-24',
      align: 'end',
      render: (s) => (
        <span
          className={
            s.hoursPerDay !== null && s.hoursPerDay >= target ? 'num text-[var(--signal-positive)]' : 'num text-[var(--signal-warning)]'
          }
        >
          {s.hoursPerDay === null ? '—' : formatNumber(s.hoursPerDay, 2)}
        </span>
      ),
      exportValue: (s) => s.hoursPerDay ?? '',
    },
    {
      key: 'uptime',
      header: 'Uptime',
      width: 'w-24',
      align: 'end',
      render: (s) =>
        s.uptimePct === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className={s.uptimePct >= uptimeTarget ? 'num text-[var(--signal-positive)]' : 'num text-[var(--signal-warning)]'}>
            {formatPercent(s.uptimePct, 0)}
          </span>
        ),
      exportValue: (s) => s.uptimePct ?? '',
    },
    {
      key: 'downtime',
      header: 'השבתה',
      width: 'w-24',
      align: 'end',
      render: (s) => (
        <span className="num text-[var(--fg-secondary)]">
          {s.downtimeMinutes30d > 0 ? formatDuration(s.downtimeMinutes30d) : '—'}
        </span>
      ),
      exportValue: (s) => s.downtimeMinutes30d,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'tickets',
      header: 'תקלות',
      width: 'w-20',
      align: 'end',
      render: (s) =>
        s.openTickets > 0 ? (
          <span className="num text-[var(--signal-warning)]">{s.openTickets}</span>
        ) : (
          <span className="num text-[var(--fg-tertiary)]">0</span>
        ),
      exportValue: (s) => s.openTickets,
    },
    {
      key: 'cost',
      header: 'עלות התקנה',
      width: 'w-28',
      align: 'end',
      render: (s) => <span className="num">{formatCurrency(s.installedCost)}</span>,
      exportValue: (s) => s.installedCost,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-28',
      align: 'center',
      render: (s) => (
        <Badge
          size="sm"
          tone={labels.stationStatus.tone(s.status as Parameters<typeof labels.stationStatus.tone>[0])}
        >
          {labels.stationStatus.label(s.status as Parameters<typeof labels.stationStatus.label>[0])}
        </Badge>
      ),
      exportValue: (s) => s.status,
    },
  ];

  const deviceColumns: Column<DeviceListRow>[] = [
    {
      key: 'deviceId',
      header: 'Device ID',
      width: 'w-36',
      render: (d) => <span className="mono">{d.deviceId}</span>,
      exportValue: (d) => d.deviceId,
    },
    {
      key: 'serial',
      header: 'מספר סידורי',
      width: 'w-40',
      render: (d) => <span className="mono text-[11px]">{d.serialNumber}</span>,
      exportValue: (d) => d.serialNumber,
    },
    {
      key: 'model',
      header: 'דגם',
      render: (d) => <span className="text-[var(--fg-secondary)]">{d.model}</span>,
      exportValue: (d) => d.model,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'firmware',
      header: 'Firmware',
      width: 'w-32',
      render: (d) => (
        <span className="flex items-center gap-1.5">
          <span className="mono text-[11px]">{d.firmwareVersion ?? '—'}</span>
          {d.isBelowMinimumFirmware && (
            <Badge size="sm" tone="warning">
              ישן
            </Badge>
          )}
        </span>
      ),
      exportValue: (d) => d.firmwareVersion ?? '',
    },
    {
      key: 'location',
      header: 'מיקום',
      render: (d) =>
        d.stationId ? (
          <span>
            <Link href={`/clubs/${d.clubId}`} className="hover:text-[var(--accent)]">
              {d.clubName}
            </Link>
            <Link
              href={`/stations/${d.stationId}`}
              className="mono ms-2 text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--accent)]"
            >
              {d.stationCode}
            </Link>
          </span>
        ) : (
          <span className="text-[var(--fg-tertiary)]">
            {d.isSpare ? 'מלאי — מכונה חלופית' : 'במלאי'}
          </span>
        ),
      exportValue: (d) => `${d.clubName ?? ''} ${d.stationCode ?? ''}`.trim(),
    },
    {
      key: 'connectivity',
      header: 'חיבור',
      width: 'w-24',
      align: 'center',
      render: (d) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot
            tone={
              d.connectivity === 'online'
                ? 'positive'
                : d.connectivity === 'offline'
                  ? 'danger'
                  : 'muted'
            }
          />
          <span className="text-[11px] text-[var(--fg-tertiary)]">
            {d.lastSeenAt ? formatRelative(d.lastSeenAt) : '—'}
          </span>
        </span>
      ),
      exportValue: (d) => d.connectivity,
    },
    {
      key: 'battery',
      header: 'סוללה',
      width: 'w-20',
      align: 'end',
      render: (d) =>
        d.batteryPct === null ? (
          <span className="text-[var(--fg-tertiary)]">—</span>
        ) : (
          <span className={d.batteryPct < 20 ? 'num text-[var(--signal-danger)]' : 'num'}>{d.batteryPct}%</span>
        ),
      exportValue: (d) => d.batteryPct ?? '',
    },
    {
      key: 'hours',
      header: 'מונה שעות',
      width: 'w-28',
      align: 'end',
      render: (d) => <span className="num">{formatNumber(d.operatingHours, 0)}</span>,
      exportValue: (d) => d.operatingHours,
    },
    {
      key: 'balls',
      header: 'מונה כדורים',
      width: 'w-28',
      align: 'end',
      render: (d) => <span className="num">{formatNumber(d.ballCount)}</span>,
      exportValue: (d) => d.ballCount,
      hideable: true,
    },
    {
      key: 'service',
      header: 'טיפול הבא',
      width: 'w-28',
      render: (d) => {
        if (!d.nextServiceDue) return <span className="text-[var(--fg-tertiary)]">—</span>;
        const overdue = new Date(d.nextServiceDue) < new Date();
        return (
          <span className={overdue ? 'num text-[var(--signal-danger)]' : 'num text-[var(--fg-secondary)]'}>
            {formatDate(d.nextServiceDue)}
          </span>
        );
      },
      exportValue: (d) => d.nextServiceDue ?? '',
    },
    {
      key: 'status',
      header: 'סטטוס',
      width: 'w-28',
      align: 'center',
      render: (d) => (
        <Badge
          size="sm"
          tone={labels.deviceStatus.tone(d.status as Parameters<typeof labels.deviceStatus.tone>[0])}
          dot
        >
          {labels.deviceStatus.label(d.status as Parameters<typeof labels.deviceStatus.label>[0])}
        </Badge>
      ),
      exportValue: (d) => d.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="עמדות ומכונות"
        description="הפרדה מלאה בין העמדה — המיקום הקבוע במועדון — לבין המכונה, שהיא נכס נייד שמוחלף."
        actions={
          <>
            {canManageStations && clubOptions.length > 0 && (
              <CreateStationButton sections={stationFormSections({}, clubOptions)} />
            )}
            {user.permissions.has('devices.register') && <RegisterDeviceButton />}
          </>
        }
        meta={
          <>
            {suspendedStations > 0 && (
              <Badge tone="danger" dot>
                {suspendedStations} עמדות מושבתות
              </Badge>
            )}
            {outdatedFirmware > 0 && (
              <Badge tone="warning" dot>
                {outdatedFirmware} מכונות עם Firmware ישן
              </Badge>
            )}
          </>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard
          label="עמדות פעילות"
          metricKey="active_station"
          value={`${activeStations} / ${stations.length}`}
          accent
        />
        <KpiCard
          label="שעות/עמדה/יום"
          metricKey="paid_training_hours_per_active_station_per_day"
          value={formatNumber(avgHoursPerDay, 2)}
          target={formatNumber(target, 1)}
          targetMet={avgHoursPerDay >= target}
        />
        <KpiCard label="מכונות ברשת" value={formatNumber(devices.length)} />
        <KpiCard
          label="מכונות מחוברות"
          value={`${onlineDevices} / ${devices.filter((d) => d.status === 'active').length}`}
        />
        <KpiCard
          label="מכונות חלופיות במלאי"
          value={formatNumber(spareDevices)}
          hint="התחייבות ה־SLA היא תיקון תוך 24–48 שעות או אספקת מכונה חלופית."
        />
        <KpiCard
          label="שעות שימוש · 30 יום"
          value={`${formatNumber(totalHours, 0)} ש׳`}
        />
      </KpiGrid>

      {spareDevices === 0 && devices.length > 0 && (
        <Callout tone="warning" className="mt-4">
          אין מכונות חלופיות זמינות במלאי. התחייבות ה־SLA כוללת אספקת מכונה חלופית כאשר תיקון
          נמשך מעבר לזמן היעד — בלי מלאי חלופי לא ניתן לעמוד בה.
        </Callout>
      )}

      <div className="mt-5">
        <Tabs defaultValue="stations">
          <TabsList>
            <TabsTrigger value="stations">עמדות ({stations.length})</TabsTrigger>
            {canSeeDevices && (
              <TabsTrigger value="devices">מכונות ({devices.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="stations">
            <Card className="p-4">
              <DataTable
                columns={stationColumns}
                rows={stations}
                rowKey={(s) => s.id}
                rowHref={(s) => `/stations/${s.id}`}
                exportName="velax-stations"
                emptyTitle="אין עמדות"
                emptyDescription="עמדה נוצרת כחלק מתהליך ההתקנה במועדון."
              />
            </Card>
          </TabsContent>

          {canSeeDevices && (
            <TabsContent value="devices">
              <Card className="p-4">
                <DataTable
                  columns={deviceColumns}
                  rows={devices}
                  rowKey={(d) => d.id}
                  rowHref={(d) => `/stations/devices/${d.id}`}
                  exportName="velax-devices"
                  emptyTitle="אין מכונות רשומות"
                  emptyDescription="ניתן לרשום מכונה חדשה בכפתור בראש המסך."
                />
              </Card>
              <p className="mt-3 text-[11px] text-[var(--fg-tertiary)]">
                מפתחות ההרשאה של המכשירים (Device Auth Keys) מוצפנים ב־AES-256-GCM ואינם ניתנים
                לצפייה או לייצוא מאף מסך במערכת.
              </p>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
