import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../../src/db/database-url.js";
import { createInitialReviewState, runReviewScenario } from "../../src/review/mvp1-review-scenarios.js";
import { createPostgresReviewPersistence } from "../../src/review/mvp1-review-persistence.js";

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
    const persistence = createPostgresReviewPersistence(db);
    let state = await persistence.initialize(createInitialReviewState());

    state = runReviewScenario(state, "local-signup").state;
    state = await persistence.persist(state);

    const { rows: userRows } = await client.query(
      "select login_id from local_credential where user_uuid = $1",
      [state.users[0]!.userUuid]
    );
    const { rows: auditRows } = await client.query(
      "select audit_event_type_cd from audit_log where actor_user_uuid = $1",
      [state.users[0]!.userUuid]
    );

    expect(userRows).toEqual([{ login_id: state.users[0]!.loginId }]);
    expect(auditRows).toEqual([{ audit_event_type_cd: "LOCAL_USER_CREATED" }]);
    expect(state.database).toMatchObject({
      mode: "database",
      connected: true
    });
    expect(state.database!.userRows).toBeGreaterThanOrEqual(1);
    expect(state.database!.auditLogRows).toBeGreaterThanOrEqual(1);
  });
});
