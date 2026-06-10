import { describe, expect, test } from "vitest";
import { AUTH_ERRORS } from "../src/domains/auth/auth-errors.js";
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
  type AuthUser
} from "../src/domains/auth/auth-domain.js";

function localUser(overrides: Partial<Parameters<typeof createLocalUser>[0]> = {}) {
  return createLocalUser({
    loginId: "user01",
    email: "user01@example.test",
    password: "correct-password",
    displayName: "User 01",
    ...overrides
  });
}

function linkKakao(user: AuthUser, allUsers: AuthUser[] = [user]) {
  return linkOAuthIdentity({
    currentUser: user,
    allUsers,
    provider: "kakao",
    providerUserId: "kakao-user-001"
  });
}

describe("인증 도메인 MVP1 테스트 커버리지", () => {
  test("MVP1-AUTH-T001: ID/이메일 회원가입은 User와 LocalCredential을 만들고 비밀번호 원문을 저장하지 않는다", () => {
    const user = localUser({ emailNotificationOptIn: true });

    expect(user.loginId).toBe("user01");
    expect(user.primaryEmail).toBe("user01@example.test");
    expect(user.displayName).toBe("User 01");
    expect(user.passwordHash).not.toBe("correct-password");
    expect(user.passwordHash).toMatch(/^scrypt:/);
    expect(user.status).toBe("active");
    expect(user.verifiedEmails[0]).toMatchObject({
      email: "user01@example.test",
      emailNotificationOptIn: true
    });
  });

  test("MVP1-AUTH-T002: 이메일 인증 필수 설정에서는 미인증 사용자의 로컬 로그인을 차단한다", () => {
    const user = localUser();

    const result = verifyLocalLogin(user, "correct-password", { emailVerificationRequired: true });

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.EMAIL_VERIFICATION_REQUIRED });
  });

  test("MVP1-AUTH-T003: 이메일 인증 선택 설정에서는 올바른 비밀번호로 로컬 로그인이 가능하다", () => {
    const user = localUser();

    const result = verifyLocalLogin(user, "correct-password");

    expect(result).toMatchObject({ ok: true, userUuid: user.userUuid });
  });

  test("MVP1-AUTH-T004: 기존 ID 로그인은 올바른 비밀번호만 성공한다", () => {
    const user = localUser({ emailVerifiedAt: new Date("2026-06-10T00:00:00.000Z") });

    expect(verifyLocalLogin(user, "correct-password", { emailVerificationRequired: true }).ok).toBe(true);
    expect(verifyLocalLogin(user, "wrong-password")).toMatchObject({
      ok: false,
      error: AUTH_ERRORS.INVALID_CREDENTIALS
    });
  });

  test("MVP1-AUTH-T005: 잘못된 비밀번호 로그인은 실패하고 비밀번호 원문을 노출하지 않는다", () => {
    const user = localUser();

    const result = verifyLocalLogin(user, "wrong-password");

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS });
    expect(JSON.stringify(result)).not.toContain("wrong-password");
  });

  test("MVP1-AUTH-T006: 신규 간편로그인 회원가입은 User와 AuthIdentity를 만든다", () => {
    const user = createOAuthUser({
      loginId: "oauth01",
      email: "oauth01@example.test",
      password: "correct-password",
      displayName: "OAuth 01",
      provider: "kakao",
      providerUserId: "kakao-user-001",
      emailFromProvider: "kakao001@example.test"
    });

    expect(user.identities).toHaveLength(1);
    expect(user.identities[0]).toMatchObject({
      provider: "kakao",
      providerUserId: "kakao-user-001",
      emailFromProvider: "kakao001@example.test"
    });
  });

  test("MVP1-AUTH-T007: 기존 간편로그인 로그인은 연결된 User를 반환한다", () => {
    const user = createOAuthUser({
      loginId: "oauth01",
      email: "oauth01@example.test",
      password: "correct-password",
      displayName: "OAuth 01",
      provider: "kakao",
      providerUserId: "kakao-user-001"
    });

    const result = findOAuthLogin([user], "kakao", "kakao-user-001");

    expect(result).toMatchObject({ ok: true, userUuid: user.userUuid });
    expect(user.identities[0].lastLoginAt).toBeInstanceOf(Date);
  });

  test("MVP1-AUTH-T008: 이미 존재하는 제공자 식별자로 신규 가입하면 기존 로그인 안내 오류를 반환한다", () => {
    const user = createOAuthUser({
      loginId: "oauth01",
      email: "oauth01@example.test",
      password: "correct-password",
      displayName: "OAuth 01",
      provider: "kakao",
      providerUserId: "kakao-user-001"
    });

    const result = linkOAuthIdentity({
      currentUser: user,
      allUsers: [user],
      provider: "kakao",
      providerUserId: "kakao-user-001"
    });

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_ALREADY_LINKED });
  });

  test("MVP1-AUTH-T009: 로그인 상태에서 미연결 제공자를 현재 User에 연결한다", () => {
    const user = localUser();

    const result = linkOAuthIdentity({
      currentUser: user,
      allUsers: [user],
      provider: "google",
      providerUserId: "google-user-001"
    });

    expect(result.ok).toBe(true);
    expect(user.identities[0]).toMatchObject({ provider: "google", providerUserId: "google-user-001" });
  });

  test("MVP1-AUTH-T010: 이미 현재 User에 연결된 제공자 재연결은 거부한다", () => {
    const user = localUser();
    linkKakao(user);

    const result = linkKakao(user);

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_ALREADY_LINKED });
  });

  test("MVP1-AUTH-T011: 다른 계정의 제공자 연결 시도는 병합 요청을 만든다", () => {
    const requester = localUser({ loginId: "requester", email: "requester@example.test" });
    const target = localUser({ loginId: "target", email: "target@example.test" });
    linkKakao(target, [requester, target]);

    const result = linkKakao(requester, [requester, target]);

    expect(result).toMatchObject({
      ok: false,
      error: AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED
    });
    expect(result.mergeRequest).toMatchObject({
      requestUserUuid: requester.userUuid,
      targetUserUuid: target.userUuid,
      status: "pending"
    });
  });

  test("MVP1-AUTH-T012: 대상 계정 통합 승인은 AuthIdentity를 이전하고 보조 User를 merged 처리한다", () => {
    const requester = localUser({ loginId: "requester", email: "requester@example.test" });
    const target = localUser({ loginId: "target", email: "target@example.test" });
    linkKakao(target, [requester, target]);
    const mergeResult = linkKakao(requester, [requester, target]);

    const approved = approveMergeRequest({
      requestUser: requester,
      targetUser: target,
      mergeRequest: mergeResult.mergeRequest!
    });

    expect(approved.ok).toBe(true);
    expect(requester.identities).toHaveLength(1);
    expect(target.identities).toHaveLength(0);
    expect(target.status).toBe("merged");
    expect(target.mergedIntoUserUuid).toBe(requester.userUuid);
  });

  test("MVP1-AUTH-T013: 계정 통합 만료 시 AuthIdentity와 User 상태를 변경하지 않는다", () => {
    const requester = localUser({ loginId: "requester", email: "requester@example.test" });
    const target = localUser({ loginId: "target", email: "target@example.test" });
    linkKakao(target, [requester, target]);
    const now = new Date("2026-06-10T00:00:00.000Z");
    const mergeResult = linkOAuthIdentity({
      currentUser: requester,
      allUsers: [requester, target],
      provider: "kakao",
      providerUserId: "kakao-user-001",
      now,
      expiresInMs: 1000
    });

    const approved = approveMergeRequest({
      requestUser: requester,
      targetUser: target,
      mergeRequest: mergeResult.mergeRequest!,
      now: new Date("2026-06-10T00:00:01.000Z")
    });

    expect(approved).toEqual({ ok: false, error: AUTH_ERRORS.MERGE_REQUEST_EXPIRED });
    expect(requester.identities).toHaveLength(0);
    expect(target.identities).toHaveLength(1);
    expect(target.status).toBe("active");
  });

  test("MVP1-AUTH-T014: 이메일이 같은 두 계정은 자동 통합하지 않는다", () => {
    const requester = localUser({ loginId: "requester", email: "same@example.test" });
    const target = localUser({ loginId: "target", email: "same@example.test" });

    expect(requester.userUuid).not.toBe(target.userUuid);
    expect(requester.status).toBe("active");
    expect(target.status).toBe("active");
  });

  test("MVP1-AUTH-T015: 카카오/네이버/구글 간편로그인은 모두 해제할 수 있다", () => {
    const user = localUser();
    linkOAuthIdentity({ currentUser: user, allUsers: [user], provider: "kakao", providerUserId: "kakao-001" });
    linkOAuthIdentity({ currentUser: user, allUsers: [user], provider: "naver", providerUserId: "naver-001" });
    linkOAuthIdentity({ currentUser: user, allUsers: [user], provider: "google", providerUserId: "google-001" });

    expect(unlinkOAuthIdentity({ user, provider: "kakao" }).ok).toBe(true);
    expect(unlinkOAuthIdentity({ user, provider: "naver" }).ok).toBe(true);
    expect(unlinkOAuthIdentity({ user, provider: "google" }).ok).toBe(true);
    expect(user.identities).toHaveLength(0);
  });

  test("MVP1-AUTH-T016: OAuth 로그인 실패 결과에는 토큰이나 Authorization Code를 담지 않는다", () => {
    const result = findOAuthLogin([], "kakao", "unknown-user");

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS });
    expect(JSON.stringify(result)).not.toMatch(/token|code|secret/i);
  });

  test("MVP1-AUTH-T017: 기본 ID/PW 로그인 정보 삭제 시도는 차단한다", () => {
    const user = localUser();

    const result = unlinkLocalCredential(user);

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.LOCAL_CREDENTIAL_REQUIRED });
  });

  test("MVP1-AUTH-T018: 이메일 인증 필수 설정에서는 인증 완료 이메일 삭제를 차단한다", () => {
    const user = localUser({ emailVerifiedAt: new Date("2026-06-10T00:00:00.000Z") });

    const result = deleteVerifiedEmail({
      user,
      email: "user01@example.test",
      emailVerificationRequired: true
    });

    expect(result).toEqual({ ok: false, error: AUTH_ERRORS.VERIFIED_EMAIL_REQUIRED });
    expect(user.verifiedEmails).toHaveLength(1);
  });

  test("MVP1-AUTH-T019: 이메일 변경은 새 이메일 인증 완료 후 교체한다", () => {
    const user = localUser({ emailVerifiedAt: new Date("2026-06-10T00:00:00.000Z") });

    requestEmailChange(user, "next@example.test");
    const result = confirmEmailChange(user, new Date("2026-06-10T01:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(user.primaryEmail).toBe("next@example.test");
    expect(user.verifiedEmails).toEqual([
      {
        email: "next@example.test",
        emailVerifiedAt: new Date("2026-06-10T01:00:00.000Z"),
        emailNotificationOptIn: true
      }
    ]);
  });

  test("MVP1-AUTH-T020: 간편로그인은 PDFowers 이메일 인증 없이 제공자 인증 결과로 로그인한다", () => {
    const user = createOAuthUser({
      loginId: "oauth01",
      email: "oauth01@example.test",
      password: "correct-password",
      displayName: "OAuth 01",
      provider: "google",
      providerUserId: "google-user-001",
      emailFromProvider: "google001@example.test"
    });

    const result = findOAuthLogin([user], "google", "google-user-001");

    expect(user.verifiedEmails[0].emailVerifiedAt).toBeNull();
    expect(result).toMatchObject({ ok: true, userUuid: user.userUuid });
  });

  test("계정 통합 취소와 중복 승인은 각각 상태 오류로 막는다", () => {
    const requester = localUser({ loginId: "requester", email: "requester@example.test" });
    const target = localUser({ loginId: "target", email: "target@example.test" });
    linkKakao(target, [requester, target]);
    const mergeResult = linkKakao(requester, [requester, target]);
    const mergeRequest = mergeResult.mergeRequest!;

    expect(cancelMergeRequest({ user: requester, mergeRequest }).ok).toBe(true);
    expect(approveMergeRequest({ requestUser: requester, targetUser: target, mergeRequest })).toEqual({
      ok: false,
      error: AUTH_ERRORS.MERGE_REQUEST_CANCELLED
    });
  });

  test("AuditLog는 로그인, 연결, 해제, 병합 승인 이벤트를 기록한다", () => {
    const requester = localUser({ loginId: "requester", email: "requester@example.test" });
    const target = localUser({ loginId: "target", email: "target@example.test" });
    verifyLocalLogin(requester, "correct-password");
    linkOAuthIdentity({ currentUser: requester, allUsers: [requester], provider: "google", providerUserId: "google-001" });
    unlinkOAuthIdentity({ user: requester, provider: "google" });
    linkKakao(target, [requester, target]);
    const mergeResult = linkKakao(requester, [requester, target]);
    approveMergeRequest({ requestUser: requester, targetUser: target, mergeRequest: mergeResult.mergeRequest! });

    expect(requester.auditLogs.map((log) => log.eventType)).toEqual(
      expect.arrayContaining([
        "LOGIN_SUCCESS",
        "AUTH_IDENTITY_LINKED",
        "AUTH_IDENTITY_UNLINKED",
        "ACCOUNT_MERGE_REQUESTED",
        "ACCOUNT_MERGE_APPROVED"
      ])
    );
  });
});
