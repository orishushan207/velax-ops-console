'use server';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { courtBookings, earnBackAdjustments, earnBackAgreements, earnBackConditions } from '@/db/schema';
import { writeAudit } from '@/server/audit';
import { assertClubAccess } from '@/server/auth/guard';
import { computeEarnBack } from '@/server/metrics/earn-back';
import {
  actionError,
  actionOk,
  formNumber,
  formString,
  revalidate,
  withPermission,
  type ActionResult,
} from './_helpers';

/**
 * פעולות Earn-Back.
 *
 * ⚠ כל שינוי בחישוב הערבות הוא פעולה כספית מהותית ולכן:
 *   • דורש הרשאת earnback.adjust
 *   • נשמר כרשומת earn_back_adjustments עם מאשר
 *   • נרשם ב־Audit Log עם ערך לפני ואחרי
 */

/** מריץ מחדש את החישוב ושומר את התוצאה */
export async function recalculateEarnBackAction(agreementId: string): Promise<ActionResult> {
  return withPermission('earnback.view', async (ctx) => {
    const [agreement] = await db
      .select({
        id: earnBackAgreements.id,
        clubId: earnBackAgreements.clubId,
        status: earnBackAgreements.status,
        verifiedRevenue: earnBackAgreements.verifiedRevenue,
      })
      .from(earnBackAgreements)
      .where(eq(earnBackAgreements.id, agreementId))
      .limit(1);
    if (!agreement) return actionError('ההסכם לא נמצא');
    assertClubAccess(ctx.user, agreement.clubId);

    const computed = await computeEarnBack(agreementId);
    if (!computed) return actionError('החישוב נכשל');

    await db
      .update(earnBackAgreements)
      .set({
        status: computed.status,
        achievedHours: String(computed.achievedHours),
        verifiedRevenue: String(computed.countedRevenue),
        remainingGap: String(computed.remainingGap),
        requiredRunRatePerDay: String(computed.requiredRunRatePerDay),
        forecastRevenue: String(computed.forecastRevenue),
        forecastWillMeet: computed.willMeet,
        lastCalculatedAt: new Date(),
      })
      .where(eq(earnBackAgreements.id, agreementId));

    revalidate('/earn-back', `/earn-back/${agreementId}`, `/clubs/${agreement.clubId}`);
    return actionOk(undefined, 'החישוב עודכן מהנתונים בפועל');
  });
}

/** סיווג הזמנת מגרש — אינקרמנטלית או בסיסית */
export async function classifyBookingAction(
  bookingId: string,
  linkType: 'incremental' | 'baseline' | 'machine_linked',
  note: string,
): Promise<ActionResult> {
  return withPermission('bookings.classify', async (ctx) => {
    const parsed = z.string().trim().min(5, 'נא לנמק את הסיווג').safeParse(note);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'הערה אינה תקינה');

    const [booking] = await db
      .select({
        id: courtBookings.id,
        clubId: courtBookings.clubId,
        linkType: courtBookings.linkType,
        revenueNet: courtBookings.revenueNet,
      })
      .from(courtBookings)
      .where(eq(courtBookings.id, bookingId))
      .limit(1);
    if (!booking) return actionError('ההזמנה לא נמצאה');
    assertClubAccess(ctx.user, booking.clubId);

    await db.transaction(async (tx) => {
      await tx
        .update(courtBookings)
        .set({
          linkType,
          classifiedBy: ctx.user.id,
          classifiedAt: new Date(),
          classificationNote: parsed.data,
        })
        .where(eq(courtBookings.id, bookingId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'booking.classify',
          entityType: 'court_booking',
          entityId: bookingId,
          clubId: booking.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { linkType: booking.linkType },
          after: { linkType },
          reason: parsed.data,
          amount: booking.revenueNet,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/earn-back');
    return actionOk(undefined, 'ההזמנה סווגה מחדש');
  });
}

/** התאמה ידנית לחישוב הערבות */
export async function addEarnBackAdjustmentAction(formData: FormData): Promise<ActionResult> {
  return withPermission('earnback.adjust', async (ctx) => {
    const agreementId = formString(formData, 'agreementId');
    const schema = z.object({
      adjustmentType: z.enum([
        'revenue_credit',
        'revenue_debit',
        'hours_credit',
        'period_extension',
      ]),
      reason: z.string().trim().min(15, 'התאמה לחישוב ערבות דורשת נימוק של 15 תווים לפחות'),
    });

    const parsed = schema.safeParse({
      adjustmentType: formString(formData, 'adjustmentType'),
      reason: formString(formData, 'reason'),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    const amount = formNumber(formData, 'amount') ?? 0;
    const hours = formNumber(formData, 'hours') ?? 0;
    const days = formNumber(formData, 'days') ?? 0;

    if (parsed.data.adjustmentType.startsWith('revenue') && amount <= 0) {
      return actionError('נא להזין סכום חיובי', { amount: 'סכום אינו תקין' });
    }
    if (parsed.data.adjustmentType === 'period_extension' && days <= 0) {
      return actionError('נא להזין מספר ימים חיובי', { days: 'מספר ימים אינו תקין' });
    }

    const [agreement] = await db
      .select({
        id: earnBackAgreements.id,
        clubId: earnBackAgreements.clubId,
        verifiedRevenue: earnBackAgreements.verifiedRevenue,
        status: earnBackAgreements.status,
      })
      .from(earnBackAgreements)
      .where(eq(earnBackAgreements.id, agreementId))
      .limit(1);
    if (!agreement) return actionError('ההסכם לא נמצא');
    assertClubAccess(ctx.user, agreement.clubId);

    await db.transaction(async (tx) => {
      await tx.insert(earnBackAdjustments).values({
        agreementId,
        adjustmentType: parsed.data.adjustmentType,
        amount: String(amount),
        hours: String(hours),
        days: Math.round(days),
        reason: parsed.data.reason,
        approvedBy: ctx.user.id,
      });

      await writeAudit(
        {
          action: 'financial_action',
          actionKey: 'earnback.adjust',
          entityType: 'earn_back_agreement',
          entityId: agreementId,
          clubId: agreement.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { verifiedRevenue: agreement.verifiedRevenue, status: agreement.status },
          after: { adjustmentType: parsed.data.adjustmentType, amount, hours, days },
          reason: parsed.data.reason,
          amount: String(amount),
          approvedByUserId: ctx.user.id,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    // חישוב מחדש מיד אחרי ההתאמה
    const computed = await computeEarnBack(agreementId);
    if (computed) {
      await db
        .update(earnBackAgreements)
        .set({
          status: computed.status,
          verifiedRevenue: String(computed.countedRevenue),
          remainingGap: String(computed.remainingGap),
          requiredRunRatePerDay: String(computed.requiredRunRatePerDay),
          forecastRevenue: String(computed.forecastRevenue),
          forecastWillMeet: computed.willMeet,
          lastCalculatedAt: new Date(),
        })
        .where(eq(earnBackAgreements.id, agreementId));
    }

    revalidate('/earn-back', `/earn-back/${agreementId}`);
    return actionOk(undefined, 'ההתאמה נרשמה והחישוב עודכן');
  });
}

/** עדכון תנאי סף — כולל ויתור מנומק */
export async function updateEarnBackConditionAction(
  conditionId: string,
  status: 'met' | 'not_met' | 'waived',
  reason: string,
): Promise<ActionResult> {
  return withPermission('earnback.manage', async (ctx) => {
    const parsed = z.string().trim().min(5, 'נא לנמק').safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'נימוק אינו תקין');

    const rows = await db.execute(sql`
      SELECT ec.*, a.club_id FROM earn_back_conditions ec
      JOIN earn_back_agreements a ON a.id = ec.agreement_id
      WHERE ec.id = ${conditionId}::uuid LIMIT 1
    `);
    const condition = rows.rows[0] as Record<string, unknown> | undefined;
    if (!condition) return actionError('התנאי לא נמצא');
    assertClubAccess(ctx.user, String(condition.club_id));

    await db.transaction(async (tx) => {
      await tx
        .update(earnBackConditions)
        .set({
          status,
          waivedBy: status === 'waived' ? ctx.user.id : null,
          waivedReason: status === 'waived' ? parsed.data : null,
          lastCheckedAt: new Date(),
        })
        .where(eq(earnBackConditions.id, conditionId));

      await writeAudit(
        {
          action: 'update',
          actionKey: 'earnback.condition_update',
          entityType: 'earn_back_condition',
          entityId: conditionId,
          entityLabel: String(condition.name_he),
          clubId: String(condition.club_id),
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: String(condition.status) },
          after: { status },
          reason: parsed.data,
          approvedByUserId: status === 'waived' ? ctx.user.id : null,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/earn-back', `/earn-back/${String(condition.agreement_id)}`);
    return actionOk(undefined, 'התנאי עודכן');
  });
}

/** הסדרת הערבות — השלמת פער או Buyback */
export async function settleEarnBackAction(
  agreementId: string,
  outcome: 'settled_topup' | 'settled_buyback',
  amount: number,
  reason: string,
): Promise<ActionResult> {
  return withPermission('earnback.manage', async (ctx) => {
    const parsed = z
      .string()
      .trim()
      .min(15, 'הסדרת ערבות דורשת נימוק של 15 תווים לפחות')
      .safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'נימוק אינו תקין');
    if (amount < 0) return actionError('הסכום אינו יכול להיות שלילי');

    const [agreement] = await db
      .select({
        id: earnBackAgreements.id,
        clubId: earnBackAgreements.clubId,
        status: earnBackAgreements.status,
        entryPrice: earnBackAgreements.entryPrice,
        exposureCap: earnBackAgreements.exposureCap,
      })
      .from(earnBackAgreements)
      .where(eq(earnBackAgreements.id, agreementId))
      .limit(1);
    if (!agreement) return actionError('ההסכם לא נמצא');
    assertClubAccess(ctx.user, agreement.clubId);

    const cap = agreement.exposureCap ? Number(agreement.exposureCap) : Number(agreement.entryPrice);
    if (amount > cap) {
      return actionError(
        `הסכום חורג מתקרת החשיפה שנקבעה בהסכם (${cap.toFixed(2)} ₪). יש לעדכן את התקרה תחילה.`,
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(earnBackAgreements)
        .set({
          status: outcome,
          settlementAmount: String(amount),
          settledAt: new Date(),
          settlementNote: parsed.data,
        })
        .where(eq(earnBackAgreements.id, agreementId));

      await writeAudit(
        {
          action: 'financial_action',
          actionKey: `earnback.${outcome}`,
          entityType: 'earn_back_agreement',
          entityId: agreementId,
          clubId: agreement.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: agreement.status },
          after: { status: outcome, settlementAmount: amount },
          reason: parsed.data,
          amount: amount.toFixed(2),
          approvedByUserId: ctx.user.id,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/earn-back', `/earn-back/${agreementId}`, `/clubs/${agreement.clubId}`);
    return actionOk(
      undefined,
      outcome === 'settled_buyback' ? 'הערבות הוסדרה ב־Buyback' : 'הערבות הוסדרה בהשלמת פער',
    );
  });
}
