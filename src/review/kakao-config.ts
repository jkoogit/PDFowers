import type { KakaoOAuthConfig } from "./kakao-oauth.js";

const DEFAULT_KAKAO_REDIRECT_PATH = "/auth/kakao/callback";

type Env = Record<string, string | undefined>;

export interface KakaoRedirectPolicy {
  mode: "fixed" | "request-host";
  allowedOrigins: string[];
}

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

export function createKakaoRedirectPolicyFromEnv(env: Env = process.env): KakaoRedirectPolicy {
  if (env.APP_ENV !== "dev") {
    return { mode: "fixed", allowedOrigins: [] };
  }

  const allowedOrigins = (env.KAKAO_ALLOWED_REDIRECT_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  return allowedOrigins.length > 0
    ? { mode: "request-host", allowedOrigins }
    : { mode: "fixed", allowedOrigins: [] };
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
