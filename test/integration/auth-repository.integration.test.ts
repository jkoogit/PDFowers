import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../../src/db/database-url.js";
import { createLocalUser, linkOAuthIdentity } from "../../src/domains/auth/auth-domain.js";
import {
  ensureAuthSchema,
  insertAuthUser,
  listAuthIdentities,
  recordAccountMergeRequest
} from "../../src/domains/auth/auth-repository.js";

const rawConnectionString = process.env.DATABASE_URL;
const connectionString = rawConnectionString ? normalizePostgresUrl(rawConnectionString) : undefined;
const describeDb = connectionString ? describe : describe.skip;

function localUser(seed: string) {
  return createLocalUser({
    loginId: `it-${seed}`,
    email: `it-${seed}@example.test`,
    password: "correct-password",
    displayName: `Integration ${seed}`,
    emailVerifiedAt: new Date("2026-06-10T00:00:00.000Z")
  });
}

describeDb("인증 저장소 PostgreSQL 통합 테스트", () => {
  let pool: Pool;
  let client: PoolClient;
  let db: NodePgDatabase;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await ensureAuthSchema(drizzle(pool));
  });

  beforeEach(async () => {
    client = await pool.connect();
    await client.query("begin");
    db = drizzle(client);
  });

  afterEach(async () => {
    await client.query("rollback");
    client.release();
  });

  afterAll(async () => {
    await pool.end();
  });

  test("AuthUser와 AuthIdentity를 실제 PostgreSQL 테이블에 저장하고 다시 조회한다", async () => {
    const seed = randomUUID();
    const user = localUser(seed);
    linkOAuthIdentity({
      currentUser: user,
      allUsers: [user],
      provider: "kakao",
      providerUserId: `kakao-${seed}`,
      emailFromProvider: `kakao-${seed}@example.test`
    });

    await insertAuthUser(db, user);

    const identities = await listAuthIdentities(db, user.userUuid);

    expect(identities).toEqual([
      expect.objectContaining({
        userUuid: user.userUuid,
        providerCd: "kakao",
        providerUserId: `kakao-${seed}`,
        emailFromProvider: `kakao-${seed}@example.test`
      })
    ]);
  });

  test("계정 통합 요청은 request/target User FK와 provider unique 후보 값을 함께 저장한다", async () => {
    const seed = randomUUID();
    const requester = localUser(`${seed}-requester`);
    const target = localUser(`${seed}-target`);
    linkOAuthIdentity({
      currentUser: target,
      allUsers: [requester, target],
      provider: "google",
      providerUserId: `google-${seed}`
    });
    const mergeResult = linkOAuthIdentity({
      currentUser: requester,
      allUsers: [requester, target],
      provider: "google",
      providerUserId: `google-${seed}`
    });

    await insertAuthUser(db, requester);
    await insertAuthUser(db, target);
    await recordAccountMergeRequest(db, mergeResult.mergeRequest!);

    const { rows } = await client.query(
      `select request_user_uuid, target_user_uuid, provider_cd, provider_user_id, merge_status_cd
         from account_merge_request
        where merge_request_uuid = $1`,
      [mergeResult.mergeRequest!.mergeRequestUuid]
    );

    expect(rows).toEqual([
      {
        request_user_uuid: requester.userUuid,
        target_user_uuid: target.userUuid,
        provider_cd: "google",
        provider_user_id: `google-${seed}`,
        merge_status_cd: "pending"
      }
    ]);
  });

  test("공통코드 초기데이터가 migration으로 등록되어 있다", async () => {
    const { rows: summaryRows } = await client.query(
      `select count(*)::int as total, count(distinct code_group_cd)::int as groups
         from common_code`
    );
    const { rows: providerRows } = await client.query(
      `select code_cd, code_label
         from common_code
        where code_group_cd = 'AUTH_PROVIDER'
        order by sort_order`
    );

    expect(summaryRows).toEqual([{ total: 27, groups: 5 }]);
    expect(providerRows).toEqual([
      { code_cd: "kakao", code_label: "카카오" },
      { code_cd: "naver", code_label: "네이버" },
      { code_cd: "google", code_label: "구글" }
    ]);
  });
});
