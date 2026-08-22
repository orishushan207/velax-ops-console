'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { supportTickets, ticketEvents } from '@/db/schema';
import { buildReference } from '@/lib/utils';
import { writeAudit } from '@/server/audit';
import { assertClubAccess } from '@/server/auth/guard';
import {
  actionError,
  actionOk,
  formString,
  revalidate,
  withPermission,
  type ActionResult,
} from './_helpers';

/**
 * ניהול קריאות שירות ו־SLA — סעיף 12 בהנחיות.
 *
 * מועדי ה־SLA מחושבים ממדיניות ה־SLA של המועדון (או מברירת המחדל),
 * ולא מערך גלובלי קשיח — התוכנית מחייבת ש"הערכים ניתנים לשינוי לפי הסכם ומועדון".
 */

type Severity = 'low' | 'medium' | 'high' | 'critical';

async function resolveSlaDeadlines(
  clubId: string | null,
  severity: Severity,
  from: Date,
) {
  // מדיניות ההסכם של המועדון, ואם אין — מדיניות ברירת המחדל
  const policyRows = await db.execute(sql`
    SELECT sp.* FROM sla_policies sp
    WHERE sp.id = COALESCE(
      (SELECT cc.sla_policy_id FROM club_contracts cc
        WHERE cc.club_id = ${clubId}::uuid AND cc.status = 'active' AND cc.deleted_at IS NULL
        ORDER BY cc.starts_on DESC LIMIT 1),
      (SELECT id FROM sla_policies WHERE is_default = true LIMIT 1)
    )
    LIMIT 1
  `);
  const policy = policyRows.rows[0] as Record<string, unknown> | undefined;
  if (!policy) {
    return { policyId: null, responseDueAt: null, resolutionDueAt: null };
  }

  const map: Record<string, [string, string]> = {
    low: ['response_hours_low', 'resolution_hours_low'],
    medium: ['response_hours_medium', 'resolution_hours_medium'],
    high: ['response_hours_high', 'resolution_hours_high'],
    critical: ['response_hours_critical', 'resolution_hours_critical'],
  };
  const [respKey, resKey] = map[severity]!;
  const responseHours = Number(policy[respKey] ?? 24);
  const resolutionHours = Number(policy[resKey] ?? 72);

  return {
    policyId: String(policy.id),
    responseDueAt: new Date(from.getTime() + responseHours * 3_600_000),
    resolutionDueAt: new Date(from.getTime() + resolutionHours * 3_600_000),
  };
}

export async function createTicketAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return withPermission('tickets.create', async (ctx) => {
    const schema = z.object({
      title: z.string().trim().min(5, 'כותרת קצרה מדי').max(250),
      description: z.string().trim().min(10, 'נא לפרט את התקלה'),
      category: z.string().min(1),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      clubId: z.string().uuid().nullable(),
      stationId: z.string().uuid().nullable(),
      deviceId: z.string().uuid().nullable(),
    });

    const nullable = (v: string) => (v && v !== 'none' ? v : null);
    const parsed = schema.safeParse({
      title: formString(formData, 'title'),
      description: formString(formData, 'description'),
      category: formString(formData, 'category'),
      severity: formString(formData, 'severity') || 'medium',
      clubId: nullable(formString(formData, 'clubId')),
      stationId: nullable(formString(formData, 'stationId')),
      deviceId: nullable(formString(formData, 'deviceId')),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    if (parsed.data.clubId) assertClubAccess(ctx.user, parsed.data.clubId);

    const now = new Date();
    const sla = await resolveSlaDeadlines(parsed.data.clubId, parsed.data.severity, now);

    const newId = await db.transaction(async (tx) => {
      const seqRow = await tx.execute(sql`SELECT COUNT(*)::int AS c FROM support_tickets`);
      const seq = Number((seqRow.rows[0] as { c: number }).c) + 1;

      const [ticket] = await tx
        .insert(supportTickets)
        .values({
          reference: buildReference('TK', now, seq),
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category as 'other',
          severity: parsed.data.severity,
          status: 'new',
          source: 'ops_console',
          clubId: parsed.data.clubId,
          stationId: parsed.data.stationId,
          deviceId: parsed.data.deviceId,
          reportedByUserId: ctx.user.id,
          slaPolicyId: sla.policyId,
          responseDueAt: sla.responseDueAt,
          resolutionDueAt: sla.resolutionDueAt,
          downtimeStartedAt: now,
        })
        .returning({ id: supportTickets.id });

      await tx.insert(ticketEvents).values({
        ticketId: ticket!.id,
        eventType: 'status_change',
        toStatus: 'new',
        actorUserId: ctx.user.id,
        message: 'הקריאה נפתחה מ־Ops Console',
      });

      await writeAudit(
        {
          action: 'create',
          actionKey: 'ticket.create',
          entityType: 'support_ticket',
          entityId: ticket!.id,
          entityLabel: parsed.data.title,
          clubId: parsed.data.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          after: { severity: parsed.data.severity, category: parsed.data.category },
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );

      return ticket!.id;
    });

    revalidate('/tickets', '/live');
    return actionOk({ id: newId }, 'הקריאה נפתחה');
  });
}

export async function assignTicketAction(
  ticketId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  return withPermission('tickets.assign', async (ctx) => {
    const [ticket] = await db
      .select({
        id: supportTickets.id,
        reference: supportTickets.reference,
        clubId: supportTickets.clubId,
        assigneeId: supportTickets.assigneeId,
        status: supportTickets.status,
      })
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), isNull(supportTickets.deletedAt)))
      .limit(1);
    if (!ticket) return actionError('הקריאה לא נמצאה');
    if (ticket.clubId) assertClubAccess(ctx.user, ticket.clubId);

    const newStatus = assigneeId && ticket.status === 'new' ? 'assigned' : ticket.status;

    await db.transaction(async (tx) => {
      await tx
        .update(supportTickets)
        .set({ assigneeId, status: newStatus })
        .where(eq(supportTickets.id, ticketId));
      await tx.insert(ticketEvents).values({
        ticketId,
        eventType: 'assignment',
        actorUserId: ctx.user.id,
        message: assigneeId ? 'הקריאה הוקצתה' : 'הקריאה שוחררה מהקצאה',
      });
      await writeAudit(
        {
          action: 'update',
          actionKey: 'ticket.assign',
          entityType: 'support_ticket',
          entityId: ticketId,
          entityLabel: ticket.reference,
          clubId: ticket.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { assigneeId: ticket.assigneeId },
          after: { assigneeId },
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/tickets', `/tickets/${ticketId}`);
    return actionOk(undefined, assigneeId ? 'הקריאה הוקצתה' : 'ההקצאה בוטלה');
  });
}

export async function updateTicketStatusAction(
  ticketId: string,
  newStatus: string,
  note: string,
): Promise<ActionResult> {
  return withPermission('tickets.edit', async (ctx) => {
    const parsed = z.string().trim().min(3, 'נא להוסיף הערה').safeParse(note);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'הערה אינה תקינה');

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        reference: supportTickets.reference,
        clubId: supportTickets.clubId,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        firstResponseAt: supportTickets.firstResponseAt,
        responseDueAt: supportTickets.responseDueAt,
        resolutionDueAt: supportTickets.resolutionDueAt,
        downtimeStartedAt: supportTickets.downtimeStartedAt,
      })
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), isNull(supportTickets.deletedAt)))
      .limit(1);
    if (!ticket) return actionError('הקריאה לא נמצאה');
    if (ticket.clubId) assertClubAccess(ctx.user, ticket.clubId);

    const now = new Date();
    const isResolving = newStatus === 'resolved' || newStatus === 'closed';

    const updates: Record<string, unknown> = { status: newStatus };

    // תגובה ראשונה נרשמת פעם אחת בלבד
    if (!ticket.firstResponseAt) {
      updates.firstResponseAt = now;
      updates.responseBreached = ticket.responseDueAt ? now > ticket.responseDueAt : false;
    }

    if (isResolving) {
      updates.resolvedAt = now;
      updates.resolutionBreached = ticket.resolutionDueAt ? now > ticket.resolutionDueAt : false;
      if (ticket.downtimeStartedAt) {
        updates.downtimeEndedAt = now;
        updates.downtimeMinutes = Math.max(
          0,
          Math.round((now.getTime() - ticket.downtimeStartedAt.getTime()) / 60000),
        );
      }
      if (newStatus === 'closed') updates.closedAt = now;
    }

    if (newStatus === 'reopened') {
      updates.resolvedAt = null;
      updates.closedAt = null;
      updates.downtimeStartedAt = now;
      updates.downtimeEndedAt = null;
    }

    await db.transaction(async (tx) => {
      await tx.update(supportTickets).set(updates).where(eq(supportTickets.id, ticketId));
      await tx.insert(ticketEvents).values({
        ticketId,
        eventType: 'status_change',
        fromStatus: ticket.status,
        toStatus: newStatus as 'new',
        actorUserId: ctx.user.id,
        message: parsed.data,
      });
      await writeAudit(
        {
          action: 'update',
          actionKey: 'ticket.status_change',
          entityType: 'support_ticket',
          entityId: ticketId,
          entityLabel: ticket.reference,
          clubId: ticket.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: ticket.status },
          after: { status: newStatus, ...updates },
          reason: parsed.data,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/tickets', `/tickets/${ticketId}`, '/live');
    return actionOk(undefined, 'סטטוס הקריאה עודכן');
  });
}

/** סגירת קריאה עם Root Cause ותיעוד מלא */
export async function closeTicketAction(formData: FormData): Promise<ActionResult> {
  return withPermission('tickets.close', async (ctx) => {
    const ticketId = formString(formData, 'ticketId');
    const schema = z.object({
      rootCause: z.string().trim().min(10, 'נא לפרט Root Cause של 10 תווים לפחות'),
      actionsTaken: z.string().trim().min(10, 'נא לפרט אילו פעולות בוצעו'),
      closureReason: z.string().trim().min(3, 'נא לציין סיבת סגירה'),
      repairCost: z.string().optional(),
      followUpRequired: z.boolean(),
    });

    const parsed = schema.safeParse({
      rootCause: formString(formData, 'rootCause'),
      actionsTaken: formString(formData, 'actionsTaken'),
      closureReason: formString(formData, 'closureReason'),
      repairCost: formString(formData, 'repairCost') || undefined,
      followUpRequired: formData.get('followUpRequired') === 'on',
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0];
        if (typeof k === 'string' && !fieldErrors[k]) fieldErrors[k] = i.message;
      }
      return actionError('נא לתקן את השדות המסומנים', fieldErrors);
    }

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        reference: supportTickets.reference,
        clubId: supportTickets.clubId,
        status: supportTickets.status,
        resolutionDueAt: supportTickets.resolutionDueAt,
        downtimeStartedAt: supportTickets.downtimeStartedAt,
      })
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), isNull(supportTickets.deletedAt)))
      .limit(1);
    if (!ticket) return actionError('הקריאה לא נמצאה');
    if (ticket.clubId) assertClubAccess(ctx.user, ticket.clubId);

    const now = new Date();
    const downtimeMinutes = ticket.downtimeStartedAt
      ? Math.max(0, Math.round((now.getTime() - ticket.downtimeStartedAt.getTime()) / 60000))
      : 0;

    await db.transaction(async (tx) => {
      await tx
        .update(supportTickets)
        .set({
          status: 'closed',
          resolvedAt: now,
          closedAt: now,
          downtimeEndedAt: now,
          downtimeMinutes,
          resolutionBreached: ticket.resolutionDueAt ? now > ticket.resolutionDueAt : false,
          rootCause: parsed.data.rootCause,
          actionsTaken: parsed.data.actionsTaken,
          closureReason: parsed.data.closureReason,
          repairCost: parsed.data.repairCost ?? '0',
          followUpRequired: parsed.data.followUpRequired,
        })
        .where(eq(supportTickets.id, ticketId));

      await tx.insert(ticketEvents).values({
        ticketId,
        eventType: 'status_change',
        fromStatus: ticket.status,
        toStatus: 'closed',
        actorUserId: ctx.user.id,
        message: `${parsed.data.closureReason} — ${parsed.data.actionsTaken}`,
      });

      await writeAudit(
        {
          action: 'update',
          actionKey: 'ticket.close',
          entityType: 'support_ticket',
          entityId: ticketId,
          entityLabel: ticket.reference,
          clubId: ticket.clubId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRoleKeys: ctx.user.roleKeys,
          before: { status: ticket.status },
          after: {
            status: 'closed',
            rootCause: parsed.data.rootCause,
            downtimeMinutes,
            repairCost: parsed.data.repairCost,
          },
          reason: parsed.data.closureReason,
          ipAddress: ctx.ipAddress,
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    revalidate('/tickets', `/tickets/${ticketId}`, '/live');
    return actionOk(undefined, 'הקריאה נסגרה');
  });
}

/** הוספת הערה לקריאה */
export async function addTicketCommentAction(
  ticketId: string,
  message: string,
  isInternal: boolean,
): Promise<ActionResult> {
  return withPermission('tickets.edit', async (ctx) => {
    const parsed = z.string().trim().min(2, 'ההערה קצרה מדי').max(2000).safeParse(message);
    if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? 'הערה אינה תקינה');

    const [ticket] = await db
      .select({ id: supportTickets.id, clubId: supportTickets.clubId })
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);
    if (!ticket) return actionError('הקריאה לא נמצאה');
    if (ticket.clubId) assertClubAccess(ctx.user, ticket.clubId);

    await db.insert(ticketEvents).values({
      ticketId,
      eventType: 'comment',
      actorUserId: ctx.user.id,
      message: parsed.data,
      isInternal,
    });

    revalidate(`/tickets/${ticketId}`);
    return actionOk(undefined, 'ההערה נוספה');
  });
}
