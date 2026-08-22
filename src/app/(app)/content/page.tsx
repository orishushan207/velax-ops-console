import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { BookOpen, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';

export const metadata: Metadata = { title: 'תוכן ותוכניות אימון' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function ContentPage() {
  await requirePermission('content.view');

  const [programRows, drillRows, homeworkRows] = await Promise.all([
    db.execute(sql`
      SELECT p.id, p.name_he, p.slug, pv.id AS version_id, pv.version_number, pv.status,
             pv.level, pv.training_goal, pv.player_count, pv.duration_minutes,
             pv.is_certified, pv.usage_count, pv.completion_rate, pv.avg_rating,
             pv.published_at, co.display_name AS coach_name,
             jsonb_array_length(COALESCE(pv.drill_version_ids, '[]'::jsonb)) AS drill_count
      FROM programs p
      LEFT JOIN program_versions pv ON pv.program_id = p.id
      LEFT JOIN coaches co ON co.id = p.created_by_coach_id
      WHERE p.deleted_at IS NULL
      ORDER BY pv.status, p.name_he, pv.version_number DESC
    `),
    db.execute(sql`
      SELECT d.id, d.name_he, d.slug, d.drill_type, dv.id AS version_id, dv.version_number,
             dv.status, dv.level, dv.training_goal, dv.player_count, dv.duration_minutes,
             dv.shot_count, dv.speed_kmh, dv.height_level, dv.spin_level, dv.depth_level,
             dv.angle_degrees, dv.frequency_per_minute, dv.sequence, dv.usage_count,
             dv.completion_rate, dv.avg_rating, co.display_name AS coach_name
      FROM drills d
      LEFT JOIN drill_versions dv ON dv.drill_id = d.id
      LEFT JOIN coaches co ON co.id = d.created_by_coach_id
      WHERE d.deleted_at IS NULL
      ORDER BY dv.level, d.name_he
    `),
    db.execute(sql`
      SELECT h.*, u.full_name AS user_name, co.display_name AS coach_name
      FROM homework_assignments h
      JOIN users u ON u.id = h.user_id
      JOIN coaches co ON co.id = h.coach_id
      WHERE h.deleted_at IS NULL ORDER BY h.created_at DESC LIMIT 30
    `),
  ]);

  const programs = programRows.rows as Record<string, unknown>[];
  const drills = drillRows.rows as Record<string, unknown>[];
  const homework = homeworkRows.rows as Record<string, unknown>[];

  const published = programs.filter((p) => p.status === 'published').length;
  const inReview = programs.filter((p) => p.status === 'review').length;
  const totalUsage = [...programs, ...drills].reduce((s, x) => s + num(x.usage_count), 0);
  const certified = programs.filter((p) => p.is_certified).length;

  return (
    <>
      <PageHeader
        title="תוכן ותוכניות אימון"
        description="ספריית התוכן של VELA-X Academy — תרגילים, תוכניות ושיעורי בית, עם ניהול גרסאות."
        meta={
          inReview > 0 ? (
            <Badge tone="warning" dot>
              {inReview} ממתינות לאישור תוכן
            </Badge>
          ) : undefined
        }
      />

      <KpiGrid columns={5}>
        <KpiCard label="תוכניות אימון" value={formatNumber(programs.length)} />
        <KpiCard label="תרגילים" value={formatNumber(drills.length)} />
        <KpiCard label="פורסמו" value={formatNumber(published)} accent />
        <KpiCard
          label="Certified by VELA-X"
          value={formatNumber(certified)}
          hint="תוכן שעבר בדיקת איכות ואושר לשימוש ברשת."
        />
        <KpiCard label="שימושים מצטברים" value={formatNumber(totalUsage)} />
      </KpiGrid>

      <Callout tone="info" icon={Layers} title="ניהול גרסאות" className="mt-4">
        שינוי בתוכנית שפורסמה יוצר גרסה חדשה ואינו משנה היסטוריית Sessions ישנים. סשן מצביע על
        גרסת התוכנית שרצה בפועל, כך שדוח ביצועים היסטורי נשאר נכון גם אחרי שהתוכנית עודכנה.
      </Callout>

      <Callout tone="warning" className="mt-3">
        <strong className="text-[var(--fg-primary)]">כלל מוצרי מחייב:</strong> מספר שעות, מספר
        כדורים ומספר אימונים הם מדדי פעילות והתמדה בלבד. אסור להציג אותם — בשום מסך, דוח או
        חומר שיווקי — כהוכחה לשיפור מקצועי של השחקן.
      </Callout>

      <Tabs defaultValue="programs" className="mt-5">
        <TabsList>
          <TabsTrigger value="programs">תוכניות ({programs.length})</TabsTrigger>
          <TabsTrigger value="drills">תרגילים ({drills.length})</TabsTrigger>
          <TabsTrigger value="homework">שיעורי בית ({homework.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="programs">
          <Card>
            <CardHeader>
              <CardTitle>תוכניות אימון</CardTitle>
              <CardDescription>
                כל תוכנית מוגבלת לשחקן אחד או שניים — אותה מגבלה שנאכפת ברמת ה־Session.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {programs.length === 0 ? (
                <EmptyState icon={BookOpen} title="אין תוכניות" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">תוכנית</th>
                      <th className="py-2 text-center font-semibold">גרסה</th>
                      <th className="py-2 text-start font-semibold">רמה</th>
                      <th className="py-2 text-start font-semibold">מטרה</th>
                      <th className="py-2 text-end font-semibold">שחקנים</th>
                      <th className="py-2 text-end font-semibold">משך</th>
                      <th className="py-2 text-end font-semibold">תרגילים</th>
                      <th className="py-2 text-end font-semibold">שימושים</th>
                      <th className="py-2 text-end font-semibold">השלמה</th>
                      <th className="py-2 text-end font-semibold">דירוג</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programs.map((p) => (
                      <tr key={String(p.version_id ?? p.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">
                          <span className="font-medium">{String(p.name_he)}</span>
                          {p.is_certified ? (
                            <Badge size="sm" tone="positive" className="ms-1.5">
                              Certified
                            </Badge>
                          ) : null}
                          {p.coach_name ? (
                            <span className="block text-[10px] text-[var(--fg-tertiary)]">
                              {String(p.coach_name)}
                            </span>
                          ) : null}
                        </td>
                        <td className="num py-2.5 text-center text-[var(--fg-secondary)]">
                          v{num(p.version_number)}
                        </td>
                        <td className="py-2.5">
                          {p.level ? (
                            <Badge
                              size="sm"
                              tone={labels.playerLevel.tone(
                                String(p.level) as Parameters<typeof labels.playerLevel.tone>[0],
                              )}
                            >
                              {labels.playerLevel.label(
                                String(p.level) as Parameters<typeof labels.playerLevel.label>[0],
                              )}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(p.training_goal) ?? '—'}
                        </td>
                        <td className="num py-2.5 text-end">{num(p.player_count)}</td>
                        <td className="num py-2.5 text-end">{num(p.duration_minutes)} דק׳</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(p.drill_count)}
                        </td>
                        <td className="num py-2.5 text-end">{formatNumber(num(p.usage_count))}</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {p.completion_rate === null ? '—' : formatPercent(num(p.completion_rate), 0)}
                        </td>
                        <td className="num py-2.5 text-end">
                          {p.avg_rating === null ? '—' : formatNumber(num(p.avg_rating), 1)}
                        </td>
                        <td className="py-2.5 text-center">
                          {p.status ? (
                            <Badge
                              size="sm"
                              tone={labels.contentStatus.tone(
                                String(p.status) as Parameters<typeof labels.contentStatus.tone>[0],
                              )}
                            >
                              {labels.contentStatus.label(
                                String(p.status) as Parameters<typeof labels.contentStatus.label>[0],
                              )}
                            </Badge>
                          ) : (
                            '—'
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

        <TabsContent value="drills">
          <Card>
            <CardHeader>
              <CardTitle>תרגילים</CardTitle>
              <CardDescription>
                פרמטרי המכות המלאים: מהירות, גובה, Spin, עומק, זווית ותדירות.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {drills.length === 0 ? (
                <EmptyState icon={BookOpen} title="אין תרגילים" />
              ) : (
                <table className="w-full min-w-[900px] text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">תרגיל</th>
                      <th className="py-2 text-start font-semibold">סוג</th>
                      <th className="py-2 text-start font-semibold">רמה</th>
                      <th className="py-2 text-end font-semibold">מכות</th>
                      <th className="py-2 text-end font-semibold">מהירות</th>
                      <th className="py-2 text-end font-semibold">גובה</th>
                      <th className="py-2 text-end font-semibold">Spin</th>
                      <th className="py-2 text-end font-semibold">עומק</th>
                      <th className="py-2 text-end font-semibold">זווית</th>
                      <th className="py-2 text-end font-semibold">תדירות</th>
                      <th className="py-2 text-center font-semibold">סדר</th>
                      <th className="py-2 text-end font-semibold">שימושים</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drills.map((d) => (
                      <tr key={String(d.version_id ?? d.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">
                          <span className="font-medium">{String(d.name_he)}</span>
                          {d.coach_name ? (
                            <span className="block text-[10px] text-[var(--fg-tertiary)]">
                              {String(d.coach_name)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {labels.drillType.label(
                            String(d.drill_type) as Parameters<typeof labels.drillType.label>[0],
                          )}
                        </td>
                        <td className="py-2.5">
                          {d.level ? (
                            <Badge
                              size="sm"
                              tone={labels.playerLevel.tone(
                                String(d.level) as Parameters<typeof labels.playerLevel.tone>[0],
                              )}
                            >
                              {String(d.level)}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="num py-2.5 text-end">{num(d.shot_count)}</td>
                        <td className="num py-2.5 text-end">{num(d.speed_kmh)} קמ״ש</td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(d.height_level)}
                        </td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(d.spin_level)}
                        </td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(d.depth_level)}
                        </td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(d.angle_degrees)}°
                        </td>
                        <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                          {num(d.frequency_per_minute)}/דק׳
                        </td>
                        <td className="py-2.5 text-center text-[11px] text-[var(--fg-secondary)]">
                          {d.sequence === 'random' ? 'אקראי' : 'קבוע'}
                        </td>
                        <td className="num py-2.5 text-end">{formatNumber(num(d.usage_count))}</td>
                        <td className="py-2.5 text-center">
                          {d.status ? (
                            <Badge
                              size="sm"
                              tone={labels.contentStatus.tone(
                                String(d.status) as Parameters<typeof labels.contentStatus.tone>[0],
                              )}
                            >
                              {labels.contentStatus.label(
                                String(d.status) as Parameters<typeof labels.contentStatus.label>[0],
                              )}
                            </Badge>
                          ) : (
                            '—'
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

        <TabsContent value="homework">
          <Card>
            <CardHeader>
              <CardTitle>שיעורי בית</CardTitle>
              <CardDescription>תוכנית אישית שמאמן שולח למתאמן, עם יעד ותאריך.</CardDescription>
            </CardHeader>
            <CardContent>
              {homework.length === 0 ? (
                <EmptyState icon={BookOpen} title="לא הוקצו שיעורי בית" />
              ) : (
                <ul className="space-y-1.5">
                  {homework.map((h) => (
                    <li
                      key={String(h.id)}
                      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2 text-[12px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{String(h.title)}</span>
                      <span className="text-[var(--fg-secondary)]">{String(h.user_name)}</span>
                      <span className="text-[11px] text-[var(--fg-tertiary)]">
                        {String(h.coach_name)}
                      </span>
                      <span className="num">
                        {num(h.completed_sessions)}/{num(h.target_sessions)}
                      </span>
                      {h.due_on ? (
                        <span className="num text-[11px] text-[var(--fg-tertiary)]">
                          {formatDate(String(h.due_on))}
                        </span>
                      ) : null}
                      {h.completed_at ? (
                        <Badge size="sm" tone="positive">
                          הושלם
                        </Badge>
                      ) : (
                        <Badge size="sm" tone="warning">
                          בתהליך
                        </Badge>
                      )}
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
