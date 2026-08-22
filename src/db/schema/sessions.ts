import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
import { demoFlag, money, quantity, softDelete, timestamps } from './_shared';
import {
  bookingLinkTypeEnum,
  peakWindowEnum,
  playerLevelEnum,
  purchaseChannelEnum,
  sessionEventTypeEnum,
  sessionStatusEnum,
} from './enums';
import { users } from './identity';
import { clubs, courts, stations } from './network';
import { devices } from './devices';

/**
 * sessions — הישות המרכזית של המערכת.
 *
 * כללי זהב (סעיף 33 בהנחיות):
 *  • amountGross כולל מע״מ, amountNet לפני מע״מ — שני שדות נפרדים, לעולם לא מעורבבים.
 *  • סשן שזוכה במלואו (fully_refunded) אינו נספר כ־Paid Session בשום מדד.
 *  • מקסימום שני שחקנים — נאכף ב־CHECK על playerCount ובאינדקס ייחודי ב־session_players.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** מזהה קריא לאדם: VX-250820-0001 */
    reference: varchar('reference', { length: 32 }).notNull(),
    status: sessionStatusEnum('status').notNull().default('draft'),

    // ─── מי ואיפה ───
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Guest Checkout — PDF פרק 6, "לאפשר Guest Checkout בלי חסימה" */
    isGuest: boolean('is_guest').notNull().default(false),
    guestPhone: varchar('guest_phone', { length: 32 }),
    guestName: varchar('guest_name', { length: 120 }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    /** מספר שחקנים באימון — 1 או 2 בלבד */
    playerCount: smallint('player_count').notNull().default(1),

    // ─── תוכנית האימון ───
    programVersionId: uuid('program_version_id'),
    drillVersionId: uuid('drill_version_id'),
    level: playerLevelEnum('level'),

    // ─── זמנים ───
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    scheduledMinutes: integer('scheduled_minutes').notNull().default(60),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** דקות פעילות בפועל, בניכוי Pause. הבסיס לחישוב Paid Training Hours. */
    actualMinutes: integer('actual_minutes'),
    pausedMinutes: integer('paused_minutes').notNull().default(0),
    peakWindow: peakWindowEnum('peak_window'),

    // ─── כסף ───
    listPriceGross: money('list_price_gross').notNull().default('0'),
    discountAmount: money('discount_amount').notNull().default('0'),
    couponId: uuid('coupon_id'),
    /** מה שהשחקן חויב בפועל, כולל מע״מ */
    amountGross: money('amount_gross').notNull().default('0'),
    vatAmount: money('vat_amount').notNull().default('0'),
    /** הכנסה לפני מע״מ = amountGross / (1 + vatRate) */
    amountNet: money('amount_net').notNull().default('0'),
    vatRateApplied: quantity('vat_rate_applied').notNull().default('0.18'),
    /** סה״כ זוכה עד כה (ברוטו) */
    refundedAmount: money('refunded_amount').notNull().default('0'),
    currency: varchar('currency', { length: 3 }).notNull().default('ILS'),

    // ─── מדידה ───
    estimatedBalls: integer('estimated_balls'),
    /** האם הסשן התחיל ללא עזרת צוות — הבסיס ל־Start Success Rate */
    startedWithoutStaffHelp: boolean('started_without_staff_help'),
    failureReason: varchar('failure_reason', { length: 120 }),
    endReason: varchar('end_reason', { length: 120 }),

    // ─── שיוך ומקור ───
    purchaseChannel: purchaseChannelEnum('purchase_channel').notNull().default('station_qr'),
    coachId: uuid('coach_id'),
    referralCode: varchar('referral_code', { length: 40 }),
    utmSource: varchar('utm_source', { length: 120 }),
    utmMedium: varchar('utm_medium', { length: 120 }),
    utmCampaign: varchar('utm_campaign', { length: 120 }),

    // ─── Rewards ───
    xpAwarded: integer('xp_awarded').notNull().default(0),
    rewardsPointsAwarded: integer('rewards_points_awarded').notNull().default(0),

    /** ⚠ אינו מוחזר לעולם ב־API. נשמר hash בלבד לצורך אימות. */
    sessionTokenHash: varchar('session_token_hash', { length: 128 }),
    tokenIssuedAt: timestamp('token_issued_at', { withTimezone: true }),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('sessions_reference_key').on(t.reference),
    index('sessions_status_idx').on(t.status),
    index('sessions_club_started_idx').on(t.clubId, t.startedAt),
    index('sessions_station_started_idx').on(t.stationId, t.startedAt),
    index('sessions_device_idx').on(t.deviceId),
    index('sessions_user_idx').on(t.userId),
    index('sessions_started_idx').on(t.startedAt),
    index('sessions_coach_idx').on(t.coachId),
    index('sessions_created_idx').on(t.createdAt),
    // מגבלה קשיחה: אימון אחד = שחקן אחד או שניים בלבד. סעיף 33 בהנחיות.
    check('sessions_player_count_check', sql`${t.playerCount} BETWEEN 1 AND 2`),
    check('sessions_amounts_non_negative', sql`${t.amountGross} >= 0 AND ${t.amountNet} >= 0`),
    check('sessions_refund_not_over', sql`${t.refundedAmount} <= ${t.amountGross}`),
  ],
);

/** שיוך שחקנים לאימון. אינדקס ייחודי + CHECK מונעים יותר משניים. */
export const sessionPlayers = pgTable(
  'session_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestLabel: varchar('guest_label', { length: 80 }),
    /** 1 או 2 — לא ניתן ליצור slot 3 */
    slot: smallint('slot').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('session_players_slot_key').on(t.sessionId, t.slot),
    index('session_players_user_idx').on(t.userId),
    check('session_players_slot_check', sql`${t.slot} IN (1, 2)`),
  ],
);

/** יומן אירועים מלא לכל Session — הבסיס ל־Timeline במסך הסשן */
export const sessionEvents = pgTable(
  'session_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    eventType: sessionEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    fromStatus: sessionStatusEnum('from_status'),
    toStatus: sessionStatusEnum('to_status'),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    /** מקור האירוע: system | ops_console | device | player_app | automation */
    source: varchar('source', { length: 40 }).notNull().default('system'),
    message: text('message'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    ...demoFlag,
  },
  (t) => [
    index('session_events_session_time_idx').on(t.sessionId, t.occurredAt),
    index('session_events_type_idx').on(t.eventType),
  ],
);

/**
 * court_bookings — הזמנות מגרש של המועדון.
 *
 * זו הישות שמכריעה את Earn-Back. ההפרדה קריטית (סעיף 15 בהנחיות):
 *  machine_linked = הזמנה עם session_id תואם
 *  incremental    = אומתה כהכנסה שלא הייתה קיימת בלי המכונה
 *  baseline       = הייתה מתקיימת בכל מקרה — לא נספרת ב־Earn-Back
 */
export const courtBookings = pgTable(
  'court_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    courtId: uuid('court_id').references(() => courts.id, { onDelete: 'set null' }),
    externalBookingId: varchar('external_booking_id', { length: 80 }),
    /** קישור ל־Session. קיומו הוא מה שהופך הזמנה ל־machine_linked. */
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    linkType: bookingLinkTypeEnum('link_type').notNull().default('unverified'),
    /** מי סיווג את ההזמנה כאינקרמנטלית או כבסיסית, ולמה */
    classifiedBy: uuid('classified_by').references(() => users.id),
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
    classificationNote: text('classification_note'),

    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    peakWindow: peakWindowEnum('peak_window'),
    /** הכנסת המועדון מההזמנה, לפני מע״מ */
    revenueNet: money('revenue_net').notNull().default('0'),
    bookedByPhone: varchar('booked_by_phone', { length: 32 }),
    isCancelled: boolean('is_cancelled').notNull().default(false),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('court_bookings_club_time_idx').on(t.clubId, t.startsAt),
    index('court_bookings_session_idx').on(t.sessionId),
    index('court_bookings_link_type_idx').on(t.linkType),
    uniqueIndex('court_bookings_external_key').on(t.clubId, t.externalBookingId),
  ],
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  club: one(clubs, { fields: [sessions.clubId], references: [clubs.id] }),
  station: one(stations, { fields: [sessions.stationId], references: [stations.id] }),
  device: one(devices, { fields: [sessions.deviceId], references: [devices.id] }),
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  events: many(sessionEvents),
  players: many(sessionPlayers),
  bookings: many(courtBookings),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, { fields: [sessionEvents.sessionId], references: [sessions.id] }),
  actor: one(users, { fields: [sessionEvents.actorUserId], references: [users.id] }),
}));

export const sessionPlayersRelations = relations(sessionPlayers, ({ one }) => ({
  session: one(sessions, { fields: [sessionPlayers.sessionId], references: [sessions.id] }),
  user: one(users, { fields: [sessionPlayers.userId], references: [users.id] }),
}));

export const courtBookingsRelations = relations(courtBookings, ({ one }) => ({
  club: one(clubs, { fields: [courtBookings.clubId], references: [clubs.id] }),
  court: one(courts, { fields: [courtBookings.courtId], references: [courts.id] }),
  session: one(sessions, { fields: [courtBookings.sessionId], references: [sessions.id] }),
}));
