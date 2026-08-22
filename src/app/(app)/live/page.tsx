import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  BatteryLow,
  CircleSlash,
  Radio,
  WifiOff,
} from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Progress,
} from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/shell/page-header';
import { formatCurrency, formatDuration, formatNumber, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { getLiveAlerts, getLiveSessions, getLiveStations } from '@/server/queries/live';
import { SessionControls } from './session-controls';
import { StationControls } from './station-controls';

export const metadata: Metadata = { title: 'פעילות בזמן אמת' };

// מרכז חי — הנתונים חייבים להיות טריים בכל טעינה
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LivePage() {
  const user = await requirePermission('sessions.view');

  const [liveSessions, alerts, stationStates] = await Promise.all([
    getLiveSessions(user),
    getLiveAlerts(user),
    getLiveStations(user),
  ]);

  const canControl = user.permissions.has('sessions.control');
  const canForceEnd = user.permissions.has('sessions.force_end');
  const canRefund = user.permissions.has('refunds.request');
  const canMessage = user.permissions.has('sessions.message_player');
  const canMarkFaulty = user.permissions.has('sessions.mark_faulty');
  const canSuspendStation = user.permissions.has('stations.suspend');
  const canCreateTicket = user.permissions.has('tickets.create');

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  const alertIcon = {
    paid_not_started: AlertTriangle,
    device_offline: WifiOff,
    station_suspended: CircleSlash,
    critical_ticket: AlertTriangle,
    battery_low: BatteryLow,
  } as const;

  return (
    <>
      <PageHeader
        title="פעילות בזמן אמת"
        description="מרכז השליטה התפעולי. מה קורה עכשיו ברשת, ומה דורש התערבות מיידית."
        meta={
          <>
            <Badge tone="positive" dot>
              <span className="pulse-live">●</span>&nbsp;{liveSessions.length} סשנים פעילים
            </Badge>
            {criticalAlerts.length > 0 && (
              <Badge tone="danger" dot>
                {criticalAlerts.length} התראות קריטיות
              </Badge>
            )}
            {warningAlerts.length > 0 && (
              <Badge tone="warning" dot>
                {warningAlerts.length} אזהרות
              </Badge>
            )}
          </>
        }
      />

      {/* ═══ התראות ═══ */}
      {alerts.length > 0 && (
        <section aria-labelledby="alerts" className="mb-5">
          <h2 id="alerts" className="mb-3 text-[13px] font-semibold text-[var(--fg-secondary)]">
            דורש טיפול עכשיו
          </h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((alert) => {
              const Icon = alertIcon[alert.kind];
              return (
                <Link
                  key={`${alert.kind}-${alert.id}`}
                  href={alert.href}
                  className={`flex items-start gap-2.5 rounded-[var(--radius-card)] p-3 ring-1 ring-inset transition-colors ${
                    alert.severity === 'critical'
                      ? 'bg-[var(--signal-danger-bg)] ring-[var(--signal-danger-ring)] hover:bg-[var(--signal-danger-bg)]'
                      : 'bg-[var(--signal-warning-bg)] ring-[var(--signal-warning-ring)] hover:bg-[var(--signal-warning-bg)]'
                  }`}
                >
                  <Icon
                    className={`mt-0.5 size-4 shrink-0 ${
                      alert.severity === 'critical' ? 'text-[var(--signal-danger)]' : 'text-[var(--signal-warning)]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--fg-primary)]">
                      {alert.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--fg-tertiary)]">{alert.detail}</p>
                  </div>
                  {alert.minutesAgo !== null && (
                    <span className="num shrink-0 text-[11px] text-[var(--fg-tertiary)]">
                      {formatDuration(alert.minutesAgo)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ סשנים פעילים ═══ */}
      <section aria-labelledby="active-sessions" className="mb-5">
        <h2
          id="active-sessions"
          className="mb-3 text-[13px] font-semibold text-[var(--fg-secondary)]"
        >
          סשנים פעילים עכשיו
        </h2>

        {liveSessions.length === 0 ? (
          <Card>
            <EmptyState
              icon={Radio}
              title="אין סשנים פעילים כרגע"
              description="כשמישהו יתחיל אימון, הוא יופיע כאן בזמן אמת עם כל פרטי המכונה והתשלום."
            />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {liveSessions.map((s) => {
              const progress =
                s.scheduledMinutes > 0 ? (s.elapsedMinutes / s.scheduledMinutes) * 100 : 0;
              const overtime = s.elapsedMinutes > s.scheduledMinutes;
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/sessions/${s.id}`}
                        className="mono text-[13px] font-medium hover:text-[var(--accent)]"
                      >
                        {s.reference}
                      </Link>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--fg-secondary)]">
                        {s.playerName}
                        {s.playerCount === 2 && ' · זוג'}
                      </p>
                    </div>
                    <Badge
                      size="sm"
                      tone={labels.sessionStatus.tone(
                        s.status as Parameters<typeof labels.sessionStatus.tone>[0],
                      )}
                      dot
                    >
                      {labels.sessionStatus.label(
                        s.status as Parameters<typeof labels.sessionStatus.label>[0],
                      )}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--fg-tertiary)]">
                    <Link href={`/clubs/${s.clubId}`} className="hover:text-[var(--fg-secondary)]">
                      {s.clubName}
                    </Link>
                    <span>·</span>
                    <Link
                      href={`/stations/${s.stationId}`}
                      className="mono hover:text-[var(--fg-secondary)]"
                    >
                      {s.stationCode}
                    </Link>
                    {s.deviceLabel && (
                      <>
                        <span>·</span>
                        <span className="mono">{s.deviceLabel}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-[var(--fg-tertiary)]">
                        התחיל {formatRelative(s.startedAt)}
                      </span>
                      <span className={overtime ? 'text-[var(--signal-warning)]' : 'text-[var(--fg-secondary)]'}>
                        <span className="num">{formatDuration(s.elapsedMinutes)}</span>
                        {' / '}
                        <span className="num">{formatDuration(s.scheduledMinutes)}</span>
                      </span>
                    </div>
                    <Progress
                      value={Math.min(progress, 100)}
                      tone={overtime ? 'warning' : 'accent'}
                    />
                    <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                      {overtime ? (
                        <span className="text-[var(--signal-warning)]">חריגה מהזמן המתוכנן</span>
                      ) : (
                        <>
                          נותרו <span className="num">{formatDuration(s.remainingMinutes)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--border-subtle)] pt-3 text-[11px]">
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-tertiary)]">תשלום</dt>
                      <dd>
                        {s.paymentStatus ? (
                          <Badge
                            size="sm"
                            tone={labels.paymentStatus.tone(
                              s.paymentStatus as Parameters<typeof labels.paymentStatus.tone>[0],
                            )}
                          >
                            {formatCurrency(s.amountGross)}
                          </Badge>
                        ) : (
                          <span className="text-[var(--signal-danger)]">אין תשלום</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-tertiary)]">BLE</dt>
                      <dd className="flex items-center gap-1.5">
                        <StatusDot
                          tone={s.connectivity === 'online' ? 'positive' : 'danger'}
                          pulse={s.connectivity === 'online'}
                        />
                        {labels.deviceConnectivity.label(
                          (s.connectivity ?? 'unknown') as Parameters<
                            typeof labels.deviceConnectivity.label
                          >[0],
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-tertiary)]">סוללה</dt>
                      <dd
                        className={
                          s.batteryPct !== null && s.batteryPct < 20
                            ? 'num text-[var(--signal-danger)]'
                            : 'num text-[var(--fg-secondary)]'
                        }
                      >
                        {s.batteryPct === null ? '—' : `${s.batteryPct}%`}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-tertiary)]">כדורים</dt>
                      <dd className="num text-[var(--fg-secondary)]">
                        {s.estimatedBallsRemaining === null
                          ? '—'
                          : `~${formatNumber(s.estimatedBallsRemaining)}`}
                      </dd>
                    </div>
                    {s.programName && (
                      <div className="col-span-2 flex justify-between">
                        <dt className="text-[var(--fg-tertiary)]">תוכנית</dt>
                        <dd className="truncate text-[var(--fg-secondary)]">{s.programName}</dd>
                      </div>
                    )}
                    {s.lastErrorCode && (
                      <div className="col-span-2 flex justify-between">
                        <dt className="text-[var(--fg-tertiary)]">שגיאה אחרונה</dt>
                        <dd className="mono text-[var(--signal-danger)]">{s.lastErrorCode}</dd>
                      </div>
                    )}
                  </dl>

                  <SessionControls
                    sessionId={s.id}
                    reference={s.reference}
                    status={s.status}
                    amountGross={s.amountGross}
                    can={{
                      control: canControl,
                      forceEnd: canForceEnd,
                      refund: canRefund,
                      message: canMessage,
                      markFaulty: canMarkFaulty,
                      createTicket: canCreateTicket,
                    }}
                  />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ מצב העמדות ═══ */}
      <section aria-labelledby="stations-state">
        <h2
          id="stations-state"
          className="mb-3 text-[13px] font-semibold text-[var(--fg-secondary)]"
        >
          מצב העמדות ברשת
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>כל העמדות</CardTitle>
            <CardDescription>
              שעות בתשלום היום, מצב חיבור וסוללה. לחיצה על עמדה פותחת את עמוד העמדה.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                  <th className="py-2 text-start font-semibold">עמדה</th>
                  <th className="py-2 text-start font-semibold">מועדון</th>
                  <th className="py-2 text-start font-semibold">מכונה</th>
                  <th className="py-2 text-center font-semibold">חיבור</th>
                  <th className="py-2 text-end font-semibold">סוללה</th>
                  <th className="py-2 text-end font-semibold">סשנים היום</th>
                  <th className="py-2 text-end font-semibold">שעות היום</th>
                  <th className="py-2 text-center font-semibold">סטטוס</th>
                  <th className="py-2 text-end font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {stationStates.map((st) => (
                  <tr
                    key={st.id}
                    className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
                  >
                    <td className="py-2.5">
                      <Link
                        href={`/stations/${st.id}`}
                        className="mono font-medium hover:text-[var(--accent)]"
                      >
                        {st.code}
                      </Link>
                      {st.activeSessionRef && (
                        <span className="ms-2 inline-flex items-center gap-1 text-[10px] text-[var(--accent)]">
                          <span className="size-1.5 rounded-full bg-[var(--accent)] pulse-live" />
                          בשימוש
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-[var(--fg-secondary)]">{st.clubName}</td>
                    <td className="mono py-2.5 text-[11px] text-[var(--fg-tertiary)]">
                      {st.deviceLabel ?? '—'}
                    </td>
                    <td className="py-2.5 text-center">
                      <StatusDot
                        tone={
                          st.connectivity === 'online'
                            ? 'positive'
                            : st.connectivity === 'offline'
                              ? 'danger'
                              : 'muted'
                        }
                      />
                    </td>
                    <td className="num py-2.5 text-end">
                      {st.batteryPct === null ? (
                        <span className="text-[var(--fg-tertiary)]">—</span>
                      ) : (
                        <span className={st.batteryPct < 20 ? 'text-[var(--signal-danger)]' : ''}>
                          {st.batteryPct}%
                        </span>
                      )}
                    </td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                      {st.todaySessions}
                    </td>
                    <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                      {formatNumber(st.todayHours, 1)}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge
                        size="sm"
                        tone={labels.stationStatus.tone(
                          st.status as Parameters<typeof labels.stationStatus.tone>[0],
                        )}
                      >
                        {labels.stationStatus.label(
                          st.status as Parameters<typeof labels.stationStatus.label>[0],
                        )}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-end">
                      <StationControls
                        stationId={st.id}
                        code={st.code}
                        status={st.status}
                        canSuspend={canSuspendStation}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
