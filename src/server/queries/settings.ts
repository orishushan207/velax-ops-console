import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export interface SettingRow {
  id: string;
  key: string;
  nameHe: string;
  category: string;
  description: string | null;
  valueType: string;
  unit: string | null;
  confidence: string;
  sourceReference: string | null;
  conflictingValue: string | null;
  conflictingSource: string | null;
  isScenarioScoped: boolean;
  allowsClubOverride: boolean;
  minValue: string | null;
  maxValue: string | null;
  currentValue: string | null;
  effectiveFrom: Date | null;
  /** ערך שנקבע לעתיד וטרם נכנס לתוקף */
  pendingValue: string | null;
  pendingEffectiveFrom: Date | null;
  versionCount: number;
}

export async function listSettings(): Promise<SettingRow[]> {
  const rows = await db.execute(sql`
    SELECT
      bs.*,
      cur.value AS current_value,
      cur.effective_from AS effective_from,
      fut.value AS pending_value,
      fut.effective_from AS pending_effective_from,
      (SELECT COUNT(*)::int FROM setting_versions sv WHERE sv.setting_id = bs.id) AS version_count
    FROM business_settings bs
    LEFT JOIN LATERAL (
      SELECT sv.value, sv.effective_from FROM setting_versions sv
      WHERE sv.setting_id = bs.id AND sv.scenario IS NULL AND sv.club_id IS NULL
        AND sv.effective_from <= now()
        AND (sv.effective_until IS NULL OR sv.effective_until > now())
      ORDER BY sv.effective_from DESC LIMIT 1
    ) cur ON TRUE
    LEFT JOIN LATERAL (
      SELECT sv.value, sv.effective_from FROM setting_versions sv
      WHERE sv.setting_id = bs.id AND sv.scenario IS NULL AND sv.club_id IS NULL
        AND sv.effective_from > now()
      ORDER BY sv.effective_from ASC LIMIT 1
    ) fut ON TRUE
    ORDER BY bs.category, bs.key
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      key: String(row.key),
      nameHe: String(row.name_he),
      category: String(row.category),
      description: row.description ? String(row.description) : null,
      valueType: String(row.value_type),
      unit: row.unit ? String(row.unit) : null,
      confidence: String(row.confidence),
      sourceReference: row.source_reference ? String(row.source_reference) : null,
      conflictingValue: row.conflicting_value ? String(row.conflicting_value) : null,
      conflictingSource: row.conflicting_source ? String(row.conflicting_source) : null,
      isScenarioScoped: Boolean(row.is_scenario_scoped),
      allowsClubOverride: Boolean(row.allows_club_override),
      minValue: row.min_value ? String(row.min_value) : null,
      maxValue: row.max_value ? String(row.max_value) : null,
      currentValue: row.current_value ? String(row.current_value) : null,
      effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : null,
      pendingValue: row.pending_value ? String(row.pending_value) : null,
      pendingEffectiveFrom: row.pending_effective_from
        ? new Date(row.pending_effective_from as string)
        : null,
      versionCount: Number(row.version_count ?? 0),
    };
  });
}

export async function getSettingHistory(settingKey: string) {
  const rows = await db.execute(sql`
    SELECT sv.*, u.full_name AS changed_by_name, c.name AS club_name
    FROM setting_versions sv
    JOIN business_settings bs ON bs.id = sv.setting_id
    LEFT JOIN users u ON u.id = sv.changed_by
    LEFT JOIN clubs c ON c.id = sv.club_id
    WHERE bs.key = ${settingKey}
    ORDER BY sv.effective_from DESC, sv.created_at DESC
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function listMetricDefinitions() {
  const rows = await db.execute(sql`
    SELECT * FROM metric_definitions ORDER BY key, version DESC
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function listSlaPolicies() {
  const rows = await db.execute(sql`
    SELECT sp.*,
      (SELECT COUNT(*)::int FROM club_contracts cc WHERE cc.sla_policy_id = sp.id
        AND cc.deleted_at IS NULL) AS contract_count
    FROM sla_policies sp ORDER BY sp.is_default DESC, sp.name_he
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function listAutomationRules() {
  const rows = await db.execute(sql`
    SELECT * FROM automation_rules WHERE deleted_at IS NULL ORDER BY severity, name_he
  `);
  return rows.rows as Record<string, unknown>[];
}
