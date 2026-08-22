import 'server-only';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { businessSettings, settingVersions } from '@/db/schema';
import { SETTINGS_BY_KEY } from '@/lib/settings-catalog';

export type Scenario = 'plan' | 'realistic' | 'conservative';

export interface ResolvedSetting {
  key: string;
  value: string;
  numeric: number;
  /** מקור הערך: global | scenario | club */
  origin: 'default' | 'global' | 'scenario' | 'club';
  effectiveFrom: Date | null;
}

/**
 * פותר ערך הגדרה נכון לרגע נתון.
 *
 * סדר עדיפויות (הגבוה ביותר קודם):
 *   1. דריסה למועדון ספציפי, בתרחיש הנוכחי
 *   2. דריסה למועדון ספציפי, ללא תרחיש
 *   3. ערך גלובלי לתרחיש הנוכחי
 *   4. ערך גלובלי ללא תרחיש
 *   5. ברירת המחדל מהקטלוג (רק אם ה־DB ריק)
 *
 * ⚠ בכל המקרים נלקחת רק גרסה שכבר נכנסה לתוקף (effective_from <= asOf).
 * כך שינוי מחיר שנקבע ל־1 בספטמבר אינו משנה את חישובי אוגוסט —
 * דרישת סעיף 1.5 בהנחיות: "תאריך תחולה לכל שינוי".
 */
export async function resolveSettings(options?: {
  keys?: string[];
  scenario?: Scenario;
  clubId?: string | null;
  asOf?: Date;
}): Promise<Map<string, ResolvedSetting>> {
  const asOf = options?.asOf ?? new Date();
  const scenario = options?.scenario ?? 'plan';
  const clubId = options?.clubId ?? null;

  const rows = await db
    .select({
      key: businessSettings.key,
      value: settingVersions.value,
      scenario: settingVersions.scenario,
      clubId: settingVersions.clubId,
      effectiveFrom: settingVersions.effectiveFrom,
    })
    .from(businessSettings)
    .innerJoin(settingVersions, eq(settingVersions.settingId, businessSettings.id))
    .where(
      and(
        lte(settingVersions.effectiveFrom, asOf),
        or(
          isNull(settingVersions.effectiveUntil),
          gt(settingVersions.effectiveUntil, asOf),
        ),
        or(isNull(settingVersions.scenario), eq(settingVersions.scenario, scenario)),
        clubId
          ? or(isNull(settingVersions.clubId), eq(settingVersions.clubId, clubId))
          : isNull(settingVersions.clubId),
      ),
    )
    .orderBy(desc(settingVersions.effectiveFrom));

  const result = new Map<string, ResolvedSetting>();
  const rank = (r: (typeof rows)[number]): number => {
    if (r.clubId && r.scenario) return 4;
    if (r.clubId) return 3;
    if (r.scenario) return 2;
    return 1;
  };
  const bestRank = new Map<string, number>();

  for (const row of rows) {
    const wanted = options?.keys;
    if (wanted && !wanted.includes(row.key)) continue;
    const currentRank = rank(row);
    const previousRank = bestRank.get(row.key) ?? 0;
    // rows ממוינות לפי effective_from יורד, כך שהראשונה בכל דירוג היא העדכנית
    if (currentRank < previousRank) continue;
    if (currentRank === previousRank && result.has(row.key)) continue;

    bestRank.set(row.key, currentRank);
    result.set(row.key, {
      key: row.key,
      value: row.value,
      numeric: Number.parseFloat(row.value),
      origin: row.clubId ? 'club' : row.scenario ? 'scenario' : 'global',
      effectiveFrom: row.effectiveFrom,
    });
  }

  // השלמה מהקטלוג עבור מפתחות שאינם ב־DB (למשל לפני הרצת Seed)
  const requested = options?.keys ?? [...SETTINGS_BY_KEY.keys()];
  for (const key of requested) {
    if (result.has(key)) continue;
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) continue;
    const raw = def.scenarioValues ? def.scenarioValues[scenario] : def.defaultValue;
    result.set(key, {
      key,
      value: raw,
      numeric: Number.parseFloat(raw),
      origin: 'default',
      effectiveFrom: null,
    });
  }

  return result;
}

/**
 * גישה נוחה להגדרות עם ברירות מחדל בטוחות.
 * שימוש: const s = await getSettings(); s.num('finance.vat_rate')
 */
export class SettingsBag {
  constructor(private readonly map: Map<string, ResolvedSetting>) {}

  num(key: string, fallback = 0): number {
    const v = this.map.get(key);
    if (!v || !Number.isFinite(v.numeric)) return fallback;
    return v.numeric;
  }

  str(key: string, fallback = ''): string {
    return this.map.get(key)?.value ?? fallback;
  }

  bool(key: string, fallback = false): boolean {
    const v = this.map.get(key)?.value;
    if (v === undefined) return fallback;
    return v === 'true' || v === '1';
  }

  origin(key: string): ResolvedSetting['origin'] | null {
    return this.map.get(key)?.origin ?? null;
  }

  all(): ResolvedSetting[] {
    return [...this.map.values()];
  }
}

/**
 * טוען את כל ההגדרות פעם אחת לכל בקשה.
 * React cache() מבטיח שקריאות חוזרות באותו render לא פוגעות במסד.
 */
export const getSettings = cache(
  async (scenario: Scenario = 'plan', clubId: string | null = null, asOf?: Date) => {
    const map = await resolveSettings({ scenario, clubId, asOf });
    return new SettingsBag(map);
  },
);
