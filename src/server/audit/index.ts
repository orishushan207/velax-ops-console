import 'server-only';
import { db, type DbOrTx } from '@/db/client';
import { auditLogs } from '@/db/schema';
import type { auditActionEnum } from '@/db/schema/enums';

type AuditAction = (typeof auditActionEnum.enumValues)[number];

export interface AuditEntry {
  action: AuditAction;
  /** מפתח מדויק: "refund.approve", "device.quarantine" */
  actionKey: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  clubId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRoleKeys?: string[];
  impersonatedByUserId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  /** חובה בפעולות כספיות */
  amount?: string | number | null;
  approvedByUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  authSessionId?: string | null;
  requestId?: string | null;
  succeeded?: boolean;
  errorMessage?: string | null;
}

/**
 * רישום ב־Audit Log.
 *
 * ⚠ סעיף 33 בהנחיות: "אל תבצע פעולה כספית ללא Audit Log."
 * לכן פונקציה זו מקבלת tx — בפעולות כספיות היא חייבת לרוץ באותה טרנזקציה
 * שבה בוצע השינוי, כדי שכישלון ברישום יבטל גם את הפעולה.
 */
export async function writeAudit(entry: AuditEntry, tx: DbOrTx = db): Promise<void> {
  await tx.insert(auditLogs).values({
    action: entry.action,
    actionKey: entry.actionKey,
    actorUserId: entry.actorUserId ?? null,
    actorName: entry.actorName ?? null,
    actorRoleKeys: entry.actorRoleKeys ?? [],
    impersonatedByUserId: entry.impersonatedByUserId ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    entityLabel: entry.entityLabel ?? null,
    clubId: entry.clubId ?? null,
    beforeValue: entry.before ?? null,
    afterValue: entry.after ?? null,
    reason: entry.reason ?? null,
    amount: entry.amount === null || entry.amount === undefined ? null : String(entry.amount),
    approvedByUserId: entry.approvedByUserId ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    authSessionId: entry.authSessionId ?? null,
    requestId: entry.requestId ?? null,
    succeeded: entry.succeeded ?? true,
    errorMessage: entry.errorMessage ?? null,
  });
}

/**
 * מחזיר רק את השדות שהשתנו — כדי שה־Audit Log לא יתפח בערכים זהים.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before[key];
    const next = after[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      b[key] = prev ?? null;
      a[key] = next ?? null;
    }
  }
  return { before: b, after: a };
}
