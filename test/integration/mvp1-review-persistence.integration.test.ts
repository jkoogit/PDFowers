import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../../src/db/database-url.js";
import { createInitialReviewState, type ReviewState } from "../../src/review/mvp1-review-scenarios.js";
import { createPostgresReviewPersistence } from "../../src/review/mvp1-review-persistence.js";
import { createReviewRequestHandler } from "../../src/review/mvp1-review-server.js";
import type { KakaoOAuthClient } from "../../src/review/kakao-oauth.js";

const rawConnectionString = process.env.DATABASE_URL;
const connectionString = rawConnectionString ? normalizePostgresUrl(rawConnectionString) : undefined;
const describeDb = connectionString ? describe : describe.skip;

describeDb("MVP1 검수 persistence PostgreSQL 통합 테스트", () => {
  let pool: Pool;
  let client: PoolClient;
  let db: NodePgDatabase;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
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

  test("검수 회원가입 시나리오 결과를 실제 user_account와 audit_log에 저장한다", async () => {
    const handler = createReviewRequestHandler(createInitialReviewState(), {
      persistence: createPostgresReviewPersistence(db)
    });
    const loginId = `local-it-${randomUUID()}`;
    const signup = await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId,
          email: `${loginId}@example.test`,
          password: "correct-password",
          displayName: "Local Integration User",
          emailVerified: true
        })
      })
    );
    const signupBody = (await signup.json()) as {
      user: { userUuid: string; loginId: string };
      state: ReviewState;
    };

    const { rows: userRows } = await client.query(
      "select login_id from local_credential where user_uuid = $1",
      [signupBody.user.userUuid]
    );
    const { rows: auditRows } = await client.query(
      "select audit_event_type_cd from audit_log where actor_user_uuid = $1",
      [signupBody.user.userUuid]
    );

    expect(signup.status).toBe(200);
    expect(userRows).toEqual([{ login_id: signupBody.user.loginId }]);
    expect(auditRows).toEqual([{ audit_event_type_cd: "LOCAL_USER_CREATED" }]);
    expect(signupBody.state.database).toMatchObject({
      mode: "database",
      connected: true
    });
    expect(signupBody.state.database!.userRows).toBeGreaterThanOrEqual(1);
    expect(signupBody.state.database!.auditLogRows).toBeGreaterThanOrEqual(1);
  });

  test("실제형 인증 API 흐름이 PostgreSQL user, identity, merge request에 반영된다", async () => {
    const handler = createReviewRequestHandler(createInitialReviewState(), {
      persistence: createPostgresReviewPersistence(db)
    });
    const seed = randomUUID();
    const requesterLoginId = `api-it-${seed}-requester`;
    const targetLoginId = `api-it-${seed}-target`;
    const providerUserId = `api-it-${seed}-google`;

    const signup = await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: requesterLoginId,
          email: `${requesterLoginId}@example.test`,
          password: "correct-password",
          displayName: "API Integration Requester",
          emailVerified: true
        })
      })
    );
    const requesterCookie = signup.headers.get("set-cookie") ?? "";

    await handler(
      new Request("http://localhost/auth/oauth/google/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerUserId,
          loginId: targetLoginId,
          emailFromProvider: `${targetLoginId}@example.test`,
          password: "correct-password",
          displayName: "API Integration Target"
        })
      })
    );

    const conflict = await handler(
      new Request("http://localhost/auth/identities/google", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: requesterCookie },
        body: JSON.stringify({ providerUserId })
      })
    );
    const conflictBody = (await conflict.json()) as {
      mergeRequest: { mergeRequestUuid: string };
    };

    const approve = await handler(
      new Request(`http://localhost/auth/merge-requests/${conflictBody.mergeRequest.mergeRequestUuid}/approve`, {
        method: "POST",
        headers: { cookie: requesterCookie }
      })
    );

    const { rows: identityRows } = await client.query(
      `select lc.login_id
         from auth_identity ai
         join local_credential lc on lc.user_uuid = ai.user_uuid
        where ai.provider_cd = 'google'
          and ai.provider_user_id = $1`,
      [providerUserId]
    );
    const { rows: mergeRows } = await client.query(
      "select merge_status_cd from account_merge_request where merge_request_uuid = $1",
      [conflictBody.mergeRequest.mergeRequestUuid]
    );
    const { rows: targetRows } = await client.query(
      "select ua.user_status_cd from user_account ua join local_credential lc on lc.user_uuid = ua.user_uuid where lc.login_id = $1",
      [targetLoginId]
    );

    expect(conflict.status).toBe(409);
    expect(approve.status).toBe(200);
    expect(identityRows).toEqual([{ login_id: requesterLoginId }]);
    expect(mergeRows).toEqual([{ merge_status_cd: "approved" }]);
    expect(targetRows).toEqual([{ user_status_cd: "merged" }]);
  });

  test("PostgreSQL에 저장된 Kakao identity를 새 핸들러가 재로그인에 사용한다", async () => {
    const providerUserId = `it-kakao-${randomUUID()}`;
    const kakaoOAuth = createFakeKakaoOAuthClient(providerUserId);

    const firstHandler = createReviewRequestHandler(createInitialReviewState(), {
      persistence: createPostgresReviewPersistence(db),
      kakaoConfig: {
        restApiKey: "test-rest-api-key",
        redirectUri: "http://localhost:4173/auth/kakao/callback"
      },
      kakaoOAuth
    });

    const firstLogin = await performKakaoLogin(firstHandler);
    expect(firstLogin.status).toBe(200);

    const secondHandler = createReviewRequestHandler(createInitialReviewState(), {
      persistence: createPostgresReviewPersistence(db),
      kakaoConfig: {
        restApiKey: "test-rest-api-key",
        redirectUri: "http://localhost:4173/auth/kakao/callback"
      },
      kakaoOAuth
    });

    const secondLogin = await performKakaoLogin(secondHandler);
    const secondBody = (await secondLogin.json()) as {
      ok: boolean;
      state: { users: Array<{ loginId: string }> };
    };

    const { rows: credentialRows } = await client.query(
      "select login_id from local_credential where login_id = $1",
      [`kakao-${providerUserId}`]
    );
    const { rows: identityRows } = await client.query(
      "select provider_user_id from auth_identity where provider_cd = 'kakao' and provider_user_id = $1",
      [providerUserId]
    );

    expect(secondLogin.status).toBe(200);
    expect(secondBody.ok).toBe(true);
    expect(secondBody.state.users.filter((user) => user.loginId === `kakao-${providerUserId}`)).toHaveLength(1);
    expect(credentialRows).toEqual([{ login_id: `kakao-${providerUserId}` }]);
    expect(identityRows).toEqual([{ provider_user_id: providerUserId }]);
  });
});

function createFakeKakaoOAuthClient(providerUserId: string): KakaoOAuthClient {
  return {
    buildAuthorizeUrl: (state) => new URL(`https://kauth.kakao.test/oauth/authorize?state=${state}`),
    exchangeCode: async () => ({ accessToken: "fake-access-token" }),
    fetchUserProfile: async () => ({
      provider: "kakao",
      providerUserId,
      displayName: `Kakao ${providerUserId}`
    })
  };
}

async function performKakaoLogin(handler: (request: Request) => Promise<Response>) {
  const start = await handler(new Request("http://localhost:4173/auth/kakao/start"));
  const cookie = start.headers.get("set-cookie") ?? "";
  const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");

  return handler(
    new Request(`http://localhost:4173/auth/kakao/callback?code=fake-code&state=${state}`, {
      headers: { cookie }
    })
  );
}
