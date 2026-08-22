'use server';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  notifications,
  payments,
  refunds,
  sessionEvents,
  sessions,
  stations,
  supportTickets,
} from '@/db/schema';
import { proRataRefund, round2, splitGross } from '@/lib/money';
import { buildReference } from '@/lib/utils';
import { writeAudit } from '@/server/audit';
import { idempotencyKey } from '@/server/auth/crypto';
import { assertClubAccess } from '@/server/auth/guard';
import { getPaymentProvider } from '@/server/providers';
import { relayDeviceCommand, relayMessage, type RelayOutcome } from '@/server/app-api/relay';
import { cancelSessionCommands } from '@/server/app-api/command-queue';
import { getSettings } from '@/server/settings/service';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  type ActionResult,
} from './_helpers';

/**
 * פעולות שליטה בסשן — סעיף 7 בהנחיות.
 *
 * ⚠ כל פעולה רגישה כאן דורשת:
 *   1. הרשאה מתאימה (withPermission)
 *   2. סיבה חופשית מהמשתמש
 *   3. רישום ב־Audit Log באותה טרנזקציה
 *   4. במקרים כספיים — תיעוד הסכום והגורם המאשר
 */

const reasonSchema = z.string().trim().min(5, 'נא לפרט סיבה של 5 תווים לפחות');

async function loadSession(sessionId: string) {
  const [row] = await db
    .select({
      id: sessions.id,
      reference: sessions.reference,
      status: sessions.status,
      clubId: sessions.clubId,
      stationId: sessions.stationId,
      deviceId: sessions.deviceId,
      startedAt: sessions.startedAt,
      scheduledMinutes: sessions.scheduledMinutes,
      actualMinutes: sessions.actualMinutes,
      pausedMinutes: sessions.pausedMinutes,
      amountGross: sessions.amountGross,
      refundedAmount: sessions.refundedAmount,
      vatRateApplied: sessions.vatRateApplied,
      userId: sessions.userId,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/** השהיית סשן פעיל */
export async function pauseSessionAction(
  sessionId: string,
  reason: string,
): Promise<ActionResult> {
  return withPermission('sessions.control', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);
    if (session.status !== 'active') return actionError('ניתן להשהות רק סשן פעיל');

    let relay: RelayOutcome = { state: 'no_device', message: 'אין מכונה משויכת לסשן' };

    await db.transaction(async (tx) => {
      // ⚠ הפקודה נכנסת לתור באותה טרנזקציה של שינוי הסטטוס: אם הרישום
      // נכשל, גם הבקשה למכונה מתבטלת ולא נוצר פער בין השניים.
      relay = await relayDeviceCommand(
        {
          deviceUuid: session.deviceId,
          sessionId,
          command: 'pause',
          issuedBy: ctx.user.id,
          reason: parsed.data,
        },
        tx,
      );
      await tx.update(sessions).set({ status: 'paused' }).where(eq(sessions.id, sessionId));
      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: 'paused',
        fromStatus: 'active',
        toStatus: 'paused',
        actorUserId: ctx.user.id,
        source: 'ops_console',
        message: parsed.data,
      });
      await writeAudit(
        {
          action: 'device_command',
          actionKey: 'session.pause',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: session.status },
          after: { status: 'paused' },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', `/sessions/${sessionId}`, '/sessions');
    return actionOk(undefined, relayMessage(relay, 'הסשן הושהה'));
  });
}

/** חידוש סשן מושהה */
export async function resumeSessionAction(sessionId: string): Promise<ActionResult> {
  return withPermission('sessions.control', async (ctx) => {
    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);
    if (session.status !== 'paused') return actionError('ניתן לחדש רק סשן מושהה');

    let relay: RelayOutcome = { state: 'no_device', message: 'אין מכונה משויכת לסשן' };

    await db.transaction(async (tx) => {
      relay = await relayDeviceCommand(
        { deviceUuid: session.deviceId, sessionId, command: 'resume', issuedBy: ctx.user.id },
        tx,
      );
      await tx.update(sessions).set({ status: 'active' }).where(eq(sessions.id, sessionId));
      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: 'resumed',
        fromStatus: 'paused',
        toStatus: 'active',
        actorUserId: ctx.user.id,
        source: 'ops_console',
      });
      await writeAudit(
        {
          action: 'device_command',
          actionKey: 'session.resume',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', `/sessions/${sessionId}`);
    return actionOk(undefined, relayMessage(relay, 'הסשן חודש'));
  });
}

/** הארכת סשן */
export async function extendSessionAction(
  sessionId: string,
  additionalMinutes: number,
  reason: string,
): Promise<ActionResult> {
  return withPermission('sessions.control', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const settings = await getSettings();
    const maxExtension = settings.num('ops.session_extension_max_minutes', 30);
    if (additionalMinutes <= 0 || additionalMinutes > maxExtension) {
      return actionError(`ניתן להאריך בין דקה ל־${maxExtension} דקות`);
    }

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);
    if (!['active', 'paused'].includes(session.status)) {
      return actionError('ניתן להאריך רק סשן פעיל או מושהה');
    }

    const newMinutes = session.scheduledMinutes + additionalMinutes;

    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ scheduledMinutes: newMinutes })
        .where(eq(sessions.id, sessionId));
      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: 'extended',
        actorUserId: ctx.user.id,
        source: 'ops_console',
        message: `הוארך ב־${additionalMinutes} דקות. ${parsed.data}`,
        payload: { additionalMinutes, newScheduledMinutes: newMinutes },
      });
      await writeAudit(
        {
          action: 'update',
          actionKey: 'session.extend',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { scheduledMinutes: session.scheduledMinutes },
          after: { scheduledMinutes: newMinutes },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', `/sessions/${sessionId}`);
    return actionOk(undefined, `הסשן הוארך ב־${additionalMinutes} דקות`);
  });
}

/** עצירה או סיום כפוי */
export async function stopSessionAction(
  sessionId: string,
  reason: string,
  force = false,
): Promise<ActionResult> {
  return withPermission(force ? 'sessions.force_end' : 'sessions.control', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);
    if (!['active', 'paused', 'connecting', 'authorized'].includes(session.status)) {
      return actionError('הסשן אינו במצב שניתן לעצור');
    }

    let relay: RelayOutcome = { state: 'no_device', message: 'אין מכונה משויכת לסשן' };
    const now = new Date();
    const elapsed = session.startedAt
      ? Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 60000) - session.pausedMinutes)
      : 0;
    const newStatus = force ? 'interrupted' : 'completed';

    await db.transaction(async (tx) => {
      relay = await relayDeviceCommand(
        {
          deviceUuid: session.deviceId,
          sessionId,
          command: force ? 'force_stop' : 'stop',
          issuedBy: ctx.user.id,
          reason: parsed.data,
        },
        tx,
      );
      // ⚠ פקודות אחרות של הסשן מבוטלות: "המשך" שממתין בתור והגיע אחרי
      // העצירה היה מפעיל מחדש מכונה של סשן שהסתיים.
      await cancelSessionCommands(sessionId, 'הסשן הסתיים', tx);

      await tx
        .update(sessions)
        .set({
          status: newStatus,
          endedAt: now,
          actualMinutes: elapsed,
          endReason: force ? 'force_ended_by_ops' : 'stopped_by_ops',
        })
        .where(eq(sessions.id, sessionId));
      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: force ? 'force_ended' : 'stopped',
        fromStatus: session.status,
        toStatus: newStatus,
        actorUserId: ctx.user.id,
        source: 'ops_console',
        message: parsed.data,
      });
      await writeAudit(
        {
          action: 'device_command',
          actionKey: force ? 'session.force_end' : 'session.stop',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: session.status },
          after: { status: newStatus, actualMinutes: elapsed },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', `/sessions/${sessionId}`, '/sessions');
    return actionOk(undefined, relayMessage(relay, force ? 'הסשן הופסק בכפייה' : 'הסשן הסתיים'));
  });
}

/** סימון סשן כתקול — פותח גם קריאת שירות */
export async function markSessionFaultyAction(
  sessionId: string,
  category: string,
  reason: string,
): Promise<ActionResult<{ ticketId: string }>> {
  return withPermission('sessions.mark_faulty', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);

    const settings = await getSettings();
    const severity = 'high' as const;
    const responseHours = settings.num('sla.response_hours', 4);
    const resolutionHours = settings.num('sla.resolution_hours', 48);
    const now = new Date();

    const ticketId = await db.transaction(async (tx) => {
      const seqRow = await tx.execute(sql`SELECT COUNT(*)::int AS c FROM support_tickets`);
      const seq = Number((seqRow.rows[0] as { c: number }).c) + 1;

      const [ticket] = await tx
        .insert(supportTickets)
        .values({
          reference: buildReference('TK', now, seq),
          title: `סשן ${session.reference} סומן כתקול`,
          description: parsed.data,
          category: category as 'other',
          severity,
          status: 'new',
          source: 'ops_console',
          clubId: session.clubId,
          stationId: session.stationId,
          deviceId: session.deviceId,
          sessionId,
          reportedByUserId: ctx.user.id,
          responseDueAt: new Date(now.getTime() + responseHours * 3_600_000),
          resolutionDueAt: new Date(now.getTime() + resolutionHours * 3_600_000),
          downtimeStartedAt: now,
        })
        .returning({ id: supportTickets.id });

      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: 'marked_faulty',
        actorUserId: ctx.user.id,
        source: 'ops_console',
        message: parsed.data,
        payload: { ticketId: ticket?.id },
      });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'session.mark_faulty',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { ticketId: ticket?.id, category },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );

      return ticket!.id;
    });

    revalidate('/live', `/sessions/${sessionId}`, '/tickets');
    return actionOk({ ticketId }, 'הסשן סומן כתקול ונפתחה קריאת שירות');
  });
}

/** שליחת הודעה לשחקן */
export async function messagePlayerAction(
  sessionId: string,
  message: string,
): Promise<ActionResult> {
  return withPermission('sessions.message_player', async (ctx) => {
    const parsed = z
      .string()
      .trim()
      .min(3, 'ההודעה קצרה מדי')
      .max(500, 'ההודעה ארוכה מדי')
      .safeParse(message);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'הודעה אינה תקינה');

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);

    await db.transaction(async (tx) => {
      // ⚠ ההודעה נרשמת כהתראה. ערוץ חיצוני אמיתי (WhatsApp/SMS) אינו מחובר,
      // ולכן delivery_provider = mock וההודעה אינה נשלחת בפועל.
      await tx.insert(notifications).values({
        severity: 'info',
        title: 'הודעה לשחקן',
        body: parsed.data,
        channel: 'in_app',
        status: 'pending',
        recipientUserId: session.userId,
        entityType: 'session',
        entityId: sessionId,
        clubId: session.clubId,
        deliveryProvider: 'mock',
      });
      await tx.insert(sessionEvents).values({
        sessionId,
        eventType: 'note',
        actorUserId: ctx.user.id,
        source: 'ops_console',
        message: `הודעה לשחקן: ${parsed.data}`,
      });
      await writeAudit(
        {
          action: 'create',
          actionKey: 'session.message_player',
          entityType: 'session',
          entityId: sessionId,
          entityLabel: session.reference,
          clubId: session.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { message: parsed.data },
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate(`/sessions/${sessionId}`);
    return actionOk(
      undefined,
      'ההודעה נרשמה. ⚠ ערוץ שליחה חיצוני אינו מחובר — ההודעה לא נשלחה בפועל.',
    );
  });
}

/** השבתת עמדה */
export async function suspendStationAction(
  stationId: string,
  reason: string,
): Promise<ActionResult> {
  return withPermission('stations.suspend', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const [station] = await db
      .select({ id: stations.id, code: stations.code, clubId: stations.clubId, status: stations.status })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);
    if (!station) return actionError('העמדה לא נמצאה');
    assertClubAccess(ctx.user, station.clubId);

    await db.transaction(async (tx) => {
      await tx
        .update(stations)
        .set({
          status: 'suspended',
          suspendedReason: parsed.data,
          suspendedBy: ctx.user.id,
          suspendedAt: new Date(),
        })
        .where(eq(stations.id, stationId));
      await writeAudit(
        {
          action: 'update',
          actionKey: 'station.suspend',
          entityType: 'station',
          entityId: stationId,
          entityLabel: station.code,
          clubId: station.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: station.status },
          after: { status: 'suspended' },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', '/stations', `/stations/${stationId}`);
    return actionOk(undefined, 'העמדה הושבתה');
  });
}

/** החזרת עמדה לפעילות */
export async function reactivateStationAction(
  stationId: string,
  reason: string,
): Promise<ActionResult> {
  return withPermission('stations.suspend', async (ctx) => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'סיבה אינה תקינה');

    const [station] = await db
      .select({ id: stations.id, code: stations.code, clubId: stations.clubId, status: stations.status })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);
    if (!station) return actionError('העמדה לא נמצאה');
    assertClubAccess(ctx.user, station.clubId);

    await db.transaction(async (tx) => {
      await tx
        .update(stations)
        .set({ status: 'active', suspendedReason: null, suspendedBy: null, suspendedAt: null })
        .where(eq(stations.id, stationId));
      await writeAudit(
        {
          action: 'update',
          actionKey: 'station.reactivate',
          entityType: 'station',
          entityId: stationId,
          entityLabel: station.code,
          clubId: station.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: station.status },
          after: { status: 'active' },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/live', '/stations', `/stations/${stationId}`);
    return actionOk(undefined, 'העמדה חזרה לפעילות');
  });
}

/**
 * ביצוע זיכוי — הפעולה הכספית הרגישה ביותר במערכת.
 *
 * ⚠ אכיפות:
 *   • סכום מעל refund.approval_threshold_ils דורש הרשאת refunds.approve
 *   • Idempotency Key מונע זיכוי כפול על אותו סשן ואותו סכום
 *   • הכל בטרנזקציה אחת יחד עם ה־Audit Log
 */
export async function issueRefundAction(formData: FormData): Promise<ActionResult> {
  return withPermission('refunds.request', async (ctx) => {
    const sessionId = formString(formData, 'sessionId');
    const refundType = formString(formData, 'refundType') as 'full' | 'partial';
    const destination = formString(formData, 'destination') as 'original_method' | 'wallet';
    const reasonCode = formString(formData, 'reason');
    const note = formString(formData, 'note');
    const amountRaw = formString(formData, 'amount');

    const schema = z.object({
      sessionId: z.string().uuid('מזהה סשן אינו תקין'),
      refundType: z.enum(['full', 'partial']),
      destination: z.enum(['original_method', 'wallet']),
      reason: z.string().min(1, 'נא לבחור סיבה'),
      note: z.string().trim().min(5, 'נא לפרט את הסיבה'),
    });
    const parsed = schema.safeParse({ sessionId, refundType, destination, reason: reasonCode, note });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    const session = await loadSession(sessionId);
    if (!session) return actionError('הסשן לא נמצא');
    assertClubAccess(ctx.user, session.clubId);

    const paidGross = Number(session.amountGross);
    const alreadyRefunded = Number(session.refundedAmount);
    const maxRefundable = round2(paidGross - alreadyRefunded);
    if (maxRefundable <= 0) return actionError('הסשן כבר זוכה במלואו');

    const amount =
      refundType === 'full' ? maxRefundable : round2(Number.parseFloat(amountRaw || '0'));

    if (!Number.isFinite(amount) || amount <= 0) {
      return actionError('סכום הזיכוי אינו תקין', { amount: 'נא להזין סכום חיובי' });
    }
    if (amount > maxRefundable) {
      return actionError(`הסכום גבוה מהיתרה הניתנת לזיכוי (${maxRefundable.toFixed(2)} ₪)`, {
        amount: 'הסכום גבוה מדי',
      });
    }

    const settings = await getSettings();
    const threshold = settings.num('refund.approval_threshold_ils', 200);
    const needsApproval = amount > threshold;
    const canApprove =
      ctx.user.permissions.has('refunds.approve') || ctx.user.permissions.has('refunds.approve_any');

    if (needsApproval && !canApprove) {
      return actionError(
        `זיכוי מעל ${threshold} ₪ דורש אישור. הבקשה לא בוצעה — פנה לגורם מאשר.`,
      );
    }

    const [payment] = await db
      .select({ id: payments.id, providerTransactionId: payments.providerTransactionId })
      .from(payments)
      .where(eq(payments.sessionId, sessionId))
      .limit(1);
    if (!payment) return actionError('לא נמצא תשלום מקושר לסשן');

    const vatRate = Number(session.vatRateApplied);
    const split = splitGross(amount, vatRate);
    const key = idempotencyKey('refund', sessionId, amount, ctx.user.id);

    // ביצוע מול ספק הסליקה לפני כתיבה ל־DB
    const provider = getPaymentProvider();
    const providerResult: {
      ok: boolean;
      data?: { refundId: string; processedAt: Date };
      errorMessage?: string;
    } =
      destination === 'original_method' && payment.providerTransactionId
        ? await provider.refund({
            transactionId: payment.providerTransactionId,
            amountGross: amount,
            idempotencyKey: key,
            reason: reasonCode,
          })
        : { ok: true, data: { refundId: `wallet_${key}`, processedAt: new Date() } };

    if (!providerResult.ok) {
      return actionError(`הזיכוי נדחה על ידי ספק הסליקה: ${providerResult.errorMessage ?? ''}`);
    }

    const newRefundedTotal = round2(alreadyRefunded + amount);
    const isNowFull = newRefundedTotal >= paidGross;
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        const seqRow = await tx.execute(sql`SELECT COUNT(*)::int AS c FROM refunds`);
        const seq = Number((seqRow.rows[0] as { c: number }).c) + 1;

        await tx.insert(refunds).values({
          reference: buildReference('RF', now, seq),
          paymentId: payment.id,
          sessionId,
          refundType,
          destination,
          status: 'completed',
          amountGross: String(amount),
          amountNet: String(split.net),
          vatAmount: String(split.vat),
          reason: reasonCode as 'other',
          reasonNote: note,
          requestedBy: ctx.user.id,
          approvedBy: needsApproval ? ctx.user.id : null,
          approvedAt: needsApproval ? now : null,
          provider: destination === 'wallet' ? 'wallet' : 'mock',
          providerRefundId: providerResult.data?.refundId ?? null,
          idempotencyKey: key,
          processedAt: now,
        });

        await tx
          .update(sessions)
          .set({
            refundedAmount: String(newRefundedTotal),
            status: isNowFull ? 'fully_refunded' : 'partially_refunded',
          })
          .where(eq(sessions.id, sessionId));

        await tx
          .update(payments)
          .set({ status: isNowFull ? 'refunded' : 'partially_refunded' })
          .where(eq(payments.id, payment.id));

        await tx.insert(sessionEvents).values({
          sessionId,
          eventType: 'refunded',
          actorUserId: ctx.user.id,
          source: 'ops_console',
          message: `זוכה ${amount.toFixed(2)} ₪ — ${note}`,
          payload: { amount, refundType, destination, reason: reasonCode },
        });

        await writeAudit(
          {
            action: 'financial_action',
            actionKey: 'refund.issue',
            entityType: 'session',
            entityId: sessionId,
            entityLabel: session.reference,
            clubId: session.clubId,
            actorUserId: ctx.user.id,
            actorName: ctx.user.fullName,
            actorRoleKeys: ctx.user.roleKeys,
            before: { refundedAmount: alreadyRefunded, status: session.status },
            after: { refundedAmount: newRefundedTotal, status: isNowFull ? 'fully_refunded' : 'partially_refunded' },
            reason: `${reasonCode}: ${note}`,
            amount: amount.toFixed(2),
            approvedByUserId: needsApproval ? ctx.user.id : null,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            requestId: ctx.requestId,
          },
          tx,
        );
      });
    } catch (error) {
      // אינדקס ייחודי על idempotency_key תפס ניסיון כפול
      if (error instanceof Error && error.message.includes('idempotency')) {
        return actionError('זיכוי זהה כבר בוצע. הפעולה נחסמה כדי למנוע זיכוי כפול.');
      }
      throw error;
    }

    revalidate('/live', `/sessions/${sessionId}`, '/payments', '/payments/refunds');
    return actionOk(undefined, `זיכוי של ${amount.toFixed(2)} ₪ בוצע`);
  });
}

/**
 * חישוב הצעת זיכוי אוטומטית לפי כללי המערכת.
 * מוצג למשתמש כברירת מחדל בטופס, אך לעולם אינו מבוצע בלי אישור אדם.
 */
export async function suggestRefundAmount(
  sessionId: string,
): Promise<{ amount: number; reason: string; explanation: string } | null> {
  const session = await loadSession(sessionId);
  if (!session) return null;

  const settings = await getSettings();
  const paidGross = Number(session.amountGross);
  const alreadyRefunded = Number(session.refundedAmount);
  const remaining = round2(paidGross - alreadyRefunded);
  if (remaining <= 0) return null;

  // כלל 1: סשן שלא התחיל בגלל תקלה → זיכוי מלא
  if (session.status === 'failed_to_start' && settings.bool('refund.auto_refund_failed_start', true)) {
    return {
      amount: remaining,
      reason: 'failed_to_start',
      explanation: 'הסשן שולם ולא התחיל עקב תקלה. כלל המערכת מחייב בדיקת זיכוי מלא.',
    };
  }

  // כלל 2: סשן שהופסק → זיכוי יחסי על הזמן שאבד
  if (session.status === 'interrupted') {
    const lost = session.scheduledMinutes - (session.actualMinutes ?? 0);
    const minDowntime = settings.num('refund.auto_credit_downtime_minutes', 15);
    if (lost >= minDowntime) {
      const amount = Math.min(remaining, proRataRefund(paidGross, session.scheduledMinutes, lost));
      return {
        amount,
        reason: 'device_malfunction',
        explanation: `האימון הופסק לאחר ${session.actualMinutes ?? 0} מתוך ${session.scheduledMinutes} דקות. זיכוי יחסי על ${lost} דקות שאבדו.`,
      };
    }
  }

  return null;
}
