import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Bell, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requireUser } from '@/server/auth/guard';
import { getIntegrationStatus } from '@/server/providers';
import { clubScopeSql } from '@/server/queries/sessions';
import { getLiveAlerts } from '@/server/queries/live';
import { listAutomationRules } from '@/server/queries/settings';

export const metadata: Metadata = { title: 'התראות ואוטומציות' };

export const dynamic = 'force-dynamic';

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function NotificationsPage() {
  const user = await requireUser();

  const [notificationRows, rules, liveAlerts] = await Promise.all([
    db.execute(sql`
      SELECT n.*, c.name AS club_name, ar.name_he AS rule_name
      FROM notifications n
      LEFT JOIN clubs c ON c.id = n.club_id
      LEFT JOIN automation_rules ar ON ar.id = n.rule_id
      WHERE (n.recipient_user_id = ${user.id}::uuid OR n.recipient_user_id IS NULL)
        AND (n.club_id IS NULL OR ${clubScopeSql(user, 'n.club_id')})
      ORDER BY n.created_at DESC LIMIT 100
    `),
    listAutomationRules(),
    getLiveAlerts(user),
  ]);

  const notifications = notificationRows.rows as Record<string, unknown>[];
  const unread = notifications.filter((n) => !n.read_at).length;
  const activeRules = rules.filter((r) => r.is_active).length;

  const channels = getIntegrationStatus().filter((i) =>
    ['email', 'sms', 'whatsapp', 'slack'].includes(i.key),
  );

  return (
    <>
      <PageHeader
        title="התראות ואוטומציות"
        description="מרכז ההתראות והכללים שמפעילים אותן. כל כלל מצביע על הגדרה עסקית ולא על מספר קבוע."
        meta={
          <>
            {liveAlerts.filter((a) => a.severity === 'critical').length > 0 && (
              <Badge tone="danger" dot>
                {liveAlerts.filter((a) => a.severity === 'critical').length} התראות חיות קריטיות
              </Badge>
            )}
            {unread > 0 && <Badge tone="info" dot>{unread} לא נקראו</Badge>}
          </>
        }
      />

      <KpiGrid columns={5}>
        <KpiCard label="התראות חיות" value={formatNumber(liveAlerts.length)} href="/live" />
        <KpiCard
          label="קריטיות חיות"
          value={formatNumber(liveAlerts.filter((a) => a.severity === 'critical').length)}
          higherIsBetter={false}
        />
        <KpiCard label="לא נקראו" value={formatNumber(unread)} higherIsBetter={false} />
        <KpiCard label="כללים פעילים" value={`${activeRules} / ${rules.length}`} />
        <KpiCard
          label="ערוצי שליחה מחוברים"
          value={`0 / ${channels.length}`}
          hint="כל הערוצים החיצוניים במצב Mock. התראות נשמרות במערכת אך אינן נשלחות."
        />
      </KpiGrid>

      <Callout tone="warning" icon={Bell} title="ערוצי שליחה חיצוניים אינם מחוברים" className="mt-4">
        Email, SMS, WhatsApp ו־Slack פועלים כולם במצב Mock. התראות נרשמות במסד ומוצגות כאן
        ובמרכז הפעילות, אך אינן נשלחות בפועל לאף אדם. חיבור ערוץ אמיתי נעשה בהזנת credentials
        במשתני הסביבה, ללא שינוי קוד.
      </Callout>

      <Tabs defaultValue="live" className="mt-5">
        <TabsList>
          <TabsTrigger value="live">התראות חיות ({liveAlerts.length})</TabsTrigger>
          <TabsTrigger value="feed">יומן התראות ({notifications.length})</TabsTrigger>
          <TabsTrigger value="rules">כללי אוטומציה ({rules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <Card>
            <CardHeader>
              <CardTitle>מה דורש טיפול עכשיו</CardTitle>
              <CardDescription>
                מחושב בזמן אמת מהמצב הנוכחי של הרשת — לא מיומן היסטורי.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {liveAlerts.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="אין התראות פתוחות"
                  description="כל המכונות מחוברות, אין סשנים תקועים ואין תקלות קריטיות."
                />
              ) : (
                <ul className="space-y-2">
                  {liveAlerts.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link
                        href={a.href}
                        className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] p-3 ring-1 ring-inset transition-colors ${
                          a.severity === 'critical'
                            ? 'bg-[var(--signal-danger-bg)] ring-[var(--signal-danger-ring)] hover:bg-[var(--signal-danger-bg)]'
                            : 'bg-[var(--signal-warning-bg)] ring-[var(--signal-warning-ring)] hover:bg-[var(--signal-warning-bg)]'
                        }`}
                      >
                        <Badge size="sm" tone={a.severity === 'critical' ? 'danger' : 'warning'} dot>
                          {a.severity === 'critical' ? 'קריטי' : 'אזהרה'}
                        </Badge>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{a.title}</span>
                          <span className="block truncate text-[11px] text-[var(--fg-tertiary)]">
                            {a.detail}
                          </span>
                        </span>
                        {a.minutesAgo !== null && (
                          <span className="num text-[11px] text-[var(--fg-tertiary)]">
                            לפני {a.minutesAgo} דק׳
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feed">
          <Card>
            <CardHeader>
              <CardTitle>יומן התראות</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <EmptyState icon={Bell} title="אין התראות ביומן" />
              ) : (
                <ul className="space-y-1.5">
                  {notifications.map((n) => (
                    <li
                      key={String(n.id)}
                      className={`rounded-[var(--radius-control)] p-3 ${
                        n.read_at ? 'bg-[var(--bg-hover)]' : 'bg-[var(--signal-info-bg)] ring-1 ring-inset ring-[var(--signal-info-ring)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Badge
                            size="sm"
                            tone={labels.notificationSeverity.tone(
                              String(n.severity) as Parameters<
                                typeof labels.notificationSeverity.tone
                              >[0],
                            )}
                            dot
                          >
                            {labels.notificationSeverity.label(
                              String(n.severity) as Parameters<
                                typeof labels.notificationSeverity.label
                              >[0],
                            )}
                          </Badge>
                          <span className="text-[13px] font-medium">{String(n.title)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {n.delivery_provider === 'mock' && (
                            <Badge size="sm" tone="warning">
                              לא נשלח — Mock
                            </Badge>
                          )}
                          <span className="num text-[11px] text-[var(--fg-tertiary)]">
                            {formatRelative(String(n.created_at))}
                          </span>
                        </span>
                      </div>
                      {n.body ? (
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                          {String(n.body)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                        {str(n.rule_name) ?? 'ידני'}
                        {n.club_name ? ` · ${String(n.club_name)}` : ''} ·{' '}
                        {formatDateTime(String(n.created_at))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-4" />
                כללי אוטומציה
              </CardTitle>
              <CardDescription>
                שינוי הרף בהגדרות העסקיות משנה מיד את התנהגות הכלל — אין מספרים קבועים בקוד
                הכללים.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">כלל</th>
                    <th className="py-2 text-center font-semibold">חומרה</th>
                    <th className="py-2 text-start font-semibold">תנאי הפעלה</th>
                    <th className="py-2 text-start font-semibold">נמענים</th>
                    <th className="py-2 text-end font-semibold">Cooldown</th>
                    <th className="py-2 text-center font-semibold">מצב</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={String(r.id)} className="border-b border-[var(--border-subtle)] align-top last:border-0">
                      <td className="py-2.5">
                        <span className="font-medium">{String(r.name_he)}</span>
                        {r.description ? (
                          <span className="block max-w-sm text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                            {String(r.description)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          size="sm"
                          tone={labels.notificationSeverity.tone(
                            String(r.severity) as Parameters<
                              typeof labels.notificationSeverity.tone
                            >[0],
                          )}
                        >
                          {labels.notificationSeverity.label(
                            String(r.severity) as Parameters<
                              typeof labels.notificationSeverity.label
                            >[0],
                          )}
                        </Badge>
                      </td>
                      <td className="mono py-2.5 text-[10px] text-[var(--fg-tertiary)]">
                        {JSON.stringify(r.condition)}
                      </td>
                      <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                        {((r.target_role_keys as string[]) ?? []).join(', ') || '—'}
                      </td>
                      <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                        {num(r.cooldown_minutes)} דק׳
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge size="sm" tone={r.is_active ? 'positive' : 'muted'}>
                          {r.is_active ? 'פעיל' : 'כבוי'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
