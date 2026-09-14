/**
 * @file agent-drizzle-repository.integration.test.ts
 * @description 에이전트 서비스 Drizzle PostgreSQL 저장소 어댑터 통합 테스트
 */

import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../../../src/db/database-url.js";
import { DrizzleAgentRepository } from "../../../src/agent/adapters/out/persistence/drizzle-agent-repository.js";
import { SessionEntity, TaskEntity, LoopEntity } from "../../../src/agent/domain/model.js";

const rawConnectionString = process.env.DATABASE_URL;
const connectionString = rawConnectionString ? normalizePostgresUrl(rawConnectionString) : undefined;
const describeDb = connectionString ? describe : describe.skip;

describeDb("Agent Drizzle Repository PostgreSQL 통합 테스트", () => {
  let pool: Pool;
  let client: PoolClient;
  let db: NodePgDatabase;
  let repository: DrizzleAgentRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
  });

  beforeEach(async () => {
    client = await pool.connect();
    await client.query("begin");
    db = drizzle(client);
    repository = new DrizzleAgentRepository(db);
  });

  afterEach(async () => {
    await client.query("rollback");
    client.release();
  });

  afterAll(async () => {
    await pool.end();
  });

  test("세션, 태스크, 루프 엔티티를 DB에 영속화하고 계층 구조로 조회할 수 있어야 한다", async () => {
    const seed = randomUUID().slice(0, 8);
    const sessionId = `SES-IT-${seed}`;
    const taskId = `TSK-IT-${seed}`;
    const loopId = `LP-IT-${seed}`;

    // 1. 세션 저장
    const session = new SessionEntity(
      sessionId,
      `통합테스트 세션 ${seed}`,
      ["통합테스트"],
      new Date(),
      { agent: "gemini", model: "gemini-3.7-flash", version: "1.0", agentStatus: "ACTIVE" }
    );
    await repository.saveSession(session);

    // 세션 조회 검증
    const loadedSession = await repository.findSessionById(sessionId);
    expect(loadedSession).toBeDefined();
    expect(loadedSession?.sessionId).toBe(sessionId);
    expect(loadedSession?.sessionName).toBe(`통합테스트 세션 ${seed}`);

    // 2. 태스크 저장
    const task = new TaskEntity(taskId, sessionId, "DB 연동 검증", new Date(), "task/test_gemini", "시작");
    await repository.saveTask(task);

    const loadedTask = await repository.findTaskById(taskId);
    expect(loadedTask).toBeDefined();
    expect(loadedTask?.taskId).toBe(taskId);
    expect(loadedTask?.sessionId).toBe(sessionId);

    // 3. 루프 저장
    const loop = new LoopEntity(
      loopId,
      taskId,
      sessionId,
      "TDD 루프",
      new Date(),
      {
        objective: "통합테스트",
        scope: "test/agent/integration/",
        allowPaths: ["test/agent/integration/"],
        completionCriteria: ["통과"],
        verifyCommand: "npm test"
      },
      "분석"
    );
    await repository.saveLoop(loop);

    const loadedLoop = await repository.findLoopById(loopId);
    expect(loadedLoop).toBeDefined();
    expect(loadedLoop?.loopId).toBe(loopId);
    expect(loadedLoop?.taskId).toBe(taskId);

    // 4. 세션 기반 태스크 및 루프 목록 조회 검증
    const tasks = await repository.findTasksBySessionId(sessionId);
    expect(tasks.length).toBe(1);
    expect(tasks[0].taskId).toBe(taskId);

    const loops = await repository.findLoopsByTaskId(taskId);
    expect(loops.length).toBe(1);
    expect(loops[0].loopId).toBe(loopId);
  });

  test("대화 턴 감사 로그가 정상적으로 DB에 기록되고 세션별로 조회되어야 한다", async () => {
    const seed = randomUUID().slice(0, 8);
    const sessionId = `SES-TRACE-${seed}`;
    const taskId = `TSK-TRACE-${seed}`;

    // 세션 및 태스크 사전 저장
    const session = new SessionEntity(sessionId, "로그 세션", ["감사"], new Date(), { agent: "gemini", model: "flash", version: "1", agentStatus: "ACTIVE" });
    const task = new TaskEntity(taskId, sessionId, "로그 태스크", new Date(), "branch", "시작");
    await repository.saveSession(session);
    await repository.saveTask(task);

    // 대화 감사 로그 기록
    await repository.saveConversationTrace({
      traceId: `TR-${seed}`,
      sessionId,
      taskId,
      stepIndex: 1,
      agentName: "gemini",
      modelName: "gemini-3.7-flash",
      userPrompt: "테스트 패키지 위치 어때?",
      agentResponse: "동위 배치가 적절합니다.",
      toolCalls: [],
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      createdAt: new Date()
    });

    const traces = await repository.findTracesBySessionId(sessionId);
    expect(traces.length).toBe(1);
    expect(traces[0].userPrompt).toBe("테스트 패키지 위치 어때?");
    expect(traces[0].totalTokens).toBe(150);
  });
});
