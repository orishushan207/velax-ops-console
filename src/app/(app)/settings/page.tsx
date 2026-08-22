import type { Metadata } from 'next';
import { AlertTriangle, Database, Info, Plug, Sliders } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shell/page-header';
import { formatDateTime } from '@/lib/format';
import * as labels from '@/lib/labels';
import { SETTING_CATEGORIES } from '@/lib/settings-catalog';
import { requireUser } from '@/server/auth/guard';
import { getIntegrationStatus } from '@/server/providers';
import {
  getSettingHistory,
  listAutomationRules,
  listMetricDefinitions,
  listSettings,
  listSlaPolicies,
} from '@/server/queries/settings';
import { SettingEditor, SettingHistoryButton } from './setting-editor';

export const metadata: Metadata = { title: 'הגדרות' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function formatValue(value: string | null, valueType: string, unit: string | null): string {
  if (value === null) return '—';
  if (valueType === 'boolean') return value === 'true' ? 'פעיל' : 'כבוי';
  if (valueType === 'percentage') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1)}%` : value;
  }
  if (valueType === 'currency') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? `${n.toLocaleString('he-IL')} ₪` : value;
  }
  return unit ? `${value} ${unit}` : value;
}

export default async function SettingsPage() {
  const user = await requireUser();
  const canEdit = user.permissions.has('finance.edit_assumptions');
  const canSeeSystem = user.permissions.has('system.manage_settings');

  const [settings, metrics, slaPolicies, automations] = await Promise.all([
    listSettings(),
    listMetricDefinitions(),
    listSlaPolicies(),
    listAutomationRules(),
  ]);

  // היסטוריה נטענת רק עבור הגדרות ששונו בפועל, כדי לא להעמיס
  const changedKeys = settings.filter((s) => s.versionCount > 1).map((s) => s.key);
  const histories = new Map<string, Awaited<ReturnType<typeof getSettingHistory>>>();
  for (const key of changedKeys) {
    histories.set(key, await getSettingHistory(key));
  }

  const disputed = settings.filter((s) => s.confidence === 'disputed');
  const assumed = settings.filter((s) => s.confidence === 'assumed');
  const pending = settings.filter((s) => s.pendingValue !== null);

  const byCategory = new Map<string, typeof settings>();
  for (const s of settings) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const integrations = getIntegrationStatus();

  return (
    <>
      <PageHeader
        title="הגדרות"
        description="כל הנחה עסקית במערכת יושבת כאן — לא בקוד. לכל שינוי יש תאריך תחולה, נימוק והיסטוריה."
        meta={
          <>
            <Badge tone="danger" dot>
              {disputed.length} סתירות בין מסמכים
            </Badge>
            <Badge tone="warning" dot>
              {assumed.length} הנחות שדורשות אימות
            </Badge>
            {pending.length > 0 && (
              <Badge tone="info" dot>
                {pending.length} שינויים ממתינים לתחולה
              </Badge>
            )}
          </>
        }
      />

      {!canEdit && (
        <Callout tone="info" icon={Info} className="mb-4">
          אין לך הרשאת עריכת הנחות עסקיות. המסך מוצג במצב קריאה בלבד.
        </Callout>
      )}

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">הנחות עסקיות ({settings.length})</TabsTrigger>
          <TabsTrigger value="conflicts">סתירות והנחות ({disputed.length + assumed.length})</TabsTrigger>
          <TabsTrigger value="metrics">מילון מדדים ({metrics.length})</TabsTrigger>
          <TabsTrigger value="sla">מדיניות SLA ({slaPolicies.length})</TabsTrigger>
          <TabsTrigger value="automations">אוטומציות ({automations.length})</TabsTrigger>
          <TabsTrigger value="integrations">אינטגרציות</TabsTrigger>
        </TabsList>

        {/* ═══ הנחות עסקיות ═══ */}
        <TabsContent value="business">
          <div className="space-y-4">
            {[...byCategory.entries()].map(([category, items]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sliders className="size-4" />
                    {SETTING_CATEGORIES[category as keyof typeof SETTING_CATEGORIES] ?? category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">הגדרה</th>
                        <th className="py-2 text-end font-semibold">ערך נוכחי</th>
                        <th className="py-2 text-center font-semibold">אמינות</th>
                        <th className="py-2 text-start font-semibold">מקור</th>
                        <th className="py-2 text-end font-semibold">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-[var(--border-subtle)] align-top last:border-0"
                        >
                          <td className="py-2.5">
                            <span className="font-medium">{s.nameHe}</span>
                            <span className="mono block text-[10px] text-[var(--fg-tertiary)]">
                              {s.key}
                            </span>
                            {s.description && (
                              <span className="mt-1 block max-w-md text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                                {s.description}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-end">
                            <span className="num font-medium">
                              {formatValue(s.currentValue, s.valueType, s.unit)}
                            </span>
                            {s.pendingValue && (
                              <span className="mt-0.5 block text-[10px] text-[var(--signal-info)]">
                                יעודכן ל־{formatValue(s.pendingValue, s.valueType, s.unit)} ב־
                                {s.pendingEffectiveFrom
                                  ? formatDateTime(s.pendingEffectiveFrom)
                                  : ''}
                              </span>
                            )}
                            {s.isScenarioScoped && (
                              <Badge size="sm" tone="info" className="mt-1">
                                תלוי תרחיש
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            <Badge
                              size="sm"
                              tone={labels.settingConfidence.tone(
                                s.confidence as Parameters<
                                  typeof labels.settingConfidence.tone
                                >[0],
                              )}
                            >
                              {labels.settingConfidence.label(
                                s.confidence as Parameters<
                                  typeof labels.settingConfidence.label
                                >[0],
                              )}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            <span className="text-[11px] leading-relaxed text-[var(--fg-tertiary)]">
                              {s.sourceReference ?? '—'}
                            </span>
                            {s.conflictingValue && (
                              <span className="mt-1 block text-[11px] leading-relaxed text-[var(--signal-danger)]">
                                ⚠ ערך חלופי: {s.conflictingValue}
                                <br />
                                {s.conflictingSource}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {s.versionCount > 1 && histories.has(s.key) && (
                                <SettingHistoryButton
                                  nameHe={s.nameHe}
                                  history={(histories.get(s.key) ?? []).map((h) => ({
                                    value: String(h.value),
                                    previousValue: str(h.previous_value),
                                    effectiveFrom: String(h.effective_from),
                                    effectiveUntil: str(h.effective_until),
                                    changedByName: str(h.changed_by_name),
                                    changeReason: str(h.change_reason),
                                    scenario: str(h.scenario),
                                  }))}
                                />
                              )}
                              <SettingEditor
                                settingKey={s.key}
                                nameHe={s.nameHe}
                                currentValue={s.currentValue}
                                valueType={s.valueType}
                                unit={s.unit}
                                isScenarioScoped={s.isScenarioScoped}
                                minValue={s.minValue}
                                maxValue={s.maxValue}
                                canEdit={canEdit}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ סתירות ═══ */}
        <TabsContent value="conflicts">
          <Callout tone="danger" icon={AlertTriangle} title="סתירות בין מסמכי המקור" className="mb-4">
            בכל מקרה שבו התוכנית העסקית והמודל הפיננסי אומרים דברים שונים, שני הערכים מתועדים
            כאן ואף אחד מהם אינו קבוע בקוד. הערך הפעיל נבחר במפורש וניתן לשינוי בכל רגע.
          </Callout>

          <Card>
            <CardHeader>
              <CardTitle className="text-[var(--signal-danger)]">סתירות מתועדות ({disputed.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {disputed.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-[var(--radius-card)] bg-[var(--signal-danger-bg)] p-4 ring-1 ring-inset ring-[var(--signal-danger-ring)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-medium">{s.nameHe}</p>
                        <p className="mono text-[10px] text-[var(--fg-tertiary)]">{s.key}</p>
                      </div>
                      <SettingEditor
                        settingKey={s.key}
                        nameHe={s.nameHe}
                        currentValue={s.currentValue}
                        valueType={s.valueType}
                        unit={s.unit}
                        isScenarioScoped={s.isScenarioScoped}
                        minValue={s.minValue}
                        maxValue={s.maxValue}
                        canEdit={canEdit}
                      />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[var(--radius-control)] bg-[var(--signal-positive-bg)] p-3 ring-1 ring-inset ring-[var(--signal-positive-ring)]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--signal-positive)]">
                          הערך הפעיל
                        </p>
                        <p className="num mt-1 text-lg font-semibold">
                          {formatValue(s.currentValue, s.valueType, s.unit)}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                          {s.sourceReference}
                        </p>
                      </div>
                      <div className="rounded-[var(--radius-control)] bg-white/[0.03] p-3 ring-1 ring-inset ring-[var(--border-subtle)]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                          הערך החלופי
                        </p>
                        <p className="num mt-1 text-lg font-semibold text-[var(--fg-tertiary)]">
                          {s.conflictingValue}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                          {s.conflictingSource}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-[var(--signal-warning)]">
                הנחות שאינן מגובות במסמכים ({assumed.length})
              </CardTitle>
              <CardDescription>
                ערכים שנקבעו על ידי המערכת מכיוון שאף מסמך מקור לא נקב בהם מספר. כל אחד מהם
                דורש אימות בפיילוט או החלטה עסקית.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">הגדרה</th>
                    <th className="py-2 text-end font-semibold">ערך</th>
                    <th className="py-2 text-start font-semibold">הבסיס להנחה</th>
                  </tr>
                </thead>
                <tbody>
                  {assumed.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2">{s.nameHe}</td>
                      <td className="num py-2 text-end">
                        {formatValue(s.currentValue, s.valueType, s.unit)}
                      </td>
                      <td className="py-2 text-[11px] text-[var(--fg-secondary)]">
                        {s.sourceReference ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ מדדים ═══ */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4" />
                Metric Dictionary
              </CardTitle>
              <CardDescription>
                הגדרה אחידה לכל מדד במערכת. שני מסכים שמציגים &laquo;Uptime&raquo; מתכוונים
                בהכרח לאותו דבר, כי שניהם קוראים מכאן.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {metrics.map((m) => (
                  <li
                    key={String(m.id)}
                    className="rounded-[var(--radius-card)] bg-[var(--bg-hover)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{String(m.name_he)}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge size="sm" tone="muted">
                          <span className="mono text-[10px]">{String(m.key)}</span>
                        </Badge>
                        <Badge size="sm" tone="neutral">
                          v{num(m.version)}
                        </Badge>
                        <Badge size="sm" tone="info">
                          {String(m.update_frequency)}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                      {String(m.definition)}
                    </p>
                    <div className="mt-2 rounded-[var(--radius-control)] bg-black/25 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                        נוסחה
                      </p>
                      <p className="mono mt-1 text-[11px] leading-relaxed text-[var(--fg-primary)]">
                        {String(m.formula)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--fg-tertiary)]">
                      <span>מקור: {String(m.data_source)}</span>
                      <span>בעלים: {String(m.owner_role)}</span>
                      <span>בתוקף מ־{formatDateTime(String(m.effective_from))}</span>
                    </div>
                    {m.caution_he ? (
                      <p className="mt-2 rounded-[var(--radius-control)] bg-[var(--signal-warning-bg)] p-2 text-[11px] leading-relaxed text-[var(--signal-warning)]">
                        ⚠ {String(m.caution_he)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SLA ═══ */}
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>מדיניות SLA</CardTitle>
              <CardDescription>
                ערכי ה־SLA ניתנים לשינוי לפי הסכם ומועדון, כפי שדורשת התוכנית העסקית. הסכם
                מועדון מצביע על מדיניות, ולא על ערכים קבועים.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">מדיניות</th>
                    <th className="py-2 text-end font-semibold">תגובה קריטי</th>
                    <th className="py-2 text-end font-semibold">תגובה גבוה</th>
                    <th className="py-2 text-end font-semibold">תיקון קריטי</th>
                    <th className="py-2 text-end font-semibold">תיקון גבוה</th>
                    <th className="py-2 text-end font-semibold">יעד זמינות</th>
                    <th className="py-2 text-end font-semibold">הסכמים</th>
                  </tr>
                </thead>
                <tbody>
                  {slaPolicies.map((p) => (
                    <tr key={String(p.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2.5">
                        {String(p.name_he)}
                        {p.is_default ? (
                          <Badge size="sm" tone="positive" className="ms-2">
                            ברירת מחדל
                          </Badge>
                        ) : null}
                      </td>
                      <td className="num py-2.5 text-end">{num(p.response_hours_critical)} ש׳</td>
                      <td className="num py-2.5 text-end">{num(p.response_hours_high)} ש׳</td>
                      <td className="num py-2.5 text-end">{num(p.resolution_hours_critical)} ש׳</td>
                      <td className="num py-2.5 text-end">{num(p.resolution_hours_high)} ש׳</td>
                      <td className="num py-2.5 text-end">{num(p.uptime_target_pct)}%</td>
                      <td className="num py-2.5 text-end text-[var(--fg-secondary)]">
                        {num(p.contract_count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ אוטומציות ═══ */}
        <TabsContent value="automations">
          <Card>
            <CardHeader>
              <CardTitle>כללי אוטומציה</CardTitle>
              <CardDescription>
                תנאי ההפעלה מצביעים על הגדרות עסקיות ולא על מספרים קבועים — שינוי הרף בהגדרות
                משנה מיד את הכלל.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {automations.map((a) => (
                  <li
                    key={String(a.id)}
                    className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{String(a.name_he)}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge
                          size="sm"
                          tone={labels.notificationSeverity.tone(
                            String(a.severity) as Parameters<
                              typeof labels.notificationSeverity.tone
                            >[0],
                          )}
                        >
                          {labels.notificationSeverity.label(
                            String(a.severity) as Parameters<
                              typeof labels.notificationSeverity.label
                            >[0],
                          )}
                        </Badge>
                        <Badge size="sm" tone={a.is_active ? 'positive' : 'muted'}>
                          {a.is_active ? 'פעיל' : 'כבוי'}
                        </Badge>
                      </span>
                    </div>
                    {a.description ? (
                      <p className="mt-1 text-[12px] text-[var(--fg-secondary)]">
                        {String(a.description)}
                      </p>
                    ) : null}
                    <p className="mono mt-1.5 text-[10px] text-[var(--fg-tertiary)]">
                      {JSON.stringify(a.condition)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ אינטגרציות ═══ */}
        <TabsContent value="integrations">
          {canSeeSystem ? (
            <>
              <Callout tone="warning" icon={Plug} title="מצב האינטגרציות" className="mb-4">
                כל אינטגרציה שמסומנת כ־Mock אינה מבצעת פעולה חיצונית אמיתית. אין חיוב כרטיס
                אשראי, אין פקודה למכונה ואין שליחת הודעה. חיבור ספק אמיתי נעשה על ידי הזנת
                credentials במשתני הסביבה — ללא שינוי קוד.
              </Callout>

              <Card>
                <CardHeader>
                  <CardTitle>אינטגרציות חיצוניות</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                        <th className="py-2 text-start font-semibold">אינטגרציה</th>
                        <th className="py-2 text-start font-semibold">ספק פעיל</th>
                        <th className="py-2 text-center font-semibold">מצב</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.map((i) => (
                        <tr key={i.key} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-2.5">{i.nameHe}</td>
                          <td className="mono py-2.5 text-[11px] text-[var(--fg-secondary)]">
                            {i.provider}
                          </td>
                          <td className="py-2.5 text-center">
                            {i.isMock ? (
                              <Badge size="sm" tone="warning">
                                Mock — אינו פעיל
                              </Badge>
                            ) : (
                              <Badge size="sm" tone="positive">
                                מחובר
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Callout tone="info">אין לך הרשאה לצפות בהגדרות מערכת.</Callout>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
