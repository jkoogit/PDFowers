import { describe, expect, test } from "vitest";
import {
  createInitialReviewState,
  listReviewTestCases,
  runReviewScenario
} from "../../src/review/mvp1-review-scenarios.js";

describe("MVP1 검수 시나리오", () => {
  test("초기 검수 상태는 MVP1-AUTH-T001부터 T020까지의 체크리스트를 제공한다", () => {
    const testCases = listReviewTestCases();

    expect(testCases).toHaveLength(20);
    expect(testCases[0]).toMatchObject({
      id: "MVP1-AUTH-T001",
      status: "pending"
    });
    expect(testCases[19]).toMatchObject({
      id: "MVP1-AUTH-T020",
      status: "pending"
    });
  });

  test("회원가입과 로그인 성공 시나리오는 계정 상태와 체크리스트를 갱신한다", () => {
    let state = createInitialReviewState();

    state = runReviewScenario(state, "local-signup").state;
    state = runReviewScenario(state, "local-login-success").state;

    expect(state.users).toHaveLength(1);
    expect(state.currentUserUuid).toBe(state.users[0]!.userUuid);
    expect(state.testCases.find((item) => item.id === "MVP1-AUTH-T001")?.status).toBe("passed");
    expect(state.testCases.find((item) => item.id === "MVP1-AUTH-T004")?.status).toBe("passed");
  });

  test("OAuth 충돌 시나리오는 계정 통합 요청을 만들고 승인 시 target 계정을 merged로 바꾼다", () => {
    let state = createInitialReviewState();

    state = runReviewScenario(state, "local-signup").state;
    state = runReviewScenario(state, "oauth-link-conflict").state;

    expect(state.mergeRequests).toHaveLength(1);
    expect(state.testCases.find((item) => item.id === "MVP1-AUTH-T011")?.status).toBe("passed");

    state = runReviewScenario(state, "merge-approve").state;

    expect(state.users.some((user) => user.status === "merged")).toBe(true);
    expect(state.testCases.find((item) => item.id === "MVP1-AUTH-T012")?.status).toBe("passed");
  });
});
