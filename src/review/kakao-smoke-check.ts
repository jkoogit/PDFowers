import { pathToFileURL } from "node:url";

export interface KakaoDeploymentSmokeCheck {
  name: "config-status" | "kakao-start-redirect";
  ok: boolean;
  message?: string;
}

export interface KakaoDeploymentSmokeResult {
  ok: boolean;
  baseUrl: string;
  redirectUri: string | null;
  checks: KakaoDeploymentSmokeCheck[];
}

interface KakaoConfigStatus {
  enabled?: boolean;
  missing?: string[];
  redirectUri?: string | null;
}

export async function checkKakaoDeployment(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<KakaoDeploymentSmokeResult> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const checks: KakaoDeploymentSmokeCheck[] = [];

  const statusResponse = await fetchSafely(
    () => fetchImpl(`${normalizedBaseUrl}/auth/kakao/config-status`),
    normalizedBaseUrl
  );
  if (!statusResponse.ok) {
    return statusResponse.result;
  }

  return checkKakaoStatusResponse(normalizedBaseUrl, statusResponse.response, fetchImpl);
}

async function checkKakaoStatusResponse(
  normalizedBaseUrl: string,
  statusResponse: Response,
  fetchImpl: typeof fetch
): Promise<KakaoDeploymentSmokeResult> {
  const checks: KakaoDeploymentSmokeCheck[] = [];
  if (!statusResponse.ok) {
    return {
      ok: false,
      baseUrl: normalizedBaseUrl,
      redirectUri: null,
      checks: [
        {
          name: "config-status",
          ok: false,
          message: `config-status HTTP ${statusResponse.status}`
        }
      ]
    };
  }

  const status = (await statusResponse.json()) as KakaoConfigStatus;
  if (!status.enabled) {
    const missing = status.missing?.length ? status.missing.join(", ") : "Kakao OAuth client";
    return {
      ok: false,
      baseUrl: normalizedBaseUrl,
      redirectUri: status.redirectUri ?? null,
      checks: [
        {
          name: "config-status",
          ok: false,
          message: `Kakao OAuth disabled: ${missing}`
        }
      ]
    };
  }
  checks.push({ name: "config-status", ok: true });

  const startResponse = await fetchSafely(
    () => fetchImpl(`${normalizedBaseUrl}/auth/kakao/start`, { redirect: "manual" }),
    normalizedBaseUrl,
    status.redirectUri ?? null,
    checks
  );
  if (!startResponse.ok) {
    return startResponse.result;
  }
  const location = startResponse.response.headers.get("location");
  const redirectOk =
    startResponse.response.status >= 300 &&
    startResponse.response.status < 400 &&
    Boolean(location?.startsWith("https://kauth.kakao.com/oauth/authorize"));
  checks.push({
    name: "kakao-start-redirect",
    ok: redirectOk,
    ...(redirectOk ? {} : { message: `unexpected redirect: HTTP ${startResponse.response.status}` })
  });

  return {
    ok: checks.every((check) => check.ok),
    baseUrl: normalizedBaseUrl,
    redirectUri: status.redirectUri ?? null,
    checks
  };
}

type FetchResult =
  | { ok: true; response: Response }
  | { ok: false; result: KakaoDeploymentSmokeResult };

async function fetchSafely(
  work: () => Promise<Response>,
  baseUrl: string,
  redirectUri: string | null = null,
  previousChecks: KakaoDeploymentSmokeCheck[] = []
): Promise<FetchResult> {
  try {
    return { ok: true, response: await work() };
  } catch (error) {
    return {
      ok: false,
      result: {
        ok: false,
        baseUrl,
        redirectUri,
        checks: [
          ...previousChecks,
          {
            name: previousChecks.length === 0 ? "config-status" : "kakao-start-redirect",
            ok: false,
            message: `network error: ${error instanceof Error ? error.message : "unknown"}`
          }
        ]
      }
    };
  }
}

function normalizeBaseUrl(value: string) {
  return new URL(value).origin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseUrl = getArgValue("--base-url") ?? process.env.APP_BASE_URL;
  if (!baseUrl) {
    console.error("APP_BASE_URL 또는 --base-url 값이 필요합니다.");
    process.exitCode = 1;
  } else {
    const result = await checkKakaoDeployment(baseUrl);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  }
}

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
