import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db, type DbOrTx } from '@/db/client';
import { deviceCommands } from '@/db/schema';
import { enqueueCommand } from './command-queue';
import { relayMessage } from '@/lib/relay-message';

export { relayMessage };

/**
 * העברת פקודה תפעולית אל המכונה, דרך אפליקציית הטלפון.
 *
 * ⚠ אין כאן שליחה. הענן אינו מגיע למכונה, ולכן הפקודה נכנסת לתור וממתינה
 * שהאפליקציה תאסוף אותה. הפונקציה מחזירה במפורש `pending` ולא `sent`,
 * כדי שה־UI לא יבטיח למפעיל דבר שלא קרה.
 */

export type { RelayState as RelayOutcome } from '@/lib/relay-message';
import type { RelayState as RelayOutcome } from '@/lib/relay-message';

export async function relayDeviceCommand(
  params: {
    deviceUuid: string | null;
    sessionId: string;
    command: string;
    payload?: Record<string, unknown> | null;
    issuedBy: string;
    reason?: string | null;
  },
  tx: DbOrTx = db,
): Promise<RelayOutcome> {
  if (!params.deviceUuid) {
    // עמדה בלי מכונה משויכת היא מצב תקין — הפעולה התפעולית נרשמת בכל מקרה
    return { state: 'no_device', message: 'אין מכונה משויכת לסשן' };
  }

  const { id, expiresAt } = await enqueueCommand(
    {
      deviceUuid: params.deviceUuid,
      sessionId: params.sessionId,
      command: params.command,
      payload: params.payload ?? null,
      issuedBy: params.issuedBy,
      reason: params.reason ?? null,
    },
    tx,
  );

  return { state: 'queued', commandId: id, expiresAt };
}

/** פקודות שעדיין לא הגיעו למכונה, לתצוגה במסך הסשן */
export interface PendingRelay {
  id: string;
  command: string;
  status: string;
  issuedAt: Date;
  expiresAt: Date;
  fetchedAt: Date | null;
}

export async function listPendingRelays(sessionId: string): Promise<PendingRelay[]> {
  return db
    .select({
      id: deviceCommands.id,
      command: deviceCommands.command,
      status: deviceCommands.status,
      issuedAt: deviceCommands.issuedAt,
      expiresAt: deviceCommands.expiresAt,
      fetchedAt: deviceCommands.fetchedAt,
    })
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.sessionId, sessionId),
        inArray(deviceCommands.status, ['pending', 'fetched']),
      ),
    )
    .orderBy(deviceCommands.issuedAt);
}
