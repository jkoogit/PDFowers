export interface KakaoOAuthConfig {
  restApiKey: string;
  redirectUri: string;
  clientSecret?: string;
  scope?: string;
}

export interface KakaoToken {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
}

export interface KakaoAuthProfile {
  provider: "kakao";
  providerUserId: string;
  emailFromProvider?: string;
  displayName: string;
}

export interface KakaoOAuthClient {
  buildAuthorizeUrl(state: string): URL;
  exchangeCode(code: string): Promise<KakaoToken>;
  fetchUserProfile(accessToken: string): Promise<KakaoAuthProfile>;
}

interface KakaoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface KakaoUserResponse {
  id?: number | string;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
  properties?: {
    nickname?: string;
  };
}

export function buildKakaoAuthorizeUrl(config: KakaoOAuthConfig, state: string): URL {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.restApiKey);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  if (config.scope) {
    url.searchParams.set("scope", config.scope);
  }
  return url;
}

export function createKakaoOAuthClient(
  config: KakaoOAuthConfig,
  fetchImpl: typeof fetch = fetch
): KakaoOAuthClient {
  return {
    buildAuthorizeUrl: (state) => buildKakaoAuthorizeUrl(config, state),
    exchangeCode: async (code) => exchangeKakaoCode(config, code, fetchImpl),
    fetchUserProfile: async (accessToken) => fetchKakaoUserProfile(accessToken, fetchImpl)
  };
}

export async function exchangeKakaoCode(
  config: KakaoOAuthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<KakaoToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    code
  });
  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const response = await fetchImpl("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body
  });
  const payload = (await response.json()) as KakaoTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "KAKAO_TOKEN_EXCHANGE_FAILED");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scope: payload.scope,
    tokenType: payload.token_type
  };
}

export async function fetchKakaoUserProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<KakaoAuthProfile> {
  const response = await fetchImpl("https://kapi.kakao.com/v2/user/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await response.json()) as KakaoUserResponse;
  if (!response.ok || payload.id === undefined || payload.id === null) {
    throw new Error("KAKAO_USER_PROFILE_FAILED");
  }

  return normalizeKakaoProfile(payload);
}

export function normalizeKakaoProfile(profile: KakaoUserResponse): KakaoAuthProfile {
  const providerUserId = String(profile.id);
  return {
    provider: "kakao",
    providerUserId,
    emailFromProvider: profile.kakao_account?.email,
    displayName:
      profile.kakao_account?.profile?.nickname ??
      profile.properties?.nickname ??
      `Kakao ${providerUserId}`
  };
}
