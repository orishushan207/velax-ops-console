import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Monitor, ShieldAlert } from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { clubScopeSql } from '@/server/queries/sessions';

export const metadata: Metadata = { title: 'מסכים וקמפיינים' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function ScreensPage() {
  const user = await requirePermission('screens.view');

  const [screenRows, campaignRows, mediaRows, playbackRows] = await Promise.all([
    db.execute(sql`
      SELECT s.*, c.name AS club_name, st.code AS station_code,
        (SELECT COUNT(*)::int FROM screen_playback_logs pl
          WHERE pl.screen_id = s.id AND pl.played_at >= now() - interval '7 days') AS plays_7d
      FROM screens s
      JOIN clubs c ON c.id = s.club_id
      LEFT JOIN stations st ON st.id = s.station_id
      WHERE s.deleted_at IS NULL AND ${clubScopeSql(user, 's.club_id')}
      ORDER BY c.name, s.name
    `),
    db.execute(sql`
      SELECT sc.*, u.full_name AS creator_name,
        jsonb_array_length(COALESCE(sc.playlist, '[]'::jsonb)) AS playlist_size,
        (SELECT COUNT(*)::int FROM screen_playback_logs pl WHERE pl.campaign_id = sc.id) AS play_count
      FROM screen_campaigns sc
      LEFT JOIN users u ON u.id = sc.created_by
      WHERE sc.deleted_at IS NULL ORDER BY sc.priority DESC, sc.starts_at DESC
    `),
    db.execute(sql`
      SELECT m.*, u.full_name AS uploader_name, mo.full_name AS moderator_name
      FROM media_assets m
      LEFT JOIN users u ON u.id = m.uploaded_by_user_id
      LEFT JOIN users mo ON mo.id = m.moderated_by
      WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 40
    `),
    db.execute(sql`
      SELECT pl.*, s.name AS screen_name, sc.name_he AS campaign_name
      FROM screen_playback_logs pl
      JOIN screens s ON s.id = pl.screen_id
      LEFT JOIN screen_campaigns sc ON sc.id = pl.campaign_id
      ORDER BY pl.played_at DESC LIMIT 30
    `),
  ]);

  const screens = screenRows.rows as Record<string, unknown>[];
  const campaigns = campaignRows.rows as Record<string, unknown>[];
  const media = mediaRows.rows as Record<string, unknown>[];
  const playbacks = playbackRows.rows as Record<string, unknown>[];

  const online = screens.filter((s) => s.status === 'online').length;
  const offline = screens.filter((s) => s.status === 'offline').length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const pendingModeration = media.filter((m) => m.moderation_status === 'pending').length;
  const ugcCount = media.filter((m) => m.is_user_generated).length;
  const expiringRights = media.filter(
    (m) => m.rights_expire_at && new Date(String(m.rights_expire_at)) < new Date(Date.now() + 30 * 86400000),
  ).length;

  return (
    <>
      <PageHeader
        title="מסכים וקמפיינים"
        description="Display CMS — המסך בעמדה הוא ערוץ הרכישה הזול והמדויק ביותר לפי התוכנית העסקית."
        meta={
          <>
            {offline > 0 && (
              <Badge tone="danger" dot>
                {offline} מסכים לא פעילים
              </Badge>
            )}
            {pendingModeration > 0 && (
              <Badge tone="warning" dot>
                {pendingModeration} ממתינים למודרציה
              </Badge>
            )}
          </>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard label="מסכים ברשת" value={formatNumber(screens.length)} />
        <KpiCard label="פעילים" value={`${online} / ${screens.length}`} accent />
        <KpiCard label="לא פעילים" value={formatNumber(offline)} higherIsBetter={false} />
        <KpiCard label="קמפיינים פעילים" value={formatNumber(activeCampaigns)} />
        <KpiCard label="תוכן משתמשים" value={formatNumber(ugcCount)} />
        <KpiCard
          label="הרשאות שיפוגו"
          value={formatNumber(expiringRights)}
          higherIsBetter={false}
          hint="תוכן שזכות השימוש בו פגה בתוך 30 יום ויש להסירו או לחדשה."
        />
      </KpiGrid>

      <Callout tone="warning" icon={ShieldAlert} title="תוכן משתמשים דורש הסכמה מפורשת" className="mt-4">
        תוכן שנוצר על ידי משתמש אינו מוצג לפני Moderation, הסכמה מתועדת ותאריך תפוגת הרשאה.
        אין הצגה אוטומטית של תוכן Instagram/TikTok — הדבר מחייב הסכמה, זכות שימוש ואישור.
      </Callout>

      <Tabs defaultValue="screens" className="mt-5">
        <TabsList>
          <TabsTrigger value="screens">מסכים ({screens.length})</TabsTrigger>
          <TabsTrigger value="campaigns">קמפיינים ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="media">מדיה ומודרציה ({media.length})</TabsTrigger>
          <TabsTrigger value="proof">Proof of Play</TabsTrigger>
        </TabsList>

        <TabsContent value="screens">
          <Card>
            <CardHeader>
              <CardTitle>מסכים</CardTitle>
              <CardDescription>
                מסך לא פעיל הוא כשל בערוץ רכישה, ולכן הוא גם רכיב בציון בריאות המועדון ותנאי סף
                ב־Earn-Back.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {screens.length === 0 ? (
                <EmptyState icon={Monitor} title="אין מסכים רשומים" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מסך</th>
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">עמדה</th>
                      <th className="py-2 text-start font-semibold">שעות פעילות</th>
                      <th className="py-2 text-end font-semibold">הצגות 7 ימים</th>
                      <th className="py-2 text-start font-semibold">Heartbeat אחרון</th>
                      <th className="py-2 text-center font-semibold">מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((s) => (
                      <tr key={String(s.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5 font-medium">{String(s.name)}</td>
                        <td className="py-2.5">
                          <Link href={`/clubs/${s.club_id}`} className="hover:text-[var(--accent)]">
                            {String(s.club_name)}
                          </Link>
                        </td>
                        <td className="py-2.5">
                          {s.station_id ? (
                            <Link
                              href={`/stations/${s.station_id}`}
                              className="mono text-[11px] hover:text-[var(--accent)]"
                            >
                              {String(s.station_code)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {String(s.active_from).slice(0, 5)}–{String(s.active_until).slice(0, 5)}
                        </td>
                        <td className="num py-2.5 text-end">{num(s.plays_7d)}</td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {s.last_heartbeat_at ? formatRelative(String(s.last_heartbeat_at)) : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot
                              tone={
                                s.status === 'online'
                                  ? 'positive'
                                  : s.status === 'offline'
                                    ? 'danger'
                                    : 'muted'
                              }
                            />
                            <span className="text-[11px]">
                              {labels.screenStatus.label(
                                String(s.status) as Parameters<typeof labels.screenStatus.label>[0],
                              )}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <div className="grid gap-4 lg:grid-cols-2">
            {campaigns.length === 0 ? (
              <Card>
                <EmptyState icon={Monitor} title="אין קמפיינים" />
              </Card>
            ) : (
              campaigns.map((c) => (
                <Card key={String(c.id)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {String(c.name_he)}
                      <Badge
                        size="sm"
                        tone={c.status === 'active' ? 'positive' : c.status === 'draft' ? 'muted' : 'info'}
                      >
                        {String(c.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-1.5 text-[12px]">
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">CTA</dt>
                        <dd className="font-medium">{str(c.cta_text) ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">יעד QR</dt>
                        <dd className="mono text-[10px]">{str(c.qr_target) ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">פריטים ב־Playlist</dt>
                        <dd className="num">{num(c.playlist_size)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">מיקוד</dt>
                        <dd>
                          {((c.target_club_ids as string[]) ?? []).length === 0
                            ? 'כל הרשת'
                            : `${((c.target_club_ids as string[]) ?? []).length} מועדונים`}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">תקופה</dt>
                        <dd className="num text-[11px]">
                          {c.starts_at ? formatDate(String(c.starts_at)) : '—'}
                          {c.ends_at ? ` — ${formatDate(String(c.ends_at))}` : ''}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">שעות הצגה</dt>
                        <dd className="num text-[11px]">
                          {c.daily_from ? String(c.daily_from).slice(0, 5) : '—'}–
                          {c.daily_until ? String(c.daily_until).slice(0, 5) : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[var(--fg-secondary)]">הצגות מתועדות</dt>
                        <dd className="num">{num(c.play_count)}</dd>
                      </div>
                    </dl>
                    {num(c.playlist_size) === 0 && (
                      <Callout tone="warning" className="mt-3">
                        אין פריטי מדיה ב־Playlist. הקמפיין לא יציג דבר על המסך.
                      </Callout>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>מדיה ומודרציה</CardTitle>
              <CardDescription>
                תוכן משתמשים מוצג רק לאחר אישור, עם הסכמה מתועדת ותאריך תפוגת הרשאה.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {media.length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="אין פריטי מדיה"
                  description="העלאת מדיה דורשת חיבור לאחסון קבצים. במצב הנוכחי האחסון מקומי ולא הועלו קבצים."
                />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">שם</th>
                      <th className="py-2 text-start font-semibold">סוג</th>
                      <th className="py-2 text-center font-semibold">UGC</th>
                      <th className="py-2 text-start font-semibold">הועלה על ידי</th>
                      <th className="py-2 text-start font-semibold">תפוגת הרשאה</th>
                      <th className="py-2 text-center font-semibold">מודרציה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {media.map((m) => (
                      <tr key={String(m.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">{String(m.name_he)}</td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {String(m.media_type)}
                        </td>
                        <td className="py-2.5 text-center">
                          {m.is_user_generated ? (
                            <Badge size="sm" tone="warning">
                              כן
                            </Badge>
                          ) : (
                            <span className="text-[var(--fg-tertiary)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(m.uploader_name) ?? '—'}
                        </td>
                        <td className="num py-2.5 text-[11px]">
                          {m.rights_expire_at ? formatDate(String(m.rights_expire_at)) : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            size="sm"
                            tone={labels.moderationStatus.tone(
                              String(m.moderation_status) as Parameters<
                                typeof labels.moderationStatus.tone
                              >[0],
                            )}
                          >
                            {labels.moderationStatus.label(
                              String(m.moderation_status) as Parameters<
                                typeof labels.moderationStatus.label
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

        <TabsContent value="proof">
          <Card>
            <CardHeader>
              <CardTitle>Proof of Play</CardTitle>
              <CardDescription>
                הוכחה שהתוכן אכן הוצג על המסך — הבסיס לדיווח לשותפים מסחריים.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playbacks.length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="אין רשומות Proof of Play"
                  description="רשומות נוצרות כאשר המסך מדווח על הצגת תוכן. חיבור המסכים דורש נגן מדיה מחובר."
                />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מתי</th>
                      <th className="py-2 text-start font-semibold">מסך</th>
                      <th className="py-2 text-start font-semibold">קמפיין</th>
                      <th className="py-2 text-end font-semibold">משך</th>
                      <th className="py-2 text-center font-semibold">הושלם</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbacks.map((p) => (
                      <tr key={String(p.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="num py-2 text-[11px]">{formatRelative(String(p.played_at))}</td>
                        <td className="py-2">{String(p.screen_name)}</td>
                        <td className="py-2 text-[var(--fg-secondary)]">
                          {str(p.campaign_name) ?? '—'}
                        </td>
                        <td className="num py-2 text-end">{num(p.duration_seconds)} שנ׳</td>
                        <td className="py-2 text-center">
                          {p.completed ? (
                            <Badge size="sm" tone="positive">
                              כן
                            </Badge>
                          ) : (
                            <Badge size="sm" tone="warning">
                              לא
                            </Badge>
                          )}
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
