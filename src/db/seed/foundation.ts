import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  businessSettings,
  metricDefinitions,
  permissions,
  rolePermissions,
  roles,
  settingVersions,
  slaPolicies,
} from '@/db/schema';
import { METRICS } from '@/lib/metrics/dictionary';
import { PERMISSIONS, ROLES, permissionsForRole } from '@/lib/permissions';
import { SETTINGS } from '@/lib/settings-catalog';

/**
 * שכבת היסוד: הרשאות, תפקידים, הגדרות עסקיות, מדדים ו־SLA.
 *
 * ⚠ אלה אינם "נתוני הדגמה" — הם התצורה של המערכת עצמה, ולכן is_demo = false.
 * מחיקת נתוני ההדגמה לא תמחק אותם.
 */
export async function seedFoundation(effectiveFrom: Date) {
  console.log('▸ הרשאות ותפקידים...');

  const permissionIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const [row] = await db
      .insert(permissions)
      .values({
        key: p.key,
        nameHe: p.nameHe,
        category: p.category,
        isSensitive: 'sensitive' in p ? Boolean(p.sensitive) : false,
      })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { nameHe: p.nameHe, category: p.category },
      })
      .returning({ id: permissions.id });
    if (row) permissionIds.set(p.key, row.id);
  }

  const roleIds = new Map<string, string>();
  for (const r of ROLES) {
    const [row] = await db
      .insert(roles)
      .values({
        key: r.key,
        nameHe: r.nameHe,
        description: r.description,
        isSystem: true,
        isClubScoped: 'clubScoped' in r ? Boolean(r.clubScoped) : false,
      })
      .onConflictDoUpdate({
        target: roles.key,
        set: { nameHe: r.nameHe, description: r.description },
      })
      .returning({ id: roles.id });
    if (!row) continue;
    roleIds.set(r.key, row.id);

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id));
    const keys = permissionsForRole(r.key);
    const values = keys
      .map((k) => permissionIds.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: row.id, permissionId }));
    if (values.length > 0) await db.insert(rolePermissions).values(values);
  }
  console.log(`  ✓ ${PERMISSIONS.length} הרשאות, ${ROLES.length} תפקידים`);

  console.log('▸ הגדרות עסקיות...');
  for (const s of SETTINGS) {
    const [row] = await db
      .insert(businessSettings)
      .values({
        key: s.key,
        nameHe: s.nameHe,
        category: s.category,
        description: s.description ?? null,
        valueType: s.valueType,
        unit: s.unit ?? null,
        confidence: s.confidence,
        sourceReference: s.sourceReference ?? null,
        conflictingValue: s.conflictingValue ?? null,
        conflictingSource: s.conflictingSource ?? null,
        isScenarioScoped: Boolean(s.scenarioValues),
        allowsClubOverride: Boolean(s.allowsClubOverride),
        minValue: s.minValue ?? null,
        maxValue: s.maxValue ?? null,
      })
      .onConflictDoUpdate({
        target: businessSettings.key,
        set: {
          nameHe: s.nameHe,
          description: s.description ?? null,
          confidence: s.confidence,
          sourceReference: s.sourceReference ?? null,
          conflictingValue: s.conflictingValue ?? null,
          conflictingSource: s.conflictingSource ?? null,
        },
      })
      .returning({ id: businessSettings.id });
    if (!row) continue;

    await db.delete(settingVersions).where(eq(settingVersions.settingId, row.id));

    if (s.scenarioValues) {
      // הגדרה תלוית תרחיש: שורה לכל תרחיש
      for (const scenario of ['plan', 'realistic', 'conservative'] as const) {
        await db.insert(settingVersions).values({
          settingId: row.id,
          scenario,
          value: s.scenarioValues[scenario],
          effectiveFrom,
          changeReason: 'טעינה ראשונית מהמודל העסקי',
        });
      }
    }
    // תמיד גם ערך גלובלי, כדי שתרחיש שאינו מוגדר ייפול עליו
    await db.insert(settingVersions).values({
      settingId: row.id,
      value: s.defaultValue,
      effectiveFrom,
      changeReason: `טעינה ראשונית · מקור: ${s.sourceReference ?? 'לא צוין'}`,
    });
  }
  console.log(`  ✓ ${SETTINGS.length} הגדרות עסקיות עם תאריך תחולה`);

  console.log('▸ מילון מדדים...');
  for (const m of METRICS) {
    await db
      .insert(metricDefinitions)
      .values({
        key: m.key,
        nameHe: m.nameHe,
        definition: m.definition,
        formula: m.formula,
        dataSource: m.dataSource,
        ownerRole: m.ownerRole,
        updateFrequency: m.updateFrequency,
        version: m.version,
        unit: m.unit ?? null,
        tooltipHe: m.tooltipHe,
        cautionHe: m.cautionHe ?? null,
        effectiveFrom,
      })
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${METRICS.length} מדדים`);

  console.log('▸ מדיניות SLA...');
  const [defaultSla] = await db
    .insert(slaPolicies)
    .values({
      nameHe: 'SLA סטנדרטי — לפי פרק 14 בתוכנית',
      isDefault: true,
      responseHoursCritical: 1,
      responseHoursHigh: 4,
      responseHoursMedium: 24,
      responseHoursLow: 48,
      resolutionHoursCritical: 24,
      resolutionHoursHigh: 48,
      resolutionHoursMedium: 72,
      resolutionHoursLow: 168,
      uptimeTargetPct: 95,
    })
    .returning({ id: slaPolicies.id });

  const [premiumSla] = await db
    .insert(slaPolicies)
    .values({
      nameHe: 'SLA פרימיום — מועדונים אסטרטגיים',
      isDefault: false,
      responseHoursCritical: 1,
      responseHoursHigh: 2,
      responseHoursMedium: 8,
      responseHoursLow: 24,
      resolutionHoursCritical: 12,
      resolutionHoursHigh: 24,
      resolutionHoursMedium: 48,
      resolutionHoursLow: 96,
      uptimeTargetPct: 97,
    })
    .returning({ id: slaPolicies.id });

  console.log('  ✓ 2 מדיניויות SLA');

  return {
    roleIds,
    permissionIds,
    defaultSlaId: defaultSla!.id,
    premiumSlaId: premiumSla!.id,
  };
}
