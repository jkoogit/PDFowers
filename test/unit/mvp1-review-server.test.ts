import { describe, expect, test, vi } from "vitest";
import { createInitialReviewState } from "../../src/review/mvp1-review-scenarios.js";
import { createReviewRequestHandler, type ReviewPersistence } from "../../src/review/mvp1-review-server.js";

describe("MVP1 검수 서버", () => {
  test("상태 API는 초기 검수 상태를 JSON으로 반환한다", async () => {
    const handler = createReviewRequestHandler();
    const response = await handler(new Request("http://localhost/api/review/state"));
    const body = (await response.json()) as { testCases: unknown[] };

    expect(response.status).toBe(200);
    expect(body.testCases).toHaveLength(20);
  });

  test("시나리오 API는 상태를 갱신한다", async () => {
    const handler = createReviewRequestHandler();
    const response = await handler(
      new Request("http://localhost/api/review/scenarios/local-signup", { method: "POST" })
    );
    const body = (await response.json()) as { ok: boolean; state: { users: unknown[] } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.state.users).toHaveLength(1);
  });

  test("저장소 persistence가 있으면 시나리오 실행 결과를 저장하고 DB 상태를 응답한다", async () => {
    const persistence: ReviewPersistence = {
      initialize: vi.fn(async (state) => ({
        ...state,
        database: { mode: "database", connected: true, userRows: 0, identityRows: 0, mergeRequestRows: 0, auditLogRows: 0 }
      })),
      persist: vi.fn(async (state) => ({
        ...state,
        database: { mode: "database", connected: true, userRows: state.users.length, identityRows: 0, mergeRequestRows: 0, auditLogRows: 1 }
      })),
      summarize: vi.fn(async (state) => state)
    };
    const handler = createReviewRequestHandler(createInitialReviewState(), { persistence });

    const response = await handler(
      new Request("http://localhost/api/review/scenarios/local-signup", { method: "POST" })
    );
    const body = (await response.json()) as {
      state: { database: { mode: string; connected: boolean; userRows: number; auditLogRows: number } };
    };

    expect(response.status).toBe(200);
    expect(persistence.persist).toHaveBeenCalledOnce();
    expect(body.state.database).toMatchObject({
      mode: "database",
      connected: true,
      userRows: 1,
      auditLogRows: 1
    });
  });
});
