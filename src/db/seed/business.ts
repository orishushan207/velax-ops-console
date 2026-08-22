import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  automationRules,
  challenges,
  coachAttributions,
  coachCommissions,
  coupons,
  crmActivities,
  earnBackAdjustments,
  earnBackAgreements,
  earnBackConditions,
  earnBackMeasurements,
  leads,
  screenCampaigns,
  tasks,
} from '@/db/schema';
import { round2 } from '@/lib/money';
import type { SeededSession } from './operations';
import { CLUB_BLUEPRINTS } from './network';
import { Rng } from './rng';

const INCREMENTALITY = 0.7;

/** תנאי הסף לערבות — PDF פרק 8.4 */
const EARN_BACK_CONDITIONS = [
  { key: 'min_off_peak_hours', nameHe: 'זמינות של שתי שעות Off-Peak בשישה ימים בשבוע', target: 2, unit: 'שעות/יום' },
  { key: 'uptime', nameHe: 'זמינות תפעולית של לפחות 90%, כולל טעינה וכדורים', target: 0.9, unit: '%' },
  { key: 'prominent_location', nameHe: 'מיקום העמדה בנקודה בולטת והפעלת המסך', target: 1, unit: 'בוליאני' },
  { key: 'booking_link', nameHe: 'חיבור הזמנת המגרש לקוד VELA-X למדידת הכנסה', target: 1, unit: 'בוליאני' },
  { key: 'staff_training', nameHe: 'הכשרת צוות הקבלה והצגת ההצעה ללקוחות', target: 1, unit: 'בוליאני' },
  { key: 'no_competitor', nameHe: 'אי־הצבת מכשיר מתחרה ליד העמדה', target: 1, unit: 'בוליאני' },
  { key: 'incident_reporting', nameHe: 'דיווח על תקלה תוך זמן מוגדר', target: 1, unit: 'בוליאני' },
  { key: 'checklist_completion', nameHe: 'ביצוע Checklist יומי', target: 0.85, unit: '%' },
];

export async function seedBusiness(
  rng: Rng,
  now: Date,
  clubIdByCode: Map<string, string>,
  contractIdByClub: Map<string, string>,
  sessionsList: SeededSession[],
  staffIds: Map<string, string>,
  _coachIds: Map<string, string>,
) {
  console.log('▸ Earn-Back...');
  const financeId = staffIds.get('finance') ?? null;
  const managementId = staffIds.get('management') ?? null;

  for (const bp of CLUB_BLUEPRINTS) {
    const clubId = clubIdByCode.get(bp.code);
    if (!clubId) continue;

    const entryPrice = bp.setupFee;
    if (entryPrice <= 0) continue;

    const startsOn = new Date(now.getTime() - Math.min(bp.joinedDaysAgo, 175) * 86400000);
    const endsOn = new Date(startsOn.getTime() + 180 * 86400000);
    const courtRevenuePerHour = bp.courtRevenuePerHour;
    const requiredHours = round2(entryPrice / courtRevenuePerHour);
    const operatingDays = 156;

    // ההכנסה שנספרת בפועל — מחושבת מהזמנות המגרש שנוצרו ב־seed התפעולי
    const revenueRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'incremental'), 0)::numeric AS incremental,
        COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'machine_linked'), 0)::numeric AS linked,
        COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'baseline'), 0)::numeric AS baseline,
        COALESCE(SUM(b.duration_minutes) FILTER (WHERE b.session_id IS NOT NULL), 0)::numeric AS linked_minutes
      FROM court_bookings b
      WHERE b.club_id = ${clubId}::uuid
        AND b.starts_at >= ${startsOn}
        AND b.is_cancelled = false
    `);
    const rev = (revenueRow.rows[0] ?? {}) as Record<string, string>;
    const incremental = Number(rev.incremental ?? 0);
    const linked = Number(rev.linked ?? 0);
    const countedRevenue = round2(incremental + linked * INCREMENTALITY);
    const achievedHours = round2(Number(rev.linked_minutes ?? 0) / 60);

    const elapsedDays = Math.max(
      1,
      Math.min(operatingDays, Math.round((now.getTime() - startsOn.getTime()) / 86400000 * (operatingDays / 180))),
    );
    const remainingDays = Math.max(0, operatingDays - elapsedDays);
    const remainingGap = round2(Math.max(0, entryPrice - countedRevenue));
    const requiredRunRate = remainingDays > 0 ? round2(remainingGap / remainingDays / courtRevenuePerHour) : 0;
    const actualRunRate = elapsedDays > 0 ? countedRevenue / elapsedDays / courtRevenuePerHour : 0;
    const forecastRevenue = round2(countedRevenue + actualRunRate * courtRevenuePerHour * remainingDays);
    const willMeet = forecastRevenue >= entryPrice;

    const status: 'met' | 'at_risk' | 'active' =
      countedRevenue >= entryPrice ? 'met' : willMeet ? 'active' : 'at_risk';

    const [agreement] = await db
      .insert(earnBackAgreements)
      .values({
        clubId,
        contractId: contractIdByClub.get(bp.code) ?? null,
        status,
        entryPrice: String(entryPrice),
        startsOn: startsOn.toISOString().slice(0, 10),
        endsOn: endsOn.toISOString().slice(0, 10),
        operatingDaysInPeriod: operatingDays,
        courtRevenuePerHourNet: String(courtRevenuePerHour),
        requiredHours: String(requiredHours),
        requiredHoursPerDay: String(round2(requiredHours / operatingDays)),
        incrementalityFactor: String(INCREMENTALITY.toFixed(6)),
        clubBallCostPerHour: '20',
        exposureCap: String(entryPrice),
        reservePct: '0.125000',
        achievedHours: String(achievedHours),
        verifiedRevenue: String(countedRevenue),
        remainingGap: String(remainingGap),
        requiredRunRatePerDay: String(requiredRunRate),
        forecastRevenue: String(forecastRevenue),
        forecastWillMeet: willMeet,
        lastCalculatedAt: now,
        isDemo: true,
      })
      .returning({ id: earnBackAgreements.id });
    if (!agreement) continue;

    for (const c of EARN_BACK_CONDITIONS) {
      // המועדון החלש נכשל בחלק מהתנאים
      const met = bp.usageFactor < 0.6 ? rng.bool(0.55) : rng.bool(0.9);
      await db.insert(earnBackConditions).values({
        agreementId: agreement.id,
        conditionKey: c.key,
        nameHe: c.nameHe,
        targetValue: String(c.target),
        unit: c.unit,
        measuredValue: String(met ? c.target : round2(c.target * rng.float(0.4, 0.85))),
        status: met ? 'met' : 'not_met',
        lastCheckedAt: now,
        isDemo: true,
      });
    }

    // מדידות חודשיות
    let cumulative = 0;
    const monthCount = Math.min(6, Math.max(1, Math.floor(elapsedDays / 26)));
    for (let m = 0; m < monthCount; m++) {
      const periodStart = new Date(startsOn.getTime() + m * 30 * 86400000);
      const periodEnd = new Date(periodStart.getTime() + 30 * 86400000);
      if (periodStart > now) break;

      const monthRow = await db.execute(sql`
        SELECT
          COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'incremental'), 0)::numeric AS incremental,
          COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'machine_linked'), 0)::numeric AS linked,
          COALESCE(SUM(b.revenue_net) FILTER (WHERE b.link_type = 'baseline'), 0)::numeric AS baseline,
          COALESCE(SUM(b.duration_minutes) FILTER (WHERE b.session_id IS NOT NULL), 0)::numeric AS minutes,
          COALESCE(SUM(b.duration_minutes) FILTER (WHERE b.peak_window = 'off_peak'), 0)::numeric AS off_peak_minutes
        FROM court_bookings b
        WHERE b.club_id = ${clubId}::uuid
          AND b.starts_at >= ${periodStart} AND b.starts_at < ${periodEnd}
          AND b.is_cancelled = false
      `);
      const mr = (monthRow.rows[0] ?? {}) as Record<string, string>;
      const mInc = Number(mr.incremental ?? 0);
      const mLinked = Number(mr.linked ?? 0);
      const mBaseline = Number(mr.baseline ?? 0);
      const mCounted = round2(mInc + mLinked * INCREMENTALITY);
      const mHours = round2(Number(mr.minutes ?? 0) / 60);
      const ballCost = round2(mHours * 20);
      cumulative = round2(cumulative + mCounted);

      const sessionHoursRow = await db.execute(sql`
        SELECT COALESCE(SUM(COALESCE(s.actual_minutes, s.scheduled_minutes)), 0)::numeric AS minutes
        FROM sessions s
        WHERE s.club_id = ${clubId}::uuid
          AND s.started_at >= ${periodStart} AND s.started_at < ${periodEnd}
          AND s.status IN ('completed','partially_refunded','active','paused')
          AND s.refunded_amount < s.amount_gross
      `);
      const paidHours = round2(
        Number((sessionHoursRow.rows[0] as Record<string, string>)?.minutes ?? 0) / 60,
      );

      await db.insert(earnBackMeasurements).values({
        agreementId: agreement.id,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        paidSessionHours: String(paidHours),
        machineLinkedRevenue: String(round2(mLinked + mInc)),
        incrementalRevenue: String(round2(mInc)),
        baselineRevenue: String(round2(mBaseline)),
        countedRevenue: String(mCounted),
        clubBallCost: String(ballCost),
        netClubBenefit: String(round2(mCounted - ballCost)),
        cumulativeCountedRevenue: String(cumulative),
        offPeakHours: String(round2(Number(mr.off_peak_minutes ?? 0) / 60)),
        uptimePct: String(rng.float(0.9, 0.995, 4)),
        operatingDays: 26,
        calculatedBy: financeId,
        calculationSnapshot: {
          incrementalityFactor: INCREMENTALITY,
          courtRevenuePerHour,
          note: 'חושב מהזמנות מגרש מקושרות בלבד. הזמנות שסווגו כבסיסיות לא נספרו.',
        },
        isDemo: true,
      });
    }

    // התאמה ידנית אחת — להדגמת Audit Trail על חישוב הערבות
    if (bp.code === 'BSH-01') {
      await db.insert(earnBackAdjustments).values({
        agreementId: agreement.id,
        adjustmentType: 'period_extension',
        days: 12,
        reason:
          'העמדה הושבתה 12 ימים עקב תקלת מנוע הזנה שאינה באחריות המועדון. תקופת הערבות מוארכת בהתאם.',
        approvedBy: managementId ?? financeId ?? '',
        approvedAt: new Date(now.getTime() - 20 * 86400000),
        isDemo: true,
      });
    }
  }
  console.log(`  ✓ ${CLUB_BLUEPRINTS.length} הסכמי Earn-Back עם מדידות ותנאי סף`);

  // ─── עמלות מאמנים ───
  console.log('▸ עמלות מאמנים...');
  let commissionCount = 0;
  const attributionCache = new Map<string, string>();

  for (const session of sessionsList) {
    if (!session.coachId || !session.userId || session.status !== 'completed') continue;
    if (!rng.bool(0.55)) continue;

    const cacheKey = `${session.coachId}:${session.userId}`;
    let attributionId = attributionCache.get(cacheKey);
    if (!attributionId) {
      const [attr] = await db
        .insert(coachAttributions)
        .values({
          coachId: session.coachId,
          userId: session.userId,
          attributionType: 'homework',
          attributedAt: session.startedAt ?? now,
          expiresAt: new Date((session.startedAt ?? now).getTime() + 180 * 86400000),
          isDemo: true,
        })
        .onConflictDoNothing()
        .returning({ id: coachAttributions.id });
      if (attr) {
        attributionId = attr.id;
        attributionCache.set(cacheKey, attr.id);
      }
    }

    const ratePct = 0.075;
    const commission = round2(session.amountNet * ratePct);
    const accruedAt = session.startedAt ?? now;
    const holdingUntil = new Date(accruedAt.getTime() + 30 * 86400000);
    const isPast = holdingUntil < now;

    await db.insert(coachCommissions).values({
      coachId: session.coachId,
      attributionId: attributionId ?? null,
      sessionId: session.id,
      attributionType: 'homework',
      status: isPast ? (rng.bool(0.7) ? 'paid' : 'approved') : 'holding_period',
      baseAmountNet: String(session.amountNet),
      ratePct: String(ratePct.toFixed(6)),
      commissionAmount: String(commission),
      accruedAt,
      holdingUntil,
      approvedBy: isPast ? financeId : null,
      approvedAt: isPast ? holdingUntil : null,
      paidAt: isPast && rng.bool(0.7) ? new Date(holdingUntil.getTime() + 3 * 86400000) : null,
      isDemo: true,
    });
    commissionCount++;
  }
  console.log(`  ✓ ${commissionCount} רשומות עמלה`);

  // ─── CRM ───
  console.log('▸ CRM — לידים ומשימות...');
  const salesId = staffIds.get('sales') ?? null;
  const leadBlueprints = [
    { name: 'פאדל חיפה — קריית אליעזר', city: 'חיפה', region: 'הצפון', courts: 5, stage: 'negotiation' as const, prob: 0.6 },
    { name: 'Padel Point נתניה', city: 'נתניה', region: 'השרון', courts: 4, stage: 'proposal_sent' as const, prob: 0.45 },
    { name: 'מועדון פאדל מודיעין', city: 'מודיעין', region: 'המרכז', courts: 3, stage: 'demo_completed' as const, prob: 0.35 },
    { name: 'פאדל אשדוד ספורט', city: 'אשדוד', region: 'הדרום', courts: 6, stage: 'demo_scheduled' as const, prob: 0.3 },
    { name: 'Elite Padel רמת גן', city: 'רמת גן', region: 'תל אביב והמרכז', courts: 4, stage: 'qualified' as const, prob: 0.25 },
    { name: 'מועדון הכפר הירוק', city: 'רמת השרון', region: 'השרון', courts: 3, stage: 'contacted' as const, prob: 0.15 },
    { name: 'פאדל באר יעקב', city: 'באר יעקב', region: 'המרכז', courts: 2, stage: 'lead' as const, prob: 0.1 },
    { name: 'Sport City ראשון לציון', city: 'ראשון לציון', region: 'המרכז', courts: 8, stage: 'contract_sent' as const, prob: 0.75 },
    { name: 'פאדל אילת', city: 'אילת', region: 'הדרום', courts: 3, stage: 'on_hold' as const, prob: 0.1 },
    { name: 'מועדון פאדל כרמיאל', city: 'כרמיאל', region: 'הצפון', courts: 2, stage: 'lost' as const, prob: 0 },
    { name: 'Padel Zone פתח תקווה', city: 'פתח תקווה', region: 'המרכז', courts: 5, stage: 'pilot_agreed' as const, prob: 0.8 },
    { name: 'מועדון פאדל אשקלון', city: 'אשקלון', region: 'הדרום', courts: 4, stage: 'lead' as const, prob: 0.1 },
  ];

  for (const lb of leadBlueprints) {
    const createdAt = new Date(now.getTime() - rng.int(5, 120) * 86400000);
    const stationPotential = Math.max(1, Math.round(lb.courts / 2.5));
    const [lead] = await db
      .insert(leads)
      .values({
        clubName: lb.name,
        stage: lb.stage,
        city: lb.city,
        region: lb.region,
        courtCount: lb.courts,
        audienceType: rng.pick(['משפחות', 'תחרותי', 'מעורב', 'אקדמיה']),
        offPeakAvailabilityHours: String(rng.float(1.5, 5, 1)),
        stationPotential,
        contactName: `${rng.pick(['רן', 'שירי', 'עידן', 'נועה', 'טל'])} ${rng.pick(['לוי', 'כהן', 'ברק', 'שרון'])}`,
        contactRole: 'בעלים',
        contactEmail: `contact@${lb.city.replace(/\s/g, '')}.example.co.il`,
        contactPhone: `05${rng.int(0, 8)}${rng.int(1000000, 9999999)}`,
        source: rng.pick(['הפניה ממועדון', 'כנס ספורט', 'פנייה יזומה', 'אתר', 'המלצת מאמן']),
        ownerId: salesId,
        closeProbability: String(lb.prob.toFixed(6)),
        dealValue: String(stationPotential * 6000),
        expectedCloseDate: new Date(now.getTime() + rng.int(10, 90) * 86400000)
          .toISOString()
          .slice(0, 10),
        nextFollowUpAt:
          lb.stage === 'lost'
            ? null
            : new Date(now.getTime() + rng.int(-3, 14) * 86400000),
        lostReason: lb.stage === 'lost' ? 'המועדון בחר בפתרון מתחרה במחיר נמוך יותר' : null,
        lostAt: lb.stage === 'lost' ? new Date(now.getTime() - 15 * 86400000) : null,
        createdAt,
        isDemo: true,
      })
      .returning({ id: leads.id });
    if (!lead) continue;

    const activityCount = rng.int(1, 5);
    for (let i = 0; i < activityCount; i++) {
      await db.insert(crmActivities).values({
        leadId: lead.id,
        activityType: rng.pick(['call', 'email', 'meeting', 'demo', 'note'] as const),
        subject: rng.pick([
          'שיחת היכרות ראשונה',
          'שליחת חומרים והצעת ערך',
          'תיאום הדגמה במועדון',
          'הדגמה בוצעה — משוב חיובי',
          'דיון בתנאי הערבות',
        ]),
        body: 'נרשם על ידי מנהל המכירות.',
        occurredAt: new Date(createdAt.getTime() + i * rng.int(2, 12) * 86400000),
        performedBy: salesId,
        isDemo: true,
      });
    }

    if (lb.stage !== 'lost' && rng.bool(0.6)) {
      await db.insert(tasks).values({
        title: `מעקב מול ${lb.name}`,
        description: 'לחזור עם תשובה על תנאי ה־Earn-Back ולוח זמנים להתקנה.',
        status: rng.pick(['open', 'in_progress'] as const),
        priority: lb.prob > 0.5 ? 'high' : 'medium',
        assigneeId: salesId,
        createdBy: salesId,
        dueAt: new Date(now.getTime() + rng.int(-2, 10) * 86400000),
        leadId: lead.id,
        isDemo: true,
      });
    }
  }
  console.log(`  ✓ ${leadBlueprints.length} לידים`);

  // ─── קופונים ואתגרים ───
  console.log('▸ Rewards — קופונים ואתגרים...');
  await db.insert(coupons).values([
    {
      code: 'OFFPEAK20',
      nameHe: '20% הנחה בשעות שפל',
      couponType: 'percentage',
      value: '0.20',
      maxDiscountAmount: '25',
      validFrom: new Date(now.getTime() - 60 * 86400000),
      validUntil: new Date(now.getTime() + 60 * 86400000),
      maxRedemptions: 500,
      maxRedemptionsPerUser: 4,
      redemptionCount: rng.int(60, 180),
      offPeakOnly: true,
      costToCompany: '18',
      createdBy: staffIds.get('marketing') ?? null,
      isDemo: true,
    },
    {
      code: 'FIRSTTRY',
      nameHe: 'אימון ראשון ב־45 ₪',
      couponType: 'fixed_amount',
      value: '45',
      validFrom: new Date(now.getTime() - 90 * 86400000),
      maxRedemptionsPerUser: 1,
      redemptionCount: rng.int(80, 200),
      costToCompany: '45',
      createdBy: staffIds.get('marketing') ?? null,
      isDemo: true,
    },
    {
      code: 'COACHGIFT',
      nameHe: 'אימון חינם — הטבת מאמן',
      couponType: 'free_session',
      value: '90',
      validFrom: new Date(now.getTime() - 30 * 86400000),
      validUntil: new Date(now.getTime() + 30 * 86400000),
      maxRedemptions: 60,
      redemptionCount: rng.int(10, 40),
      costToCompany: '90',
      createdBy: staffIds.get('marketing') ?? null,
      isDemo: true,
    },
  ]);

  await db.insert(challenges).values([
    {
      nameHe: 'אתגר ההתמדה — 4 אימונים בחודש',
      description: 'השלם ארבעה אימונים בתשלום בתוך 28 יום וקבל שעת מגרש מתנה.',
      status: 'active',
      startsAt: new Date(now.getTime() - 20 * 86400000),
      endsAt: new Date(now.getTime() + 40 * 86400000),
      criteria: { type: 'session_count', value: 4, window_days: 28 },
      xpReward: 400,
      pointsReward: 100,
      participantCount: rng.int(40, 120),
      completionCount: rng.int(10, 35),
      estimatedCost: String(rng.int(1500, 4200)),
      isDemo: true,
    },
    {
      nameHe: 'אתגר Off-Peak — שלושה אימוני בוקר',
      description: 'שלושה אימונים בין 08:00 ל־16:00 בתוך שבועיים.',
      status: 'active',
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 20 * 86400000),
      criteria: { type: 'off_peak_sessions', value: 3, window_days: 14 },
      xpReward: 250,
      pointsReward: 60,
      participantCount: rng.int(20, 70),
      completionCount: rng.int(5, 20),
      estimatedCost: String(rng.int(800, 2400)),
      isDemo: true,
    },
  ]);

  // ─── קמפיין מסכים ───
  await db.insert(screenCampaigns).values({
    nameHe: 'קמפיין השקה — TRAIN SMARTER. PERFORM BETTER.',
    status: 'active',
    playlist: [],
    ctaText: 'SCAN. TRAIN. LEVEL UP.',
    qrTarget: 'https://app.velax.example/start',
    targetClubIds: [],
    startsAt: new Date(now.getTime() - 30 * 86400000),
    endsAt: new Date(now.getTime() + 60 * 86400000),
    dailyFrom: '06:00',
    dailyUntil: '23:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    priority: 80,
    createdBy: staffIds.get('marketing') ?? null,
    isDemo: true,
  });

  // ─── כללי אוטומציה ───
  console.log('▸ כללי אוטומציה והתראות...');
  await db.insert(automationRules).values([
    {
      key: 'device_offline',
      nameHe: 'מכונה מנותקת יותר מ־10 דקות',
      description: 'מזהה מכשיר שלא דיווח למערכת מעבר לסף שהוגדר בהגדרות התפעול.',
      severity: 'critical',
      condition: { metric: 'device_offline_minutes', operator: '>', settingKey: 'ops.device_offline_alert_minutes' },
      actions: [{ type: 'notify' }, { type: 'create_ticket', category: 'ble', severity: 'high' }],
      channels: ['in_app'],
      cooldownMinutes: 60,
      targetRoleKeys: ['operations_manager', 'fleet_manager'],
      isDemo: true,
    },
    {
      key: 'battery_low',
      nameHe: 'סוללה מתחת לרף',
      severity: 'warning',
      condition: { metric: 'battery_pct', operator: '<', settingKey: 'ops.battery_low_threshold_pct' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 240,
      targetRoleKeys: ['operations_manager', 'club_manager'],
      isDemo: true,
    },
    {
      key: 'paid_not_started',
      nameHe: 'סשן ששולם ולא התחיל',
      description: 'מפעיל בדיקת זיכוי אוטומטי לפי מדיניות הזיכויים.',
      severity: 'critical',
      condition: { metric: 'paid_not_started_minutes', operator: '>', settingKey: 'ops.paid_not_started_alert_minutes' },
      actions: [{ type: 'notify' }, { type: 'evaluate_auto_refund' }],
      channels: ['in_app'],
      cooldownMinutes: 15,
      targetRoleKeys: ['support_agent', 'operations_manager'],
      isDemo: true,
    },
    {
      key: 'start_success_below_target',
      nameHe: 'Start Success מתחת ליעד',
      severity: 'warning',
      condition: { metric: 'start_success_rate', operator: '<', settingKey: 'quality.start_success_target_pct' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 1440,
      targetRoleKeys: ['management', 'operations_manager'],
      isDemo: true,
    },
    {
      key: 'uptime_below_target',
      nameHe: 'זמינות מתחת ליעד ההסכם',
      severity: 'critical',
      condition: { metric: 'uptime_pct', operator: '<', settingKey: 'sla.uptime_target_pct' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 1440,
      targetRoleKeys: ['operations_manager', 'management'],
      isDemo: true,
    },
    {
      key: 'refund_rate_high',
      nameHe: 'שיעור זיכויים מעל הרף',
      severity: 'warning',
      condition: { metric: 'refund_rate', operator: '>', settingKey: 'quality.refund_rate_alert_pct' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 1440,
      targetRoleKeys: ['finance', 'management'],
      isDemo: true,
    },
    {
      key: 'sla_breach_imminent',
      nameHe: 'SLA עומד להיפרץ',
      severity: 'critical',
      condition: { metric: 'sla_remaining_hours', operator: '<', value: 4 },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 120,
      targetRoleKeys: ['operations_manager', 'technician'],
      isDemo: true,
    },
    {
      key: 'checklist_missed',
      nameHe: 'Checklist יומי לא בוצע',
      severity: 'warning',
      condition: { metric: 'checklist_missed_days', operator: '>=', value: 1 },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 1440,
      targetRoleKeys: ['operations_manager', 'club_manager'],
      isDemo: true,
    },
    {
      key: 'inventory_below_reorder',
      nameHe: 'מלאי מתחת לרף ההזמנה',
      severity: 'warning',
      condition: { metric: 'quantity_on_hand', operator: '<', field: 'reorder_point' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 1440,
      targetRoleKeys: ['fleet_manager'],
      isDemo: true,
    },
    {
      key: 'earn_back_at_risk',
      nameHe: 'מועדון בסיכון Earn-Back',
      severity: 'critical',
      condition: { metric: 'earn_back_forecast_gap', operator: '>', settingKey: 'earnback.at_risk_threshold_pct' },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 10080,
      targetRoleKeys: ['management', 'finance', 'sales'],
      isDemo: true,
    },
    {
      key: 'double_charge',
      nameHe: 'חשד לחיוב כפול',
      severity: 'critical',
      condition: { metric: 'duplicate_payments_per_session', operator: '>', value: 1 },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 60,
      targetRoleKeys: ['finance', 'support_agent'],
      isDemo: true,
    },
    {
      key: 'firmware_outdated',
      nameHe: 'Firmware לא מעודכן',
      severity: 'info',
      condition: { metric: 'firmware_below_minimum', operator: '=', value: true },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 10080,
      targetRoleKeys: ['fleet_manager'],
      isDemo: true,
    },
    {
      key: 'contract_expiring',
      nameHe: 'חוזה עומד להסתיים',
      severity: 'warning',
      condition: { metric: 'days_to_renewal', operator: '<', value: 45 },
      actions: [{ type: 'notify' }],
      channels: ['in_app'],
      cooldownMinutes: 10080,
      targetRoleKeys: ['sales', 'management'],
      isDemo: true,
    },
  ]);

  console.log('  ✓ 13 כללי אוטומציה');

  return {};
}
