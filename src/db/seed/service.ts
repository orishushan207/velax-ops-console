import { db } from '@/db/client';
import {
  checklistItems,
  checklistSubmissions,
  checklists,
  inventoryItems,
  inventoryLocations,
  inventoryMovements,
  maintenancePlans,
  maintenanceTasks,
  suppliers,
  supportTickets,
  ticketEvents,
} from '@/db/schema';
import { buildReference } from '@/lib/utils';
import type { SeededStation } from './network';
import type { SeededSession } from './operations';
import { Rng } from './rng';

/** SLA לפי חומרה — נגזר ממדיניות ברירת המחדל */
const SLA_HOURS: Record<string, { response: number; resolution: number }> = {
  low: { response: 48, resolution: 168 },
  medium: { response: 24, resolution: 72 },
  high: { response: 4, resolution: 48 },
  critical: { response: 1, resolution: 24 },
};

export async function seedService(
  rng: Rng,
  now: Date,
  stationsList: SeededStation[],
  sessionsList: SeededSession[],
  staffIds: Map<string, string>,
  slaIds: { defaultSlaId: string; premiumSlaId: string },
) {
  console.log('▸ תקלות ו־SLA...');

  const technicianId = staffIds.get('technician') ?? null;
  const supportId = staffIds.get('support_agent') ?? null;
  const opsId = staffIds.get('operations_manager') ?? null;

  const failedSessions = sessionsList.filter(
    (s) => s.status === 'failed_to_start' || s.status === 'interrupted',
  );

  let ticketSeq = 0;
  const ticketBatch: (typeof supportTickets.$inferInsert)[] = [];
  const ticketEventBatch: (typeof ticketEvents.$inferInsert)[] = [];

  // תקלות שנגזרות מסשנים שכשלו — כך שהקישור בין סשן לתקלה אמיתי
  for (const session of failedSessions) {
    if (!rng.bool(0.62)) continue;
    ticketSeq++;
    const openedAt = new Date((session.startedAt ?? now).getTime() + rng.int(5, 90) * 60000);
    if (openedAt > now) continue;

    const category = rng.weighted([
      ['ble' as const, 30],
      ['battery' as const, 16],
      ['feed_motor' as const, 12],
      ['firmware' as const, 10],
      ['balls' as const, 10],
      ['lock' as const, 8],
      ['charger' as const, 6],
      ['qr_nfc' as const, 5],
      ['payment' as const, 3],
    ]);
    const severity = rng.weighted([
      ['medium' as const, 46],
      ['high' as const, 34],
      ['low' as const, 14],
      ['critical' as const, 6],
    ]);
    const sla = SLA_HOURS[severity]!;
    const isResolved = rng.bool(0.78);
    const resolutionHours = rng.float(1, sla.resolution * 1.4, 1);
    const resolvedAt = isResolved
      ? new Date(openedAt.getTime() + resolutionHours * 3600000)
      : null;
    const firstResponseHours = rng.float(0.2, sla.response * 1.2, 2);
    const firstResponseAt = new Date(openedAt.getTime() + firstResponseHours * 3600000);
    const station = stationsList.find((s) => s.id === session.stationId);

    const status = isResolved
      ? rng.weighted([
          ['closed' as const, 70],
          ['resolved' as const, 25],
          ['reopened' as const, 5],
        ])
      : rng.weighted([
          ['in_progress' as const, 34],
          ['assigned' as const, 22],
          ['waiting_for_part' as const, 16],
          ['triaged' as const, 14],
          ['new' as const, 14],
        ]);

    const downtimeMinutes = isResolved ? Math.round(resolutionHours * 60 * rng.float(0.3, 0.9)) : Math.round(((now.getTime() - openedAt.getTime()) / 60000) * rng.float(0.2, 0.6));

    ticketBatch.push({
      reference: buildReference('TK', openedAt, ticketSeq),
      title:
        category === 'ble'
          ? 'המכשיר לא מתחבר לאפליקציה'
          : category === 'battery'
            ? 'סוללה מתרוקנת מהר מהצפוי'
            : category === 'feed_motor'
              ? 'מנוע ההזנה נתקע באמצע אימון'
              : category === 'balls'
                ? 'חוסר כדורים בעמדה'
                : category === 'lock'
                  ? 'נעילת העמדה אינה נפתחת'
                  : 'תקלה בעמדה',
      description: `דווח בעקבות סשן ${session.reference}. השחקן לא הצליח להשלים את האימון.`,
      category,
      severity,
      status,
      source: rng.weighted([
        ['player_app' as const, 44],
        ['telemetry_auto' as const, 24],
        ['club_staff' as const, 18],
        ['support_agent' as const, 14],
      ]),
      clubId: session.clubId,
      stationId: session.stationId,
      deviceId: session.deviceId,
      sessionId: session.id,
      assigneeId: status === 'new' ? null : rng.bool(0.7) ? technicianId : opsId,
      slaPolicyId:
        station?.blueprint.slaTier === 'premium' ? slaIds.premiumSlaId : slaIds.defaultSlaId,
      responseDueAt: new Date(openedAt.getTime() + sla.response * 3600000),
      resolutionDueAt: new Date(openedAt.getTime() + sla.resolution * 3600000),
      firstResponseAt: status === 'new' ? null : firstResponseAt,
      resolvedAt,
      closedAt: status === 'closed' ? resolvedAt : null,
      responseBreached: status !== 'new' && firstResponseHours > sla.response,
      resolutionBreached: isResolved
        ? resolutionHours > sla.resolution
        : (now.getTime() - openedAt.getTime()) / 3600000 > sla.resolution,
      rootCause: isResolved
        ? rng.pick([
            'מודול BLE דרש איפוס וקושחה מעודכנת',
            'סוללה בסוף חיי שירות — הוחלפה',
            'גוף זר במנוע ההזנה',
            'כבל חשמל רופף',
            'מלאי כדורים לא חודש על ידי צוות המועדון',
          ])
        : null,
      actionsTaken: isResolved ? 'טכנאי הגיע לשטח, ביצע אבחון והחזיר את העמדה לפעילות.' : null,
      downtimeMinutes,
      downtimeStartedAt: openedAt,
      downtimeEndedAt: resolvedAt,
      repairCost: isResolved ? String(rng.int(0, 480)) : '0',
      replacementDeviceProvided: severity === 'critical' && rng.bool(0.4),
      closureReason: status === 'closed' ? 'התקלה נפתרה ואומתה מול המועדון' : null,
      createdAt: openedAt,
      isDemo: true,
    });
  }

  // כמה תקלות שאינן קשורות לסשן — טלמטריה, בטיחות, נזק פיזי
  for (let i = 0; i < 14; i++) {
    ticketSeq++;
    const station = rng.pick(stationsList);
    const openedAt = new Date(now.getTime() - rng.int(0, 60) * 86400000 - rng.int(0, 23) * 3600000);
    const category = rng.pick([
      'safety',
      'physical_damage',
      'screen',
      'wheels',
      'remote',
      'app',
      'backend',
      'theft_loss',
    ] as const);
    const severity = category === 'safety' || category === 'theft_loss' ? 'critical' : rng.pick(['low', 'medium', 'high'] as const);
    const sla = SLA_HOURS[severity]!;
    const isResolved = rng.bool(0.6);
    const resolutionHours = rng.float(2, sla.resolution, 1);

    ticketBatch.push({
      reference: buildReference('TK', openedAt, ticketSeq),
      title:
        category === 'safety'
          ? 'דיווח על אזור בטיחות לא פנוי בזמן אימון'
          : category === 'theft_loss'
            ? 'מכשיר לא אותר במועדון'
            : category === 'screen'
              ? 'המסך המסחרי אינו מציג תוכן'
              : 'תקלה בציוד העמדה',
      description: 'דווח על ידי צוות המועדון במסגרת בדיקה יומית.',
      category,
      severity,
      status: isResolved ? 'closed' : rng.pick(['in_progress', 'waiting_for_part', 'triaged'] as const),
      source: 'club_staff',
      clubId: station.clubId,
      stationId: station.id,
      deviceId: station.deviceId,
      assigneeId: technicianId,
      slaPolicyId:
        station.blueprint.slaTier === 'premium' ? slaIds.premiumSlaId : slaIds.defaultSlaId,
      responseDueAt: new Date(openedAt.getTime() + sla.response * 3600000),
      resolutionDueAt: new Date(openedAt.getTime() + sla.resolution * 3600000),
      firstResponseAt: new Date(openedAt.getTime() + rng.float(0.1, 2, 2) * 3600000),
      resolvedAt: isResolved ? new Date(openedAt.getTime() + resolutionHours * 3600000) : null,
      closedAt: isResolved ? new Date(openedAt.getTime() + resolutionHours * 3600000) : null,
      downtimeMinutes: isResolved ? Math.round(resolutionHours * 60 * 0.5) : 0,
      repairCost: isResolved ? String(rng.int(0, 1200)) : '0',
      createdAt: openedAt,
      isDemo: true,
    });
  }

  const insertedTickets = await db
    .insert(supportTickets)
    .values(ticketBatch)
    .returning({ id: supportTickets.id, createdAt: supportTickets.createdAt, status: supportTickets.status, resolvedAt: supportTickets.resolvedAt });

  for (const t of insertedTickets) {
    ticketEventBatch.push({
      ticketId: t.id,
      eventType: 'status_change',
      toStatus: 'new',
      actorUserId: supportId,
      message: 'הקריאה נפתחה',
      occurredAt: t.createdAt,
      isDemo: true,
    });
    if (t.status !== 'new') {
      ticketEventBatch.push({
        ticketId: t.id,
        eventType: 'assignment',
        actorUserId: opsId,
        message: 'הקריאה הוקצתה לטכנאי שדה',
        occurredAt: new Date(t.createdAt.getTime() + 30 * 60000),
        isDemo: true,
      });
    }
    if (t.resolvedAt) {
      ticketEventBatch.push({
        ticketId: t.id,
        eventType: 'status_change',
        toStatus: 'resolved',
        actorUserId: technicianId,
        message: 'הטיפול הושלם והעמדה חזרה לפעילות',
        occurredAt: t.resolvedAt,
        isDemo: true,
      });
    }
  }
  if (ticketEventBatch.length > 0) {
    for (let i = 0; i < ticketEventBatch.length; i += 500) {
      await db.insert(ticketEvents).values(ticketEventBatch.slice(i, i + 500));
    }
  }
  console.log(`  ✓ ${insertedTickets.length} קריאות שירות`);

  // ─── תחזוקה מונעת ───
  console.log('▸ תחזוקה מונעת ו־Checklists...');
  const planRows = await db
    .insert(maintenancePlans)
    .values([
      {
        nameHe: 'בדיקה יומית — 60 שניות',
        description: 'בדיקה מהירה של טעינה, כדורים, ניקיון ואזור בטיחות.',
        trigger: 'calendar',
        intervalValue: '1',
        warnAheadValue: '0',
        estimatedMinutes: 1,
        instructions: 'סמן את כל הפריטים ב־Checklist היומי. דווח על כל חריגה.',
        isDemo: true,
      },
      {
        nameHe: 'תחזוקה לפי מונה שעות — 250 שעות',
        description: 'ניקוי מנועי הזנה, בדיקת גלגלים והידוק ברגים.',
        trigger: 'operating_hours',
        intervalValue: '250',
        warnAheadValue: '25',
        estimatedMinutes: 60,
        isDemo: true,
      },
      {
        nameHe: 'רוטציית כדורים — 25,000 כדורים',
        description: 'החלפת סט הכדורים. רוטציה קבועה, בלי ערבוב בלאי קיצוני.',
        trigger: 'ball_count',
        intervalValue: '25000',
        warnAheadValue: '3000',
        estimatedMinutes: 15,
        isDemo: true,
      },
      {
        nameHe: 'תחזוקה חודשית מלאה',
        description: 'בדיקת סוללה, כבלים, שלט, עצירת חירום וכיול מהירות.',
        trigger: 'calendar',
        intervalValue: '30',
        warnAheadValue: '5',
        estimatedMinutes: 90,
        isDemo: true,
      },
    ])
    .returning({ id: maintenancePlans.id, nameHe: maintenancePlans.nameHe });

  const taskBatch: (typeof maintenanceTasks.$inferInsert)[] = [];
  let taskSeq = 0;
  for (const station of stationsList) {
    if (!station.deviceId) continue;
    for (const plan of planRows.slice(1)) {
      // היסטוריה: 2-3 טיפולים שהושלמו
      const completedCount = rng.int(1, 3);
      for (let i = completedCount; i >= 1; i--) {
        taskSeq++;
        const dueDate = new Date(now.getTime() - i * rng.int(25, 45) * 86400000);
        taskBatch.push({
          reference: buildReference('MT', dueDate, taskSeq),
          planId: plan.id,
          deviceId: station.deviceId,
          stationId: station.id,
          clubId: station.clubId,
          status: 'completed',
          dueOn: dueDate.toISOString().slice(0, 10),
          assigneeId: technicianId,
          startedAt: dueDate,
          completedAt: new Date(dueDate.getTime() + rng.int(30, 180) * 60000),
          completedBy: technicianId,
          notes: 'הטיפול בוצע במלואו. לא נמצאו חריגות.',
          createdAt: new Date(dueDate.getTime() - 7 * 86400000),
          isDemo: true,
        });
      }
      // טיפול עתידי / באיחור
      taskSeq++;
      const nextDue = new Date(now.getTime() + rng.int(-8, 30) * 86400000);
      const isOverdue = nextDue < now;
      taskBatch.push({
        reference: buildReference('MT', nextDue, taskSeq),
        planId: plan.id,
        deviceId: station.deviceId,
        stationId: station.id,
        clubId: station.clubId,
        status: isOverdue ? 'overdue' : nextDue.getTime() - now.getTime() < 5 * 86400000 ? 'due' : 'scheduled',
        dueOn: nextDue.toISOString().slice(0, 10),
        assigneeId: technicianId,
        isDemo: true,
      });
    }
  }
  for (let i = 0; i < taskBatch.length; i += 500) {
    await db.insert(maintenanceTasks).values(taskBatch.slice(i, i + 500));
  }

  // ─── Checklists ───
  const [dailyChecklist] = await db
    .insert(checklists)
    .values({
      nameHe: 'בדיקה יומית של העמדה',
      frequency: 'daily',
      description: 'בדיקת 60 שניות שצוות המועדון מבצע בכל בוקר.',
      estimatedSeconds: 60,
      isDemo: true,
    })
    .returning({ id: checklists.id });

  const [weeklyChecklist] = await db
    .insert(checklists)
    .values({
      nameHe: 'בדיקה שבועית מתועדת',
      frequency: 'weekly',
      description: 'בדיקה מעמיקה עם תיעוד בתמונות.',
      estimatedSeconds: 600,
      isDemo: true,
    })
    .returning({ id: checklists.id });

  const dailyItems = [
    { label: 'המכונה טעונה מעל 50%', blocking: true, photo: false },
    { label: 'מלאי הכדורים תקין', blocking: true, photo: false },
    { label: 'אזור הבטיחות פנוי ומסומן', blocking: true, photo: false },
    { label: 'כפתור עצירת חירום נגיש ותקין', blocking: true, photo: false },
    { label: 'העמדה נקייה ובמיקום הנכון', blocking: false, photo: false },
    { label: 'המסך פועל ומציג תוכן', blocking: false, photo: false },
    { label: 'שילוט QR קריא ולא פגום', blocking: false, photo: false },
  ];
  const weeklyItems = [
    { label: 'בדיקת גלגלים ובלאי', blocking: false, photo: true },
    { label: 'בדיקת מנועי הזנה', blocking: true, photo: true },
    { label: 'בדיקת כבלים ומחברים', blocking: true, photo: false },
    { label: 'בדיקת שלט רחוק', blocking: false, photo: false },
    { label: 'ניקוי יסודי של המכונה', blocking: false, photo: true },
    { label: 'רוטציית כדורים לפי מונה', blocking: false, photo: false },
  ];

  const dailyItemIds: string[] = [];
  if (dailyChecklist) {
    for (const [idx, item] of dailyItems.entries()) {
      const [row] = await db
        .insert(checklistItems)
        .values({
          checklistId: dailyChecklist.id,
          orderIndex: idx,
          labelHe: item.label,
          isBlocking: item.blocking,
          requiresPhoto: item.photo,
          isDemo: true,
        })
        .returning({ id: checklistItems.id });
      if (row) dailyItemIds.push(row.id);
    }
  }
  if (weeklyChecklist) {
    for (const [idx, item] of weeklyItems.entries()) {
      await db.insert(checklistItems).values({
        checklistId: weeklyChecklist.id,
        orderIndex: idx,
        labelHe: item.label,
        isBlocking: item.blocking,
        requiresPhoto: item.photo,
        isDemo: true,
      });
    }
  }

  // הגשות יומיות ל־30 יום אחרונים
  const submissionBatch: (typeof checklistSubmissions.$inferInsert)[] = [];
  if (dailyChecklist) {
    for (let d = 30; d >= 1; d--) {
      const forDate = new Date(now.getTime() - d * 86400000);
      for (const station of stationsList) {
        // מועדון עם reliability נמוכה מפספס יותר בדיקות
        const completed = rng.bool(station.blueprint.reliability * 0.95);
        const withIssues = completed && rng.bool(0.12);
        submissionBatch.push({
          checklistId: dailyChecklist.id,
          clubId: station.clubId,
          stationId: station.id,
          deviceId: station.deviceId,
          forDate: forDate.toISOString().slice(0, 10),
          status: completed ? (withIssues ? 'completed_with_issues' : 'completed') : 'missed',
          submittedAt: completed
            ? new Date(forDate.getTime() + rng.int(7, 10) * 3600000)
            : null,
          results: completed
            ? dailyItemIds.map((itemId, i) => ({
                itemId,
                passed: !(withIssues && i === rng.int(0, dailyItemIds.length - 1)),
              }))
            : [],
          issuesReported: withIssues ? 1 : 0,
          isDemo: true,
        });
      }
    }
  }
  for (let i = 0; i < submissionBatch.length; i += 500) {
    await db.insert(checklistSubmissions).values(submissionBatch.slice(i, i + 500));
  }
  console.log(`  ✓ ${taskBatch.length} משימות תחזוקה · ${submissionBatch.length} הגשות Checklist`);

  // ─── מלאי ───
  console.log('▸ מלאי וספקים...');
  const supplierRows = await db
    .insert(suppliers)
    .values([
      { name: 'PUSUN Sports Equipment', contactName: 'Wei Zhang', email: 'sales@pusun.example.cn', country: 'סין', leadTimeDays: 45, isDemo: true },
      { name: 'ספורט ישראל בע״מ', contactName: 'יוסי לוי', email: 'yossi@sport-il.example.co.il', phone: '037654321', country: 'ישראל', leadTimeDays: 7, isDemo: true },
      { name: 'אלקטרוניקה טכנית', contactName: 'דוד כהן', email: 'david@electech.example.co.il', country: 'ישראל', leadTimeDays: 3, isDemo: true },
    ])
    .returning({ id: suppliers.id, name: suppliers.name });

  const locationRows = await db
    .insert(inventoryLocations)
    .values([
      { name: 'מחסן מרכזי — פתח תקווה', locationType: 'warehouse', address: 'האורגים 15, פתח תקווה', isDemo: true },
      { name: 'רכב טכנאי — עומר', locationType: 'technician', technicianId, isDemo: true },
      { name: 'מלאי בדרך מהיצרן', locationType: 'transit', isDemo: true },
    ])
    .returning({ id: inventoryLocations.id, name: inventoryLocations.name });

  const warehouseId = locationRows[0]!.id;
  const technicianLocationId = locationRows[1]!.id;

  const itemDefs = [
    { sku: 'BALL-CASE-72', name: 'ארגז כדורי פאדל (72 יחידות)', category: 'balls' as const, cost: 340, reorder: 8, qty: 22, supplier: 1 },
    { sku: 'BATT-PT9001', name: 'סוללה PT-9001', category: 'battery' as const, cost: 420, reorder: 4, qty: 3, supplier: 0 },
    { sku: 'CHRG-PT9001', name: 'מטען PT-9001', category: 'charger' as const, cost: 180, reorder: 4, qty: 9, supplier: 0 },
    { sku: 'WHL-FEED-SET', name: 'סט גלגלי הזנה', category: 'wheels' as const, cost: 260, reorder: 6, qty: 4, supplier: 0 },
    { sku: 'MTR-FEED', name: 'מנוע הזנה', category: 'motor' as const, cost: 690, reorder: 3, qty: 5, supplier: 0 },
    { sku: 'CBL-POWER', name: 'כבל חשמל מוגן', category: 'cables' as const, cost: 65, reorder: 10, qty: 24, supplier: 2 },
    { sku: 'RMT-CTRL', name: 'שלט רחוק', category: 'remote' as const, cost: 150, reorder: 5, qty: 11, supplier: 0 },
    { sku: 'NFC-TAG', name: 'תג NFC ממותג', category: 'qr_nfc_tag' as const, cost: 12, reorder: 30, qty: 85, supplier: 2 },
    { sku: 'SCR-32IN', name: 'מסך מסחרי 32״', category: 'screen' as const, cost: 1450, reorder: 2, qty: 3, supplier: 2 },
    { sku: 'STND-LOCK', name: 'מנעול סטנד', category: 'stand_part' as const, cost: 320, reorder: 4, qty: 7, supplier: 1 },
    { sku: 'SFT-SIGN', name: 'שילוט בטיחות לעמדה', category: 'safety_equipment' as const, cost: 90, reorder: 6, qty: 14, supplier: 1 },
    { sku: 'SPARE-PT9001', name: 'מכונה חלופית PT-9001', category: 'spare_machine' as const, cost: 3000, reorder: 2, qty: 2, supplier: 0 },
  ];

  for (const item of itemDefs) {
    const [row] = await db
      .insert(inventoryItems)
      .values({
        sku: item.sku,
        nameHe: item.name,
        category: item.category,
        unitCost: String(item.cost),
        supplierId: supplierRows[item.supplier]?.id ?? null,
        reorderPoint: item.reorder,
        reorderQuantity: item.reorder * 2,
        quantityOnHand: item.qty,
        isDemo: true,
      })
      .returning({ id: inventoryItems.id });
    if (!row) continue;

    // תנועת קליטה ראשונית
    await db.insert(inventoryMovements).values({
      itemId: row.id,
      movementType: 'purchase_in',
      quantity: item.qty + rng.int(2, 8),
      toLocationId: warehouseId,
      unitCost: String(item.cost),
      totalCost: String(item.cost * (item.qty + 4)),
      performedBy: staffIds.get('fleet_manager') ?? null,
      occurredAt: new Date(now.getTime() - rng.int(40, 120) * 86400000),
      note: 'קליטת רכש מהיצרן',
      isDemo: true,
    });

    // תנועות צריכה
    for (let i = 0; i < rng.int(1, 4); i++) {
      await db.insert(inventoryMovements).values({
        itemId: row.id,
        movementType: rng.pick(['consume_ticket', 'consume_maintenance', 'allocate_technician'] as const),
        quantity: -rng.int(1, 3),
        fromLocationId: warehouseId,
        toLocationId: technicianLocationId,
        unitCost: String(item.cost),
        performedBy: technicianId,
        occurredAt: new Date(now.getTime() - rng.int(1, 60) * 86400000),
        isDemo: true,
      });
    }
  }
  console.log(`  ✓ ${itemDefs.length} פריטי מלאי · ${supplierRows.length} ספקים`);

  return { ticketCount: insertedTickets.length };
}
