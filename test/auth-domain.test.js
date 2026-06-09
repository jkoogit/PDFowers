import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_ERRORS } from "../src/domains/auth/auth-errors.js";
import {
  createLocalUser,
  linkOAuthIdentity,
  approveMergeRequest,
  verifyLocalLogin,
  unlinkLocalCredential
} from "../src/domains/auth/auth-domain.js";

test("AUTH_ERRORS exposes stable auth error codes", () => {
  assert.equal(AUTH_ERRORS.INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
  assert.equal(AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED, "ACCOUNT_MERGE_REQUIRED");
});

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
