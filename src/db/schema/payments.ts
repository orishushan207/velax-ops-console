import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
import { demoFlag, money, quantity, softDelete, timestamps } from './_shared';
import {
  couponTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  refundDestinationEnum,
  refundReasonEnum,
  refundStatusEnum,
  refundTypeEnum,
  walletTxTypeEnum,
} from './enums';
import { users } from './identity';
import { clubs } from './network';
import { sessions } from './sessions';

/**
 * payments — ספר תשלומים מלא, לא עמודת "paid" על הסשן.
 *
 * ⚠ idempotencyKey הוא ההגנה היחידה מפני חיוב כפול. אינדקס ייחודי עליו.
 * כל פעולה כספית עוברת ב־transaction יחד עם רישום ב־audit_logs.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 32 }).notNull(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),

    status: paymentStatusEnum('status').notNull().default('pending'),
    method: paymentMethodEnum('method').notNull().default('card'),

    amountGross: money('amount_gross').notNull(),
    vatAmount: money('vat_amount').notNull().default('0'),
    amountNet: money('amount_net').notNull(),
    vatRateApplied: quantity('vat_rate_applied').notNull().default('0.18'),
    currency: varchar('currency', { length: 3 }).notNull().default('ILS'),

    /** עמלת סליקה בפועל — 2.7% + 1 ₪ לפי המודל */
    processingFee: money('processing_fee').notNull().default('0'),

    /** ספק הסליקה: mock | tranzila | cardcom | stripe */
    provider: varchar('provider', { length: 40 }).notNull().default('mock'),
    providerTransactionId: varchar('provider_transaction_id', { length: 120 }),
    providerReference: varchar('provider_reference', { length: 120 }),
    cardLast4: varchar('card_last4', { length: 4 }),
    cardBrand: varchar('card_brand', { length: 24 }),

    /** מפתח ייחודי למניעת חיוב כפול. סעיף 25 בהנחיות. */
    idempotencyKey: varchar('idempotency_key', { length: 96 }).notNull(),

    capturedAt: timestamp('captured_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureCode: varchar('failure_code', { length: 60 }),
    failureMessage: text('failure_message'),

    invoiceId: uuid('invoice_id'),
    settlementId: uuid('settlement_id'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('payments_reference_key').on(t.reference),
    uniqueIndex('payments_idempotency_key').on(t.idempotencyKey),
    index('payments_session_idx').on(t.sessionId),
    index('payments_status_idx').on(t.status),
    index('payments_user_idx').on(t.userId),
    index('payments_club_captured_idx').on(t.clubId, t.capturedAt),
    index('payments_provider_tx_idx').on(t.providerTransactionId),
    check('payments_amount_positive', sql`${t.amountGross} > 0`),
  ],
);

/** כל ניסיון סליקה, כולל כשלים — הבסיס לניתוח כשלי תשלום */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull().default(1),
    succeeded: boolean('succeeded').notNull().default(false),
    provider: varchar('provider', { length: 40 }).notNull(),
    providerResponseCode: varchar('provider_response_code', { length: 40 }),
    providerResponseMessage: text('provider_response_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    latencyMs: integer('latency_ms'),
    ...demoFlag,
  },
  (t) => [index('payment_attempts_payment_idx').on(t.paymentId)],
);

/**
 * refunds — זיכויים.
 * כל זיכוי חייב: סיבה מובנית, הערה, Session מקושר, סכום, מבצע, מאשר מעל רף, תאריך ואסמכתה.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 32 }).notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    ticketId: uuid('ticket_id'),

    refundType: refundTypeEnum('refund_type').notNull(),
    destination: refundDestinationEnum('destination').notNull().default('original_method'),
    status: refundStatusEnum('status').notNull().default('pending_approval'),

    amountGross: money('amount_gross').notNull(),
    amountNet: money('amount_net').notNull(),
    vatAmount: money('vat_amount').notNull().default('0'),

    reason: refundReasonEnum('reason').notNull(),
    reasonNote: text('reason_note').notNull(),

    requestedBy: uuid('requested_by').references(() => users.id),
    /** חובה כאשר הסכום עולה על refund.approval_threshold_ils */
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),

    /** נוצר על ידי Rules Engine ולא על ידי אדם */
    isAutomatic: boolean('is_automatic').notNull().default(false),
    automationRuleId: uuid('automation_rule_id'),

    provider: varchar('provider', { length: 40 }).notNull().default('mock'),
    providerRefundId: varchar('provider_refund_id', { length: 120 }),
    idempotencyKey: varchar('idempotency_key', { length: 96 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('refunds_reference_key').on(t.reference),
    uniqueIndex('refunds_idempotency_key').on(t.idempotencyKey),
    index('refunds_payment_idx').on(t.paymentId),
    index('refunds_session_idx').on(t.sessionId),
    index('refunds_status_idx').on(t.status),
    index('refunds_reason_idx').on(t.reason),
    check('refunds_amount_positive', sql`${t.amountGross} > 0`),
  ],
);

export const chargebacks = pgTable(
  'chargebacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    amountGross: money('amount_gross').notNull(),
    providerCaseId: varchar('provider_case_id', { length: 120 }),
    reasonCode: varchar('reason_code', { length: 60 }),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    respondByAt: timestamp('respond_by_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** won | lost | accepted | pending */
    outcome: varchar('outcome', { length: 20 }).notNull().default('pending'),
    notes: text('notes'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [index('chargebacks_payment_idx').on(t.paymentId)],
);

/** התאמת סליקה — מה הסולק העביר בפועל מול מה שנרשם */
export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 40 }).notNull(),
    settlementDate: date('settlement_date').notNull(),
    grossAmount: money('gross_amount').notNull().default('0'),
    feesAmount: money('fees_amount').notNull().default('0'),
    refundsAmount: money('refunds_amount').notNull().default('0'),
    chargebacksAmount: money('chargebacks_amount').notNull().default('0'),
    netAmount: money('net_amount').notNull().default('0'),
    transactionCount: integer('transaction_count').notNull().default(0),
    /** הפרש בין הצפוי למה שהתקבל בפועל */
    varianceAmount: money('variance_amount').notNull().default('0'),
    isReconciled: boolean('is_reconciled').notNull().default(false),
    reconciledBy: uuid('reconciled_by').references(() => users.id),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    externalReference: varchar('external_reference', { length: 120 }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('settlements_key').on(t.provider, t.settlementDate),
    index('settlements_date_idx').on(t.settlementDate),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: varchar('invoice_number', { length: 40 }).notNull(),
    /** session_payment | club_setup_fee | club_retainer | coach_commission */
    invoiceType: varchar('invoice_type', { length: 40 }).notNull(),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    amountNet: money('amount_net').notNull(),
    vatAmount: money('vat_amount').notNull(),
    amountGross: money('amount_gross').notNull(),
    /** מספר מסמך במערכת החשבונות החיצונית */
    externalDocumentId: varchar('external_document_id', { length: 120 }),
    fileId: uuid('file_id'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('invoices_number_key').on(t.invoiceNumber),
    index('invoices_club_idx').on(t.clubId),
    index('invoices_type_idx').on(t.invoiceType),
    index('invoices_due_idx').on(t.dueAt),
  ],
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull(),
    nameHe: varchar('name_he', { length: 160 }).notNull(),
    couponType: couponTypeEnum('coupon_type').notNull(),
    /** אחוז (0.20) או סכום קבוע בש״ח, לפי couponType */
    value: money('value').notNull(),
    maxDiscountAmount: money('max_discount_amount'),
    minPurchaseAmount: money('min_purchase_amount').notNull().default('0'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    maxRedemptions: integer('max_redemptions'),
    maxRedemptionsPerUser: integer('max_redemptions_per_user').notNull().default(1),
    redemptionCount: integer('redemption_count').notNull().default(0),
    /** הגבלה למועדון מסוים / חלון Off-Peak בלבד */
    restrictedClubIds: jsonb('restricted_club_ids').$type<string[]>().notNull().default([]),
    offPeakOnly: boolean('off_peak_only').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /** עלות ההטבה ל־VELA-X — משמש לחישוב Rewards Liability */
    costToCompany: money('cost_to_company').notNull().default('0'),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('coupons_code_key').on(t.code),
    index('coupons_active_idx').on(t.isActive),
    index('coupons_validity_idx').on(t.validFrom, t.validUntil),
  ],
);

/** ארנק קרדיט — יעד אפשרי לזיכוי */
export const creditWallets = pgTable(
  'credit_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: money('balance').notNull().default('0'),
    currency: varchar('currency', { length: 3 }).notNull().default('ILS'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('credit_wallets_user_key').on(t.userId),
    check('credit_wallets_balance_non_negative', sql`${t.balance} >= 0`),
  ],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => creditWallets.id, { onDelete: 'cascade' }),
    txType: walletTxTypeEnum('tx_type').notNull(),
    /** חיובי = זיכוי לארנק, שלילי = משיכה */
    amount: money('amount').notNull(),
    balanceAfter: money('balance_after').notNull(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    refundId: uuid('refund_id').references(() => refunds.id, { onDelete: 'set null' }),
    note: text('note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('wallet_tx_wallet_idx').on(t.walletId),
    index('wallet_tx_type_idx').on(t.txType),
  ],
);

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  session: one(sessions, { fields: [payments.sessionId], references: [sessions.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  club: one(clubs, { fields: [payments.clubId], references: [clubs.id] }),
  attempts: many(paymentAttempts),
  refunds: many(refunds),
  chargebacks: many(chargebacks),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
  session: one(sessions, { fields: [refunds.sessionId], references: [sessions.id] }),
  requester: one(users, { fields: [refunds.requestedBy], references: [users.id] }),
  approver: one(users, { fields: [refunds.approvedBy], references: [users.id] }),
}));

export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  payment: one(payments, { fields: [paymentAttempts.paymentId], references: [payments.id] }),
}));
