import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, money, quantity, rate, softDelete, timestamps } from './_shared';
import {
  clubStatusEnum,
  contractStatusEnum,
  pricingModelEnum,
  screenStatusEnum,
  stationStatusEnum,
  stationTypeEnum,
} from './enums';
import { users } from './identity';

/**
 * clubs — מועדון פאדל.
 * Health Score נשמר כערך מחושב עם חותמת זמן, כדי שדוחות היסטוריים לא ישתנו רטרואקטיבית.
 */
export const clubs = pgTable(
  'clubs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 24 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    region: varchar('region', { length: 80 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    address: text('address'),
    latitude: quantity('latitude'),
    longitude: quantity('longitude'),
    status: clubStatusEnum('status').notNull().default('prospect'),
    courtCount: integer('court_count').notNull().default(0),
    joinedAt: date('joined_at'),
    /** חלון Off-Peak של המועדון. התוכנית דורשת מינימום שעות Off-Peak אך לא מגדירה את החלון. */
    offPeakStart: time('off_peak_start').notNull().default('08:00'),
    offPeakEnd: time('off_peak_end').notNull().default('16:00'),
    offPeakDays: jsonb('off_peak_days').$type<number[]>().notNull().default([0, 1, 2, 3, 4]),
    /** ציון בריאות אחרון שחושב, 0–100. הנוסחה ב־lib/metrics/club-health.ts */
    healthScore: smallint('health_score'),
    healthScoreAt: timestamp('health_score_at', { withTimezone: true }),
    healthScoreBreakdown: jsonb('health_score_breakdown').$type<Record<string, number>>(),
    accountManagerId: uuid('account_manager_id').references(() => users.id),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('clubs_code_key').on(t.code),
    index('clubs_status_idx').on(t.status),
    index('clubs_region_idx').on(t.region),
    index('clubs_name_idx').on(t.name),
  ],
);

export const clubContacts = pgTable(
  'club_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    role: varchar('role', { length: 100 }),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 32 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('club_contacts_club_idx').on(t.clubId)],
);

/**
 * club_contracts — ההסכם המסחרי.
 * pricingModel מכסה את שלושת המודלים מגיליון "מודלים חלופיים" ב־XLSX.
 */
export const clubContracts = pgTable(
  'club_contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    contractNumber: varchar('contract_number', { length: 40 }).notNull(),
    status: contractStatusEnum('status').notNull().default('draft'),
    pricingModel: pricingModelEnum('pricing_model').notNull().default('setup_fee_usage'),
    /** דמי הקמה — 6,000 ₪ במודל העדכני, 14,900 ₪ במסמך העסקי הישן */
    setupFee: money('setup_fee').notNull().default('0'),
    /** ריטיינר חודשי — קיים רק במודלים ב׳ ו־ג׳ */
    monthlyRetainer: money('monthly_retainer').notNull().default('0'),
    /** אחוז מהכנסת השעה שחוזר למועדון, אם קיים בחוזה */
    clubRevenueSharePct: rate('club_revenue_share_pct').notNull().default('0'),
    /** מחיר לשחקן לשעה — יורש מההגדרות הגלובליות אם null */
    consumerPricePerHour: money('consumer_price_per_hour'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    renewalDate: date('renewal_date'),
    autoRenew: boolean('auto_renew').notNull().default(false),
    /** SLA ספציפי להסכם. null = שימוש במדיניות ברירת המחדל. */
    slaPolicyId: uuid('sla_policy_id'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    signedByName: varchar('signed_by_name', { length: 200 }),
    documentFileId: uuid('document_file_id'),
    terms: text('terms'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('club_contracts_number_key').on(t.contractNumber),
    index('club_contracts_club_idx').on(t.clubId),
    index('club_contracts_status_idx').on(t.status),
    index('club_contracts_renewal_idx').on(t.renewalDate),
  ],
);

export const clubOperatingHours = pgTable(
  'club_operating_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    /** 0 = ראשון ... 6 = שבת (תקן ישראלי) */
    dayOfWeek: smallint('day_of_week').notNull(),
    opensAt: time('opens_at').notNull(),
    closesAt: time('closes_at').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [uniqueIndex('club_hours_key').on(t.clubId, t.dayOfWeek)],
);

export const courts = pgTable(
  'courts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    isIndoor: boolean('is_indoor').notNull().default(false),
    /** הכנסת מגרש לשעה לפני מע״מ — בסיס לחישוב Earn-Back */
    revenuePerHourNet: money('revenue_per_hour_net'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('courts_club_idx').on(t.clubId)],
);

/**
 * stations — העמדה הפיזית במועדון.
 * זו יחידת המדידה העסקית: Uptime, שעות בתשלום ו־Earn-Back נמדדים לעמדה, לא למכונה,
 * כי מכונה מוחלפת והעמדה נשארת.
 */
export const stations = pgTable(
  'stations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    stationType: stationTypeEnum('station_type').notNull().default('lean'),
    status: stationStatusEnum('status').notNull().default('planned'),
    locationDescription: text('location_description'),
    /** מגרשים שהעמדה משרתת. המודל: 2.5 בממוצע; הערת היזם: 2. */
    servesCourtIds: jsonb('serves_court_ids').$type<string[]>().notNull().default([]),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    decommissionedAt: timestamp('decommissioned_at', { withTimezone: true }),
    /** עלות ההתקנה בפועל — 5,500 רזה / 10,000 מלאה לפי המודל */
    installedCost: money('installed_cost'),
    qrCodeToken: varchar('qr_code_token', { length: 64 }),
    nfcTagId: varchar('nfc_tag_id', { length: 64 }),
    suspendedReason: text('suspended_reason'),
    suspendedBy: uuid('suspended_by').references(() => users.id),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('stations_code_key').on(t.code),
    uniqueIndex('stations_qr_key').on(t.qrCodeToken),
    index('stations_club_idx').on(t.clubId),
    index('stations_status_idx').on(t.status),
  ],
);

/** מסך מסחרי בעמדה — Display CMS, פרק 12 בתוכנית */
export const screens = pgTable(
  'screens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 120 }).notNull(),
    serialNumber: varchar('serial_number', { length: 80 }),
    status: screenStatusEnum('status').notNull().default('unknown'),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    activeFrom: time('active_from').notNull().default('06:00'),
    activeUntil: time('active_until').notNull().default('23:00'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [index('screens_club_idx').on(t.clubId), index('screens_station_idx').on(t.stationId)],
);

export const clubsRelations = relations(clubs, ({ many, one }) => ({
  contacts: many(clubContacts),
  contracts: many(clubContracts),
  courts: many(courts),
  stations: many(stations),
  screens: many(screens),
  operatingHours: many(clubOperatingHours),
  accountManager: one(users, { fields: [clubs.accountManagerId], references: [users.id] }),
}));

export const stationsRelations = relations(stations, ({ one }) => ({
  club: one(clubs, { fields: [stations.clubId], references: [clubs.id] }),
}));

export const courtsRelations = relations(courts, ({ one }) => ({
  club: one(clubs, { fields: [courts.clubId], references: [clubs.id] }),
}));

export const clubContractsRelations = relations(clubContracts, ({ one }) => ({
  club: one(clubs, { fields: [clubContracts.clubId], references: [clubs.id] }),
}));

export const clubContactsRelations = relations(clubContacts, ({ one }) => ({
  club: one(clubs, { fields: [clubContacts.clubId], references: [clubs.id] }),
}));

export const screensRelations = relations(screens, ({ one }) => ({
  club: one(clubs, { fields: [screens.clubId], references: [clubs.id] }),
  station: one(stations, { fields: [screens.stationId], references: [stations.id] }),
}));
