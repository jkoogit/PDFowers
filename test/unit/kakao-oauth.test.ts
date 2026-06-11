import { describe, expect, test, vi } from "vitest";
import {
  buildKakaoAuthorizeUrl,
  createKakaoOAuthClient,
  normalizeKakaoProfile,
  type KakaoOAuthConfig
} from "../../src/review/kakao-oauth.js";

const config: KakaoOAuthConfig = {
  restApiKey: "test-rest-api-key",
  redirectUri: "http://localhost:4173/auth/kakao/callback",
  clientSecret: "test-client-secret",
  scope: "account_email,profile_nickname"
};

describe("Kakao OAuth client", () => {
  test("카카오 인가 URL을 REST API 키, redirect URI, state로 생성한다", () => {
    const url = buildKakaoAuthorizeUrl(config, "csrf-state");

    expect(url.origin).toBe("https://kauth.kakao.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-rest-api-key");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4173/auth/kakao/callback");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("scope")).toBe("account_email,profile_nickname");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  test("인가 코드를 토큰으로 교환하고 사용자 정보를 조회한다", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", token_type: "bearer" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 12345,
            kakao_account: { email: "kakao-user@example.test" },
            properties: { nickname: "카카오 사용자" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    const client = createKakaoOAuthClient(config, fetchMock);

    const token = await client.exchangeCode("authorization-code");
    const profile = await client.fetchUserProfile(token.accessToken);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(tokenBody).toBeInstanceOf(URLSearchParams);
    expect((tokenBody as URLSearchParams).get("grant_type")).toBe("authorization_code");
    expect((tokenBody as URLSearchParams).get("client_id")).toBe("test-rest-api-key");
    expect((tokenBody as URLSearchParams).get("client_secret")).toBe("test-client-secret");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer access-token"
    });
    expect(profile).toEqual({
      provider: "kakao",
      providerUserId: "12345",
      emailFromProvider: "kakao-user@example.test",
      displayName: "카카오 사용자"
    });
  });

  test("카카오 프로필에 닉네임이 없으면 기본 표시명을 사용한다", () => {
    expect(normalizeKakaoProfile({ id: 999 })).toEqual({
      provider: "kakao",
      providerUserId: "999",
      emailFromProvider: undefined,
      displayName: "Kakao 999"
    });
  });
});
