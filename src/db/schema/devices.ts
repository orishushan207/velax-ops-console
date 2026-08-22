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
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { demoFlag, money, quantity, softDelete, timestamps } from './_shared';
import {
  deviceAssignmentReasonEnum,
  deviceConnectivityEnum,
  deviceStatusEnum,
  firmwareChannelEnum,
} from './enums';
import { users } from './identity';
import { clubs, stations } from './network';

/**
 * devices — המכונה הפיזית (PT-9001 / VELA-X ELITE).
 *
 * ⚠ אבטחה: authKeyEncrypted מכיל את מפתח ההרשאה של המכשיר, מוצפן ב־AES-256-GCM
 * עם מפתח מ־DEVICE_KEY_ENCRYPTION_KEY. הוא לעולם אינו מוחזר מ־API ואינו מוצג ב־UI.
 * סעיף 9 בהנחיות: "אל תשמור Secrets גלויים במסד הנתונים או ב־UI".
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Device ID ייחודי שאינו ניתן לשינוי פשוט — PDF פרק 13.2 */
    deviceId: varchar('device_id', { length: 64 }).notNull(),
    serialNumber: varchar('serial_number', { length: 80 }).notNull(),
    model: varchar('model', { length: 80 }).notNull().default('PT-9001'),
    hardwareVersion: varchar('hardware_version', { length: 40 }),
    firmwareVersionId: uuid('firmware_version_id'),
    status: deviceStatusEnum('status').notNull().default('in_stock'),
    /** האם המכשיר מורשה לפעול ברשת VELA-X */
    isAuthorized: boolean('is_authorized').notNull().default(false),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    /** מפתח מוצפן. אין endpoint שמחזיר אותו. */
    authKeyEncrypted: text('auth_key_encrypted'),
    authKeyRotatedAt: timestamp('auth_key_rotated_at', { withTimezone: true }),
    /** מכונה חלופית מוחזקת במלאי להחלפה מהירה לפי SLA */
    isSpare: boolean('is_spare').notNull().default(false),

    currentClubId: uuid('current_club_id').references(() => clubs.id, { onDelete: 'set null' }),
    currentStationId: uuid('current_station_id').references(() => stations.id, {
      onDelete: 'set null',
    }),

    connectivity: deviceConnectivityEnum('connectivity').notNull().default('unknown'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    batteryPct: smallint('battery_pct'),
    /** מונה שעות עבודה מצטבר — טריגר לתחזוקה מונעת */
    operatingHours: quantity('operating_hours').notNull().default('0'),
    /** מונה כדורים מצטבר — טריגר לרוטציית כדורים */
    ballCount: integer('ball_count').notNull().default(0),
    estimatedBallsRemaining: integer('estimated_balls_remaining'),

    purchaseDate: date('purchase_date'),
    purchaseCost: money('purchase_cost'),
    supplierId: uuid('supplier_id'),
    warrantyUntil: date('warranty_until'),
    lastServiceAt: timestamp('last_service_at', { withTimezone: true }),
    nextServiceDue: date('next_service_due'),

    quarantineReason: text('quarantine_reason'),
    quarantinedBy: uuid('quarantined_by').references(() => users.id),
    quarantinedAt: timestamp('quarantined_at', { withTimezone: true }),
    retiredReason: text('retired_reason'),

    qrCodeToken: varchar('qr_code_token', { length: 64 }),
    nfcTagId: varchar('nfc_tag_id', { length: 64 }),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('devices_device_id_key').on(t.deviceId),
    uniqueIndex('devices_serial_key').on(t.serialNumber),
    index('devices_status_idx').on(t.status),
    index('devices_club_idx').on(t.currentClubId),
    index('devices_station_idx').on(t.currentStationId),
    index('devices_connectivity_idx').on(t.connectivity),
    index('devices_next_service_idx').on(t.nextServiceDue),
  ],
);

/** היסטוריית הצבת מכונה בעמדה — מי היה איפה ומתי */
export const deviceAssignments = pgTable(
  'device_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    reason: deviceAssignmentReasonEnum('reason').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    unassignedAt: timestamp('unassigned_at', { withTimezone: true }),
    assignedBy: uuid('assigned_by').references(() => users.id),
    /** המכונה שהוחלפה, כאשר reason = replacement */
    replacedDeviceId: uuid('replaced_device_id'),
    notes: text('notes'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('device_assignments_device_idx').on(t.deviceId),
    index('device_assignments_station_idx').on(t.stationId),
    index('device_assignments_period_idx').on(t.assignedAt, t.unassignedAt),
  ],
);

/** טלמטריה — נשמרת מדוגמת, לא כל אירוע. Retention מוגדר במדיניות. */
export const deviceTelemetry = pgTable(
  'device_telemetry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    batteryPct: smallint('battery_pct'),
    connectivity: deviceConnectivityEnum('connectivity').notNull().default('unknown'),
    rssi: smallint('rssi'),
    ballsFired: integer('balls_fired'),
    motorTempC: smallint('motor_temp_c'),
    errorCode: varchar('error_code', { length: 40 }),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    ...demoFlag,
  },
  (t) => [
    index('device_telemetry_device_time_idx').on(t.deviceId, t.recordedAt),
    index('device_telemetry_session_idx').on(t.sessionId),
    index('device_telemetry_error_idx').on(t.errorCode),
  ],
);

export const firmwareVersions = pgTable(
  'firmware_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: varchar('version', { length: 40 }).notNull(),
    channel: firmwareChannelEnum('channel').notNull().default('stable'),
    releaseNotes: text('release_notes'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    /** מינימום נדרש — מכשירים מתחת לזה מסומנים כלא מעודכנים */
    isMinimumRequired: boolean('is_minimum_required').notNull().default(false),
    checksum: varchar('checksum', { length: 128 }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [uniqueIndex('firmware_versions_key').on(t.version, t.channel)],
);

export const deviceFirmwareHistory = pgTable(
  'device_firmware_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    fromVersionId: uuid('from_version_id').references(() => firmwareVersions.id),
    toVersionId: uuid('to_version_id')
      .notNull()
      .references(() => firmwareVersions.id),
    isRollback: boolean('is_rollback').notNull().default(false),
    succeeded: boolean('succeeded').notNull().default(true),
    errorMessage: text('error_message'),
    performedBy: uuid('performed_by').references(() => users.id),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
    ...demoFlag,
  },
  (t) => [index('device_fw_history_device_idx').on(t.deviceId)],
);

export const devicesRelations = relations(devices, ({ one, many }) => ({
  club: one(clubs, { fields: [devices.currentClubId], references: [clubs.id] }),
  station: one(stations, { fields: [devices.currentStationId], references: [stations.id] }),
  firmware: one(firmwareVersions, {
    fields: [devices.firmwareVersionId],
    references: [firmwareVersions.id],
  }),
  assignments: many(deviceAssignments),
  telemetry: many(deviceTelemetry),
}));

export const deviceAssignmentsRelations = relations(deviceAssignments, ({ one }) => ({
  device: one(devices, { fields: [deviceAssignments.deviceId], references: [devices.id] }),
  station: one(stations, { fields: [deviceAssignments.stationId], references: [stations.id] }),
  club: one(clubs, { fields: [deviceAssignments.clubId], references: [clubs.id] }),
}));
