import { describe, expect, test } from "vitest";
import { createReviewRequestHandler } from "../../src/review/mvp1-review-server.js";

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
});
