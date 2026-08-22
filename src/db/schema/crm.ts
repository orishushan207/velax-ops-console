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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, money, rate, softDelete, timestamps } from './_shared';
import { crmActivityTypeEnum, leadStageEnum, taskPriorityEnum, taskStatusEnum } from './enums';
import { users } from './identity';
import { clubs } from './network';

/** Pipeline מכירות למועדונים — 14 שלבים לפי סעיף 17 בהנחיות */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubName: varchar('club_name', { length: 200 }).notNull(),
    /** מועדון קיים במערכת, אם הליד נסגר */
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    stage: leadStageEnum('stage').notNull().default('lead'),
    city: varchar('city', { length: 100 }),
    region: varchar('region', { length: 80 }),
    courtCount: integer('court_count'),
    /** משפחות | תחרותי | מעורב | אקדמיה */
    audienceType: varchar('audience_type', { length: 60 }),
    /** זמינות Off-Peak משוערת בשעות ביום */
    offPeakAvailabilityHours: rate('off_peak_availability_hours'),
    /** פוטנציאל עמדות — courtCount / courts_per_station */
    stationPotential: integer('station_potential'),

    contactName: varchar('contact_name', { length: 200 }),
    contactRole: varchar('contact_role', { length: 100 }),
    contactEmail: varchar('contact_email', { length: 320 }),
    contactPhone: varchar('contact_phone', { length: 32 }),

    source: varchar('source', { length: 80 }),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    closeProbability: rate('close_probability').notNull().default('0'),
    dealValue: money('deal_value').notNull().default('0'),
    expectedCloseDate: date('expected_close_date'),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    wonAt: timestamp('won_at', { withTimezone: true }),
    proposalFileIds: jsonb('proposal_file_ids').$type<string[]>().notNull().default([]),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('leads_stage_idx').on(t.stage),
    index('leads_owner_idx').on(t.ownerId),
    index('leads_follow_up_idx').on(t.nextFollowUpAt),
    index('leads_name_idx').on(t.clubName),
  ],
);

export const crmActivities = pgTable(
  'crm_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    activityType: crmActivityTypeEnum('activity_type').notNull(),
    subject: varchar('subject', { length: 250 }),
    body: text('body'),
    fromStage: leadStageEnum('from_stage'),
    toStage: leadStageEnum('to_stage'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    performedBy: uuid('performed_by').references(() => users.id),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('crm_activities_lead_time_idx').on(t.leadId, t.occurredAt),
    index('crm_activities_club_idx').on(t.clubId),
  ],
);

/** משימות כלליות — משמשות גם ל־CRM, גם למועדון וגם לתפעול */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 250 }).notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('open'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** קישור פולימורפי: entityType + entityId */
    entityType: varchar('entity_type', { length: 40 }),
    entityId: uuid('entity_id'),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    isPinned: boolean('is_pinned').notNull().default(false),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('tasks_assignee_status_idx').on(t.assigneeId, t.status),
    index('tasks_due_idx').on(t.dueAt),
    index('tasks_entity_idx').on(t.entityType, t.entityId),
    index('tasks_club_idx').on(t.clubId),
  ],
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  club: one(clubs, { fields: [leads.clubId], references: [clubs.id] }),
  activities: many(crmActivities),
  tasks: many(tasks),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  lead: one(leads, { fields: [crmActivities.leadId], references: [leads.id] }),
  performer: one(users, { fields: [crmActivities.performedBy], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  club: one(clubs, { fields: [tasks.clubId], references: [clubs.id] }),
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
}));
