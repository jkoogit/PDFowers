import type { AccountMergeRequest, AuthUser } from "../domains/auth/auth-domain.js";
import type { ReviewState } from "./mvp1-review-scenarios.js";

export interface MergeRequestReviewItem {
  mergeRequestUuid: string;
  providerLabel: string;
  statusLabel: string;
  statusTone: AccountMergeRequest["status"];
  requestUserLabel: string;
  targetUserLabel: string;
  maskedProviderUserId: string;
  expiresAt: string;
  targetAfterApproval: string;
  irreversibleNotice: string;
}

export function createMergeRequestReviewItems(state: ReviewState): MergeRequestReviewItem[] {
  return state.mergeRequests.map((mergeRequest) => {
    const requestUser = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid);
    const targetUser = state.users.find((user) => user.userUuid === mergeRequest.targetUserUuid);

    return {
      mergeRequestUuid: mergeRequest.mergeRequestUuid,
      providerLabel: providerLabel(mergeRequest.provider),
      statusLabel: mergeStatusLabel(mergeRequest.status),
      statusTone: mergeRequest.status,
      requestUserLabel: userLabel(requestUser, mergeRequest.requestUserUuid),
      targetUserLabel: userLabel(targetUser, mergeRequest.targetUserUuid),
      maskedProviderUserId: maskProviderUserId(mergeRequest.providerUserId),
      expiresAt: mergeRequest.expiresAt.toISOString(),
      targetAfterApproval: "승인 후 대상 계정은 merged 상태가 됩니다.",
      irreversibleNotice: "통합 승인 후 되돌리기 어려운 작업입니다."
    };
  });
}

function userLabel(user: AuthUser | undefined, fallbackUuid: string) {
  return user ? `${user.displayName} (${user.loginId})` : fallbackUuid;
}

function providerLabel(provider: AccountMergeRequest["provider"]) {
  if (provider === "kakao") return "Kakao";
  if (provider === "naver") return "Naver";
  return "Google";
}

function mergeStatusLabel(status: AccountMergeRequest["status"]) {
  if (status === "pending") return "승인 대기";
  if (status === "approved") return "승인됨";
  if (status === "cancelled") return "취소됨";
  return "만료됨";
}

function maskProviderUserId(value: string) {
  if (value.length <= 6) {
    return value ? "***" : "없음";
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
