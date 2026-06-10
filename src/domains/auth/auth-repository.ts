import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  accountMergeRequest,
  auditLog,
  authIdentity,
  localCredential,
  userAccount,
  verifiedEmail
} from "../../db/schema/auth.js";
import type { AccountMergeRequest, AuthUser } from "./auth-domain.js";

type AuthDatabase = NodePgDatabase<Record<string, never>>;

export async function ensureAuthSchema(db: AuthDatabase) {
  await db.execute(sql`
    create table if not exists user_account (
      user_uuid uuid primary key,
      display_name varchar(100) not null,
      primary_email varchar(320) not null,
      user_status_cd varchar(50) not null,
      merged_into_user_uuid uuid,
      created_sys varchar(50) not null default 'pdfowers',
      created_at timestamptz not null default now(),
      created_by varchar(100) not null default 'system',
      updated_sys varchar(50) not null default 'pdfowers',
      updated_at timestamptz not null default now(),
      updated_by varchar(100) not null default 'system',
      version integer not null default 1
    )
  `);
  await db.execute(sql`
    create table if not exists local_credential (
      user_uuid uuid primary key references user_account(user_uuid),
      login_id varchar(100) not null unique,
      password_hash text not null,
      password_hash_alg_cd varchar(50) not null,
      created_sys varchar(50) not null default 'pdfowers',
      created_at timestamptz not null default now(),
      created_by varchar(100) not null default 'system',
      updated_sys varchar(50) not null default 'pdfowers',
      updated_at timestamptz not null default now(),
      updated_by varchar(100) not null default 'system',
      version integer not null default 1
    )
  `);
  await db.execute(sql`
    create table if not exists verified_email (
      verified_email_uuid uuid primary key default gen_random_uuid(),
      user_uuid uuid not null references user_account(user_uuid),
      email varchar(320) not null unique,
      email_verified_at timestamptz,
      email_notification_opt_in boolean not null default false,
      created_sys varchar(50) not null default 'pdfowers',
      created_at timestamptz not null default now(),
      created_by varchar(100) not null default 'system',
      updated_sys varchar(50) not null default 'pdfowers',
      updated_at timestamptz not null default now(),
      updated_by varchar(100) not null default 'system',
      version integer not null default 1
    )
  `);
  await db.execute(sql`
    create table if not exists auth_identity (
      auth_identity_uuid uuid primary key default gen_random_uuid(),
      user_uuid uuid not null references user_account(user_uuid),
      provider_cd varchar(50) not null,
      provider_user_id varchar(255) not null,
      email_from_provider varchar(320),
      connected_at timestamptz not null,
      last_login_at timestamptz,
      created_sys varchar(50) not null default 'pdfowers',
      created_at timestamptz not null default now(),
      created_by varchar(100) not null default 'system',
      updated_sys varchar(50) not null default 'pdfowers',
      updated_at timestamptz not null default now(),
      updated_by varchar(100) not null default 'system',
      version integer not null default 1,
      unique(provider_cd, provider_user_id)
    )
  `);
  await db.execute(sql`
    create table if not exists account_merge_request (
      merge_request_uuid uuid primary key,
      request_user_uuid uuid not null references user_account(user_uuid),
      target_user_uuid uuid not null references user_account(user_uuid),
      provider_cd varchar(50) not null,
      provider_user_id varchar(255) not null,
      merge_status_cd varchar(50) not null,
      expires_at timestamptz not null,
      approved_at timestamptz,
      cancelled_at timestamptz,
      created_sys varchar(50) not null default 'pdfowers',
      created_at timestamptz not null default now(),
      created_by varchar(100) not null default 'system',
      updated_sys varchar(50) not null default 'pdfowers',
      updated_at timestamptz not null default now(),
      updated_by varchar(100) not null default 'system',
      version integer not null default 1
    )
  `);
  await db.execute(sql`
    create table if not exists audit_log (
      audit_log_uuid uuid primary key default gen_random_uuid(),
      actor_user_uuid uuid,
      audit_event_type_cd varchar(100) not null,
      target_type_cd varchar(50),
      target_uuid uuid,
      metadata_json jsonb,
      created_at timestamptz not null default now()
    )
  `);
}

export async function insertAuthUser(db: AuthDatabase, user: AuthUser) {
  await db.insert(userAccount).values({
    userUuid: user.userUuid,
    displayName: user.displayName,
    primaryEmail: user.primaryEmail,
    userStatusCd: user.status,
    mergedIntoUserUuid: user.mergedIntoUserUuid
  });
  await db.insert(localCredential).values({
    userUuid: user.userUuid,
    loginId: user.loginId,
    passwordHash: user.passwordHash,
    passwordHashAlgCd: user.passwordHash.split(":")[0] ?? "unknown"
  });

  if (user.verifiedEmails.length > 0) {
    await db.insert(verifiedEmail).values(
      user.verifiedEmails.map((email) => ({
        userUuid: user.userUuid,
        email: email.email,
        emailVerifiedAt: email.emailVerifiedAt,
        emailNotificationOptIn: email.emailNotificationOptIn
      }))
    );
  }

  if (user.identities.length > 0) {
    await db.insert(authIdentity).values(
      user.identities.map((identity) => ({
        userUuid: user.userUuid,
        providerCd: identity.provider,
        providerUserId: identity.providerUserId,
        emailFromProvider: identity.emailFromProvider,
        connectedAt: identity.connectedAt,
        lastLoginAt: identity.lastLoginAt
      }))
    );
  }

  if (user.auditLogs.length > 0) {
    await db.insert(auditLog).values(
      user.auditLogs.map((log) => ({
        actorUserUuid: log.actorUserUuid ?? user.userUuid,
        auditEventTypeCd: log.eventType,
        targetTypeCd: log.targetUserUuid ? "user_account" : undefined,
        targetUuid: log.targetUserUuid,
        metadataJson: log.metadata
      }))
    );
  }
}

export async function listAuthIdentities(db: AuthDatabase, userUuid: string) {
  return db.select().from(authIdentity).where(eq(authIdentity.userUuid, userUuid));
}

export async function recordAccountMergeRequest(
  db: AuthDatabase,
  mergeRequest: AccountMergeRequest
) {
  await db.insert(accountMergeRequest).values({
    mergeRequestUuid: mergeRequest.mergeRequestUuid,
    requestUserUuid: mergeRequest.requestUserUuid,
    targetUserUuid: mergeRequest.targetUserUuid,
    providerCd: mergeRequest.provider,
    providerUserId: mergeRequest.providerUserId,
    mergeStatusCd: mergeRequest.status,
    expiresAt: mergeRequest.expiresAt,
    approvedAt: mergeRequest.approvedAt,
    cancelledAt: mergeRequest.cancelledAt
  });
}
