import { describe, expect, test } from "vitest";
import { createKakaoConfigFromEnv } from "../../src/review/kakao-config.js";

describe("Kakao config env", () => {
  test("APP_BASE_URL과 기본 callback path로 redirect URI를 만든다", () => {
    const config = createKakaoConfigFromEnv({
      KAKAO_REST_API_KEY: "rest-api-key",
      APP_BASE_URL: "https://jkok2.myqnapcloud.com"
    });

    expect(config).toMatchObject({
      restApiKey: "rest-api-key",
      redirectUri: "https://jkok2.myqnapcloud.com/auth/kakao/callback"
    });
  });

  test("KAKAO_REDIRECT_PATH로 callback path를 환경별로 바꿀 수 있다", () => {
    const config = createKakaoConfigFromEnv({
      KAKAO_REST_API_KEY: "rest-api-key",
      APP_BASE_URL: "https://example.test/base/",
      KAKAO_REDIRECT_PATH: "/oauth/kakao/callback"
    });

    expect(config?.redirectUri).toBe("https://example.test/oauth/kakao/callback");
  });

  test("기존 KAKAO_REDIRECT_URI가 있으면 명시값을 우선한다", () => {
    const config = createKakaoConfigFromEnv({
      KAKAO_REST_API_KEY: "rest-api-key",
      APP_BASE_URL: "https://ignored.example.test",
      KAKAO_REDIRECT_URI: "https://explicit.example.test/auth/kakao/callback"
    });

    expect(config?.redirectUri).toBe("https://explicit.example.test/auth/kakao/callback");
  });

  test("REST API 키 또는 기준 URL이 없으면 설정을 만들지 않는다", () => {
    expect(createKakaoConfigFromEnv({ APP_BASE_URL: "https://example.test" })).toBeUndefined();
    expect(createKakaoConfigFromEnv({ KAKAO_REST_API_KEY: "rest-api-key" })).toBeUndefined();
  });
});
