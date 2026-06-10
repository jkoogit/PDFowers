import {
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const metaColumns = {
  createdSys: varchar("created_sys", { length: 50 }).notNull().default("pdfowers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 100 }).notNull().default("system"),
  updatedSys: varchar("updated_sys", { length: 50 }).notNull().default("pdfowers"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 100 }).notNull().default("system"),
  version: integer("version").notNull().default(1)
};

export const commonCode = pgTable(
  "common_code",
  {
    codeGroupCd: varchar("code_group_cd", { length: 100 }).notNull(),
    codeCd: varchar("code_cd", { length: 100 }).notNull(),
    codeLabel: varchar("code_label", { length: 100 }).notNull(),
    codeDescription: text("code_description"),
    sortOrder: integer("sort_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...metaColumns
  },
  (table) => [primaryKey({ columns: [table.codeGroupCd, table.codeCd] })]
);

export const userAccount = pgTable("user_account", {
  userUuid: uuid("user_uuid").primaryKey(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  primaryEmail: varchar("primary_email", { length: 320 }).notNull(),
  userStatusCd: varchar("user_status_cd", { length: 50 }).notNull(),
  mergedIntoUserUuid: uuid("merged_into_user_uuid"),
  ...metaColumns
});

export const localCredential = pgTable(
  "local_credential",
  {
    userUuid: uuid("user_uuid")
      .primaryKey()
      .references(() => userAccount.userUuid),
    loginId: varchar("login_id", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordHashAlgCd: varchar("password_hash_alg_cd", { length: 50 }).notNull(),
    ...metaColumns
  },
  (table) => [uniqueIndex("local_credential_login_id_uidx").on(table.loginId)]
);

export const verifiedEmail = pgTable(
  "verified_email",
  {
    verifiedEmailUuid: uuid("verified_email_uuid").primaryKey().defaultRandom(),
    userUuid: uuid("user_uuid")
      .notNull()
      .references(() => userAccount.userUuid),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    emailNotificationOptIn: boolean("email_notification_opt_in").notNull().default(false),
    ...metaColumns
  },
  (table) => [uniqueIndex("verified_email_email_uidx").on(table.email)]
);

export const authIdentity = pgTable(
  "auth_identity",
  {
    authIdentityUuid: uuid("auth_identity_uuid").primaryKey().defaultRandom(),
    userUuid: uuid("user_uuid")
      .notNull()
      .references(() => userAccount.userUuid),
    providerCd: varchar("provider_cd", { length: 50 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    emailFromProvider: varchar("email_from_provider", { length: 320 }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...metaColumns
  },
  (table) => [
    uniqueIndex("auth_identity_provider_user_uidx").on(table.providerCd, table.providerUserId)
  ]
);

export const accountMergeRequest = pgTable("account_merge_request", {
  mergeRequestUuid: uuid("merge_request_uuid").primaryKey(),
  requestUserUuid: uuid("request_user_uuid")
    .notNull()
    .references(() => userAccount.userUuid),
  targetUserUuid: uuid("target_user_uuid")
    .notNull()
    .references(() => userAccount.userUuid),
  providerCd: varchar("provider_cd", { length: 50 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  mergeStatusCd: varchar("merge_status_cd", { length: 50 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...metaColumns
});

export const auditLog = pgTable("audit_log", {
  auditLogUuid: uuid("audit_log_uuid").primaryKey().defaultRandom(),
  actorUserUuid: uuid("actor_user_uuid"),
  auditEventTypeCd: varchar("audit_event_type_cd", { length: 100 }).notNull(),
  targetTypeCd: varchar("target_type_cd", { length: 50 }),
  targetUuid: uuid("target_uuid"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const job = pgTable("job", {
  jobUuid: uuid("job_uuid").primaryKey().defaultRandom(),
  jobTypeCd: varchar("job_type_cd", { length: 100 }).notNull(),
  jobStatusCd: varchar("job_status_cd", { length: 50 }).notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedReason: text("failed_reason"),
  ...metaColumns
});
