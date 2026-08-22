import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  courtBookings,
  courts,
  payments,
  refunds,
  rewardsAccounts,
  rewardsTransactions,
  sessionEvents,
  sessionPlayers,
  sessions,
} from '@/db/schema';
import { buildReference } from '@/lib/utils';
import { processingFee, round2, splitGross } from '@/lib/money';
import { idempotencyKey } from '@/server/auth/crypto';
import type { SeededStation } from './network';
import type { SeededPlayer } from './people';
import { Rng } from './rng';

const VAT_RATE = 0.18;
const PSP_PCT = 0.027;
const PSP_FIXED = 1;
const REWARDS_RESERVE_PCT = 0.06;

export interface SeededSession {
  id: string;
  reference: string;
  clubId: string;
  stationId: string;
  deviceId: string | null;
  userId: string | null;
  status: string;
  startedAt: Date | null;
  amountGross: number;
  amountNet: number;
  actualMinutes: number;
  paymentId: string | null;
  coachId: string | null;
  peakWindow: 'peak' | 'off_peak';
}

/**
 * 90 יום של פעילות אמיתית.
 *
 * ההתפלגות מכוונת ל־1.2–1.6 שעות בתשלום לעמדה ליום — בדיוק הטווח שהתוכנית
 * מגדירה כשער המעבר ל־PMF — כדי שהדשבורד יראה מספרים שמשמעותיים להחלטה,
 * ולא רעש אקראי.
 *
 * ⚠ כל שורה כאן נושאת is_demo = true. ה־UI מציג באנר קבוע כשקיימים נתוני הדגמה.
 */
export async function seedOperations(
  rng: Rng,
  now: Date,
  stationsList: SeededStation[],
  players: SeededPlayer[],
  coachIdByCode: Map<string, string>,
  programVersionIds: string[],
  days = 90,
) {
  console.log(`▸ ${days} ימי פעילות — סשנים, תשלומים וזיכויים...`);

  const courtRows = await db
    .select({ id: courts.id, clubId: courts.clubId })
    .from(courts);
  const courtsByClub = new Map<string, string[]>();
  for (const c of courtRows) {
    const list = courtsByClub.get(c.clubId) ?? [];
    list.push(c.id);
    courtsByClub.set(c.clubId, list);
  }

  const seeded: SeededSession[] = [];
  let sequence = 0;

  // אצווה לכתיבה יעילה
  const sessionBatch: (typeof sessions.$inferInsert)[] = [];
  const eventBatch: (typeof sessionEvents.$inferInsert)[] = [];
  const playerBatch: (typeof sessionPlayers.$inferInsert)[] = [];
  const paymentBatch: (typeof payments.$inferInsert)[] = [];
  const bookingBatch: (typeof courtBookings.$inferInsert)[] = [];
  const refundBatch: (typeof refunds.$inferInsert)[] = [];

  for (let dayOffset = days; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(now.getTime() - dayOffset * 86400000);
    dayStart.setHours(0, 0, 0, 0);
    const weekday = dayStart.getDay();
    // שישי חלש יותר, שבת וראשון חזקים
    const dayFactor = weekday === 5 ? 0.55 : weekday === 6 ? 1.15 : weekday === 0 ? 1.1 : 1.0;
    // מגמת צמיחה לאורך התקופה — 90 יום אחורה עד היום
    const growth = 0.72 + (1 - dayOffset / days) * 0.55;

    for (const station of stationsList) {
      const bp = station.blueprint;
      const clubAgeDays = bp.joinedDaysAgo;
      if (dayOffset > clubAgeDays) continue; // המועדון עדיין לא הצטרף

      const expected = bp.usageFactor * dayFactor * growth * 1.35;
      const sessionCount = Math.max(0, Math.round(rng.normal(expected, 0.75)));

      for (let s = 0; s < sessionCount; s++) {
        sequence++;
        const isOffPeak = rng.bool(bp.offPeakShare);
        const hour = isOffPeak ? rng.int(8, 15) : rng.pick([16, 17, 18, 19, 20, 21]);
        const startedAt = new Date(dayStart.getTime() + hour * 3600000 + rng.int(0, 55) * 60000);
        if (startedAt > now) continue;

        // בחירת שחקן: מוטה לשחקנים שהמועדון הזה הוא המועדף שלהם
        const clubPlayers = players.filter(
          (p) => p.preferredClubId === station.clubId && p.joinedAt <= startedAt,
        );
        const pool = clubPlayers.length > 4 ? clubPlayers : players.filter((p) => p.joinedAt <= startedAt);
        if (pool.length === 0) continue;

        // משתמשים פעילים נבחרים בסבירות גבוהה יותר
        const player = rng.weighted(pool.map((p) => [p, p.activityFactor] as const));
        const isGuest = rng.bool(0.11);

        const status = rng.weighted([
          ['completed' as const, 88],
          ['failed_to_start' as const, 4],
          ['interrupted' as const, 3],
          ['cancelled' as const, 3],
          ['fully_refunded' as const, 2],
        ]);

        const priceGross = bp.slaTier === 'premium' ? 100 : 90;
        const scheduledMinutes = rng.weighted([
          [60, 72],
          [30, 20],
          [90, 8],
        ]);
        const listGross = round2((priceGross * scheduledMinutes) / 60);

        // קופון מדי פעם בשעות שפל
        const discount = isOffPeak && rng.bool(0.12) ? round2(listGross * 0.2) : 0;
        const amountGross = status === 'cancelled' ? 0 : round2(listGross - discount);
        const { net, vat } = splitGross(amountGross, VAT_RATE);

        const actualMinutes =
          status === 'completed'
            ? scheduledMinutes - rng.int(0, 4)
            : status === 'interrupted'
              ? Math.round(scheduledMinutes * rng.float(0.2, 0.7))
              : 0;

        const sessionId = crypto.randomUUID();
        const reference = buildReference('VX', startedAt, sequence);
        const coachId = player.coachId && rng.bool(0.6) ? player.coachId : null;
        const playerCount = rng.bool(0.34) ? 2 : 1;

        const startedSuccessfully = status !== 'failed_to_start' && status !== 'cancelled';
        const needsStaffHelp = startedSuccessfully && rng.bool(0.035);

        sessionBatch.push({
          id: sessionId,
          reference,
          status,
          userId: isGuest ? null : player.userId,
          isGuest,
          guestPhone: isGuest ? player.phone : null,
          guestName: isGuest ? player.name : null,
          clubId: station.clubId,
          stationId: station.id,
          deviceId: station.deviceId,
          playerCount,
          programVersionId:
            programVersionIds.length > 0 && rng.bool(0.75) ? rng.pick(programVersionIds) : null,
          level: player.level,
          scheduledStartAt: startedAt,
          scheduledMinutes,
          startedAt: startedSuccessfully ? startedAt : null,
          endedAt: startedSuccessfully
            ? new Date(startedAt.getTime() + actualMinutes * 60000)
            : null,
          actualMinutes: startedSuccessfully ? actualMinutes : null,
          peakWindow: isOffPeak ? 'off_peak' : 'peak',
          listPriceGross: String(listGross),
          discountAmount: String(discount),
          amountGross: String(amountGross),
          vatAmount: String(vat),
          amountNet: String(net),
          vatRateApplied: String(VAT_RATE),
          refundedAmount: status === 'fully_refunded' ? String(amountGross) : '0',
          estimatedBalls: startedSuccessfully ? Math.round(actualMinutes * rng.int(8, 14)) : null,
          startedWithoutStaffHelp: startedSuccessfully ? !needsStaffHelp : false,
          failureReason:
            status === 'failed_to_start'
              ? rng.pick(['ble_timeout', 'device_offline', 'battery_low', 'lock_jam'])
              : null,
          endReason:
            status === 'completed'
              ? 'timer_completed'
              : status === 'interrupted'
                ? rng.pick(['device_error', 'player_stopped', 'safety_stop'])
                : null,
          purchaseChannel: rng.weighted([
            ['station_qr' as const, 58],
            ['app' as const, 22],
            ['station_nfc' as const, 10],
            ['coach_link' as const, 7],
            ['club_staff' as const, 3],
          ]),
          coachId,
          xpAwarded: status === 'completed' ? Math.min(300, 100 + rng.int(0, 60)) : 0,
          rewardsPointsAwarded: status === 'completed' ? rng.int(5, 25) : 0,
          createdAt: new Date(startedAt.getTime() - rng.int(2, 12) * 60000),
          isDemo: true,
        });

        playerBatch.push({
          sessionId,
          userId: isGuest ? null : player.userId,
          guestLabel: isGuest ? player.name : null,
          slot: 1,
          isPrimary: true,
          isDemo: true,
        });
        if (playerCount === 2) {
          const partner = rng.pick(pool);
          playerBatch.push({
            sessionId,
            userId: partner.userId === player.userId ? null : partner.userId,
            guestLabel: partner.userId === player.userId ? 'שותף אורח' : null,
            slot: 2,
            isDemo: true,
          });
        }

        // ─── אירועי הסשן ───
        const createdAt = new Date(startedAt.getTime() - rng.int(2, 12) * 60000);
        eventBatch.push({
          sessionId,
          eventType: 'created',
          occurredAt: createdAt,
          toStatus: 'draft',
          source: 'player_app',
          isDemo: true,
        });

        let paymentId: string | null = null;
        if (status !== 'cancelled') {
          paymentId = crypto.randomUUID();
          const capturedAt = new Date(createdAt.getTime() + rng.int(20, 90) * 1000);
          const fee = processingFee(amountGross, PSP_PCT, PSP_FIXED);

          paymentBatch.push({
            id: paymentId,
            reference: buildReference('PAY', capturedAt, sequence),
            sessionId,
            userId: isGuest ? null : player.userId,
            clubId: station.clubId,
            status: status === 'fully_refunded' ? 'refunded' : 'captured',
            method: rng.weighted([
              ['card' as const, 62],
              ['apple_pay' as const, 24],
              ['google_pay' as const, 11],
              ['club_staff_manual' as const, 3],
            ]),
            amountGross: String(amountGross),
            vatAmount: String(vat),
            amountNet: String(net),
            vatRateApplied: String(VAT_RATE),
            processingFee: String(fee),
            provider: 'mock',
            providerTransactionId: `mock_tx_${sessionId.slice(0, 12)}`,
            cardLast4: String(rng.int(1000, 9999)),
            cardBrand: rng.pick(['Visa', 'Mastercard', 'Isracard']),
            idempotencyKey: idempotencyKey('charge', sessionId),
            capturedAt,
            createdAt,
            isDemo: true,
          });

          eventBatch.push(
            {
              sessionId,
              eventType: 'payment_initiated',
              occurredAt: new Date(createdAt.getTime() + 5000),
              source: 'player_app',
              isDemo: true,
            },
            {
              sessionId,
              eventType: 'payment_succeeded',
              occurredAt: capturedAt,
              fromStatus: 'awaiting_payment',
              toStatus: 'paid',
              source: 'system',
              message: `נגבו ${amountGross.toFixed(2)} ₪`,
              isDemo: true,
            },
            {
              sessionId,
              eventType: 'token_issued',
              occurredAt: new Date(capturedAt.getTime() + 2000),
              toStatus: 'authorized',
              source: 'system',
              isDemo: true,
            },
          );

          if (status === 'failed_to_start') {
            eventBatch.push({
              sessionId,
              eventType: 'ble_failed',
              occurredAt: new Date(capturedAt.getTime() + rng.int(30, 180) * 1000),
              fromStatus: 'connecting',
              toStatus: 'failed_to_start',
              source: 'device',
              message: 'החיבור למכשיר נכשל לאחר שלושה ניסיונות',
              isDemo: true,
            });
          } else {
            eventBatch.push(
              {
                sessionId,
                eventType: 'ble_connected',
                occurredAt: new Date(startedAt.getTime() - 8000),
                toStatus: 'connecting',
                source: 'device',
                isDemo: true,
              },
              {
                sessionId,
                eventType: 'started',
                occurredAt: startedAt,
                fromStatus: 'connecting',
                toStatus: 'active',
                source: 'device',
                isDemo: true,
              },
            );
            const endedAt = new Date(startedAt.getTime() + actualMinutes * 60000);
            if (status === 'interrupted') {
              eventBatch.push({
                sessionId,
                eventType: 'error',
                occurredAt: endedAt,
                fromStatus: 'active',
                toStatus: 'interrupted',
                source: 'device',
                message: 'המכשיר הפסיק לפעול באמצע האימון',
                isDemo: true,
              });
            } else {
              eventBatch.push({
                sessionId,
                eventType: 'completed',
                occurredAt: endedAt,
                fromStatus: 'active',
                toStatus: status === 'fully_refunded' ? 'completed' : 'completed',
                source: 'device',
                isDemo: true,
              });
            }
          }

          // ─── זיכויים ───
          const needsRefund =
            status === 'fully_refunded' || status === 'failed_to_start' || status === 'interrupted';
          if (needsRefund && amountGross > 0) {
            const isFull = status === 'fully_refunded' || status === 'failed_to_start';
            const refundGross = isFull
              ? amountGross
              : round2(amountGross * rng.float(0.3, 0.6));
            const refundSplit = splitGross(refundGross, VAT_RATE);
            const refundedAt = new Date(startedAt.getTime() + rng.int(30, 2880) * 60000);
            if (refundedAt <= now) {
              refundBatch.push({
                reference: buildReference('RF', refundedAt, sequence),
                paymentId,
                sessionId,
                refundType: isFull ? 'full' : 'partial',
                destination: rng.bool(0.75) ? 'original_method' : 'wallet',
                status: 'completed',
                amountGross: String(refundGross),
                amountNet: String(refundSplit.net),
                vatAmount: String(refundSplit.vat),
                reason:
                  status === 'failed_to_start'
                    ? 'failed_to_start'
                    : status === 'interrupted'
                      ? 'device_malfunction'
                      : rng.pick(['customer_request', 'goodwill'] as const),
                reasonNote:
                  status === 'failed_to_start'
                    ? 'הסשן לא התחיל עקב כשל בחיבור BLE. זיכוי מלא אוטומטי לפי כלל המערכת.'
                    : status === 'interrupted'
                      ? 'המכשיר הפסיק לפעול באמצע האימון. זיכוי יחסי על הזמן שאבד.'
                      : 'זיכוי לבקשת הלקוח לאחר בירור מול התמיכה.',
                isAutomatic: status === 'failed_to_start',
                provider: 'mock',
                providerRefundId: `mock_rf_${sessionId.slice(0, 12)}`,
                idempotencyKey: idempotencyKey('refund', sessionId, refundGross),
                processedAt: refundedAt,
                createdAt: refundedAt,
                isDemo: true,
              });

              if (!isFull) {
                // סשן שזוכה חלקית משנה סטטוס
                const idx = sessionBatch.findIndex((x) => x.id === sessionId);
                if (idx >= 0) {
                  sessionBatch[idx]!.status = 'partially_refunded';
                  sessionBatch[idx]!.refundedAmount = String(refundGross);
                }
              }
              eventBatch.push({
                sessionId,
                eventType: 'refunded',
                occurredAt: refundedAt,
                source: 'ops_console',
                message: `זוכה ${refundGross.toFixed(2)} ₪`,
                isDemo: true,
              });
            }
          }
        } else {
          eventBatch.push({
            sessionId,
            eventType: 'note',
            occurredAt: new Date(createdAt.getTime() + 60000),
            toStatus: 'cancelled',
            source: 'player_app',
            message: 'השחקן ביטל לפני התשלום',
            isDemo: true,
          });
        }

        // ─── הזמנת מגרש מקושרת ───
        // רק חלק מהסשנים מקושרים להזמנה. זו בדיוק הנקודה שהתוכנית מודה בה:
        // לא כל שעת מכונה מייצרת הכנסת מגרש חדשה.
        const clubCourts = courtsByClub.get(station.clubId) ?? [];
        if (startedSuccessfully && clubCourts.length > 0 && rng.bool(0.62)) {
          const bookingMinutes = rng.pick([60, 90]);
          const linkType = rng.weighted([
            ['machine_linked' as const, 48],
            ['incremental' as const, 27],
            ['baseline' as const, 17],
            ['unverified' as const, 8],
          ]);
          bookingBatch.push({
            clubId: station.clubId,
            courtId: rng.pick(clubCourts),
            externalBookingId: `EXT-${station.clubCode}-${sequence}`,
            sessionId,
            linkType,
            startsAt: startedAt,
            endsAt: new Date(startedAt.getTime() + bookingMinutes * 60000),
            durationMinutes: bookingMinutes,
            peakWindow: isOffPeak ? 'off_peak' : 'peak',
            revenueNet: String(round2((bp.courtRevenuePerHour * bookingMinutes) / 60)),
            bookedByPhone: player.phone,
            classificationNote:
              linkType === 'baseline'
                ? 'המועדון סימן: ההזמנה הייתה מתקיימת גם ללא המכונה.'
                : linkType === 'incremental'
                  ? 'אומת מול צוות המועדון: השחקן הגיע בגלל העמדה.'
                  : null,
            createdAt: startedAt,
            isDemo: true,
          });
        }

        seeded.push({
          id: sessionId,
          reference,
          clubId: station.clubId,
          stationId: station.id,
          deviceId: station.deviceId,
          userId: isGuest ? null : player.userId,
          status,
          startedAt: startedSuccessfully ? startedAt : null,
          amountGross,
          amountNet: net,
          actualMinutes,
          paymentId,
          coachId,
          peakWindow: isOffPeak ? 'off_peak' : 'peak',
        });
      }
    }
  }

  // ─── כתיבה באצוות ───
  const CHUNK = 500;
  const writeChunks = async <T>(rowsArr: T[], writer: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rowsArr.length; i += CHUNK) {
      await writer(rowsArr.slice(i, i + CHUNK));
    }
  };

  await writeChunks(sessionBatch, (c) => db.insert(sessions).values(c));
  await writeChunks(playerBatch, (c) => db.insert(sessionPlayers).values(c));
  await writeChunks(paymentBatch, (c) => db.insert(payments).values(c));
  await writeChunks(eventBatch, (c) => db.insert(sessionEvents).values(c));
  await writeChunks(bookingBatch, (c) => db.insert(courtBookings).values(c));
  await writeChunks(refundBatch, (c) => db.insert(refunds).values(c));

  console.log(
    `  ✓ ${sessionBatch.length} סשנים · ${paymentBatch.length} תשלומים · ${refundBatch.length} זיכויים · ${bookingBatch.length} הזמנות מגרש`,
  );

  // ─── Rewards: צבירה על סשנים שהושלמו ───
  console.log('▸ Rewards...');
  const accounts = await db
    .select({ id: rewardsAccounts.id, userId: rewardsAccounts.userId })
    .from(rewardsAccounts);
  const accountByUser = new Map(accounts.map((a) => [a.userId, a.id]));

  const rewardsBatch: (typeof rewardsTransactions.$inferInsert)[] = [];
  const totals = new Map<string, { xp: number; points: number }>();

  for (const s of seeded) {
    if (s.status !== 'completed' || !s.userId) continue;
    const accountId = accountByUser.get(s.userId);
    if (!accountId) continue;
    const t = totals.get(accountId) ?? { xp: 0, points: 0 };
    const xp = 100;
    const points = rng.int(5, 25);
    t.xp += xp;
    t.points += points;
    totals.set(accountId, t);

    rewardsBatch.push({
      accountId,
      txType: 'earn_session',
      xpDelta: xp,
      pointsDelta: points,
      pointsBalanceAfter: t.points,
      sessionId: s.id,
      // עלות ההטבה ל־VELA-X: 6% מההכנסה נטו, לפי פרק 11.4
      costToCompany: String(round2(s.amountNet * REWARDS_RESERVE_PCT)),
      expiresAt: new Date(now.getTime() + 365 * 86400000),
      createdAt: s.startedAt ?? now,
      isDemo: true,
    });
  }

  await writeChunks(rewardsBatch, (c) => db.insert(rewardsTransactions).values(c));

  for (const [accountId, t] of totals) {
    await db
      .update(rewardsAccounts)
      .set({
        xpTotal: t.xp,
        pointsBalance: t.points,
        pointsEarnedTotal: t.points,
        currentStreakWeeks: rng.int(0, 9),
        longestStreakWeeks: rng.int(1, 14),
        lastActivityDate: now.toISOString().slice(0, 10),
      })
      .where(eq(rewardsAccounts.id, accountId));
  }

  console.log(`  ✓ ${rewardsBatch.length} תנועות Rewards`);

  return seeded;
}

/**
 * סשנים פעילים ברגע זה — כדי שמסך "פעילות בזמן אמת" יציג מצב אמיתי
 * ולא מסך ריק. נוצרים עם started_at בעבר הקרוב וסטטוס active/paused.
 */
export async function seedActiveSessions(
  rng: Rng,
  now: Date,
  stationsList: SeededStation[],
  players: SeededPlayer[],
  programVersionIds: string[],
) {
  const usable = stationsList.filter((s) => s.deviceId).slice(0, 4);
  const created: string[] = [];

  for (const [index, station] of usable.entries()) {
    const bp = station.blueprint;
    const player = rng.pick(players);
    const minutesIn = rng.int(6, 42);
    const startedAt = new Date(now.getTime() - minutesIn * 60000);
    const scheduledMinutes = rng.pick([30, 60, 60, 90]);
    const priceGross = bp.slaTier === 'premium' ? 100 : 90;
    const amountGross = round2((priceGross * scheduledMinutes) / 60);
    const { net, vat } = splitGross(amountGross, VAT_RATE);
    const sessionId = crypto.randomUUID();
    const reference = buildReference('VX', now, 9000 + index);
    const status = index === 3 ? ('paused' as const) : ('active' as const);
    const hour = startedAt.getHours();
    const isOffPeak = hour >= 8 && hour < 16;

    await db.insert(sessions).values({
      id: sessionId,
      reference,
      status,
      userId: player.userId,
      isGuest: false,
      clubId: station.clubId,
      stationId: station.id,
      deviceId: station.deviceId,
      playerCount: rng.bool(0.35) ? 2 : 1,
      programVersionId: programVersionIds.length > 0 ? rng.pick(programVersionIds) : null,
      level: player.level,
      scheduledStartAt: startedAt,
      scheduledMinutes,
      startedAt,
      actualMinutes: null,
      pausedMinutes: status === 'paused' ? rng.int(1, 4) : 0,
      peakWindow: isOffPeak ? 'off_peak' : 'peak',
      listPriceGross: String(amountGross),
      amountGross: String(amountGross),
      vatAmount: String(vat),
      amountNet: String(net),
      vatRateApplied: String(VAT_RATE),
      estimatedBalls: minutesIn * rng.int(8, 13),
      startedWithoutStaffHelp: true,
      purchaseChannel: 'station_qr',
      createdAt: new Date(startedAt.getTime() - 3 * 60000),
      isDemo: true,
    });

    await db.insert(sessionPlayers).values({
      sessionId,
      userId: player.userId,
      slot: 1,
      isPrimary: true,
      isDemo: true,
    });

    const paymentId = crypto.randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      reference: buildReference('PAY', now, 9000 + index),
      sessionId,
      userId: player.userId,
      clubId: station.clubId,
      status: 'captured',
      method: 'card',
      amountGross: String(amountGross),
      vatAmount: String(vat),
      amountNet: String(net),
      vatRateApplied: String(VAT_RATE),
      processingFee: String(processingFee(amountGross, PSP_PCT, PSP_FIXED)),
      provider: 'mock',
      providerTransactionId: `mock_tx_${sessionId.slice(0, 12)}`,
      cardLast4: String(rng.int(1000, 9999)),
      cardBrand: 'Visa',
      idempotencyKey: idempotencyKey('charge', sessionId),
      capturedAt: new Date(startedAt.getTime() - 2 * 60000),
      createdAt: new Date(startedAt.getTime() - 3 * 60000),
      isDemo: true,
    });

    await db.insert(sessionEvents).values([
      {
        sessionId,
        eventType: 'payment_succeeded',
        occurredAt: new Date(startedAt.getTime() - 2 * 60000),
        toStatus: 'paid',
        source: 'system',
        isDemo: true,
      },
      {
        sessionId,
        eventType: 'started',
        occurredAt: startedAt,
        toStatus: 'active',
        source: 'device',
        isDemo: true,
      },
    ]);

    created.push(sessionId);
  }

  console.log(`  ✓ ${created.length} סשנים פעילים כרגע (למסך הזמן־אמת)`);
  return created;
}
