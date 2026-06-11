import { describe, expect, test, vi } from "vitest";
import { createReviewRequestHandler } from "../../src/review/mvp1-review-server.js";
import type { KakaoAuthProfile, KakaoOAuthClient } from "../../src/review/kakao-oauth.js";

function createKakaoClient(): KakaoOAuthClient {
  return {
    buildAuthorizeUrl: vi.fn((state: string) => {
      const url = new URL("https://kauth.kakao.com/oauth/authorize");
      url.searchParams.set("state", state);
      return url;
    }),
    exchangeCode: vi.fn(async () => ({ accessToken: "access-token" })),
    fetchUserProfile: vi.fn(async (): Promise<KakaoAuthProfile> => ({
      provider: "kakao",
      providerUserId: "kakao-actual-user",
      emailFromProvider: "kakao-actual@example.test",
      displayName: "실제 카카오"
    }))
  };
}

describe("MVP1 review Kakao OAuth endpoints", () => {
  test("카카오 설정이 없으면 설정 상태 API와 시작 API가 누락 항목을 반환한다", async () => {
    const handler = createReviewRequestHandler();

    const status = await handler(new Request("http://localhost/auth/kakao/config-status"));
    const start = await handler(new Request("http://localhost/auth/kakao/start"));

    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      enabled: false,
      missing: ["KAKAO_REST_API_KEY", "KAKAO_REDIRECT_URI"]
    });
    expect(start.status).toBe(503);
    expect(await start.json()).toMatchObject({
      ok: false,
      error: "KAKAO_OAUTH_NOT_CONFIGURED"
    });
  });

  test("카카오 시작 API는 state 쿠키를 만들고 인가 URL로 리다이렉트한다", async () => {
    const kakaoOAuth = createKakaoClient();
    const handler = createReviewRequestHandler(undefined, {
      kakaoConfig: {
        restApiKey: "rest-api-key",
        redirectUri: "http://localhost:4173/auth/kakao/callback"
      },
      kakaoOAuth
    });

    const response = await handler(new Request("http://localhost/auth/kakao/start"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(response.headers.get("set-cookie")).toContain("pdfowers_kakao_state=");
    expect(kakaoOAuth.buildAuthorizeUrl).toHaveBeenCalledOnce();
  });

  test("카카오 콜백은 state를 검증한 뒤 프로필로 회원가입과 세션 발급을 처리한다", async () => {
    const kakaoOAuth = createKakaoClient();
    const handler = createReviewRequestHandler(undefined, {
      kakaoConfig: {
        restApiKey: "rest-api-key",
        redirectUri: "http://localhost:4173/auth/kakao/callback"
      },
      kakaoOAuth
    });
    const start = await handler(new Request("http://localhost/auth/kakao/start"));
    const stateCookie = start.headers.get("set-cookie") ?? "";
    const state = /pdfowers_kakao_state=([^;]+)/.exec(stateCookie)?.[1];

    const response = await handler(
      new Request(`http://localhost/auth/kakao/callback?code=authorization-code&state=${state}`, {
        headers: { cookie: stateCookie }
      })
    );
    const body = (await response.json()) as { ok: boolean; user: { loginId: string }; state: { users: unknown[] } };

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("pdfowers_review_session=");
    expect(kakaoOAuth.exchangeCode).toHaveBeenCalledWith("authorization-code");
    expect(kakaoOAuth.fetchUserProfile).toHaveBeenCalledWith("access-token");
    expect(body.ok).toBe(true);
    expect(body.user.loginId).toBe("kakao-kakao-actual-user");
    expect(body.state.users).toHaveLength(1);
  });

  test("카카오 콜백 state가 다르면 거부한다", async () => {
    const handler = createReviewRequestHandler(undefined, {
      kakaoConfig: {
        restApiKey: "rest-api-key",
        redirectUri: "http://localhost:4173/auth/kakao/callback"
      },
      kakaoOAuth: createKakaoClient()
    });

    const response = await handler(
      new Request("http://localhost/auth/kakao/callback?code=authorization-code&state=wrong", {
        headers: { cookie: "pdfowers_kakao_state=right" }
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "KAKAO_OAUTH_STATE_MISMATCH"
    });
  });
});
