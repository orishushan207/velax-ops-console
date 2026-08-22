import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
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
  consentTypeEnum,
  dominantHandEnum,
  membershipTierEnum,
  playerLevelEnum,
  userStatusEnum,
} from './enums';

/**
 * users — חשבון יחיד לכל בן אדם במערכת.
 * אותו רשומה משמשת גם משתמש מערכת (staff), גם שחקן וגם מאמן,
 * כדי שמאמן שהוא גם שחקן לא יהיה שני חשבונות.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 32 }),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    passwordHash: text('password_hash'),
    status: userStatusEnum('status').notNull().default('active'),
    isStaff: boolean('is_staff').notNull().default(false),
    isPlayer: boolean('is_player').notNull().default(false),
    isCoach: boolean('is_coach').notNull().default(false),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecret: text('mfa_secret'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginCount: varchar('failed_login_count', { length: 8 }).notNull().default('0'),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    locale: varchar('locale', { length: 10 }).notNull().default('he-IL'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Jerusalem'),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('users_email_key').on(t.email),
    uniqueIndex('users_phone_key').on(t.phone),
    index('users_status_idx').on(t.status),
    index('users_name_idx').on(t.fullName),
  ],
);

/** מפגשי התחברות של משתמשי מערכת. עוגייה httpOnly מחזיקה רק את ה־token hash. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** התחזות מבוקרת: מי המנהל שמתחזה, ומה הסיבה. סעיף 18 בהנחיות. */
    impersonatedByUserId: uuid('impersonated_by_user_id').references(() => users.id),
    impersonationReason: text('impersonation_reason'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('auth_sessions_token_key').on(t.tokenHash),
    index('auth_sessions_user_idx').on(t.userId),
    index('auth_sessions_expiry_idx').on(t.expiresAt),
  ],
);

/** תפקידים. 12 תפקידים ראשוניים לפי סעיף 24 בהנחיות. */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    nameHe: varchar('name_he', { length: 100 }).notNull(),
    description: text('description'),
    /** תפקיד מערכת לא ניתן למחיקה או לשינוי מפתח */
    isSystem: boolean('is_system').notNull().default(false),
    /** האם התפקיד מוגבל למועדונים ספציפיים (Club Manager, Coach) */
    isClubScoped: boolean('is_club_scoped').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('roles_key_key').on(t.key)],
);

/** הרשאות ברמת פעולה בודדת, לא ברמת מסך. */
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 96 }).notNull(),
    nameHe: varchar('name_he', { length: 160 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    description: text('description'),
    /** פעולה רגישה — מחייבת סיבה + Audit Log מפורט */
    isSensitive: boolean('is_sensitive').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('permissions_key_key').on(t.key),
    index('permissions_category_idx').on(t.category),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('role_permissions_key').on(t.roleId, t.permissionId)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex('user_roles_key').on(t.userId, t.roleId), index('user_roles_user_idx').on(t.userId)],
);

/**
 * הגבלת משתמש למועדונים מסוימים.
 * Club Manager יראה רק את המועדונים שלו — סעיף 24 בהנחיות.
 * נאכף גם באפליקציה וגם ב־RLS.
 */
export const userClubScopes = pgTable(
  'user_club_scopes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('user_club_scopes_key').on(t.userId, t.clubId),
    index('user_club_scopes_club_idx').on(t.clubId),
  ],
);

/** פרופיל צוות VELA-X */
export const staffProfiles = pgTable(
  'staff_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobTitle: varchar('job_title', { length: 120 }),
    department: varchar('department', { length: 80 }),
    /** טכנאי שדה — משמש להקצאת קריאות שירות ומלאי */
    isFieldTechnician: boolean('is_field_technician').notNull().default(false),
    regions: jsonb('regions').$type<string[]>().notNull().default([]),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [uniqueIndex('staff_profiles_user_key').on(t.userId)],
);

/** פרופיל שחקן */
export const playerProfiles = pgTable(
  'player_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    level: playerLevelEnum('level').notNull().default('1'),
    /** תיקון ידני של רמה על ידי צוות — עם סיבה ב־Audit Log */
    levelOverriddenBy: uuid('level_overridden_by').references(() => users.id),
    dominantHand: dominantHandEnum('dominant_hand').notNull().default('unknown'),
    preferredClubId: uuid('preferred_club_id'),
    membershipTier: membershipTierEnum('membership_tier').notNull().default('X1'),
    birthYear: varchar('birth_year', { length: 4 }),
    /** קטין — דורש אישור הורה, ללא אימון בלתי מפוקח. PDF פרק 21. */
    isMinor: boolean('is_minor').notNull().default(false),
    guardianConsentAt: timestamp('guardian_consent_at', { withTimezone: true }),
    /** אינדיקטורי סיכון/הונאה — מחושבים על ידי כללי אוטומציה */
    riskFlags: jsonb('risk_flags').$type<string[]>().notNull().default([]),
    acquisitionChannel: varchar('acquisition_channel', { length: 64 }),
    utmSource: varchar('utm_source', { length: 120 }),
    utmCampaign: varchar('utm_campaign', { length: 120 }),
    referredByCoachId: uuid('referred_by_coach_id'),
    /** איחוד חשבונות כפולים: הרשומה הזו מוזגה לתוך רשומה אחרת */
    mergedIntoUserId: uuid('merged_into_user_id').references(() => users.id),
    ...timestamps,
    ...softDelete,
    ...demoFlag,
  },
  (t) => [
    uniqueIndex('player_profiles_user_key').on(t.userId),
    index('player_profiles_level_idx').on(t.level),
    index('player_profiles_club_idx').on(t.preferredClubId),
  ],
);

/** הסכמות מתועדות — סעיף 25 בהנחיות, ותיקון 13 לחוק הגנת הפרטיות */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consentType: consentTypeEnum('consent_type').notNull(),
    granted: boolean('granted').notNull(),
    version: varchar('version', { length: 32 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
    ...demoFlag,
  },
  (t) => [
    index('consents_user_idx').on(t.userId),
    index('consents_type_idx').on(t.consentType),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  roles: many(userRoles),
  clubScopes: many(userClubScopes),
  staffProfile: one(staffProfiles, { fields: [users.id], references: [staffProfiles.userId] }),
  playerProfile: one(playerProfiles, { fields: [users.id], references: [playerProfiles.userId] }),
  consents: many(consents),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const playerProfilesRelations = relations(playerProfiles, ({ one }) => ({
  user: one(users, { fields: [playerProfiles.userId], references: [users.id] }),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  user: one(users, { fields: [staffProfiles.userId], references: [users.id] }),
}));
