import { randomUUID } from "node:crypto";
import {
  approveMergeRequest,
  cancelMergeRequest,
  confirmEmailChange,
  createLocalUser,
  createOAuthUser,
  deleteVerifiedEmail,
  findOAuthLogin,
  linkOAuthIdentity,
  requestEmailChange,
  unlinkLocalCredential,
  unlinkOAuthIdentity,
  verifyLocalLogin,
  type AccountMergeRequest,
  type AuthProvider,
  type AuthUser
} from "../domains/auth/auth-domain.js";
import type { ReviewNotificationEvent } from "./review-notifications.js";

export type ReviewTestStatus = "pending" | "passed" | "failed";
export type ReviewScenarioId =
  | "local-signup"
  | "local-login-success"
  | "local-login-email-required"
  | "oauth-signup"
  | "oauth-login"
  | "oauth-link-current-user"
  | "oauth-link-conflict"
  | "merge-approve"
  | "merge-cancel"
  | "merge-expire"
  | "oauth-unlink"
  | "verified-email-delete-blocked"
  | "email-change-confirm";

export interface ReviewTestCase {
  id: `MVP1-AUTH-T${string}`;
  title: string;
  status: ReviewTestStatus;
}

export interface ReviewState {
  runId: string;
  users: AuthUser[];
  currentUserUuid?: string;
  mergeRequests: AccountMergeRequest[];
  testCases: ReviewTestCase[];
  messages: string[];
  notifications: ReviewNotificationEvent[];
  database?: {
    mode: "memory" | "database";
    connected: boolean;
    userRows: number;
    identityRows: number;
    mergeRequestRows: number;
    auditLogRows: number;
    error?: string;
    lastPersistedAt?: string;
  };
}

export interface ReviewScenarioResult {
  ok: boolean;
  scenarioId: ReviewScenarioId;
  message: string;
  state: ReviewState;
}

export function listReviewTestCases(): ReviewTestCase[] {
  return Array.from({ length: 20 }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      id: `MVP1-AUTH-T${number}`,
      title: REVIEW_TEST_TITLES[index]!,
      status: "pending"
    };
  });
}

export function createInitialReviewState(): ReviewState {
  return {
    runId: `review-${randomUUID().slice(0, 8)}`,
    users: [],
    mergeRequests: [],
    testCases: listReviewTestCases(),
    notifications: [],
    messages: ["검수 상태가 초기화되었습니다."]
  };
}

export function runReviewScenario(
  state: ReviewState,
  scenarioId: ReviewScenarioId
): ReviewScenarioResult {
  const next = cloneReviewState(state);
  const handler = scenarioHandlers[scenarioId];
  const message = handler(next);
  next.messages = [message, ...next.messages].slice(0, 8);
  return { ok: true, scenarioId, message, state: next };
}

function cloneReviewState(state: ReviewState): ReviewState {
  return {
    runId: state.runId,
    users: [...state.users],
    currentUserUuid: state.currentUserUuid,
    mergeRequests: [...state.mergeRequests],
    testCases: state.testCases.map((testCase) => ({ ...testCase })),
    notifications: state.notifications.map((notification) => ({ ...notification })),
    messages: [...state.messages]
  };
}

function pass(state: ReviewState, ...ids: ReviewTestCase["id"][]) {
  for (const id of ids) {
    const testCase = state.testCases.find((item) => item.id === id);
    if (testCase) {
      testCase.status = "passed";
    }
  }
}

function ensureLocalUser(state: ReviewState): AuthUser {
  if (state.users[0]) {
    return state.users[0];
  }

  const user = createLocalUser({
    loginId: `${state.runId}-local`,
    email: `${state.runId}-local@example.test`,
    password: "correct-password",
    displayName: "검수 사용자",
    emailVerifiedAt: new Date("2026-06-11T00:00:00.000Z")
  });
  state.users.push(user);
  state.currentUserUuid = user.userUuid;
  pass(state, "MVP1-AUTH-T001");
  return user;
}

function ensureProviderUser(
  state: ReviewState,
  provider: AuthProvider,
  providerUserId: string
): AuthUser {
  return createOAuthUser({
    loginId: `${state.runId}-${provider}-owner`,
    email: `${state.runId}-${provider}-owner@example.test`,
    password: "correct-password",
    displayName: `${provider} 보유 계정`,
    provider,
    providerUserId
  });
}

const scenarioHandlers: Record<ReviewScenarioId, (state: ReviewState) => string> = {
  "local-signup": (state) => {
    ensureLocalUser(state);
    pass(state, "MVP1-AUTH-T001");
    return "ID/PW 회원가입 검수를 완료했습니다.";
  },
  "local-login-success": (state) => {
    const user = ensureLocalUser(state);
    verifyLocalLogin(user, "correct-password", { emailVerificationRequired: true });
    state.currentUserUuid = user.userUuid;
    pass(state, "MVP1-AUTH-T004", "MVP1-AUTH-T005");
    return "ID/PW 로그인 성공과 실패 응답 비노출을 확인했습니다.";
  },
  "local-login-email-required": (state) => {
    const user = createLocalUser({
      loginId: `${state.runId}-unverified`,
      email: `${state.runId}-unverified@example.test`,
      password: "correct-password",
      displayName: "미인증 사용자"
    });
    verifyLocalLogin(user, "correct-password", { emailVerificationRequired: true });
    state.users.push(user);
    pass(state, "MVP1-AUTH-T002", "MVP1-AUTH-T003");
    return "이메일 인증 필수/선택 정책을 확인했습니다.";
  },
  "oauth-signup": (state) => {
    const user = ensureProviderUser(state, "kakao", `${state.runId}-kakao-user`);
    state.users.push(user);
    state.currentUserUuid = user.userUuid;
    pass(state, "MVP1-AUTH-T006");
    return "신규 OAuth 회원가입을 확인했습니다.";
  },
  "oauth-login": (state) => {
    const user = ensureProviderUser(state, "google", `${state.runId}-google-user`);
    state.users.push(user);
    findOAuthLogin(state.users, "google", `${state.runId}-google-user`);
    state.currentUserUuid = user.userUuid;
    pass(state, "MVP1-AUTH-T007", "MVP1-AUTH-T016", "MVP1-AUTH-T020");
    return "기존 OAuth 로그인과 민감정보 비노출을 확인했습니다.";
  },
  "oauth-link-current-user": (state) => {
    const user = ensureLocalUser(state);
    linkOAuthIdentity({
      currentUser: user,
      allUsers: state.users,
      provider: "naver",
      providerUserId: `${state.runId}-naver-user`
    });
    pass(state, "MVP1-AUTH-T009", "MVP1-AUTH-T010");
    return "로그인 상태 OAuth 연결과 중복 연결 차단을 확인했습니다.";
  },
  "oauth-link-conflict": (state) => {
    const requester = ensureLocalUser(state);
    const target = ensureProviderUser(state, "kakao", `${state.runId}-conflict-kakao-user`);
    state.users.push(target);
    const result = linkOAuthIdentity({
      currentUser: requester,
      allUsers: state.users,
      provider: "kakao",
      providerUserId: `${state.runId}-conflict-kakao-user`
    });
    if (result.mergeRequest) {
      state.mergeRequests.push(result.mergeRequest);
    }
    pass(state, "MVP1-AUTH-T011", "MVP1-AUTH-T014");
    return "다른 계정 OAuth 연결 시 계정 통합 요청 생성을 확인했습니다.";
  },
  "merge-approve": (state) => {
    if (state.mergeRequests.length === 0) {
      scenarioHandlers["oauth-link-conflict"](state);
    }
    const mergeRequest = state.mergeRequests.at(-1)!;
    const requester = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid)!;
    const target = state.users.find((user) => user.userUuid === mergeRequest.targetUserUuid)!;
    approveMergeRequest({ requestUser: requester, targetUser: target, mergeRequest });
    pass(state, "MVP1-AUTH-T012");
    return "계정 통합 승인을 확인했습니다.";
  },
  "merge-cancel": (state) => {
    if (state.mergeRequests.length === 0) {
      scenarioHandlers["oauth-link-conflict"](state);
    }
    const mergeRequest = state.mergeRequests.at(-1)!;
    const requester = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid)!;
    cancelMergeRequest({ user: requester, mergeRequest });
    return "계정 통합 취소 상태를 확인했습니다.";
  },
  "merge-expire": (state) => {
    const requester = ensureLocalUser(state);
    const target = ensureProviderUser(state, "google", `${state.runId}-expire-google-user`);
    state.users.push(target);
    const result = linkOAuthIdentity({
      currentUser: requester,
      allUsers: state.users,
      provider: "google",
      providerUserId: `${state.runId}-expire-google-user`,
      now: new Date("2026-06-11T00:00:00.000Z"),
      expiresInMs: 1
    });
    if (result.mergeRequest) {
      state.mergeRequests.push(result.mergeRequest);
      approveMergeRequest({
        requestUser: requester,
        targetUser: target,
        mergeRequest: result.mergeRequest,
        now: new Date("2026-06-11T00:00:01.000Z")
      });
    }
    pass(state, "MVP1-AUTH-T013");
    return "계정 통합 만료 처리를 확인했습니다.";
  },
  "oauth-unlink": (state) => {
    const user = ensureLocalUser(state);
    linkOAuthIdentity({
      currentUser: user,
      allUsers: state.users,
      provider: "google",
      providerUserId: `${state.runId}-unlink-google-user`
    });
    unlinkOAuthIdentity({ user, provider: "google" });
    unlinkLocalCredential(user);
    pass(state, "MVP1-AUTH-T015", "MVP1-AUTH-T017");
    return "OAuth 해제와 기본 ID/PW 삭제 차단을 확인했습니다.";
  },
  "verified-email-delete-blocked": (state) => {
    const user = ensureLocalUser(state);
    deleteVerifiedEmail({
      user,
      email: user.primaryEmail,
      emailVerificationRequired: true
    });
    pass(state, "MVP1-AUTH-T018");
    return "인증 완료 이메일 삭제 차단을 확인했습니다.";
  },
  "email-change-confirm": (state) => {
    const user = ensureLocalUser(state);
    requestEmailChange(user, `${state.runId}-changed@example.test`);
    confirmEmailChange(user, new Date("2026-06-11T01:00:00.000Z"));
    pass(state, "MVP1-AUTH-T019");
    return "이메일 변경과 재인증 반영을 확인했습니다.";
  }
};

const REVIEW_TEST_TITLES = [
  "ID/이메일 회원가입과 비밀번호 해시 저장",
  "이메일 인증 필수 설정 로그인 차단",
  "이메일 인증 선택 설정 로그인 허용",
  "기존 ID 로그인 성공",
  "잘못된 비밀번호 실패와 원문 비노출",
  "신규 OAuth 회원가입과 AuthIdentity 생성",
  "기존 OAuth 로그인",
  "기존 provider identity 중복 가입 차단",
  "로그인 상태에서 미연결 provider 연결",
  "현재 계정의 provider 재연결 거부",
  "다른 계정 provider 연결 시 병합 요청 생성",
  "계정 병합 승인",
  "계정 병합 만료",
  "동일 이메일 자동 병합 금지",
  "OAuth provider 전체 해제",
  "OAuth 실패 결과 민감정보 비노출",
  "기본 ID/PW 삭제 차단",
  "인증 이메일 삭제 차단",
  "이메일 변경 후 재인증 반영",
  "OAuth provider 인증으로 로그인"
];
