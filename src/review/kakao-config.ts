import type { KakaoOAuthConfig } from "./kakao-oauth.js";

const DEFAULT_KAKAO_REDIRECT_PATH = "/auth/kakao/callback";

type Env = Record<string, string | undefined>;

export function createKakaoConfigFromEnv(env: Env = process.env): KakaoOAuthConfig | undefined {
  if (!env.KAKAO_REST_API_KEY) {
    return undefined;
  }

  const redirectUri = resolveKakaoRedirectUri(env);
  if (!redirectUri) {
    return undefined;
  }

  return {
    restApiKey: env.KAKAO_REST_API_KEY,
    redirectUri,
    clientSecret: env.KAKAO_CLIENT_SECRET,
    scope: env.KAKAO_SCOPE
  };
}

function resolveKakaoRedirectUri(env: Env) {
  if (env.KAKAO_REDIRECT_URI) {
    return env.KAKAO_REDIRECT_URI;
  }

  const appBaseUrl = env.APP_BASE_URL ?? env.APP_DOMAIN;
  if (!appBaseUrl) {
    return undefined;
  }

  const origin = normalizeOrigin(appBaseUrl);
  const redirectPath = env.KAKAO_REDIRECT_PATH ?? DEFAULT_KAKAO_REDIRECT_PATH;
  return new URL(redirectPath, origin).toString();
}

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}
