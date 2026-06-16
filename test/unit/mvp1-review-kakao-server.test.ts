import { describe, expect, test, vi } from "vitest";
import { createReviewRequestHandler } from "../../src/review/mvp1-review-server.js";
import type { KakaoAuthProfile, KakaoOAuthClient } from "../../src/review/kakao-oauth.js";

function createKakaoClient(redirectUri?: string): KakaoOAuthClient {
  return {
    buildAuthorizeUrl: vi.fn((state: string) => {
      const url = new URL("https://kauth.kakao.com/oauth/authorize");
      url.searchParams.set("state", state);
      if (redirectUri) {
        url.searchParams.set("redirect_uri", redirectUri);
      }
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
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("pdfowers_review_session=");
    expect(response.headers.get("set-cookie")).toContain("pdfowers_kakao_state=;");
    expect(response.headers.get("location")).toBe("/?kakao=success");
    expect(kakaoOAuth.exchangeCode).toHaveBeenCalledWith("authorization-code");
    expect(kakaoOAuth.fetchUserProfile).toHaveBeenCalledWith("access-token");
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

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?kakao_error=KAKAO_OAUTH_STATE_MISMATCH");
    expect(response.headers.get("set-cookie")).toContain("pdfowers_kakao_state=;");
  });

  test("dev request-host 정책은 IP 접속 origin으로 authorize와 token redirect URI를 맞춘다", async () => {
    const clients: KakaoOAuthClient[] = [];
    const handler = createReviewRequestHandler(undefined, {
      kakaoConfig: {
        restApiKey: "rest-api-key",
        redirectUri: "https://jkok2.myqnapcloud.com:4443/auth/kakao/callback"
      },
      kakaoOAuthFactory: (config) => {
        const client = createKakaoClient(config.redirectUri);
        clients.push(client);
        return client;
      },
      kakaoRedirectPolicy: {
        mode: "request-host",
        allowedOrigins: ["http://192.168.219.112:4173", "https://jkok2.myqnapcloud.com:4443"]
      }
    });

    const start = await handler(
      new Request("http://192.168.219.112:4173/auth/kakao/start", {
        headers: { host: "192.168.219.112:4173" }
      })
    );
    const stateCookie = start.headers.get("set-cookie") ?? "";
    const state = /pdfowers_kakao_state=([^;]+)/.exec(stateCookie)?.[1];
    const location = new URL(start.headers.get("location") ?? "");

    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://192.168.219.112:4173/auth/kakao/callback"
    );

    const response = await handler(
      new Request(`http://192.168.219.112:4173/auth/kakao/callback?code=authorization-code&state=${state}`, {
        headers: {
          cookie: stateCookie,
          host: "192.168.219.112:4173"
        }
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?kakao=success");
    expect(clients[0]?.exchangeCode).toHaveBeenCalledWith("authorization-code");
    expect(clients[0]?.buildAuthorizeUrl).toHaveBeenCalledWith(state);
  });

  test("카카오 callback 실패는 오류 코드와 함께 검수화면으로 복귀한다", async () => {
    const kakaoOAuth = createKakaoClient();
    vi.mocked(kakaoOAuth.exchangeCode).mockRejectedValueOnce(new Error("KAKAO_TOKEN_EXCHANGE_FAILED"));
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

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?kakao_error=KAKAO_OAUTH_CALLBACK_FAILED");
    expect(response.headers.get("set-cookie")).toContain("pdfowers_kakao_state=;");
  });
});
