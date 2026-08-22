import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { AlertTriangle, ClipboardCheck, Package, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import * as labels from '@/lib/labels';
import { requirePermission } from '@/server/auth/guard';
import { clubScopeSql } from '@/server/queries/sessions';

export const metadata: Metadata = { title: 'תחזוקה ומלאי' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function MaintenancePage() {
  const user = await requirePermission('maintenance.view');
  const canSeeInventory = user.permissions.has('inventory.view');

  const [taskRows, planRows, checklistRows, submissionRows, inventoryRows, movementRows, locationRows] =
    await Promise.all([
      db.execute(sql`
        SELECT mt.*, mp.name_he AS plan_name, mp.trigger, d.device_id AS device_label,
               st.code AS station_code, c.name AS club_name, u.full_name AS assignee_name
        FROM maintenance_tasks mt
        LEFT JOIN maintenance_plans mp ON mp.id = mt.plan_id
        LEFT JOIN devices d ON d.id = mt.device_id
        LEFT JOIN stations st ON st.id = mt.station_id
        LEFT JOIN clubs c ON c.id = mt.club_id
        LEFT JOIN users u ON u.id = mt.assignee_id
        WHERE mt.deleted_at IS NULL AND (mt.club_id IS NULL OR ${clubScopeSql(user, 'mt.club_id')})
        ORDER BY
          CASE mt.status WHEN 'overdue' THEN 0 WHEN 'due' THEN 1 WHEN 'in_progress' THEN 2
            WHEN 'scheduled' THEN 3 ELSE 4 END,
          mt.due_on
        LIMIT 100
      `),
      db.execute(sql`SELECT * FROM maintenance_plans WHERE deleted_at IS NULL ORDER BY name_he`),
      db.execute(sql`
        SELECT ch.*, (SELECT COUNT(*)::int FROM checklist_items ci WHERE ci.checklist_id = ch.id) AS item_count
        FROM checklists ch WHERE ch.deleted_at IS NULL ORDER BY ch.frequency, ch.name_he
      `),
      db.execute(sql`
        SELECT cs.*, ch.name_he AS checklist_name, c.name AS club_name, st.code AS station_code,
               u.full_name AS submitted_by_name
        FROM checklist_submissions cs
        JOIN checklists ch ON ch.id = cs.checklist_id
        JOIN clubs c ON c.id = cs.club_id
        LEFT JOIN stations st ON st.id = cs.station_id
        LEFT JOIN users u ON u.id = cs.submitted_by
        WHERE ${clubScopeSql(user, 'cs.club_id')}
        ORDER BY cs.for_date DESC LIMIT 60
      `),
      db.execute(sql`
        SELECT i.*, s.name AS supplier_name FROM inventory_items i
        LEFT JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.deleted_at IS NULL ORDER BY
          CASE WHEN i.quantity_on_hand < i.reorder_point THEN 0 ELSE 1 END, i.name_he
      `),
      db.execute(sql`
        SELECT m.*, i.name_he AS item_name, i.sku, fl.name AS from_name, tl.name AS to_name,
               u.full_name AS performer_name
        FROM inventory_movements m
        JOIN inventory_items i ON i.id = m.item_id
        LEFT JOIN inventory_locations fl ON fl.id = m.from_location_id
        LEFT JOIN inventory_locations tl ON tl.id = m.to_location_id
        LEFT JOIN users u ON u.id = m.performed_by
        ORDER BY m.occurred_at DESC LIMIT 40
      `),
      db.execute(sql`
        SELECT l.*, c.name AS club_name, u.full_name AS technician_name
        FROM inventory_locations l
        LEFT JOIN clubs c ON c.id = l.club_id
        LEFT JOIN users u ON u.id = l.technician_id
        WHERE l.deleted_at IS NULL ORDER BY l.location_type, l.name
      `),
    ]);

  const tasks = taskRows.rows as Record<string, unknown>[];
  const plans = planRows.rows as Record<string, unknown>[];
  const checklists = checklistRows.rows as Record<string, unknown>[];
  const submissions = submissionRows.rows as Record<string, unknown>[];
  const inventory = inventoryRows.rows as Record<string, unknown>[];
  const movements = movementRows.rows as Record<string, unknown>[];
  const locations = locationRows.rows as Record<string, unknown>[];

  const overdue = tasks.filter((t) => t.status === 'overdue').length;
  const due = tasks.filter((t) => t.status === 'due').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  const missedChecklists = submissions.filter((s) => s.status === 'missed').length;
  const withIssues = submissions.filter((s) => s.status === 'completed_with_issues').length;
  const checklistCompliance =
    submissions.length > 0
      ? submissions.filter((s) => String(s.status).startsWith('completed')).length /
        submissions.length
      : null;

  const belowReorder = inventory.filter(
    (i) => num(i.quantity_on_hand) < num(i.reorder_point),
  );
  const inventoryValue = inventory.reduce(
    (s, i) => s + num(i.quantity_on_hand) * num(i.unit_cost),
    0,
  );

  return (
    <>
      <PageHeader
        title="תחזוקה ומלאי"
        description="מנוע התחזוקה המונעת, Checklists של צוות המועדון, וניהול חלקי חילוף ומכונות חלופיות."
        meta={
          <>
            {overdue > 0 && (
              <Badge tone="danger" dot>
                {overdue} טיפולים באיחור
              </Badge>
            )}
            {belowReorder.length > 0 && (
              <Badge tone="warning" dot>
                {belowReorder.length} פריטים מתחת לרף
              </Badge>
            )}
          </>
        }
      />

      <KpiGrid columns={6}>
        <KpiCard label="טיפולים באיחור" value={formatNumber(overdue)} higherIsBetter={false} />
        <KpiCard label="הגיע מועדם" value={formatNumber(due)} higherIsBetter={false} />
        <KpiCard label="הושלמו" value={formatNumber(completed)} accent />
        <KpiCard
          label="עמידה ב־Checklist"
          value={checklistCompliance === null ? '—' : formatPercent(checklistCompliance, 0)}
          hint="אחוז ההגשות שבוצעו מתוך הנדרשות ב־30 הימים האחרונים."
        />
        <KpiCard
          label="Checklist שלא בוצעו"
          value={formatNumber(missedChecklists)}
          higherIsBetter={false}
        />
        {canSeeInventory && (
          <KpiCard label="שווי מלאי" value={formatCurrency(inventoryValue)} />
        )}
      </KpiGrid>

      {belowReorder.length > 0 && canSeeInventory && (
        <Callout tone="warning" icon={Package} title="פריטים מתחת לרף ההזמנה" className="mt-4">
          {belowReorder.map((i) => (
            <span key={String(i.id)} className="me-3 inline-block">
              {String(i.name_he)} — <span className="num">{num(i.quantity_on_hand)}</span> /{' '}
              <span className="num">{num(i.reorder_point)}</span>
            </span>
          ))}
        </Callout>
      )}

      <Tabs defaultValue="tasks" className="mt-5">
        <TabsList>
          <TabsTrigger value="tasks">משימות תחזוקה ({tasks.length})</TabsTrigger>
          <TabsTrigger value="plans">תוכניות תחזוקה ({plans.length})</TabsTrigger>
          <TabsTrigger value="checklists">Checklists ({submissions.length})</TabsTrigger>
          {canSeeInventory && <TabsTrigger value="inventory">מלאי ({inventory.length})</TabsTrigger>}
          {canSeeInventory && <TabsTrigger value="movements">תנועות מלאי</TabsTrigger>}
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>משימות תחזוקה</CardTitle>
              <CardDescription>
                טיפולים נוצרים אוטומטית לפי זמן, מונה שעות, מספר סשנים או מונה כדורים.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {tasks.length === 0 ? (
                <EmptyState icon={Wrench} title="אין משימות תחזוקה" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מזהה</th>
                      <th className="py-2 text-start font-semibold">תוכנית</th>
                      <th className="py-2 text-start font-semibold">מכונה</th>
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">יעד</th>
                      <th className="py-2 text-start font-semibold">אחראי</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={String(t.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="mono py-2.5 text-[11px]">{String(t.reference)}</td>
                        <td className="py-2.5">{str(t.plan_name) ?? '—'}</td>
                        <td className="py-2.5">
                          {t.device_id ? (
                            <Link
                              href={`/stations/devices/${t.device_id}`}
                              className="mono text-[11px] hover:text-[var(--accent)]"
                            >
                              {str(t.device_label)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 text-[var(--fg-secondary)]">
                          {str(t.club_name) ?? '—'}
                          {t.station_code ? (
                            <span className="mono ms-1.5 text-[10px] text-[var(--fg-tertiary)]">
                              {String(t.station_code)}
                            </span>
                          ) : null}
                        </td>
                        <td className="num py-2.5 text-[11px]">{formatDate(String(t.due_on))}</td>
                        <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(t.assignee_name) ?? 'לא הוקצה'}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            size="sm"
                            tone={labels.maintenanceTaskStatus.tone(
                              String(t.status) as Parameters<
                                typeof labels.maintenanceTaskStatus.tone
                              >[0],
                            )}
                          >
                            {labels.maintenanceTaskStatus.label(
                              String(t.status) as Parameters<
                                typeof labels.maintenanceTaskStatus.label
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

        <TabsContent value="plans">
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((p) => (
              <Card key={String(p.id)}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {String(p.name_he)}
                    <Badge size="sm" tone={p.is_active ? 'positive' : 'muted'}>
                      {p.is_active ? 'פעיל' : 'כבוי'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{str(p.description) ?? ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-secondary)]">טריגר</dt>
                      <dd>
                        {labels.maintenanceTrigger.label(
                          String(p.trigger) as Parameters<
                            typeof labels.maintenanceTrigger.label
                          >[0],
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-secondary)]">מרווח</dt>
                      <dd className="num">{formatNumber(num(p.interval_value), 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-secondary)]">התראה מוקדמת</dt>
                      <dd className="num">{formatNumber(num(p.warn_ahead_value), 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[var(--fg-secondary)]">משך משוער</dt>
                      <dd className="num">{num(p.estimated_minutes)} דק׳</dd>
                    </div>
                  </dl>
                  {p.instructions ? (
                    <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                      {String(p.instructions)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checklists">
          <div className="grid gap-4 lg:grid-cols-3">
            {checklists.map((ch) => (
              <Card key={String(ch.id)} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">{String(ch.name_he)}</span>
                  <Badge size="sm" tone="neutral">
                    {labels.checklistFrequency.label(
                      String(ch.frequency) as Parameters<
                        typeof labels.checklistFrequency.label
                      >[0],
                    )}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--fg-secondary)]">
                  {str(ch.description) ?? ''}
                </p>
                <p className="num mt-2 text-[11px] text-[var(--fg-tertiary)]">
                  {num(ch.item_count)} פריטים · {num(ch.estimated_seconds)} שניות
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4" />
                הגשות אחרונות
              </CardTitle>
              <CardDescription>
                ביצוע Checklist הוא תנאי סף ב־Earn-Back ורכיב בציון בריאות המועדון.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {submissions.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="אין הגשות" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">תאריך</th>
                      <th className="py-2 text-start font-semibold">Checklist</th>
                      <th className="py-2 text-start font-semibold">מועדון</th>
                      <th className="py-2 text-start font-semibold">עמדה</th>
                      <th className="py-2 text-end font-semibold">חריגות</th>
                      <th className="py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.slice(0, 30).map((s) => (
                      <tr key={String(s.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="num py-2 text-[11px]">{formatDate(String(s.for_date))}</td>
                        <td className="py-2">{String(s.checklist_name)}</td>
                        <td className="py-2 text-[var(--fg-secondary)]">{String(s.club_name)}</td>
                        <td className="mono py-2 text-[11px]">{str(s.station_code) ?? '—'}</td>
                        <td className="num py-2 text-end">
                          {num(s.issues_reported) > 0 ? (
                            <span className="text-[var(--signal-warning)]">{num(s.issues_reported)}</span>
                          ) : (
                            <span className="text-[var(--fg-tertiary)]">0</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <Badge
                            size="sm"
                            tone={labels.checklistSubmissionStatus.tone(
                              String(s.status) as Parameters<
                                typeof labels.checklistSubmissionStatus.tone
                              >[0],
                            )}
                          >
                            {labels.checklistSubmissionStatus.label(
                              String(s.status) as Parameters<
                                typeof labels.checklistSubmissionStatus.label
                              >[0],
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {withIssues > 0 && (
                <Callout tone="warning" icon={AlertTriangle} className="mt-4">
                  {withIssues} הגשות סומנו עם חריגות. חריגה בפריט חוסם מחייבת בדיקה לפני
                  שהעמדה חוזרת לשימוש.
                </Callout>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeInventory && (
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>מלאי חלקים וציוד</CardTitle>
                <CardDescription>
                  כל שינוי כמות עובר דרך תנועת מלאי — אין עדכון ידני של כמות במלאי.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">SKU</th>
                      <th className="py-2 text-start font-semibold">פריט</th>
                      <th className="py-2 text-start font-semibold">קטגוריה</th>
                      <th className="py-2 text-end font-semibold">במלאי</th>
                      <th className="py-2 text-end font-semibold">רף הזמנה</th>
                      <th className="py-2 text-center font-semibold">מצב</th>
                      <th className="py-2 text-end font-semibold">עלות יחידה</th>
                      <th className="py-2 text-end font-semibold">שווי</th>
                      <th className="py-2 text-start font-semibold">ספק</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((i) => {
                      const qty = num(i.quantity_on_hand);
                      const reorder = num(i.reorder_point);
                      const low = qty < reorder;
                      return (
                        <tr key={String(i.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="mono py-2.5 text-[11px]">{String(i.sku)}</td>
                          <td className="py-2.5">{String(i.name_he)}</td>
                          <td className="py-2.5 text-[var(--fg-secondary)]">
                            {labels.inventoryCategory.label(
                              String(i.category) as Parameters<
                                typeof labels.inventoryCategory.label
                              >[0],
                            )}
                          </td>
                          <td className={`num py-2.5 text-end ${low ? 'text-[var(--signal-danger)]' : ''}`}>{qty}</td>
                          <td className="num py-2.5 text-end text-[var(--fg-secondary)]">{reorder}</td>
                          <td className="py-2.5">
                            <div className="flex items-center justify-center gap-2">
                              <Progress
                                value={reorder > 0 ? Math.min(100, (qty / (reorder * 2)) * 100) : 100}
                                tone={low ? 'danger' : 'accent'}
                                className="w-14"
                              />
                            </div>
                          </td>
                          <td className="num py-2.5 text-end">{formatCurrency(num(i.unit_cost))}</td>
                          <td className="num py-2.5 text-end font-medium">
                            {formatCurrency(qty * num(i.unit_cost))}
                          </td>
                          <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                            {str(i.supplier_name) ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>מיקומי מלאי</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {locations.map((l) => (
                    <li
                      key={String(l.id)}
                      className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3 text-[12px]"
                    >
                      <p className="font-medium">{String(l.name)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--fg-tertiary)]">
                        {String(l.location_type)}
                        {l.technician_name ? ` · ${String(l.technician_name)}` : ''}
                        {l.club_name ? ` · ${String(l.club_name)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canSeeInventory && (
          <TabsContent value="movements">
            <Card>
              <CardHeader>
                <CardTitle>תנועות מלאי אחרונות</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">מתי</th>
                      <th className="py-2 text-start font-semibold">פריט</th>
                      <th className="py-2 text-start font-semibold">סוג תנועה</th>
                      <th className="py-2 text-end font-semibold">כמות</th>
                      <th className="py-2 text-start font-semibold">מ־</th>
                      <th className="py-2 text-start font-semibold">אל</th>
                      <th className="py-2 text-start font-semibold">בוצע על ידי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={String(m.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="num py-2 text-[11px] text-[var(--fg-tertiary)]">
                          {formatDate(String(m.occurred_at))}
                        </td>
                        <td className="py-2">
                          <span className="mono text-[10px] text-[var(--fg-tertiary)]">
                            {String(m.sku)}
                          </span>{' '}
                          {String(m.item_name)}
                        </td>
                        <td className="py-2">
                          <Badge
                            size="sm"
                            tone={labels.inventoryMovementType.tone(
                              String(m.movement_type) as Parameters<
                                typeof labels.inventoryMovementType.tone
                              >[0],
                            )}
                          >
                            {labels.inventoryMovementType.label(
                              String(m.movement_type) as Parameters<
                                typeof labels.inventoryMovementType.label
                              >[0],
                            )}
                          </Badge>
                        </td>
                        <td
                          className={`num py-2 text-end ${num(m.quantity) < 0 ? 'text-[var(--signal-danger)]' : 'text-[var(--signal-positive)]'}`}
                        >
                          {num(m.quantity) > 0 ? '+' : ''}
                          {num(m.quantity)}
                        </td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(m.from_name) ?? '—'}
                        </td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(m.to_name) ?? '—'}
                        </td>
                        <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                          {str(m.performer_name) ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
