import { relations } from 'drizzle-orm';
import {
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
import { demoFlag, money, softDelete, timestamps } from './_shared';
import { challengeStatusEnum, membershipTierEnum, rewardsTxTypeEnum } from './enums';
import { users } from './identity';
import { sessions } from './sessions';
import { coupons } from './payments';

/**
 * rewards_accounts — XP, נקודות ו־Streak לשחקן.
 *
 * ⚠ כלל מפרק 11.2: "אין XP על פתיחת סשן שלא הושלם ואין קנייה ישירה של מעמד."
 * לכן צבירה מתרחשת רק במעבר ל־completed, ורק על סשן ששולם ולא זוכה במלואו.
 */
export const rewardsAccounts = pgTable(
  'rewards_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    xpTotal: integer('xp_total').notNull().default(0),
    pointsBalance: integer('points_balance').notNull().default(0),
    pointsEarnedTotal: integer('points_earned_total').notNull().default(0),
    pointsRedeemedTotal: integer('points_redeemed_total').notNull().default(0),
    pointsExpiredTotal: integer('points_expired_total').notNull().default(0),
    currentStreakWeeks: integer('current_streak_weeks').notNull().default(0),
    longestStreakWeeks: integer('longest_streak_weeks').notNull().default(0),
    lastActivityDate: date('last_activity_date'),
    tier: membershipTierEnum('tier').notNull().default('X1'),
    badges: jsonb('badges').$type<string[]>().notNull().default([]),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [uniqueIndex('rewards_accounts_user_key').on(t.userId)],
);

export const rewardsTransactions = pgTable(
  'rewards_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => rewardsAccounts.id, { onDelete: 'cascade' }),
    txType: rewardsTxTypeEnum('tx_type').notNull(),
    xpDelta: integer('xp_delta').notNull().default(0),
    pointsDelta: integer('points_delta').notNull().default(0),
    pointsBalanceAfter: integer('points_balance_after').notNull().default(0),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    challengeId: uuid('challenge_id'),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    /**
     * עלות ההטבה ל־VELA-X. הבסיס ל־Outstanding Liability.
     * הקרן: 6% מההכנסה נטו לפי פרק 11.4.
     */
    costToCompany: money('cost_to_company').notNull().default('0'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('rewards_tx_account_idx').on(t.accountId),
    index('rewards_tx_type_idx').on(t.txType),
    index('rewards_tx_created_idx').on(t.createdAt),
    index('rewards_tx_expiry_idx').on(t.expiresAt),
  ],
);

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    description: text('description'),
    status: challengeStatusEnum('status').notNull().default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** תנאי השלמה, למשל: {"type":"session_count","value":4,"window_days":28} */
    criteria: jsonb('criteria').$type<Record<string, unknown>>().notNull().default({}),
    xpReward: integer('xp_reward').notNull().default(0),
    pointsReward: integer('points_reward').notNull().default(0),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    participantCount: integer('participant_count').notNull().default(0),
    completionCount: integer('completion_count').notNull().default(0),
    estimatedCost: money('estimated_cost').notNull().default('0'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('challenges_status_idx').on(t.status), index('challenges_period_idx').on(t.startsAt, t.endsAt)],
);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerUserId: uuid('referrer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id').references(() => users.id, { onDelete: 'set null' }),
    code: varchar('code', { length: 40 }).notNull(),
    /** pending | qualified | rewarded | rejected */
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    /** דרישת ההסמכה: השלים 2-3 סשנים בתשלום — פרק 10.1 */
    qualifyingSessions: integer('qualifying_sessions').notNull().default(0),
    requiredSessions: integer('required_sessions').notNull().default(2),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    rewardedAt: timestamp('rewarded_at', { withTimezone: true }),
    rewardAmount: money('reward_amount').notNull().default('0'),
    /** נפסל בבדיקת הונאה: Self-referral, כרטיס זהה, מכשיר זהה */
    fraudFlags: jsonb('fraud_flags').$type<string[]>().notNull().default([]),
    rejectionReason: text('rejection_reason'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('referrals_referrer_idx').on(t.referrerUserId),
    index('referrals_code_idx').on(t.code),
    index('referrals_status_idx').on(t.status),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planKey: varchar('plan_key', { length: 60 }).notNull(),
    planNameHe: varchar('plan_name_he', { length: 160 }).notNull(),
    /** active | paused | cancelled | expired | past_due */
    status: varchar('status', { length: 24 }).notNull().default('active'),
    monthlyPriceGross: money('monthly_price_gross').notNull().default('0'),
    includedSessionsPerMonth: integer('included_sessions_per_month').notNull().default(0),
    usedSessionsThisPeriod: integer('used_sessions_this_period').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('subscriptions_user_idx').on(t.userId), index('subscriptions_status_idx').on(t.status)],
);

export const rewardsAccountsRelations = relations(rewardsAccounts, ({ one, many }) => ({
  user: one(users, { fields: [rewardsAccounts.userId], references: [users.id] }),
  transactions: many(rewardsTransactions),
}));

export const rewardsTransactionsRelations = relations(rewardsTransactions, ({ one }) => ({
  account: one(rewardsAccounts, {
    fields: [rewardsTransactions.accountId],
    references: [rewardsAccounts.id],
  }),
  session: one(sessions, { fields: [rewardsTransactions.sessionId], references: [sessions.id] }),
}));
