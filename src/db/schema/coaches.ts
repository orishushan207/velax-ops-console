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
import { demoFlag, money, quantity, rate, softDelete, timestamps } from './_shared';
import { attributionTypeEnum, coachVerificationEnum, commissionStatusEnum } from './enums';
import { users } from './identity';
import { clubs } from './network';
import { sessions } from './sessions';

/** מאמן — PDF פרק 10, Coach Partner Economy */
export const coaches = pgTable(
  'coaches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    bio: text('bio'),
    verification: coachVerificationEnum('verification').notNull().default('pending'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),
    /** קוד Referral אישי — הבסיס ל־Attribution */
    referralCode: varchar('referral_code', { length: 40 }).notNull(),
    homeClubId: uuid('home_club_id').references(() => clubs.id, { onDelete: 'set null' }),

    /** תעריפי עמלה — טווחים מפרק 10.1, ערכי ברירת מחדל מההגדרות העסקיות */
    referralBonusAmount: money('referral_bonus_amount').notNull().default('0'),
    retentionCommissionPct: rate('retention_commission_pct').notNull().default('0'),
    homeworkCommissionPct: rate('homework_commission_pct').notNull().default('0.075000'),
    contentRoyaltyPct: rate('content_royalty_pct').notNull().default('0.175000'),
    /** תקרת עמלה ללקוח — מונע כפל תגמול. פרק 10.2. */
    commissionCapPctPerCustomer: rate('commission_cap_pct_per_customer').notNull().default('0.200000'),
    /** חלון שיוך בימים — 180 לדוגמה בפרק 10.2 */
    attributionWindowDays: integer('attribution_window_days').notNull().default(180),

    rating: quantity('rating'),
    ratingCount: integer('rating_count').notNull().default(0),
    agreementSignedAt: timestamp('agreement_signed_at', { withTimezone: true }),
    agreementFileId: uuid('agreement_file_id'),
    contentRightsGranted: boolean('content_rights_granted').notNull().default(false),

    suspendedReason: text('suspended_reason'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('coaches_user_key').on(t.userId),
    uniqueIndex('coaches_referral_code_key').on(t.referralCode),
    index('coaches_verification_idx').on(t.verification),
    index('coaches_club_idx').on(t.homeClubId),
  ],
);

/**
 * coach_attributions — שיוך לקוח למאמן.
 * כלל אנטי-הונאה מפרק 10.2: אין Self-referral, אין כפל מלא של Referral+Homework+Content
 * על אותו לקוח, ואין עמלה על לקוח שכבר היה במערכת.
 */
export const coachAttributions = pgTable(
  'coach_attributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attributionType: attributionTypeEnum('attribution_type').notNull(),
    attributedAt: timestamp('attributed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** האם השיוך נפסל בבדיקת הונאה */
    isRejected: boolean('is_rejected').notNull().default(false),
    rejectionReason: text('rejection_reason'),
    sourceReferralCode: varchar('source_referral_code', { length: 40 }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('coach_attributions_key').on(t.coachId, t.userId, t.attributionType),
    index('coach_attributions_user_idx').on(t.userId),
    index('coach_attributions_coach_idx').on(t.coachId),
  ],
);

/**
 * coach_commissions — עמלה שנצברה.
 * "עמלה משולמת רק על שימוש ששולם והושלם, לאחר חלון זיכויים" — פרק 10.2.
 * לכן holdingUntil, ולכן clawback אפשרי.
 */
export const coachCommissions = pgTable(
  'coach_commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    attributionId: uuid('attribution_id').references(() => coachAttributions.id, {
      onDelete: 'set null',
    }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    attributionType: attributionTypeEnum('attribution_type').notNull(),
    status: commissionStatusEnum('status').notNull().default('accrued'),
    /** בסיס החישוב — הכנסה נטו של הסשן */
    baseAmountNet: money('base_amount_net').notNull().default('0'),
    ratePct: rate('rate_pct').notNull().default('0'),
    commissionAmount: money('commission_amount').notNull().default('0'),
    accruedAt: timestamp('accrued_at', { withTimezone: true }).notNull().defaultNow(),
    /** סוף חלון הזיכויים — לפניו לא משלמים */
    holdingUntil: timestamp('holding_until', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    payoutReference: varchar('payout_reference', { length: 80 }),
    clawbackReason: text('clawback_reason'),
    clawedBackAt: timestamp('clawed_back_at', { withTimezone: true }),
    /** האם נחסמה בגלל תקרה */
    cappedAmount: money('capped_amount').notNull().default('0'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('coach_commissions_coach_idx').on(t.coachId),
    index('coach_commissions_status_idx').on(t.status),
    index('coach_commissions_session_idx').on(t.sessionId),
    index('coach_commissions_accrued_idx').on(t.accruedAt),
  ],
);

export const coachesRelations = relations(coaches, ({ one, many }) => ({
  user: one(users, { fields: [coaches.userId], references: [users.id] }),
  homeClub: one(clubs, { fields: [coaches.homeClubId], references: [clubs.id] }),
  attributions: many(coachAttributions),
  commissions: many(coachCommissions),
}));

export const coachCommissionsRelations = relations(coachCommissions, ({ one }) => ({
  coach: one(coaches, { fields: [coachCommissions.coachId], references: [coaches.id] }),
  session: one(sessions, { fields: [coachCommissions.sessionId], references: [sessions.id] }),
}));

export const coachAttributionsRelations = relations(coachAttributions, ({ one }) => ({
  coach: one(coaches, { fields: [coachAttributions.coachId], references: [coaches.id] }),
  user: one(users, { fields: [coachAttributions.userId], references: [users.id] }),
}));

/** הקצאת שיעורי בית ממאמן למתאמן — PDF פרק 5.3 */
export const homeworkAssignments = pgTable(
  'homework_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programVersionId: uuid('program_version_id'),
    title: varchar('title', { length: 200 }).notNull(),
    instructions: text('instructions'),
    dueOn: date('due_on'),
    targetSessions: integer('target_sessions').notNull().default(1),
    completedSessions: integer('completed_sessions').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sessionIds: jsonb('session_ids').$type<string[]>().notNull().default([]),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('homework_coach_idx').on(t.coachId),
    index('homework_user_idx').on(t.userId),
    index('homework_due_idx').on(t.dueOn),
  ],
);
