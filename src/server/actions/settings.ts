'use server';

import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { businessSettings, settingVersions } from '@/db/schema';
import { writeAudit } from '@/server/audit';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  type ActionResult,
} from './_helpers';

/**
 * שינוי הגדרה עסקית.
 *
 * ⚠ סעיף 1.5 בהנחיות: לכל שינוי חייב להיות תאריך תחולה והיסטוריה.
 * שינוי אינו דורס את הערך הקודם — הוא סוגר אותו ופותח גרסה חדשה.
 * כך חישוב היסטורי נשאר נכון גם אחרי שינוי מחיר.
 */
export async function updateSettingAction(formData: FormData): Promise<ActionResult> {
  return withPermission('finance.edit_assumptions', async (ctx) => {
    const schema = z.object({
      settingKey: z.string().min(1),
      value: z.string().trim().min(1, 'נא להזין ערך'),
      effectiveFrom: z.string().min(1, 'נא לבחור תאריך תחולה'),
      changeReason: z.string().trim().min(10, 'שינוי הנחה עסקית דורש נימוק של 10 תווים לפחות'),
      scenario: z.string().optional(),
    });

    const parsed = schema.safeParse({
      settingKey: formString(formData, 'settingKey'),
      value: formString(formData, 'value'),
      effectiveFrom: formString(formData, 'effectiveFrom'),
      changeReason: formString(formData, 'changeReason'),
      scenario: formString(formData, 'scenario') || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    const [setting] = await db
      .select({
        id: businessSettings.id,
        key: businessSettings.key,
        nameHe: businessSettings.nameHe,
        valueType: businessSettings.valueType,
        minValue: businessSettings.minValue,
        maxValue: businessSettings.maxValue,
      })
      .from(businessSettings)
      .where(eq(businessSettings.key, parsed.data.settingKey))
      .limit(1);
    if (!setting) return actionError('ההגדרה לא נמצאה');

    // אימות טווח ערכים לפי סוג
    if (['number', 'percentage', 'currency', 'duration_minutes'].includes(setting.valueType)) {
      const numeric = Number.parseFloat(parsed.data.value);
      if (!Number.isFinite(numeric)) {
        return actionError('הערך חייב להיות מספר', { value: 'ערך אינו מספרי' });
      }
      if (setting.minValue && numeric < Number.parseFloat(setting.minValue)) {
        return actionError(`הערך נמוך מהמינימום (${setting.minValue})`, { value: 'ערך נמוך מדי' });
      }
      if (setting.maxValue && numeric > Number.parseFloat(setting.maxValue)) {
        return actionError(`הערך גבוה מהמקסימום (${setting.maxValue})`, { value: 'ערך גבוה מדי' });
      }
    }
    if (setting.valueType === 'boolean' && !['true', 'false'].includes(parsed.data.value)) {
      return actionError('ערך בוליאני חייב להיות true או false');
    }

    const effectiveFrom = new Date(parsed.data.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return actionError('תאריך תחולה אינו תקין', { effectiveFrom: 'תאריך שגוי' });
    }

    const scenario = parsed.data.scenario as 'plan' | 'realistic' | 'conservative' | undefined;

    // הערך הנוכחי, כדי לתעד ממה השתנה
    const [current] = await db
      .select({ id: settingVersions.id, value: settingVersions.value })
      .from(settingVersions)
      .where(
        and(
          eq(settingVersions.settingId, setting.id),
          scenario ? eq(settingVersions.scenario, scenario) : isNull(settingVersions.scenario),
          isNull(settingVersions.clubId),
          lte(settingVersions.effectiveFrom, new Date()),
          or(isNull(settingVersions.effectiveUntil), sql`${settingVersions.effectiveUntil} > now()`),
        ),
      )
      .orderBy(desc(settingVersions.effectiveFrom))
      .limit(1);

    if (current && current.value === parsed.data.value) {
      return actionError('הערך זהה לערך הנוכחי — לא בוצע שינוי');
    }

    await db.transaction(async (tx) => {
      // סוגרים את הגרסה הקודמת בתאריך התחולה החדש
      if (current) {
        await tx
          .update(settingVersions)
          .set({ effectiveUntil: effectiveFrom })
          .where(eq(settingVersions.id, current.id));
      }

      await tx.insert(settingVersions).values({
        settingId: setting.id,
        scenario: scenario ?? null,
        clubId: null,
        value: parsed.data.value,
        effectiveFrom,
        changedBy: ctx.user.id,
        changeReason: parsed.data.changeReason,
        previousValue: current?.value ?? null,
      });

      await writeAudit(
        {
          action: 'setting_change',
          actionKey: 'setting.update',
          entityType: 'business_setting',
          entityId: setting.id,
          entityLabel: setting.nameHe,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { value: current?.value ?? null, scenario: scenario ?? null },
          after: {
            value: parsed.data.value,
            scenario: scenario ?? null,
            effectiveFrom: effectiveFrom.toISOString(),
          },
          reason: parsed.data.changeReason,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    // שינוי הנחה משפיע כמעט על כל מסך במערכת
    revalidate('/', '/finance', '/earn-back', '/settings', '/reports', '/stations');
    return actionOk(
      undefined,
      effectiveFrom > new Date()
        ? `השינוי נשמר ויחול מ־${effectiveFrom.toLocaleDateString('he-IL')}`
        : 'ההגדרה עודכנה',
    );
  });
}
