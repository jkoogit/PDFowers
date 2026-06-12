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

  test("실제형 회원가입 API는 사용자를 만들고 session cookie를 반환한다", async () => {
    const handler = createReviewRequestHandler();

    const response = await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: "api-user",
          email: "api-user@example.test",
          password: "correct-password",
          displayName: "API 사용자",
          emailVerified: true
        })
      })
    );
    const body = (await response.json()) as {
      ok: boolean;
      user: { loginId: string; primaryEmail: string };
      state: { users: unknown[]; currentUserUuid?: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("pdfowers_review_session=");
    expect(body.ok).toBe(true);
    expect(body.user).toMatchObject({
      loginId: "api-user",
      primaryEmail: "api-user@example.test"
    });
    expect(body.state.users).toHaveLength(1);
    expect(body.state.currentUserUuid).toBeTruthy();
  });

  test("실제형 로그인 API는 기존 사용자의 비밀번호를 검증하고 session을 갱신한다", async () => {
    const handler = createReviewRequestHandler();
    await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: "login-api-user",
          email: "login-api-user@example.test",
          password: "correct-password",
          displayName: "로그인 사용자",
          emailVerified: true
        })
      })
    );

    const response = await handler(
      new Request("http://localhost/auth/login/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: "login-api-user",
          password: "correct-password",
          emailVerificationRequired: true
        })
      })
    );
    const body = (await response.json()) as { ok: boolean; user: { loginId: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("pdfowers_review_session=");
    expect(body).toMatchObject({ ok: true, user: { loginId: "login-api-user" } });
  });

  test("session API는 cookie의 현재 사용자를 반환한다", async () => {
    const handler = createReviewRequestHandler();
    const signup = await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: "session-api-user",
          email: "session-api-user@example.test",
          password: "correct-password",
          displayName: "세션 사용자",
          emailVerified: true
        })
      })
    );
    const cookie = signup.headers.get("set-cookie") ?? "";

    const response = await handler(
      new Request("http://localhost/auth/session", {
        headers: { cookie }
      })
    );
    const body = (await response.json()) as { authenticated: boolean; user: { loginId: string } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      authenticated: true,
      user: { loginId: "session-api-user" }
    });
  });

  test("mock OAuth callback API는 신규 provider 사용자를 만들고 기존 provider 로그인을 처리한다", async () => {
    const handler = createReviewRequestHandler();

    const signup = await handler(
      new Request("http://localhost/auth/oauth/kakao/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerUserId: "api-kakao-user",
          emailFromProvider: "api-kakao@example.test",
          loginId: "api-kakao-owner",
          password: "correct-password",
          displayName: "카카오 사용자"
        })
      })
    );
    const login = await handler(
      new Request("http://localhost/auth/oauth/kakao/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerUserId: "api-kakao-user" })
      })
    );
    const body = (await login.json()) as { ok: boolean; user: { loginId: string } };

    expect(signup.status).toBe(200);
    expect(login.status).toBe(200);
    expect(body).toMatchObject({ ok: true, user: { loginId: "api-kakao-owner" } });
  });

  test("identity 연결 API는 로그인 cookie를 사용하고 충돌 시 병합 요청과 알림 이벤트를 만든다", async () => {
    const sentMessages: string[] = [];
    const handler = createReviewRequestHandler(undefined, {
      emailSender: {
        send: async (message) => {
          sentMessages.push(message.to);
        }
      }
    });
    const requesterSignup = await handler(
      new Request("http://localhost/auth/signup/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loginId: "merge-requester",
          email: "merge-requester@example.test",
          password: "correct-password",
          displayName: "병합 요청자",
          emailVerified: true
        })
      })
    );
    const requesterCookie = requesterSignup.headers.get("set-cookie") ?? "";
    await handler(
      new Request("http://localhost/auth/oauth/google/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerUserId: "merge-google-user",
          loginId: "merge-target",
          emailFromProvider: "merge-target@example.test",
          password: "correct-password",
          displayName: "병합 대상"
        })
      })
    );

    const conflict = await handler(
      new Request("http://localhost/auth/identities/google", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: requesterCookie },
        body: JSON.stringify({ providerUserId: "merge-google-user" })
      })
    );
    const conflictBody = (await conflict.json()) as {
      ok: boolean;
      error: string;
      mergeRequest: { mergeRequestUuid: string };
      state: {
        mergeRequests: unknown[];
        notifications: Array<{
          eventType: string;
          channel: string;
          status: string;
        }>;
      };
    };

    expect(conflict.status).toBe(409);
    expect(conflictBody.error).toBe("ACCOUNT_MERGE_REQUIRED");
    expect(conflictBody.mergeRequest.mergeRequestUuid).toBeTruthy();
    expect(conflictBody.state.mergeRequests).toHaveLength(1);
    expect(conflictBody.state.notifications).toHaveLength(2);
    expect(conflictBody.state.notifications[0]).toMatchObject({
      eventType: "ACCOUNT_MERGE_REQUESTED",
      channel: "sample",
      status: "recorded"
    });

    const approve = await handler(
      new Request(`http://localhost/auth/merge-requests/${conflictBody.mergeRequest.mergeRequestUuid}/approve`, {
        method: "POST",
        headers: { cookie: requesterCookie }
      })
    );
    const approveBody = (await approve.json()) as {
      ok: boolean;
      state: {
        users: Array<{ status: string }>;
        notifications: Array<{ eventType: string; channel: string; status: string }>;
      };
    };

    expect(approve.status).toBe(200);
    expect(approveBody.ok).toBe(true);
    expect(approveBody.state.users.some((user) => user.status === "merged")).toBe(true);
    expect(approveBody.state.notifications).toHaveLength(6);
    expect(approveBody.state.notifications.filter((event) => event.eventType === "ACCOUNT_MERGE_APPROVED")).toHaveLength(4);
    expect(sentMessages).toEqual([
      "merge-target@example.test",
      "merge-requester@example.test",
      "merge-target@example.test"
    ]);
  });
});
