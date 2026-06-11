import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ensureAuthSchema } from "../domains/auth/auth-repository.js";
import type { AuditLog } from "../domains/auth/auth-domain.js";
import type { ReviewPersistence } from "./mvp1-review-server.js";
import type { ReviewState } from "./mvp1-review-scenarios.js";

type ReviewDatabase = NodePgDatabase<Record<string, never>>;

export function createPostgresReviewPersistence(db: ReviewDatabase): ReviewPersistence {
  const auditOffsets = new Map<string, number>();

  return {
    async initialize(state) {
      await ensureAuthSchema(db);
      return summarizeDatabase(db, state, { connected: true });
    },
    async persist(state) {
      await ensureAuthSchema(db);
      await persistUsers(db, state, auditOffsets);
      await persistMergeRequests(db, state);
      return summarizeDatabase(db, state, {
        connected: true,
        lastPersistedAt: new Date().toISOString()
      });
    },
    async summarize(state) {
      return summarizeDatabase(db, state, { connected: true });
    }
  };
}

export function createMemoryReviewPersistence(): ReviewPersistence {
  return {
    async initialize(state) {
      return {
        ...state,
        database: {
          mode: "memory",
          connected: false,
          userRows: 0,
          identityRows: 0,
          mergeRequestRows: 0,
          auditLogRows: 0
        }
      };
    },
    async persist(state) {
      return this.initialize(state);
    },
    async summarize(state) {
      return this.initialize(state);
    }
  };
}

async function persistUsers(
  db: ReviewDatabase,
  state: ReviewState,
  auditOffsets: Map<string, number>
) {
  for (const user of state.users) {
    await db.execute(sql`
      insert into user_account (
        user_uuid,
        display_name,
        primary_email,
        user_status_cd,
        merged_into_user_uuid
      )
      values (
        ${user.userUuid},
        ${user.displayName},
        ${user.primaryEmail},
        ${user.status},
        ${user.mergedIntoUserUuid ?? null}
      )
      on conflict (user_uuid) do update set
        display_name = excluded.display_name,
        primary_email = excluded.primary_email,
        user_status_cd = excluded.user_status_cd,
        merged_into_user_uuid = excluded.merged_into_user_uuid,
        updated_at = now(),
        version = user_account.version + 1
    `);

    await db.execute(sql`
      insert into local_credential (
        user_uuid,
        login_id,
        password_hash,
        password_hash_alg_cd
      )
      values (
        ${user.userUuid},
        ${user.loginId},
        ${user.passwordHash},
        ${user.passwordHash.split(":")[0] ?? "unknown"}
      )
      on conflict (user_uuid) do update set
        login_id = excluded.login_id,
        password_hash = excluded.password_hash,
        password_hash_alg_cd = excluded.password_hash_alg_cd,
        updated_at = now(),
        version = local_credential.version + 1
    `);

    for (const email of user.verifiedEmails) {
      await db.execute(sql`
        insert into verified_email (
          user_uuid,
          email,
          email_verified_at,
          email_notification_opt_in
        )
        values (
          ${user.userUuid},
          ${email.email},
          ${email.emailVerifiedAt},
          ${email.emailNotificationOptIn}
        )
        on conflict (email) do update set
          user_uuid = excluded.user_uuid,
          email_verified_at = excluded.email_verified_at,
          email_notification_opt_in = excluded.email_notification_opt_in,
          updated_at = now(),
          version = verified_email.version + 1
      `);
    }

    for (const identity of user.identities) {
      await db.execute(sql`
        insert into auth_identity (
          user_uuid,
          provider_cd,
          provider_user_id,
          email_from_provider,
          connected_at,
          last_login_at
        )
        values (
          ${user.userUuid},
          ${identity.provider},
          ${identity.providerUserId},
          ${identity.emailFromProvider ?? null},
          ${identity.connectedAt},
          ${identity.lastLoginAt ?? null}
        )
        on conflict (provider_cd, provider_user_id) do update set
          user_uuid = excluded.user_uuid,
          email_from_provider = excluded.email_from_provider,
          connected_at = excluded.connected_at,
          last_login_at = excluded.last_login_at,
          updated_at = now(),
          version = auth_identity.version + 1
      `);
    }

    await persistAuditLogs(db, user.userUuid, user.auditLogs, auditOffsets);
  }
}

async function persistAuditLogs(
  db: ReviewDatabase,
  userUuid: string,
  auditLogs: AuditLog[],
  auditOffsets: Map<string, number>
) {
  const offset = auditOffsets.get(userUuid) ?? 0;
  const pendingLogs = auditLogs.slice(offset);

  for (const log of pendingLogs) {
    await db.execute(sql`
      insert into audit_log (
        actor_user_uuid,
        audit_event_type_cd,
        target_type_cd,
        target_uuid,
        metadata_json
      )
      values (
        ${log.actorUserUuid ?? userUuid},
        ${log.eventType},
        ${log.targetUserUuid ? "user_account" : null},
        ${log.targetUserUuid ?? null},
        ${JSON.stringify(log.metadata ?? {})}::jsonb
      )
    `);
  }

  auditOffsets.set(userUuid, auditLogs.length);
}

async function persistMergeRequests(db: ReviewDatabase, state: ReviewState) {
  for (const mergeRequest of state.mergeRequests) {
    await db.execute(sql`
      insert into account_merge_request (
        merge_request_uuid,
        request_user_uuid,
        target_user_uuid,
        provider_cd,
        provider_user_id,
        merge_status_cd,
        expires_at,
        approved_at,
        cancelled_at
      )
      values (
        ${mergeRequest.mergeRequestUuid},
        ${mergeRequest.requestUserUuid},
        ${mergeRequest.targetUserUuid},
        ${mergeRequest.provider},
        ${mergeRequest.providerUserId},
        ${mergeRequest.status},
        ${mergeRequest.expiresAt},
        ${mergeRequest.approvedAt ?? null},
        ${mergeRequest.cancelledAt ?? null}
      )
      on conflict (merge_request_uuid) do update set
        merge_status_cd = excluded.merge_status_cd,
        approved_at = excluded.approved_at,
        cancelled_at = excluded.cancelled_at,
        updated_at = now(),
        version = account_merge_request.version + 1
    `);
  }
}

async function summarizeDatabase(
  db: ReviewDatabase,
  state: ReviewState,
  options: {
    connected: boolean;
    lastPersistedAt?: string;
  }
): Promise<ReviewState> {
  try {
    const userRows = await countRows("user_account");
    const identityRows = await countRows("auth_identity");
    const mergeRequestRows = await countRows("account_merge_request");
    const auditLogRows = await countRows("audit_log");

    return {
      ...state,
      database: {
        mode: "database",
        connected: options.connected,
        userRows,
        identityRows,
        mergeRequestRows,
        auditLogRows,
        lastPersistedAt: options.lastPersistedAt
      }
    };
  } catch (error) {
    return {
      ...state,
      database: {
        mode: "database",
        connected: false,
        userRows: 0,
        identityRows: 0,
        mergeRequestRows: 0,
        auditLogRows: 0,
        error: error instanceof Error ? error.message : "DB 상태 조회 실패"
      }
    };
  }

  async function countRows(tableName: string) {
    const result = await db.execute(sql.raw(`select count(*)::int as count from ${tableName}`));
    const rows = result as unknown as { rows?: Array<{ count: number }> };
    return rows.rows?.[0]?.count ?? 0;
  }
}
