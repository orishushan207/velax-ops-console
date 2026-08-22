import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, quantity, rate, softDelete, timestamps } from './_shared';
import { contentStatusEnum, drillTypeEnum, playerLevelEnum, shotSequenceEnum } from './enums';
import { users } from './identity';
import { coaches } from './coaches';

/**
 * drills / programs — ה־CMS של תוכן האימון.
 *
 * ⚠ כלל מפרק 20 בהנחיות: "שינוי בתוכנית שפורסמה צריך ליצור גרסה חדשה
 * ולא לשנות היסטוריית Sessions ישנים."
 * לכן ה־Session מצביע על drill_versions / program_versions ולא על drills / programs.
 */
export const drills = pgTable(
  'drills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    drillType: drillTypeEnum('drill_type').notNull(),
    createdByCoachId: uuid('created_by_coach_id').references(() => coaches.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    /** גרסה פעילה כרגע */
    currentVersionId: uuid('current_version_id'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('drills_slug_key').on(t.slug),
    index('drills_type_idx').on(t.drillType),
  ],
);

export const drillVersions = pgTable(
  'drill_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    drillId: uuid('drill_id')
      .notNull()
      .references(() => drills.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: contentStatusEnum('status').notNull().default('draft'),

    description: text('description'),
    level: playerLevelEnum('level').notNull().default('1'),
    trainingGoal: varchar('training_goal', { length: 200 }),
    /** 1 או 2 בלבד — אותה מגבלה כמו ב־Sessions */
    playerCount: smallint('player_count').notNull().default(1),
    durationMinutes: integer('duration_minutes').notNull().default(30),

    /** פרמטרי המכות */
    shotCount: integer('shot_count'),
    speedKmh: smallint('speed_kmh'),
    heightLevel: smallint('height_level'),
    spinLevel: smallint('spin_level'),
    depthLevel: smallint('depth_level'),
    angleDegrees: smallint('angle_degrees'),
    frequencyPerMinute: smallint('frequency_per_minute'),
    sequence: shotSequenceEnum('sequence').notNull().default('fixed'),
    /** רצף מכות מפורט לתוכניות Combination */
    shotPattern: jsonb('shot_pattern').$type<Record<string, unknown>[]>().notNull().default([]),

    safetyInstructions: text('safety_instructions'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    /** מדדי ביצוע — מחושבים מדי לילה */
    usageCount: integer('usage_count').notNull().default(0),
    completionRate: rate('completion_rate'),
    avgRating: quantity('avg_rating'),
    retentionImpact: rate('retention_impact'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('drill_versions_key').on(t.drillId, t.versionNumber),
    index('drill_versions_status_idx').on(t.status),
    index('drill_versions_level_idx').on(t.level),
  ],
);

export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    createdByCoachId: uuid('created_by_coach_id').references(() => coaches.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    currentVersionId: uuid('current_version_id'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [uniqueIndex('programs_slug_key').on(t.slug)],
);

export const programVersions = pgTable(
  'program_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: contentStatusEnum('status').notNull().default('draft'),
    description: text('description'),
    level: playerLevelEnum('level').notNull().default('1'),
    trainingGoal: varchar('training_goal', { length: 200 }),
    playerCount: smallint('player_count').notNull().default(1),
    durationMinutes: integer('duration_minutes').notNull().default(45),
    /** רשימת drill_version_id בסדר ההרצה */
    drillVersionIds: jsonb('drill_version_ids').$type<string[]>().notNull().default([]),
    safetyInstructions: text('safety_instructions'),
    /** תוכן שאושר על ידי VELA-X — "Certified by VELA-X", פרק 10.3 */
    isCertified: boolean('is_certified').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    usageCount: integer('usage_count').notNull().default(0),
    completionRate: rate('completion_rate'),
    avgRating: quantity('avg_rating'),
    retentionImpact: rate('retention_impact'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('program_versions_key').on(t.programId, t.versionNumber),
    index('program_versions_status_idx').on(t.status),
  ],
);

export const drillsRelations = relations(drills, ({ many, one }) => ({
  versions: many(drillVersions),
  coach: one(coaches, { fields: [drills.createdByCoachId], references: [coaches.id] }),
}));

export const drillVersionsRelations = relations(drillVersions, ({ one }) => ({
  drill: one(drills, { fields: [drillVersions.drillId], references: [drills.id] }),
}));

export const programsRelations = relations(programs, ({ many, one }) => ({
  versions: many(programVersions),
  coach: one(coaches, { fields: [programs.createdByCoachId], references: [coaches.id] }),
}));

export const programVersionsRelations = relations(programVersions, ({ one }) => ({
  program: one(programs, { fields: [programVersions.programId], references: [programs.id] }),
}));
