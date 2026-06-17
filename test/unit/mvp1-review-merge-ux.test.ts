import { describe, expect, test } from "vitest";
import {
  createInitialReviewState,
  runReviewScenario
} from "../../src/review/mvp1-review-scenarios.js";
import { createMergeRequestReviewItems } from "../../src/review/mvp1-review-merge-ux.js";

describe("MVP1 계정 통합 검수 UX", () => {
  test("계정 통합 요청은 UUID만이 아니라 요청/대상 계정과 승인 안내를 함께 표시한다", () => {
    let state = createInitialReviewState();

    state = runReviewScenario(state, "local-signup").state;
    state = runReviewScenario(state, "oauth-link-conflict").state;

    const items = createMergeRequestReviewItems(state);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      providerLabel: "Kakao",
      statusLabel: "승인 대기",
      statusTone: "pending",
      requestUserLabel: expect.stringContaining("검수 사용자"),
      targetUserLabel: expect.stringContaining("kakao 보유 계정"),
      targetAfterApproval: "승인 후 대상 계정은 merged 상태가 됩니다.",
      irreversibleNotice: "통합 승인 후 되돌리기 어려운 작업입니다."
    });
    expect(items[0]!.maskedProviderUserId).toMatch(/^\w{3}\*\*\*\w{3}$/);
  });

  test("취소와 만료 상태는 검수자가 구분할 수 있는 상태 라벨을 제공한다", () => {
    let cancelled = createInitialReviewState();
    cancelled = runReviewScenario(cancelled, "oauth-link-conflict").state;
    cancelled = runReviewScenario(cancelled, "merge-cancel").state;

    let expired = createInitialReviewState();
    expired = runReviewScenario(expired, "merge-expire").state;

    expect(createMergeRequestReviewItems(cancelled)[0]).toMatchObject({
      statusLabel: "취소됨",
      statusTone: "cancelled"
    });
    expect(createMergeRequestReviewItems(expired)[0]).toMatchObject({
      statusLabel: "만료됨",
      statusTone: "expired"
    });
  });
});
