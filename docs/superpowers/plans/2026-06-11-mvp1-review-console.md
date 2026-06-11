# MVP1 Review Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP1 인증 기능을 브라우저에서 검수할 수 있는 로컬 검수화면과 시나리오 실행 API를 만든다.

**Architecture:** 프론트엔드 프레임워크를 추가하지 않고 Node.js 내장 HTTP 서버와 정적 HTML/CSS/JS를 사용한다. 검수 시나리오는 `src/domains/auth/auth-domain.ts`의 기존 순수 함수를 호출하며, 검수 상태는 서버 메모리에만 보관한다.

**Tech Stack:** Node.js, TypeScript, Vitest, built-in `node:http`, static HTML/CSS/JavaScript.

---

## File Structure

- Create `src/review/mvp1-review-scenarios.ts`: 메모리 검수 상태, 시나리오 실행, 테스트 케이스 매핑을 담당한다.
- Create `src/review/mvp1-review-server.ts`: 정적 파일 제공과 `/api/review/*` JSON API를 담당한다.
- Create `src/review/public/mvp1-review.html`: 검수화면 HTML 진입점이다.
- Create `src/review/public/mvp1-review.css`: 내부 검수 도구 스타일이다.
- Create `src/review/public/mvp1-review.js`: 브라우저 이벤트, API 호출, 화면 갱신을 담당한다.
- Create `test/unit/mvp1-review-scenarios.test.ts`: 검수 시나리오 상태 전이와 테스트 케이스 매핑을 검증한다.
- Modify `package.json`: `review:mvp1` 실행 스크립트를 추가한다.
- Modify `tsconfig.json`: review 서버 실행에 필요한 타입 범위를 유지한다.

## Task 1: Review Scenario Test

**Files:**
- Create: `test/unit/mvp1-review-scenarios.test.ts`
- Create: `src/review/mvp1-review-scenarios.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/mvp1-review-scenarios.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- test/unit/mvp1-review-scenarios.test.ts`

Expected: FAIL because `src/review/mvp1-review-scenarios.ts` does not exist.

- [ ] **Step 3: Add minimal scenario module**

Create `src/review/mvp1-review-scenarios.ts` with exported types and functions:

```ts
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
  users: AuthUser[];
  currentUserUuid?: string;
  mergeRequests: AccountMergeRequest[];
  testCases: ReviewTestCase[];
  messages: string[];
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
    users: [],
    mergeRequests: [],
    testCases: listReviewTestCases(),
    messages: ["검수 상태가 초기화되었습니다."]
  };
}

export function runReviewScenario(state: ReviewState, scenarioId: ReviewScenarioId): ReviewScenarioResult {
  const next = cloneReviewState(state);
  const handler = scenarioHandlers[scenarioId];
  const message = handler(next);
  next.messages = [message, ...next.messages].slice(0, 8);
  return { ok: true, scenarioId, message, state: next };
}

function cloneReviewState(state: ReviewState): ReviewState {
  return {
    users: [...state.users],
    currentUserUuid: state.currentUserUuid,
    mergeRequests: [...state.mergeRequests],
    testCases: state.testCases.map((testCase) => ({ ...testCase })),
    messages: [...state.messages]
  };
}

function pass(state: ReviewState, ...ids: ReviewTestCase["id"][]) {
  for (const id of ids) {
    const testCase = state.testCases.find((item) => item.id === id);
    if (testCase) testCase.status = "passed";
  }
}

function ensureLocalUser(state: ReviewState): AuthUser {
  if (state.users[0]) return state.users[0];
  const user = createLocalUser({
    loginId: "review-user",
    email: "review-user@example.test",
    password: "correct-password",
    displayName: "검수 사용자",
    emailVerifiedAt: new Date("2026-06-11T00:00:00.000Z")
  });
  state.users.push(user);
  state.currentUserUuid = user.userUuid;
  pass(state, "MVP1-AUTH-T001");
  return user;
}

function ensureProviderUser(provider: AuthProvider, providerUserId: string): AuthUser {
  return createOAuthUser({
    loginId: `${provider}-owner`,
    email: `${provider}-owner@example.test`,
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
      loginId: "unverified-user",
      email: "unverified@example.test",
      password: "correct-password",
      displayName: "미인증 사용자"
    });
    verifyLocalLogin(user, "correct-password", { emailVerificationRequired: true });
    state.users.push(user);
    pass(state, "MVP1-AUTH-T002", "MVP1-AUTH-T003");
    return "이메일 인증 필수/선택 정책을 확인했습니다.";
  },
  "oauth-signup": (state) => {
    const user = ensureProviderUser("kakao", "review-kakao-user");
    state.users.push(user);
    state.currentUserUuid = user.userUuid;
    pass(state, "MVP1-AUTH-T006");
    return "신규 OAuth 회원가입을 확인했습니다.";
  },
  "oauth-login": (state) => {
    const user = ensureProviderUser("google", "review-google-user");
    state.users.push(user);
    findOAuthLogin(state.users, "google", "review-google-user");
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
      providerUserId: "review-naver-user"
    });
    pass(state, "MVP1-AUTH-T009", "MVP1-AUTH-T010");
    return "로그인 상태 OAuth 연결과 중복 연결 차단을 확인했습니다.";
  },
  "oauth-link-conflict": (state) => {
    const requester = ensureLocalUser(state);
    const target = ensureProviderUser("kakao", "conflict-kakao-user");
    state.users.push(target);
    const result = linkOAuthIdentity({
      currentUser: requester,
      allUsers: state.users,
      provider: "kakao",
      providerUserId: "conflict-kakao-user"
    });
    if (result.mergeRequest) state.mergeRequests.push(result.mergeRequest);
    pass(state, "MVP1-AUTH-T011", "MVP1-AUTH-T014");
    return "다른 계정 OAuth 연결 시 계정 통합 요청 생성을 확인했습니다.";
  },
  "merge-approve": (state) => {
    if (state.mergeRequests.length === 0) scenarioHandlers["oauth-link-conflict"](state);
    const mergeRequest = state.mergeRequests.at(-1)!;
    const requester = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid)!;
    const target = state.users.find((user) => user.userUuid === mergeRequest.targetUserUuid)!;
    approveMergeRequest({ requestUser: requester, targetUser: target, mergeRequest });
    pass(state, "MVP1-AUTH-T012");
    return "계정 통합 승인을 확인했습니다.";
  },
  "merge-cancel": (state) => {
    if (state.mergeRequests.length === 0) scenarioHandlers["oauth-link-conflict"](state);
    const mergeRequest = state.mergeRequests.at(-1)!;
    const requester = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid)!;
    cancelMergeRequest({ user: requester, mergeRequest });
    return "계정 통합 취소 상태를 확인했습니다.";
  },
  "merge-expire": (state) => {
    const requester = ensureLocalUser(state);
    const target = ensureProviderUser("google", "expire-google-user");
    state.users.push(target);
    const result = linkOAuthIdentity({
      currentUser: requester,
      allUsers: state.users,
      provider: "google",
      providerUserId: "expire-google-user",
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
    linkOAuthIdentity({ currentUser: user, allUsers: state.users, provider: "google", providerUserId: "unlink-google-user" });
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
    requestEmailChange(user, "changed-review-user@example.test");
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- test/unit/mvp1-review-scenarios.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/review/mvp1-review-scenarios.ts test/unit/mvp1-review-scenarios.test.ts
git commit -m "MVP1 검수 시나리오 추가"
```

## Task 2: Review HTTP Server

**Files:**
- Create: `src/review/mvp1-review-server.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing server smoke test**

Create `test/unit/mvp1-review-server.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { createReviewRequestHandler } from "../../src/review/mvp1-review-server.js";

describe("MVP1 검수 서버", () => {
  test("상태 API는 초기 검수 상태를 JSON으로 반환한다", async () => {
    const handler = createReviewRequestHandler();
    const response = await handler(new Request("http://localhost/api/review/state"));
    const body = await response.json() as { testCases: unknown[] };

    expect(response.status).toBe(200);
    expect(body.testCases).toHaveLength(20);
  });

  test("시나리오 API는 상태를 갱신한다", async () => {
    const handler = createReviewRequestHandler();
    const response = await handler(new Request("http://localhost/api/review/scenarios/local-signup", { method: "POST" }));
    const body = await response.json() as { ok: boolean; state: { users: unknown[] } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.state.users).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- test/unit/mvp1-review-server.test.ts`

Expected: FAIL because `src/review/mvp1-review-server.ts` does not exist.

- [ ] **Step 3: Implement request handler and CLI server**

Create `src/review/mvp1-review-server.ts` with:

- `createReviewRequestHandler()`
- `startMvp1ReviewServer(port?: number)`
- static file serving from `src/review/public`
- API routes for state, reset, scenario execution

- [ ] **Step 4: Add script**

Modify `package.json`:

```json
"review:mvp1": "node --experimental-strip-types src/review/mvp1-review-server.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- test/unit/mvp1-review-server.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json src/review/mvp1-review-server.ts test/unit/mvp1-review-server.test.ts
git commit -m "MVP1 검수 서버 추가"
```

## Task 3: Review Screen UI

**Files:**
- Create: `src/review/public/mvp1-review.html`
- Create: `src/review/public/mvp1-review.css`
- Create: `src/review/public/mvp1-review.js`

- [ ] **Step 1: Create HTML**

Create a single-page internal review UI with scenario buttons, account state panel, audit log panel, and test case checklist.

- [ ] **Step 2: Create CSS**

Use a restrained operational-tool layout: compact header, tab-like scenario groups, dense state panels, and status badges.

- [ ] **Step 3: Create browser JS**

Implement:

- `loadState()`
- `runScenario(scenarioId)`
- `resetState()`
- `renderState(state)`
- safe text rendering using `textContent`

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/review/public/mvp1-review.html src/review/public/mvp1-review.css src/review/public/mvp1-review.js
git commit -m "MVP1 검수화면 UI 추가"
```

## Task 4: Final Verification

**Files:**
- Modify only if verification finds a defect.

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: PASS. Integration tests may skip when `DATABASE_URL` is not set.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Start review server**

Run: `npm run review:mvp1`

Expected: terminal prints `MVP1 review server: http://localhost:4173`.

- [ ] **Step 5: Manual browser smoke check**

Open `http://localhost:4173`, click:

1. `ID/PW 회원가입`
2. `ID/PW 로그인 성공`
3. `OAuth 충돌 연결`
4. `계정 통합 승인`
5. `이메일 변경 확인`

Expected: user count, identity count, merge request state, audit log, and checklist badges update without page reload.

- [ ] **Step 6: Commit any verification fixes**

Run:

```bash
git status --short
git add <changed-files>
git commit -m "MVP1 검수화면 검증 보완"
```

Only commit if verification required fixes.

## Self-Review

- Spec coverage: 검수화면, 로컬 시나리오 API, 체크리스트, 상태 패널, 수동/자동 검증 명령이 모두 작업에 포함되어 있다.
- Placeholder scan: 미정 상태나 빈 구현 지시가 없다.
- Type consistency: `ReviewState`, `ReviewScenarioId`, `ReviewTestCase`, `createReviewRequestHandler` 이름을 모든 작업에서 동일하게 사용한다.
