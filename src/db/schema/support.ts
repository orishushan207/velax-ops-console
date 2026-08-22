import { relations } from 'drizzle-orm';
import {
  boolean,
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
import { demoFlag, money, softDelete, timestamps } from './_shared';
import {
  ticketCategoryEnum,
  ticketSeverityEnum,
  ticketSourceEnum,
  ticketStatusEnum,
} from './enums';
import { users } from './identity';
import { clubs, stations } from './network';
import { devices } from './devices';
import { sessions } from './sessions';

/**
 * sla_policies — ערכי ה־SLA ניתנים לשינוי לפי הסכם ומועדון.
 * ברירת המחדל מגיעה מפרק 14 בתוכנית: תיקון 24–48 שעות, זמינות ≥95%.
 * "הערכים חייבים להיות ניתנים לשינוי לפי הסכם ומועדון" — סעיף 12 בהנחיות.
 */
export const slaPolicies = pgTable(
  'sla_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 120 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    /** שעות תגובה לפי חומרה */
    responseHoursLow: integer('response_hours_low').notNull().default(48),
    responseHoursMedium: integer('response_hours_medium').notNull().default(24),
    responseHoursHigh: integer('response_hours_high').notNull().default(4),
    responseHoursCritical: integer('response_hours_critical').notNull().default(1),
    /** שעות תיקון לפי חומרה */
    resolutionHoursLow: integer('resolution_hours_low').notNull().default(168),
    resolutionHoursMedium: integer('resolution_hours_medium').notNull().default(72),
    resolutionHoursHigh: integer('resolution_hours_high').notNull().default(48),
    resolutionHoursCritical: integer('resolution_hours_critical').notNull().default(24),
    /** יעד זמינות באחוזים — 95 לפי התוכנית */
    uptimeTargetPct: integer('uptime_target_pct').notNull().default(95),
    /** האם ספירת ה־SLA מתחשבת רק בשעות פעילות המועדון */
    businessHoursOnly: boolean('business_hours_only').notNull().default(false),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [index('sla_policies_default_idx').on(t.isDefault)],
);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 32 }).notNull(),
    title: varchar('title', { length: 250 }).notNull(),
    description: text('description'),

    category: ticketCategoryEnum('category').notNull(),
    severity: ticketSeverityEnum('severity').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('new'),
    source: ticketSourceEnum('source').notNull().default('ops_console'),

    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    reportedByUserId: uuid('reported_by_user_id').references(() => users.id),
    assigneeId: uuid('assignee_id').references(() => users.id),

    slaPolicyId: uuid('sla_policy_id').references(() => slaPolicies.id),
    responseDueAt: timestamp('response_due_at', { withTimezone: true }),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    responseBreached: boolean('response_breached').notNull().default(false),
    resolutionBreached: boolean('resolution_breached').notNull().default(false),

    rootCause: text('root_cause'),
    actionsTaken: text('actions_taken'),
    partsReplaced: jsonb('parts_replaced').$type<{ itemId: string; qty: number }[]>().notNull().default([]),
    /** דקות השבתה של העמדה — הבסיס לחישוב Uptime ולזיכוי אוטומטי */
    downtimeMinutes: integer('downtime_minutes').notNull().default(0),
    downtimeStartedAt: timestamp('downtime_started_at', { withTimezone: true }),
    downtimeEndedAt: timestamp('downtime_ended_at', { withTimezone: true }),
    repairCost: money('repair_cost').notNull().default('0'),
    /** זיכוי שניתן בעקבות התקלה */
    refundIssuedAmount: money('refund_issued_amount').notNull().default('0'),

    closureReason: varchar('closure_reason', { length: 120 }),
    followUpRequired: boolean('follow_up_required').notNull().default(false),
    followUpAt: timestamp('follow_up_at', { withTimezone: true }),
    /** האם סופקה מכונה חלופית — התחייבות SLA מפרק 14 */
    replacementDeviceProvided: boolean('replacement_device_provided').notNull().default(false),
    replacementDeviceId: uuid('replacement_device_id').references(() => devices.id),

    attachmentFileIds: jsonb('attachment_file_ids').$type<string[]>().notNull().default([]),
    deviceLogs: text('device_logs'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('support_tickets_reference_key').on(t.reference),
    index('support_tickets_status_idx').on(t.status),
    index('support_tickets_severity_idx').on(t.severity),
    index('support_tickets_club_idx').on(t.clubId),
    index('support_tickets_device_idx').on(t.deviceId),
    index('support_tickets_station_idx').on(t.stationId),
    index('support_tickets_assignee_idx').on(t.assigneeId),
    index('support_tickets_resolution_due_idx').on(t.resolutionDueAt),
    index('support_tickets_created_idx').on(t.createdAt),
  ],
);

export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    /** status_change | comment | assignment | sla_breach | part_used | attachment | escalation */
    eventType: varchar('event_type', { length: 40 }).notNull(),
    fromStatus: ticketStatusEnum('from_status'),
    toStatus: ticketStatusEnum('to_status'),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    message: text('message'),
    isInternal: boolean('is_internal').notNull().default(true),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...demoFlag,
  },
  (t) => [index('ticket_events_ticket_time_idx').on(t.ticketId, t.occurredAt)],
);

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  club: one(clubs, { fields: [supportTickets.clubId], references: [clubs.id] }),
  station: one(stations, { fields: [supportTickets.stationId], references: [stations.id] }),
  device: one(devices, { fields: [supportTickets.deviceId], references: [devices.id] }),
  session: one(sessions, { fields: [supportTickets.sessionId], references: [sessions.id] }),
  assignee: one(users, { fields: [supportTickets.assigneeId], references: [users.id] }),
  slaPolicy: one(slaPolicies, {
    fields: [supportTickets.slaPolicyId],
    references: [slaPolicies.id],
  }),
  events: many(ticketEvents),
}));

export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketEvents.ticketId], references: [supportTickets.id] }),
  actor: one(users, { fields: [ticketEvents.actorUserId], references: [users.id] }),
}));
