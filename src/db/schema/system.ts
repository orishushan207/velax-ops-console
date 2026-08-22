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
import { demoFlag, softDelete, timestamps } from './_shared';
import {
  auditActionEnum,
  notificationChannelEnum,
  notificationSeverityEnum,
  notificationStatusEnum,
  scenarioEnum,
  settingConfidenceEnum,
  settingValueTypeEnum,
} from './enums';
import { users } from './identity';
import { clubs } from './network';

/**
 * business_settings — לב המערכת.
 *
 * כל הנחה עסקית יושבת כאן ולא בקוד. סעיף 1.5 בהנחיות:
 * "במקרה של סתירה בין מסמכים, אל תקבע ערך קשיח."
 *
 * הערך הנוכחי הוא זה שב־setting_versions עם effective_from האחרון שכבר חל.
 * כך שינוי מחיר ב־1 בספטמבר לא משנה את חישוב אוגוסט.
 */
export const businessSettings = pgTable(
  'business_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 120 }).notNull(),
    nameHe: varchar('name_he', { length: 250 }).notNull(),
    category: varchar('category', { length: 60 }).notNull(),
    description: text('description'),
    valueType: settingValueTypeEnum('value_type').notNull(),
    unit: varchar('unit', { length: 40 }),
    /** רמת האמון בהנחה — ראה OPS_CONSOLE_ANALYSIS.md סעיף 5 */
    confidence: settingConfidenceEnum('confidence').notNull().default('assumed'),
    /** מאיפה הערך הגיע: "PDF פרק 8.5" / "XLSX הנחות!B36" */
    sourceReference: text('source_reference'),
    /** כשקיימת סתירה — הערך החלופי ומקורו, לתצוגה במסך ההגדרות */
    conflictingValue: text('conflicting_value'),
    conflictingSource: text('conflicting_source'),
    /** ההגדרה תלוית תרחיש (תוכנית / ריאלי / שמרני) */
    isScenarioScoped: boolean('is_scenario_scoped').notNull().default(false),
    /** ניתן לדריסה ברמת מועדון */
    allowsClubOverride: boolean('allows_club_override').notNull().default(false),
    minValue: varchar('min_value', { length: 60 }),
    maxValue: varchar('max_value', { length: 60 }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('business_settings_key_key').on(t.key),
    index('business_settings_category_idx').on(t.category),
  ],
);

/**
 * setting_versions — היסטוריית שינויים עם תאריך תחולה.
 * שורה אחת = ערך אחד, לתרחיש אחד, למועדון אחד (או גלובלי), מתאריך מסוים.
 */
export const settingVersions = pgTable(
  'setting_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settingId: uuid('setting_id')
      .notNull()
      .references(() => businessSettings.id, { onDelete: 'cascade' }),
    /** null = חל על כל התרחישים */
    scenario: scenarioEnum('scenario'),
    /** null = ערך גלובלי; אחרת דריסה למועדון מסוים */
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    changedBy: uuid('changed_by').references(() => users.id),
    changeReason: text('change_reason'),
    previousValue: text('previous_value'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('setting_versions_setting_idx').on(t.settingId),
    index('setting_versions_effective_idx').on(t.settingId, t.effectiveFrom),
    index('setting_versions_club_idx').on(t.clubId),
  ],
);

/**
 * metric_definitions — Metric Dictionary מרכזי (סעיף 27 בהנחיות).
 * מטרתו למנוע מצב שבו שני מסכים מציגים "Uptime" ומתכוונים לשני דברים שונים.
 */
export const metricDefinitions = pgTable(
  'metric_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 80 }).notNull(),
    nameHe: varchar('name_he', { length: 200 }).notNull(),
    definition: text('definition').notNull(),
    formula: text('formula').notNull(),
    dataSource: text('data_source').notNull(),
    /** בעל המדד — מי אחראי להגדרה */
    ownerRole: varchar('owner_role', { length: 80 }).notNull(),
    /** realtime | hourly | daily | monthly */
    updateFrequency: varchar('update_frequency', { length: 24 }).notNull(),
    version: integer('version').notNull().default(1),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    unit: varchar('unit', { length: 40 }),
    /** הסבר קצר שמופיע ב־Tooltip ליד ה־KPI */
    tooltipHe: text('tooltip_he'),
    /** אזהרות שימוש — למשל "אל תציג כהוכחת שיפור מקצועי" */
    cautionHe: text('caution_he'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [uniqueIndex('metric_definitions_key_key').on(t.key, t.version)],
);

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 80 }).notNull(),
    nameHe: varchar('name_he', { length: 250 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    severity: notificationSeverityEnum('severity').notNull().default('warning'),
    /** תנאי ההפעלה: {"metric":"device_offline_minutes","operator":">","value":10} */
    condition: jsonb('condition').$type<Record<string, unknown>>().notNull().default({}),
    /** פעולות: [{"type":"notify","channels":["in_app"]},{"type":"create_ticket"}] */
    actions: jsonb('actions').$type<Record<string, unknown>[]>().notNull().default([]),
    channels: jsonb('channels').$type<string[]>().notNull().default(['in_app']),
    /** לא לשלוח שוב תוך X דקות על אותה ישות */
    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
    targetRoleKeys: jsonb('target_role_keys').$type<string[]>().notNull().default([]),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    triggerCount: integer('trigger_count').notNull().default(0),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('automation_rules_key_key').on(t.key),
    index('automation_rules_active_idx').on(t.isActive),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
    severity: notificationSeverityEnum('severity').notNull().default('info'),
    title: varchar('title', { length: 250 }).notNull(),
    body: text('body'),
    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    status: notificationStatusEnum('status').notNull().default('pending'),
    /** נמען: משתמש ספציפי או null לכל בעלי התפקיד */
    recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),
    recipientRoleKey: varchar('recipient_role_key', { length: 64 }),
    /** קישור לישות: club / station / device / session / ticket / earn_back */
    entityType: varchar('entity_type', { length: 40 }),
    entityId: uuid('entity_id'),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    actionUrl: text('action_url'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    /** תוצאת שליחה בערוץ החיצוני. mock = לא נשלח באמת. */
    deliveryProvider: varchar('delivery_provider', { length: 40 }).notNull().default('mock'),
    deliveryError: text('delivery_error'),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('notifications_recipient_idx').on(t.recipientUserId, t.status),
    index('notifications_role_idx').on(t.recipientRoleKey, t.status),
    index('notifications_entity_idx').on(t.entityType, t.entityId),
    index('notifications_created_idx').on(t.createdAt),
    index('notifications_severity_idx').on(t.severity),
  ],
);

/**
 * audit_logs — כל פעולה רגישה נרשמת כאן.
 * סעיף 25 בהנחיות: מי, מתי, מאיזה IP, איזו ישות, ערך קודם, ערך חדש, סיבה, מזהה בקשה.
 * הטבלה append-only: אין UPDATE ואין DELETE עליה.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: auditActionEnum('action').notNull(),
    /** תיאור מדויק של הפעולה: "refund.approve", "device.quarantine" */
    actionKey: varchar('action_key', { length: 96 }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 200 }),
    actorRoleKeys: jsonb('actor_role_keys').$type<string[]>().notNull().default([]),
    /** כאשר הפעולה בוצעה תוך התחזות */
    impersonatedByUserId: uuid('impersonated_by_user_id').references(() => users.id),

    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: uuid('entity_id'),
    entityLabel: varchar('entity_label', { length: 250 }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),

    beforeValue: jsonb('before_value').$type<Record<string, unknown>>(),
    afterValue: jsonb('after_value').$type<Record<string, unknown>>(),
    /** סיבה — חובה בכל פעולה רגישה */
    reason: text('reason'),

    /** סכום ומאשר — חובה בפעולות כספיות */
    amount: varchar('amount', { length: 32 }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),

    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    authSessionId: uuid('auth_session_id'),
    requestId: varchar('request_id', { length: 64 }),
    succeeded: boolean('succeeded').notNull().default(true),
    errorMessage: text('error_message'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...demoFlag,
  },
  (t) => [
    index('audit_logs_actor_idx').on(t.actorUserId, t.occurredAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_action_idx').on(t.actionKey),
    index('audit_logs_time_idx').on(t.occurredAt),
    index('audit_logs_club_idx').on(t.clubId),
    index('audit_logs_request_idx').on(t.requestId),
  ],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileName: varchar('file_name', { length: 250 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    /** local | s3 | supabase */
    storageProvider: varchar('storage_provider', { length: 24 }).notNull().default('local'),
    storagePath: text('storage_path').notNull(),
    checksum: varchar('checksum', { length: 128 }),
    entityType: varchar('entity_type', { length: 40 }),
    entityId: uuid('entity_id'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    /** מדיניות שמירה — מתי הקובץ נמחק אוטומטית */
    retainUntil: timestamp('retain_until', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    index('files_entity_idx').on(t.entityType, t.entityId),
    index('files_uploader_idx').on(t.uploadedBy),
  ],
);

/** תצוגות שמורות של טבלאות — מסננים, עמודות וסדר */
export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** המסך שאליו התצוגה שייכת: sessions | clubs | devices | tickets ... */
    scope: varchar('scope', { length: 60 }).notNull(),
    nameHe: varchar('name_he', { length: 160 }).notNull(),
    /** ה־query string שמייצג את מצב המסננים */
    queryState: text('query_state').notNull(),
    visibleColumns: jsonb('visible_columns').$type<string[]>().notNull().default([]),
    isDefault: boolean('is_default').notNull().default(false),
    isShared: boolean('is_shared').notNull().default(false),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('saved_views_user_scope_idx').on(t.userId, t.scope),
  ],
);

export const businessSettingsRelations = relations(businessSettings, ({ many }) => ({
  versions: many(settingVersions),
}));

export const settingVersionsRelations = relations(settingVersions, ({ one }) => ({
  setting: one(businessSettings, {
    fields: [settingVersions.settingId],
    references: [businessSettings.id],
  }),
  changedByUser: one(users, { fields: [settingVersions.changedBy], references: [users.id] }),
  club: one(clubs, { fields: [settingVersions.clubId], references: [clubs.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
  club: one(clubs, { fields: [auditLogs.clubId], references: [clubs.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  rule: one(automationRules, { fields: [notifications.ruleId], references: [automationRules.id] }),
  recipient: one(users, { fields: [notifications.recipientUserId], references: [users.id] }),
  club: one(clubs, { fields: [notifications.clubId], references: [clubs.id] }),
}));
