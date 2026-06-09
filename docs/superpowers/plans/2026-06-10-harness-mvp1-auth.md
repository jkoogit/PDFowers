# Harness MVP1 Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 패키지 없이 실행 가능한 MVP1 인증 도메인 최소 스캐폴딩을 만들고, 이후 REST/OpenAPI, 세션, Drizzle 구현으로 확장할 수 있는 경계를 세운다.

**Architecture:** 첫 코딩 단위는 Node.js ESM과 `node:test`만 사용한다. 도메인 규칙은 `src/domains/auth` 아래 순수 함수로 두고, HTTP/DB/OAuth 실제 어댑터는 후속 작업에서 붙인다.

**Tech Stack:** Node.js 22+, ESM JavaScript, `node:test`, 향후 TypeScript, REST + OpenAPI, 서버 세션, PostgreSQL + Drizzle ORM.

---

## File Structure

| 경로 | 역할 |
| :--- | :--- |
| `package.json` | 최소 Node.js 프로젝트 스크립트 정의 |
| `src/domains/auth/auth-domain.js` | 회원가입, 로그인, OAuth 식별자 연결, 계정 통합 순수 도메인 로직 |
| `src/domains/auth/auth-errors.js` | 인증 도메인 오류 코드 상수 |
| `test/auth-domain.test.js` | MVP1 인증 도메인 테스트 |
| `docs/04_기술관리/06_개발명령어.md` | 실제 생성된 `npm test` 명령 반영 |

## Task 1: Minimal Node Scaffold

**Files:**
- Create: `package.json`
- Create: `src/domains/auth/auth-errors.js`
- Test: `test/auth-domain.test.js`

- [ ] **Step 1: Write the initial failing test**

Create `test/auth-domain.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_ERRORS } from "../src/domains/auth/auth-errors.js";

test("AUTH_ERRORS exposes stable auth error codes", () => {
  assert.equal(AUTH_ERRORS.INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
  assert.equal(AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED, "ACCOUNT_MERGE_REQUIRED");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: `npm` reports missing `package.json` or test script.

- [ ] **Step 3: Add minimal project script and error constants**

Create `package.json`:

```json
{
  "name": "pdfowers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

Create `src/domains/auth/auth-errors.js`:

```js
export const AUTH_ERRORS = Object.freeze({
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  AUTH_IDENTITY_ALREADY_LINKED: "AUTH_IDENTITY_ALREADY_LINKED",
  ACCOUNT_MERGE_REQUIRED: "ACCOUNT_MERGE_REQUIRED",
  LOCAL_CREDENTIAL_REQUIRED: "LOCAL_CREDENTIAL_REQUIRED",
  EMAIL_VERIFICATION_REQUIRED: "EMAIL_VERIFICATION_REQUIRED"
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test
```

Expected: 1 test passes, 0 fails.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/domains/auth/auth-errors.js test/auth-domain.test.js
git commit -m "하네스 인증 도메인 스캐폴딩 추가"
```

## Task 2: Local Signup and Login Domain

**Files:**
- Create: `src/domains/auth/auth-domain.js`
- Modify: `test/auth-domain.test.js`

- [ ] **Step 1: Write failing local auth tests**

Append to `test/auth-domain.test.js`:

```js
import {
  createLocalUser,
  verifyLocalLogin,
  unlinkLocalCredential
} from "../src/domains/auth/auth-domain.js";

test("createLocalUser creates a local account without storing plaintext password", () => {
  const user = createLocalUser({
    loginId: "user01",
    email: "user01@example.test",
    password: "correct-password",
    displayName: "User 01"
  });

  assert.equal(user.loginId, "user01");
  assert.equal(user.primaryEmail, "user01@example.test");
  assert.equal(user.displayName, "User 01");
  assert.notEqual(user.passwordHash, "correct-password");
  assert.equal(user.status, "active");
});

test("verifyLocalLogin accepts only matching password", () => {
  const user = createLocalUser({
    loginId: "user01",
    email: "user01@example.test",
    password: "correct-password",
    displayName: "User 01"
  });

  assert.equal(verifyLocalLogin(user, "correct-password").ok, true);
  assert.equal(verifyLocalLogin(user, "wrong-password").ok, false);
  assert.equal(verifyLocalLogin(user, "wrong-password").error, AUTH_ERRORS.INVALID_CREDENTIALS);
});

test("unlinkLocalCredential rejects removing the required ID/PW credential", () => {
  const user = createLocalUser({
    loginId: "user01",
    email: "user01@example.test",
    password: "correct-password",
    displayName: "User 01"
  });

  assert.equal(unlinkLocalCredential(user).ok, false);
  assert.equal(unlinkLocalCredential(user).error, AUTH_ERRORS.LOCAL_CREDENTIAL_REQUIRED);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: module export error for `createLocalUser`.

- [ ] **Step 3: Implement local auth domain**

Create `src/domains/auth/auth-domain.js`:

```js
import { createHash, randomUUID } from "node:crypto";
import { AUTH_ERRORS } from "./auth-errors.js";

function hashPassword(password) {
  return createHash("sha256").update(`pdfowers:${password}`).digest("hex");
}

export function createLocalUser({ loginId, email, password, displayName }) {
  return {
    userUuid: randomUUID(),
    loginId,
    primaryEmail: email,
    passwordHash: hashPassword(password),
    displayName,
    status: "active",
    identities: [],
    auditLogs: [{ eventType: "LOCAL_USER_CREATED" }]
  };
}

export function verifyLocalLogin(user, password) {
  if (user.passwordHash !== hashPassword(password)) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }
  return { ok: true, userUuid: user.userUuid };
}

export function unlinkLocalCredential() {
  return { ok: false, error: AUTH_ERRORS.LOCAL_CREDENTIAL_REQUIRED };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test
```

Expected: 4 tests pass, 0 fails.

- [ ] **Step 5: Commit**

```powershell
git add src/domains/auth/auth-domain.js test/auth-domain.test.js
git commit -m "로컬 인증 도메인 규칙 추가"
```

## Task 3: OAuth Identity Link and Merge Request

**Files:**
- Modify: `src/domains/auth/auth-domain.js`
- Modify: `test/auth-domain.test.js`

- [ ] **Step 1: Write failing OAuth identity tests**

Append to `test/auth-domain.test.js`:

```js
import {
  linkOAuthIdentity,
  approveMergeRequest
} from "../src/domains/auth/auth-domain.js";

test("linkOAuthIdentity links an unused provider identity to the current user", () => {
  const user = createLocalUser({
    loginId: "user01",
    email: "user01@example.test",
    password: "correct-password",
    displayName: "User 01"
  });

  const result = linkOAuthIdentity({
    currentUser: user,
    allUsers: [user],
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });

  assert.equal(result.ok, true);
  assert.equal(user.identities.length, 1);
  assert.equal(user.identities[0].provider, "kakao");
});

test("linkOAuthIdentity creates merge request when identity belongs to another user", () => {
  const requester = createLocalUser({
    loginId: "requester",
    email: "requester@example.test",
    password: "correct-password",
    displayName: "Requester"
  });
  const target = createLocalUser({
    loginId: "target",
    email: "target@example.test",
    password: "correct-password",
    displayName: "Target"
  });
  linkOAuthIdentity({
    currentUser: target,
    allUsers: [requester, target],
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });

  const result = linkOAuthIdentity({
    currentUser: requester,
    allUsers: [requester, target],
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED);
  assert.equal(result.mergeRequest.requestUserUuid, requester.userUuid);
  assert.equal(result.mergeRequest.targetUserUuid, target.userUuid);
});

test("approveMergeRequest moves identity and marks target user as merged", () => {
  const requester = createLocalUser({
    loginId: "requester",
    email: "requester@example.test",
    password: "correct-password",
    displayName: "Requester"
  });
  const target = createLocalUser({
    loginId: "target",
    email: "target@example.test",
    password: "correct-password",
    displayName: "Target"
  });
  linkOAuthIdentity({
    currentUser: target,
    allUsers: [requester, target],
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });
  const mergeResult = linkOAuthIdentity({
    currentUser: requester,
    allUsers: [requester, target],
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });

  const approved = approveMergeRequest({
    requestUser: requester,
    targetUser: target,
    mergeRequest: mergeResult.mergeRequest
  });

  assert.equal(approved.ok, true);
  assert.equal(requester.identities.length, 1);
  assert.equal(target.identities.length, 0);
  assert.equal(target.status, "merged");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: module export error for `linkOAuthIdentity`.

- [ ] **Step 3: Implement OAuth identity domain**

Append to `src/domains/auth/auth-domain.js`:

```js
function findUserByIdentity(users, provider, providerUserId) {
  return users.find((user) =>
    user.identities.some((identity) =>
      identity.provider === provider && identity.providerUserId === providerUserId
    )
  );
}

export function linkOAuthIdentity({ currentUser, allUsers, provider, providerUserId }) {
  const owner = findUserByIdentity(allUsers, provider, providerUserId);

  if (!owner) {
    currentUser.identities.push({ provider, providerUserId });
    currentUser.auditLogs.push({ eventType: "AUTH_IDENTITY_LINKED", provider });
    return { ok: true };
  }

  if (owner.userUuid === currentUser.userUuid) {
    return { ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_ALREADY_LINKED };
  }

  return {
    ok: false,
    error: AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED,
    mergeRequest: {
      mergeRequestUuid: randomUUID(),
      requestUserUuid: currentUser.userUuid,
      targetUserUuid: owner.userUuid,
      provider,
      providerUserId,
      status: "pending"
    }
  };
}

export function approveMergeRequest({ requestUser, targetUser, mergeRequest }) {
  const movingIdentityIndex = targetUser.identities.findIndex((identity) =>
    identity.provider === mergeRequest.provider &&
    identity.providerUserId === mergeRequest.providerUserId
  );

  if (movingIdentityIndex === -1) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  const [identity] = targetUser.identities.splice(movingIdentityIndex, 1);
  requestUser.identities.push(identity);
  targetUser.status = "merged";
  targetUser.mergedIntoUserUuid = requestUser.userUuid;
  requestUser.auditLogs.push({ eventType: "ACCOUNT_MERGE_APPROVED" });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test
```

Expected: 7 tests pass, 0 fails.

- [ ] **Step 5: Commit**

```powershell
git add src/domains/auth/auth-domain.js test/auth-domain.test.js
git commit -m "OAuth 식별자 연결과 계정 통합 규칙 추가"
```

## Task 4: Command Documentation Sync

**Files:**
- Modify: `docs/04_기술관리/06_개발명령어.md`

- [ ] **Step 1: Update command document**

Add this row to the current command table:

```markdown
| Node 테스트 | `npm test` | 현재 최소 인증 도메인 테스트를 실행한다. |
```

- [ ] **Step 2: Verify docs and tests**

Run:

```powershell
npm test
git diff --check
```

Expected: `npm test` exits 0 and `git diff --check` exits 0.

- [ ] **Step 3: Commit**

```powershell
git add docs/04_기술관리/06_개발명령어.md
git commit -m "하네스 인증 테스트 명령 문서화"
```

## Self-Review

- 설계 문서의 현재 앱 구조 없음, API/인증/ORM/비동기 결정, 최소 테스트 가능 스캐폴딩을 모두 반영했다.
- 외부 패키지 설치가 필요한 Drizzle, Vitest, OpenAPI 생성은 이번 첫 코딩 착수 범위에서 제외하고 문서 결정으로만 고정했다.
- 테스트 함수와 구현 함수 이름은 `createLocalUser`, `verifyLocalLogin`, `unlinkLocalCredential`, `linkOAuthIdentity`, `approveMergeRequest`로 일치한다.
- 비어 있는 결정 항목 없이 실행 가능한 첫 구현 단위를 제시했다.
