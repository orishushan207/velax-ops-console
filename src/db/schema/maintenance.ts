import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, quantity, softDelete, timestamps } from './_shared';
import {
  checklistFrequencyEnum,
  checklistSubmissionStatusEnum,
  maintenanceTaskStatusEnum,
  maintenanceTriggerEnum,
} from './enums';
import { users } from './identity';
import { clubs, stations } from './network';
import { devices } from './devices';

/**
 * maintenance_plans — מנוע התחזוקה המונעת.
 * טריגרים: זמן / שעות עבודה / מספר Sessions / מספר כדורים / אירועים חריגים.
 */
export const maintenancePlans = pgTable(
  'maintenance_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 160 }).notNull(),
    description: text('description'),
    trigger: maintenanceTriggerEnum('trigger').notNull(),
    /** ערך הטריגר: ימים / שעות עבודה / מספר סשנים / מספר כדורים */
    intervalValue: quantity('interval_value').notNull(),
    /** התראה מוקדמת לפני מועד הטיפול */
    warnAheadValue: quantity('warn_ahead_value').notNull().default('0'),
    /** דגם מכונה שאליו הטיפול חל. null = כל הדגמים. */
    appliesToModel: varchar('applies_to_model', { length: 80 }),
    estimatedMinutes: integer('estimated_minutes').notNull().default(30),
    instructions: text('instructions'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('maintenance_plans_trigger_idx').on(t.trigger)],
);

export const maintenanceTasks = pgTable(
  'maintenance_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 32 }).notNull(),
    planId: uuid('plan_id').references(() => maintenancePlans.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    status: maintenanceTaskStatusEnum('status').notNull().default('scheduled'),
    dueOn: date('due_on').notNull(),
    /** ערך המונה שבו הטיפול הופעל */
    triggerSnapshot: jsonb('trigger_snapshot').$type<Record<string, number>>(),
    assigneeId: uuid('assignee_id').references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id),
    notes: text('notes'),
    partsUsed: jsonb('parts_used').$type<{ itemId: string; qty: number }[]>().notNull().default([]),
    skipReason: text('skip_reason'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('maintenance_tasks_reference_key').on(t.reference),
    index('maintenance_tasks_device_idx').on(t.deviceId),
    index('maintenance_tasks_status_due_idx').on(t.status, t.dueOn),
    index('maintenance_tasks_club_idx').on(t.clubId),
  ],
);

/** תבנית Checklist — יומי 60 שניות, שבועי מתועד, חודשי */
export const checklists = pgTable(
  'checklists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 160 }).notNull(),
    frequency: checklistFrequencyEnum('frequency').notNull(),
    description: text('description'),
    estimatedSeconds: integer('estimated_seconds').notNull().default(60),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('checklists_frequency_idx').on(t.frequency)],
);

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    labelHe: varchar('label_he', { length: 250 }).notNull(),
    /** האם כשל בפריט הזה חוסם את העמדה */
    isBlocking: boolean('is_blocking').notNull().default(false),
    requiresPhoto: boolean('requires_photo').notNull().default(false),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [uniqueIndex('checklist_items_order_key').on(t.checklistId, t.orderIndex)],
);

export const checklistSubmissions = pgTable(
  'checklist_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    /** התאריך שאליו ה־Checklist שייך (לא זמן ההגשה) */
    forDate: date('for_date').notNull(),
    status: checklistSubmissionStatusEnum('status').notNull().default('pending'),
    submittedBy: uuid('submitted_by').references(() => users.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    /** תוצאות: [{itemId, passed, note, photoFileId}] */
    results: jsonb('results')
      .$type<{ itemId: string; passed: boolean; note?: string; photoFileId?: string }[]>()
      .notNull()
      .default([]),
    issuesReported: integer('issues_reported').notNull().default(0),
    createdTicketId: uuid('created_ticket_id'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('checklist_submissions_key').on(t.checklistId, t.stationId, t.forDate),
    index('checklist_submissions_club_date_idx').on(t.clubId, t.forDate),
    index('checklist_submissions_status_idx').on(t.status),
  ],
);

export const maintenanceTasksRelations = relations(maintenanceTasks, ({ one }) => ({
  plan: one(maintenancePlans, {
    fields: [maintenanceTasks.planId],
    references: [maintenancePlans.id],
  }),
  device: one(devices, { fields: [maintenanceTasks.deviceId], references: [devices.id] }),
  club: one(clubs, { fields: [maintenanceTasks.clubId], references: [clubs.id] }),
  station: one(stations, { fields: [maintenanceTasks.stationId], references: [stations.id] }),
  assignee: one(users, { fields: [maintenanceTasks.assigneeId], references: [users.id] }),
}));

export const checklistsRelations = relations(checklists, ({ many }) => ({
  items: many(checklistItems),
  submissions: many(checklistSubmissions),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, { fields: [checklistItems.checklistId], references: [checklists.id] }),
}));

export const checklistSubmissionsRelations = relations(checklistSubmissions, ({ one }) => ({
  checklist: one(checklists, {
    fields: [checklistSubmissions.checklistId],
    references: [checklists.id],
  }),
  club: one(clubs, { fields: [checklistSubmissions.clubId], references: [clubs.id] }),
  station: one(stations, { fields: [checklistSubmissions.stationId], references: [stations.id] }),
}));
