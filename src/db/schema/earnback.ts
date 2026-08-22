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
import { earnBackConditionStatusEnum, earnBackStatusEnum } from './enums';
import { users } from './identity';
import { clubContracts, clubs } from './network';

/**
 * earn_back_agreements — ערבות ששת החודשים (PDF פרק 8.3).
 *
 * ⚠ כלל מחייב (סעיף 15 בהנחיות): "אין לחשב Earn-Back רק לפי Sessions."
 * ההכנסה שנספרת היא הכנסת המגרש המקושרת של המועדון, לא ההכנסה של VELA-X.
 * incrementalityFactor מבטא איזה חלק מההכנסה המקושרת הוא באמת אינקרמנטלי —
 * הנחה שדורשת אימות בפיילוט, ולכן ניתנת לשינוי לכל הסכם בנפרד.
 */
export const earnBackAgreements = pgTable(
  'earn_back_agreements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    contractId: uuid('contract_id').references(() => clubContracts.id, { onDelete: 'set null' }),
    status: earnBackStatusEnum('status').notNull().default('draft'),

    /** מחיר הכניסה שיש להחזיר — 6,000 ₪ במודל העדכני */
    entryPrice: money('entry_price').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    /** ימי פעילות בתקופה — 156 לפי המודל (180 יום קלנדריים) */
    operatingDaysInPeriod: integer('operating_days_in_period').notNull().default(156),

    /** הכנסת מגרש לשעה לפני מע״מ — 90 ₪ לפי פרק 8.5 */
    courtRevenuePerHourNet: money('court_revenue_per_hour_net').notNull(),
    /** שעות נדרשות להחזר = entryPrice / courtRevenuePerHourNet */
    requiredHours: quantity('required_hours').notNull(),
    /** שעות ליום נדרשות = requiredHours / operatingDaysInPeriod */
    requiredHoursPerDay: quantity('required_hours_per_day').notNull(),

    /**
     * מקדם אינקרמנטליות. 1.00 = כל הכנסה מקושרת נחשבת אינקרמנטלית.
     * ברירת מחדל 0.70 — הנחה שלי, לא מספר מהמסמכים. דורשת אימות בפיילוט.
     */
    incrementalityFactor: rate('incrementality_factor').notNull().default('0.700000'),
    /** עלות כדורים שהמועדון סופג לשעה — 20 ₪ במודל, לא מופיע בחישוב שבתוכנית */
    clubBallCostPerHour: money('club_ball_cost_per_hour').notNull().default('0'),

    /** תקרת חשיפה מוחלטת בש״ח. אין ערך כזה במסמכים — הנחה שלי. */
    exposureCap: money('exposure_cap'),
    /** אחוז הפרשה מתקבולי ההתקנה — התוכנית מציעה 10%-15% */
    reservePct: rate('reserve_pct').notNull().default('0.125000'),

    /** תוצאה מחושבת אחרונה */
    achievedHours: quantity('achieved_hours').notNull().default('0'),
    verifiedRevenue: money('verified_revenue').notNull().default('0'),
    remainingGap: money('remaining_gap').notNull().default('0'),
    requiredRunRatePerDay: quantity('required_run_rate_per_day').notNull().default('0'),
    forecastRevenue: money('forecast_revenue').notNull().default('0'),
    forecastWillMeet: boolean('forecast_will_meet'),
    lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true }),

    /** תקופות השבתה שאינן באחריות המועדון — מוארכות את התקופה */
    excludedDowntimeDays: integer('excluded_downtime_days').notNull().default(0),
    /** האם המועדון הפר תנאי סף */
    clubBreachedConditions: boolean('club_breached_conditions').notNull().default(false),

    settlementAmount: money('settlement_amount'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    settlementNote: text('settlement_note'),
    documentFileIds: jsonb('document_file_ids').$type<string[]>().notNull().default([]),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('earn_back_club_idx').on(t.clubId),
    index('earn_back_status_idx').on(t.status),
    index('earn_back_period_idx').on(t.startsOn, t.endsOn),
  ],
);

/** תנאי סף לערבות — PDF פרק 8.4 */
export const earnBackConditions = pgTable(
  'earn_back_conditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => earnBackAgreements.id, { onDelete: 'cascade' }),
    /** מפתח מזהה: min_off_peak_hours | min_operating_days | uptime | charging_and_balls | ... */
    conditionKey: varchar('condition_key', { length: 80 }).notNull(),
    nameHe: varchar('name_he', { length: 250 }).notNull(),
    /** ערך הסף הנדרש */
    targetValue: quantity('target_value'),
    unit: varchar('unit', { length: 40 }),
    /** ערך שנמדד בפועל */
    measuredValue: quantity('measured_value'),
    status: earnBackConditionStatusEnum('status').notNull().default('not_measured'),
    /** ניתן לוותר על תנאי בהחלטה מסחרית — עם סיבה */
    waivedBy: uuid('waived_by').references(() => users.id),
    waivedReason: text('waived_reason'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('earn_back_conditions_key').on(t.agreementId, t.conditionKey),
    index('earn_back_conditions_status_idx').on(t.status),
  ],
);

/** מדידה חודשית — Snapshot שאינו משתנה רטרואקטיבית */
export const earnBackMeasurements = pgTable(
  'earn_back_measurements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => earnBackAgreements.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),

    /** שעות VELA-X בתשלום שהושלמו בתקופה */
    paidSessionHours: quantity('paid_session_hours').notNull().default('0'),
    /** הכנסת מגרש מהזמנות עם session_id תואם */
    machineLinkedRevenue: money('machine_linked_revenue').notNull().default('0'),
    /** מתוכה — מה שסווג כאינקרמנטלי */
    incrementalRevenue: money('incremental_revenue').notNull().default('0'),
    /** מתוכה — מה שסווג כבסיסי ולא נספר */
    baselineRevenue: money('baseline_revenue').notNull().default('0'),
    /** ההכנסה שנספרת בפועל לטובת הערבות */
    countedRevenue: money('counted_revenue').notNull().default('0'),
    /** עלות כדורים שהמועדון ספג בתקופה */
    clubBallCost: money('club_ball_cost').notNull().default('0'),
    /** הכנסה נטו למועדון = countedRevenue - clubBallCost */
    netClubBenefit: money('net_club_benefit').notNull().default('0'),

    cumulativeCountedRevenue: money('cumulative_counted_revenue').notNull().default('0'),
    offPeakHours: quantity('off_peak_hours').notNull().default('0'),
    uptimePct: rate('uptime_pct'),
    operatingDays: integer('operating_days').notNull().default(0),

    calculationSnapshot: jsonb('calculation_snapshot').$type<Record<string, unknown>>(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    calculatedBy: uuid('calculated_by').references(() => users.id),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('earn_back_measurements_key').on(t.agreementId, t.periodStart),
    index('earn_back_measurements_agreement_idx').on(t.agreementId),
  ],
);

/** התאמה ידנית לחישוב — כל שינוי מתועד ב־Audit Trail */
export const earnBackAdjustments = pgTable(
  'earn_back_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => earnBackAgreements.id, { onDelete: 'cascade' }),
    measurementId: uuid('measurement_id').references(() => earnBackMeasurements.id, {
      onDelete: 'set null',
    }),
    /** revenue_credit | revenue_debit | hours_credit | period_extension | condition_waiver */
    adjustmentType: varchar('adjustment_type', { length: 40 }).notNull(),
    amount: money('amount').notNull().default('0'),
    hours: quantity('hours').notNull().default('0'),
    days: integer('days').notNull().default(0),
    reason: text('reason').notNull(),
    approvedBy: uuid('approved_by')
      .notNull()
      .references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [index('earn_back_adjustments_agreement_idx').on(t.agreementId)],
);

export const earnBackAgreementsRelations = relations(earnBackAgreements, ({ one, many }) => ({
  club: one(clubs, { fields: [earnBackAgreements.clubId], references: [clubs.id] }),
  contract: one(clubContracts, {
    fields: [earnBackAgreements.contractId],
    references: [clubContracts.id],
  }),
  conditions: many(earnBackConditions),
  measurements: many(earnBackMeasurements),
  adjustments: many(earnBackAdjustments),
}));

export const earnBackConditionsRelations = relations(earnBackConditions, ({ one }) => ({
  agreement: one(earnBackAgreements, {
    fields: [earnBackConditions.agreementId],
    references: [earnBackAgreements.id],
  }),
}));

export const earnBackMeasurementsRelations = relations(earnBackMeasurements, ({ one }) => ({
  agreement: one(earnBackAgreements, {
    fields: [earnBackMeasurements.agreementId],
    references: [earnBackAgreements.id],
  }),
}));
