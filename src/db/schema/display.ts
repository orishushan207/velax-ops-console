import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, softDelete, timestamps } from './_shared';
import { mediaTypeEnum, moderationStatusEnum } from './enums';
import { users } from './identity';
import { screens } from './network';

/**
 * media_assets — כל קובץ מדיה שמוצג במסכי המועדון.
 *
 * ⚠ תוכן משתמשים (UGC) דורש: הסכמה מפורשת, Moderation, זכות שימוש, ותאריך תפוגת הרשאה.
 * PDF פרק 12.2 ו־21. לכן consentId ו־rightsExpireAt הם שדות חובה לוגית ל־UGC.
 */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    fileId: uuid('file_id'),
    externalUrl: text('external_url'),
    durationSeconds: integer('duration_seconds'),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),

    /** תוכן שנוצר על ידי משתמש — דורש Moderation */
    isUserGenerated: boolean('is_user_generated').notNull().default(false),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    moderationStatus: moderationStatusEnum('moderation_status').notNull().default('pending'),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    moderationNote: text('moderation_note'),
    /** הסכמת המשתמש לשימוש בתוכן */
    consentId: uuid('consent_id'),
    /** תאריך תפוגת ההרשאה לשימוש */
    rightsExpireAt: timestamp('rights_expire_at', { withTimezone: true }),
    reportCount: integer('report_count').notNull().default(0),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('media_assets_moderation_idx').on(t.moderationStatus),
    index('media_assets_ugc_idx').on(t.isUserGenerated),
    index('media_assets_rights_idx').on(t.rightsExpireAt),
  ],
);

export const screenCampaigns = pgTable(
  'screen_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    /** draft | scheduled | active | paused | ended */
    status: varchar('status', { length: 24 }).notNull().default('draft'),
    /** רשימת מזהי מדיה בסדר ההצגה */
    playlist: jsonb('playlist')
      .$type<{ mediaAssetId: string; durationSeconds: number }[]>()
      .notNull()
      .default([]),
    ctaText: varchar('cta_text', { length: 200 }),
    ctaUrl: text('cta_url'),
    qrTarget: text('qr_target'),

    /** מיקוד: מועדונים ואזורים ספציפיים. ריק = כל הרשת. */
    targetClubIds: jsonb('target_club_ids').$type<string[]>().notNull().default([]),
    targetRegions: jsonb('target_regions').$type<string[]>().notNull().default([]),
    targetScreenIds: jsonb('target_screen_ids').$type<string[]>().notNull().default([]),

    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    dailyFrom: time('daily_from'),
    dailyUntil: time('daily_until'),
    daysOfWeek: jsonb('days_of_week').$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    priority: integer('priority').notNull().default(50),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('screen_campaigns_status_idx').on(t.status),
    index('screen_campaigns_period_idx').on(t.startsAt, t.endsAt),
  ],
);

/** Proof of play — הוכחה שהתוכן אכן הוצג */
export const screenPlaybackLogs = pgTable(
  'screen_playback_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    screenId: uuid('screen_id')
      .notNull()
      .references(() => screens.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => screenCampaigns.id, { onDelete: 'set null' }),
    mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    completed: boolean('completed').notNull().default(true),
    ...demoFlag,
  },
  (t) => [
    index('screen_playback_screen_time_idx').on(t.screenId, t.playedAt),
    index('screen_playback_campaign_idx').on(t.campaignId),
  ],
);

export const screenCampaignsRelations = relations(screenCampaigns, ({ many }) => ({
  playbackLogs: many(screenPlaybackLogs),
}));

export const screenPlaybackLogsRelations = relations(screenPlaybackLogs, ({ one }) => ({
  screen: one(screens, { fields: [screenPlaybackLogs.screenId], references: [screens.id] }),
  campaign: one(screenCampaigns, {
    fields: [screenPlaybackLogs.campaignId],
    references: [screenCampaigns.id],
  }),
}));
