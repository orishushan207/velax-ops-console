import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { KeyRound, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard, KpiGrid } from '@/components/data/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/db/client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import * as labels from '@/lib/labels';
import { PERMISSION_CATEGORIES, PERMISSIONS, ROLES } from '@/lib/permissions';
import { requirePermission } from '@/server/auth/guard';

export const metadata: Metadata = { title: 'משתמשים והרשאות' };

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export default async function UsersPage() {
  await requirePermission('system.manage_users');

  const [staffRows, roleRows, sessionRows] = await Promise.all([
    db.execute(sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.mfa_enabled, u.last_login_at,
             sp.job_title, sp.department, sp.is_field_technician,
             ARRAY(
               SELECT r.name_he FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id ORDER BY r.name_he
             ) AS role_names,
             ARRAY(
               SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id
             ) AS role_keys,
             (SELECT COUNT(*)::int FROM user_club_scopes ucs WHERE ucs.user_id = u.id) AS club_scope_count,
             ARRAY(
               SELECT c.name FROM user_club_scopes ucs JOIN clubs c ON c.id = ucs.club_id
               WHERE ucs.user_id = u.id ORDER BY c.name
             ) AS club_names
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.is_staff = true AND u.deleted_at IS NULL
      ORDER BY u.full_name
    `),
    db.execute(sql`
      SELECT r.*, 
        (SELECT COUNT(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
        (SELECT COUNT(*)::int FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
      FROM roles r ORDER BY r.name_he
    `),
    db.execute(sql`
      SELECT s.*, u.full_name FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > now()
      ORDER BY s.created_at DESC LIMIT 30
    `),
  ]);

  const staff = staffRows.rows as Record<string, unknown>[];
  const roles = roleRows.rows as Record<string, unknown>[];
  const sessions = sessionRows.rows as Record<string, unknown>[];

  const activeStaff = staff.filter((s) => s.status === 'active').length;
  const mfaEnabled = staff.filter((s) => s.mfa_enabled).length;
  const scopedUsers = staff.filter((s) => num(s.club_scope_count) > 0).length;

  const sensitivePermissions = PERMISSIONS.filter(
    (p) => 'sensitive' in p && p.sensitive === true,
  ).length;

  return (
    <>
      <PageHeader
        title="משתמשי מערכת והרשאות"
        description="הרשאות מוגדרות ברמת פעולה ולא ברמת מסך — כך אפשר לתת גישת צפייה בכספים בלי גישת ביצוע זיכוי."
      />

      <KpiGrid columns={6}>
        <KpiCard label="משתמשי מערכת" value={formatNumber(staff.length)} />
        <KpiCard label="פעילים" value={formatNumber(activeStaff)} accent />
        <KpiCard
          label="עם MFA"
          value={`${mfaEnabled} / ${staff.length}`}
          hint="MFA נדרש למשתמשים בעלי גישה כספית או ניהולית."
        />
        <KpiCard
          label="מוגבלי מועדון"
          value={formatNumber(scopedUsers)}
          hint="משתמשים שרואים רק את המועדונים שהוקצו להם."
        />
        <KpiCard label="תפקידים" value={formatNumber(roles.length)} />
        <KpiCard
          label="הרשאות רגישות"
          value={`${sensitivePermissions} / ${PERMISSIONS.length}`}
          hint="פעולה רגישה מחייבת סיבה חופשית ורישום מפורט ב־Audit Log."
        />
      </KpiGrid>

      <Tabs defaultValue="users" className="mt-5">
        <TabsList>
          <TabsTrigger value="users">משתמשים ({staff.length})</TabsTrigger>
          <TabsTrigger value="roles">תפקידים ({roles.length})</TabsTrigger>
          <TabsTrigger value="matrix">מטריצת הרשאות</TabsTrigger>
          <TabsTrigger value="sessions">מפגשים פעילים ({sessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>משתמשי המערכת</CardTitle>
              <CardDescription>
                משתמש עם תפקיד מוגבל־מועדון רואה אך ורק את המועדונים שהוקצו לו. אם לא הוקצה לו
                מועדון — הוא לא רואה דבר, ולא &laquo;את הכל&raquo;.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                    <th className="py-2 text-start font-semibold">שם</th>
                    <th className="py-2 text-start font-semibold">אימייל</th>
                    <th className="py-2 text-start font-semibold">תפקיד במערכת</th>
                    <th className="py-2 text-start font-semibold">תפקידים</th>
                    <th className="py-2 text-start font-semibold">היקף מועדונים</th>
                    <th className="py-2 text-center font-semibold">MFA</th>
                    <th className="py-2 text-start font-semibold">התחברות אחרונה</th>
                    <th className="py-2 text-center font-semibold">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((u) => (
                    <tr key={String(u.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2.5 font-medium">{String(u.full_name)}</td>
                      <td className="mono py-2.5 text-[11px] text-[var(--fg-secondary)]">
                        {str(u.email) ?? '—'}
                      </td>
                      <td className="py-2.5 text-[var(--fg-secondary)]">
                        {str(u.job_title) ?? '—'}
                        {u.is_field_technician ? (
                          <Badge size="sm" tone="info" className="ms-1.5">
                            טכנאי שדה
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {((u.role_names as string[]) ?? []).map((r) => (
                            <Badge key={r} size="sm" tone="neutral">
                              {r}
                            </Badge>
                          ))}
                        </span>
                      </td>
                      <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                        {num(u.club_scope_count) === 0 ? (
                          <span className="text-[var(--fg-tertiary)]">כל הרשת</span>
                        ) : (
                          ((u.club_names as string[]) ?? []).join(', ')
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {u.mfa_enabled ? (
                          <Badge size="sm" tone="positive">
                            פעיל
                          </Badge>
                        ) : (
                          <Badge size="sm" tone="muted">
                            כבוי
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-[11px] text-[var(--fg-secondary)]">
                        {u.last_login_at ? formatRelative(String(u.last_login_at)) : 'מעולם'}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          size="sm"
                          tone={labels.userStatus.tone(
                            String(u.status) as Parameters<typeof labels.userStatus.tone>[0],
                          )}
                        >
                          {labels.userStatus.label(
                            String(u.status) as Parameters<typeof labels.userStatus.label>[0],
                          )}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Callout tone="warning" className="mt-4">
            יצירת משתמש חדש, איפוס סיסמה ושינוי תפקידים דורשים חיבור לספק זהות (Identity
            Provider) או תהליך הזמנה באימייל. ראה{' '}
            <span className="mono">REMAINING_WORK.md</span> — הפונקציונליות הזו לא נבנתה בשלב זה
            במכוון, כדי לא ליצור מסלול יצירת חשבונות ללא אימות אימייל.
          </Callout>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid gap-4 lg:grid-cols-2">
            {roles.map((r) => {
              const roleDef = ROLES.find((rd) => rd.key === String(r.key));
              return (
                <Card key={String(r.id)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {String(r.name_he)}
                      <span className="flex items-center gap-1.5">
                        {r.is_club_scoped ? (
                          <Badge size="sm" tone="warning">
                            מוגבל מועדון
                          </Badge>
                        ) : null}
                        <Badge size="sm" tone="neutral">
                          {num(r.user_count)} משתמשים
                        </Badge>
                      </span>
                    </CardTitle>
                    <CardDescription>{str(r.description) ?? ''}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[12px] text-[var(--fg-secondary)]">
                      <span className="num font-medium">{num(r.permission_count)}</span> הרשאות
                      מתוך {PERMISSIONS.length}
                    </p>
                    {roleDef && roleDef.permissions !== '*' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12px] text-[var(--accent)]">
                          הצג רשימת הרשאות
                        </summary>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {roleDef.permissions.map((p) => {
                            const def = PERMISSIONS.find((pd) => pd.key === p);
                            return (
                              <li
                                key={p}
                                className="flex items-center gap-1.5 text-[11px] text-[var(--fg-secondary)]"
                              >
                                {def && 'sensitive' in def && def.sensitive ? (
                                  <KeyRound className="size-3 shrink-0 text-[var(--signal-warning)]" />
                                ) : (
                                  <span className="size-3 shrink-0" />
                                )}
                                {def?.nameHe ?? p}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                    {roleDef?.permissions === '*' && (
                      <Badge tone="danger" className="mt-2">
                        גישה מלאה לכל ההרשאות
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                מטריצת הרשאות
              </CardTitle>
              <CardDescription>
                {PERMISSIONS.length} הרשאות ברמת פעולה. הרשאות המסומנות בסמל מפתח הן פעולות
                רגישות המחייבות סיבה ורישום מפורט.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(Object.keys(PERMISSION_CATEGORIES) as (keyof typeof PERMISSION_CATEGORIES)[]).map(
                (category) => {
                  const perms = PERMISSIONS.filter((p) => p.category === category);
                  if (perms.length === 0) return null;
                  return (
                    <div key={category} className="mb-5 last:mb-0">
                      <h3 className="mb-2 text-[12px] font-semibold text-[var(--fg-secondary)]">
                        {PERMISSION_CATEGORIES[category]}
                      </h3>
                      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {perms.map((p) => (
                          <li
                            key={p.key}
                            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2"
                          >
                            {'sensitive' in p && p.sensitive ? (
                              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-[var(--signal-warning)]" />
                            ) : (
                              <span className="mt-0.5 size-3.5 shrink-0" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-[12px]">{p.nameHe}</span>
                              <span className="mono block text-[10px] text-[var(--fg-tertiary)]">
                                {p.key}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                },
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>מפגשי התחברות פעילים</CardTitle>
              <CardDescription>
                מפגש נשמר כ־hash בלבד. הטוקן עצמו אינו נשמר במסד ואינו ניתן לשחזור.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {sessions.length === 0 ? (
                <EmptyState icon={UsersIcon} title="אין מפגשים פעילים" />
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--fg-tertiary)]">
                      <th className="py-2 text-start font-semibold">משתמש</th>
                      <th className="py-2 text-start font-semibold">IP</th>
                      <th className="py-2 text-start font-semibold">התחיל</th>
                      <th className="py-2 text-start font-semibold">פג תוקף</th>
                      <th className="py-2 text-center font-semibold">התחזות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={String(s.id)} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5">{String(s.full_name)}</td>
                        <td className="mono py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {str(s.ip_address) ?? '—'}
                        </td>
                        <td className="num py-2.5 text-[11px]">
                          {formatDateTime(String(s.created_at))}
                        </td>
                        <td className="num py-2.5 text-[11px] text-[var(--fg-secondary)]">
                          {formatRelative(String(s.expires_at))}
                        </td>
                        <td className="py-2.5 text-center">
                          {s.impersonated_by_user_id ? (
                            <Badge size="sm" tone="danger">
                              כן
                            </Badge>
                          ) : (
                            <span className="text-[var(--fg-tertiary)]">—</span>
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
