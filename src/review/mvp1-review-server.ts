import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  approveMergeRequest,
  createLocalUser,
  createOAuthUser,
  findOAuthLogin,
  linkOAuthIdentity,
  unlinkOAuthIdentity,
  verifyLocalLogin,
  type AuthProvider,
  type AuthUser
} from "../domains/auth/auth-domain.js";
import {
  createInitialReviewState,
  runReviewScenario,
  type ReviewScenarioId,
  type ReviewState
} from "./mvp1-review-scenarios.js";
import { createMergeRequestReviewItems } from "./mvp1-review-merge-ux.js";
import {
  createAccountMergeApprovedNotifications,
  createAccountMergeRequestedNotifications,
  type EmailSender
} from "./review-notifications.js";
import { createKakaoOAuthClient } from "./kakao-oauth.js";
import type {
  KakaoAuthProfile,
  KakaoOAuthClient,
  KakaoOAuthConfig
} from "./kakao-oauth.js";
import type { KakaoRedirectPolicy } from "./kakao-config.js";

type ReviewRequestHandler = (request: Request) => Promise<Response>;

export interface ReviewPersistence {
  initialize(state: ReviewState): Promise<ReviewState>;
  persist(state: ReviewState): Promise<ReviewState>;
  summarize(state: ReviewState): Promise<ReviewState>;
}

interface ReviewHandlerOptions {
  persistence?: ReviewPersistence;
  kakaoConfig?: Partial<KakaoOAuthConfig>;
  kakaoOAuth?: KakaoOAuthClient;
  kakaoOAuthFactory?: (config: KakaoOAuthConfig) => KakaoOAuthClient;
  kakaoRedirectPolicy?: KakaoRedirectPolicy;
  emailSender?: EmailSender;
}

const DEFAULT_PORT = 4173;
const compiledPublicDir = fileURLToPath(new URL("./public", import.meta.url));
const sourcePublicDir = join(process.cwd(), "src", "review", "public");
const PUBLIC_DIR = existsSync(join(compiledPublicDir, "mvp1-review.html"))
  ? compiledPublicDir
  : sourcePublicDir;
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

export function createReviewRequestHandler(
  initialState = createInitialReviewState(),
  options: ReviewHandlerOptions = {}
): ReviewRequestHandler {
  let state: ReviewState = initialState;
  let initialized = false;
  const sessions = new Map<string, string>();
  const kakaoStates = new Map<string, KakaoOAuthClient>();
  const emailSender = options.emailSender ?? createMissingEmailSender();

  async function ensureInitialized() {
    if (!initialized) {
      initialized = true;
      state = options.persistence ? await options.persistence.initialize(state) : state;
    }
  }

  return async (request: Request) => {
    await ensureInitialized();
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/review/state") {
      state = options.persistence ? await options.persistence.summarize(state) : state;
      return jsonResponse(publicReviewState(state));
    }

    if (request.method === "POST" && url.pathname === "/api/review/reset") {
      state = createInitialReviewState();
      initialized = false;
      await ensureInitialized();
      return jsonResponse({ ok: true, state: publicReviewState(state) });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/review/scenarios/")) {
      const scenarioId = url.pathname.split("/").at(-1) as ReviewScenarioId;
      try {
        const result = runReviewScenario(state, scenarioId);
        state = options.persistence ? await options.persistence.persist(result.state) : result.state;
        return jsonResponse({ ...result, state: publicReviewState(state) });
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: "REVIEW_SCENARIO_FAILED",
            message: error instanceof Error ? error.message : "검수 시나리오 실행에 실패했습니다.",
            state
          },
          400
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/auth/signup/local") {
      const payload = await readJsonBody<{
        loginId?: string;
        email?: string;
        password?: string;
        displayName?: string;
        emailVerified?: boolean;
      }>(request);
      if (!payload.loginId || !payload.email || !payload.password || !payload.displayName) {
        return jsonResponse({ ok: false, error: "INVALID_SIGNUP_REQUEST" }, 400);
      }
      if (state.users.some((user) => user.loginId === payload.loginId)) {
        return jsonResponse({ ok: false, error: "LOGIN_ID_ALREADY_EXISTS" }, 409);
      }

      const user = createLocalUser({
        loginId: payload.loginId,
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
        emailVerifiedAt: payload.emailVerified ? new Date() : null
      });
      state = {
        ...state,
        users: [...state.users, user],
        currentUserUuid: user.userUuid,
        testCases: markPassed(state, "MVP1-AUTH-T001")
      };
      const sessionId = createSession(sessions, user.userUuid);
      state = options.persistence ? await options.persistence.persist(state) : state;
      return jsonResponse(
        {
          ok: true,
          user: publicUser(user),
          state: publicReviewState(state)
        },
        200,
        { "set-cookie": sessionCookie(sessionId) }
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/login/local") {
      const payload = await readJsonBody<{
        loginId?: string;
        password?: string;
        emailVerificationRequired?: boolean;
      }>(request);
      const user = state.users.find((candidate) => candidate.loginId === payload.loginId);
      if (!user || !payload.password) {
        return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
      }

      const result = verifyLocalLogin(user, payload.password, {
        emailVerificationRequired: payload.emailVerificationRequired
      });
      if (!result.ok) {
        state = options.persistence ? await options.persistence.persist(state) : state;
        return jsonResponse({ ok: false, error: result.error, state: publicReviewState(state) }, 401);
      }

      state = {
        ...state,
        currentUserUuid: user.userUuid,
        testCases: markPassed(state, "MVP1-AUTH-T004", "MVP1-AUTH-T005")
      };
      const sessionId = createSession(sessions, user.userUuid);
      state = options.persistence ? await options.persistence.persist(state) : state;
      return jsonResponse(
        {
          ok: true,
          user: publicUser(user),
          state
        },
        200,
        { "set-cookie": sessionCookie(sessionId) }
      );
    }

    if (request.method === "GET" && url.pathname === "/auth/session") {
      const user = currentSessionUser(request, sessions, state);
      return jsonResponse({
        authenticated: Boolean(user),
        user: user ? publicUser(user) : null,
        state: publicReviewState(state)
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/config-status") {
      const status = kakaoConfigStatus(options);
      return jsonResponse(status);
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/start") {
      const status = kakaoConfigStatus(options);
      const kakaoOAuth = createKakaoOAuthForRequest(request, options);
      if (!status.enabled || !kakaoOAuth) {
        return jsonResponse(
          { ok: false, error: "KAKAO_OAUTH_NOT_CONFIGURED", ...status },
          503
        );
      }

      const oauthState = randomUUID();
      kakaoStates.set(oauthState, kakaoOAuth);
      const authorizeUrl = kakaoOAuth.buildAuthorizeUrl(oauthState);
      return new Response(null, {
        status: 302,
        headers: {
          location: authorizeUrl.toString(),
          "set-cookie": kakaoStateCookie(oauthState)
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      const status = kakaoConfigStatus(options);
      if (!status.enabled) {
        return jsonResponse({ ok: false, error: "KAKAO_OAUTH_NOT_CONFIGURED" }, 503);
      }
      const code = url.searchParams.get("code");
      const oauthState = url.searchParams.get("state");
      const storedState = parseCookie(request.headers.get("cookie") ?? "")["pdfowers_kakao_state"];
      if (!code) {
        return redirectToReviewWithKakaoError("KAKAO_OAUTH_CODE_REQUIRED");
      }
      const kakaoOAuth = oauthState ? kakaoStates.get(oauthState) : undefined;
      if (!oauthState || !storedState || oauthState !== storedState || !kakaoOAuth) {
        return redirectToReviewWithKakaoError("KAKAO_OAUTH_STATE_MISMATCH");
      }
      kakaoStates.delete(oauthState);

      try {
        const token = await kakaoOAuth.exchangeCode(code);
        const profile = await kakaoOAuth.fetchUserProfile(token.accessToken);
        const result = await signInWithKakaoProfile(profile, state, sessions, options.persistence);
        state = result.state;
        const headers = new Headers({
          location: "/?kakao=success"
        });
        headers.append("set-cookie", sessionCookie(result.sessionId));
        headers.append("set-cookie", clearKakaoStateCookie());
        return new Response(null, { status: 303, headers });
      } catch (error) {
        return redirectToReviewWithKakaoError("KAKAO_OAUTH_CALLBACK_FAILED");
      }
    }

    if (request.method === "POST" && /^\/auth\/oauth\/[^/]+\/callback$/.test(url.pathname)) {
      const provider = url.pathname.split("/")[3];
      if (!isAuthProvider(provider)) {
        return jsonResponse({ ok: false, error: "UNSUPPORTED_AUTH_PROVIDER" }, 400);
      }

      const payload = await readJsonBody<{
        providerUserId?: string;
        emailFromProvider?: string;
        loginId?: string;
        password?: string;
        displayName?: string;
      }>(request);
      if (!payload.providerUserId) {
        return jsonResponse({ ok: false, error: "INVALID_OAUTH_CALLBACK_REQUEST" }, 400);
      }

      const loginResult = findOAuthLogin(state.users, provider, payload.providerUserId);
      if (loginResult.ok) {
        const user = state.users.find((candidate) => candidate.userUuid === loginResult.userUuid)!;
        const sessionId = createSession(sessions, user.userUuid);
        state = {
          ...state,
          currentUserUuid: user.userUuid,
          testCases: markPassed(state, "MVP1-AUTH-T007", "MVP1-AUTH-T020")
        };
        state = options.persistence ? await options.persistence.persist(state) : state;
        return jsonResponse({ ok: true, user: publicUser(user), state: publicReviewState(state) }, 200, {
          "set-cookie": sessionCookie(sessionId)
        });
      }

      if (!payload.loginId || !payload.password || !payload.displayName) {
        return jsonResponse({ ok: false, error: "OAUTH_SIGNUP_REQUIRED" }, 404);
      }

      const user = createOAuthUser({
        loginId: payload.loginId,
        email: payload.emailFromProvider ?? `${payload.loginId}@example.test`,
        password: payload.password,
        displayName: payload.displayName,
        provider,
        providerUserId: payload.providerUserId,
        emailFromProvider: payload.emailFromProvider
      });
      state = {
        ...state,
        users: [...state.users, user],
        currentUserUuid: user.userUuid,
        testCases: markPassed(state, "MVP1-AUTH-T006")
      };
      const sessionId = createSession(sessions, user.userUuid);
      state = options.persistence ? await options.persistence.persist(state) : state;
      return jsonResponse({ ok: true, user: publicUser(user), state: publicReviewState(state) }, 200, {
        "set-cookie": sessionCookie(sessionId)
      });
    }

    if (
      (request.method === "POST" || request.method === "DELETE") &&
      /^\/auth\/identities\/[^/]+$/.test(url.pathname)
    ) {
      const provider = url.pathname.split("/")[3];
      if (!isAuthProvider(provider)) {
        return jsonResponse({ ok: false, error: "UNSUPPORTED_AUTH_PROVIDER" }, 400);
      }
      const currentUser = currentSessionUser(request, sessions, state);
      if (!currentUser) {
        return jsonResponse({ ok: false, error: "AUTHENTICATION_REQUIRED" }, 401);
      }

      if (request.method === "DELETE") {
        const result = unlinkOAuthIdentity({ user: currentUser, provider });
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error, state: publicReviewState(state) }, 409);
        }
        state = {
          ...state,
          testCases: markPassed(state, "MVP1-AUTH-T015")
        };
        state = options.persistence ? await options.persistence.persist(state) : state;
        return jsonResponse({ ok: true, user: publicUser(currentUser), state: publicReviewState(state) });
      }

      const payload = await readJsonBody<{
        providerUserId?: string;
        emailFromProvider?: string;
      }>(request);
      if (!payload.providerUserId) {
        return jsonResponse({ ok: false, error: "INVALID_IDENTITY_LINK_REQUEST" }, 400);
      }

      const result = linkOAuthIdentity({
        currentUser,
        allUsers: state.users,
        provider,
        providerUserId: payload.providerUserId,
        emailFromProvider: payload.emailFromProvider
      });
      if (result.ok) {
        state = {
          ...state,
          testCases: markPassed(state, "MVP1-AUTH-T009")
        };
        state = options.persistence ? await options.persistence.persist(state) : state;
        return jsonResponse({ ok: true, user: publicUser(currentUser), state: publicReviewState(state) });
      }

      if (result.mergeRequest) {
        const targetUser = state.users.find((user) => user.userUuid === result.mergeRequest!.targetUserUuid);
        const notifications = targetUser
          ? await createAccountMergeRequestedNotifications({
              mergeRequest: result.mergeRequest,
              requestUser: currentUser,
              targetUser,
              sender: emailSender
            })
          : [];
        state = {
          ...state,
          mergeRequests: [...state.mergeRequests, result.mergeRequest],
          notifications: [...state.notifications, ...notifications],
          testCases: markPassed(state, "MVP1-AUTH-T011", "MVP1-AUTH-T014")
        };
        state = options.persistence ? await options.persistence.persist(state) : state;
        return jsonResponse(
          { ok: false, error: result.error, mergeRequest: result.mergeRequest, state: publicReviewState(state) },
          409
        );
      }

      return jsonResponse({ ok: false, error: result.error, state: publicReviewState(state) }, 409);
    }

    if (request.method === "POST" && /^\/auth\/merge-requests\/[^/]+\/approve$/.test(url.pathname)) {
      const currentUser = currentSessionUser(request, sessions, state);
      if (!currentUser) {
        return jsonResponse({ ok: false, error: "AUTHENTICATION_REQUIRED" }, 401);
      }
      const mergeRequestUuid = url.pathname.split("/")[3];
      const mergeRequest = state.mergeRequests.find(
        (candidate) => candidate.mergeRequestUuid === mergeRequestUuid
      );
      if (!mergeRequest) {
        return jsonResponse({ ok: false, error: "MERGE_REQUEST_NOT_FOUND" }, 404);
      }
      const requestUser = state.users.find((user) => user.userUuid === mergeRequest.requestUserUuid);
      const targetUser = state.users.find((user) => user.userUuid === mergeRequest.targetUserUuid);
      if (!requestUser || !targetUser) {
        return jsonResponse({ ok: false, error: "MERGE_USER_NOT_FOUND" }, 404);
      }
      const result = approveMergeRequest({ requestUser, targetUser, mergeRequest });
      if (!result.ok) {
        return jsonResponse({ ok: false, error: result.error, state: publicReviewState(state) }, 409);
      }
      const notifications = await createAccountMergeApprovedNotifications({
        mergeRequest,
        requestUser,
        targetUser,
        sender: emailSender
      });
      state = {
        ...state,
        currentUserUuid: requestUser.userUuid,
        notifications: [...state.notifications, ...notifications],
        testCases: markPassed(state, "MVP1-AUTH-T012")
      };
      state = options.persistence ? await options.persistence.persist(state) : state;
      return jsonResponse({ ok: true, state: publicReviewState(state) });
    }

    if (request.method === "GET") {
      return staticResponse(url.pathname);
    }

    return jsonResponse({ ok: false, error: "NOT_FOUND", message: "요청 경로를 찾을 수 없습니다." }, 404);
  };
}

export function startMvp1ReviewServer(
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  options: ReviewHandlerOptions = {}
) {
  const handler = createReviewRequestHandler(createInitialReviewState(), options);
  const server = createServer((request, response) => {
    void handleNodeRequest(handler, request, response);
  });

  server.listen(port, () => {
    console.log(`MVP1 review server: http://localhost:${port}`);
  });

  return server;
}

async function handleNodeRequest(
  handler: ReviewRequestHandler,
  request: IncomingMessage,
  response: ServerResponse
) {
  const body = await readNodeRequestBody(request);
  const webRequest = new Request(`http://localhost${request.url ?? "/"}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body
  });
  const webResponse = await handler(webRequest);
  response.writeHead(webResponse.status, responseHeaders(webResponse.headers));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

function responseHeaders(headers: Headers) {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(headers) : [];
  if (setCookies.length > 0) {
    result["set-cookie"] = setCookies;
  }
  return result;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

async function readJsonBody<T extends object>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function createSession(sessions: Map<string, string>, userUuid: string) {
  const sessionId = randomUUID();
  sessions.set(sessionId, userUuid);
  return sessionId;
}

function sessionCookie(sessionId: string) {
  return `pdfowers_review_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
}

function kakaoStateCookie(state: string) {
  return `pdfowers_kakao_state=${state}; Path=/auth/kakao; HttpOnly; SameSite=Lax`;
}

function clearKakaoStateCookie() {
  return "pdfowers_kakao_state=; Path=/auth/kakao; HttpOnly; SameSite=Lax; Max-Age=0";
}

function redirectToReviewWithKakaoError(error: string) {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/?kakao_error=${encodeURIComponent(error)}`,
      "set-cookie": clearKakaoStateCookie()
    }
  });
}

function parseCookie(cookieHeader: string) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function currentSessionUser(
  request: Request,
  sessions: Map<string, string>,
  state: ReviewState
): AuthUser | undefined {
  const sessionId = parseCookie(request.headers.get("cookie") ?? "")["pdfowers_review_session"];
  const userUuid = sessionId ? sessions.get(sessionId) : undefined;
  return state.users.find((candidate) => candidate.userUuid === userUuid);
}

function isAuthProvider(provider: string | undefined): provider is AuthProvider {
  return provider === "kakao" || provider === "naver" || provider === "google";
}

function publicUser(user: AuthUser) {
  return {
    userUuid: user.userUuid,
    loginId: user.loginId,
    primaryEmail: user.primaryEmail,
    displayName: user.displayName,
    status: user.status,
    identities: user.identities.map((identity) => ({
      provider: identity.provider,
      providerUserId: identity.providerUserId
    }))
  };
}

function publicReviewState(state: ReviewState) {
  return {
    ...state,
    mergeRequestReviewItems: createMergeRequestReviewItems(state)
  };
}

function markPassed(state: ReviewState, ...ids: Array<`MVP1-AUTH-T${string}`>) {
  return state.testCases.map((testCase) =>
    ids.includes(testCase.id) ? { ...testCase, status: "passed" as const } : testCase
  );
}

function createMissingEmailSender(): EmailSender {
  return {
    send: async () => {
      throw new Error("EMAIL_SENDER_NOT_CONFIGURED");
    }
  };
}

function createKakaoOAuthForRequest(
  request: Request,
  options: ReviewHandlerOptions
): KakaoOAuthClient | undefined {
  if (options.kakaoRedirectPolicy?.mode !== "request-host") {
    return options.kakaoOAuth;
  }

  const config = completeKakaoConfig(options.kakaoConfig);
  if (!config) {
    return undefined;
  }

  const origin = allowedRequestOrigin(request, options.kakaoRedirectPolicy.allowedOrigins);
  if (!origin) {
    return undefined;
  }

  const callbackPath = new URL(config.redirectUri).pathname;
  const dynamicConfig = {
    ...config,
    redirectUri: new URL(callbackPath, origin).toString()
  };
  const factory = options.kakaoOAuthFactory ?? createKakaoOAuthClient;
  return factory(dynamicConfig);
}

function completeKakaoConfig(config: Partial<KakaoOAuthConfig> | undefined): KakaoOAuthConfig | undefined {
  if (!config?.restApiKey || !config.redirectUri) {
    return undefined;
  }

  return {
    restApiKey: config.restApiKey,
    redirectUri: config.redirectUri,
    clientSecret: config.clientSecret,
    scope: config.scope
  };
}

function allowedRequestOrigin(request: Request, allowedOrigins: string[]) {
  const requestHosts = requestHostCandidates(request);
  return allowedOrigins.find((origin) => requestHosts.has(new URL(origin).host.toLowerCase()));
}

function requestHostCandidates(request: Request) {
  const url = new URL(request.url);
  const hosts = new Set<string>([url.host.toLowerCase()]);
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host) {
    hosts.add(host.toLowerCase());
  }
  if (forwardedHost) {
    hosts.add(forwardedHost.toLowerCase());
  }
  return hosts;
}

function kakaoConfigStatus(options: ReviewHandlerOptions) {
  const missing = [];
  if (!options.kakaoConfig?.restApiKey) {
    missing.push("KAKAO_REST_API_KEY");
  }
  if (!options.kakaoConfig?.redirectUri) {
    missing.push("KAKAO_REDIRECT_URI");
  }

  return {
    enabled: missing.length === 0 && Boolean(options.kakaoOAuth ?? options.kakaoOAuthFactory),
    missing,
    redirectUri: options.kakaoConfig?.redirectUri ?? null,
    redirectMode: options.kakaoRedirectPolicy?.mode ?? "fixed",
    scope: options.kakaoConfig?.scope ?? null,
    clientSecretConfigured: Boolean(options.kakaoConfig?.clientSecret)
  };
}

async function signInWithKakaoProfile(
  profile: KakaoAuthProfile,
  state: ReviewState,
  sessions: Map<string, string>,
  persistence?: ReviewPersistence
) {
  const loginResult = findOAuthLogin(state.users, profile.provider, profile.providerUserId);
  if (loginResult.ok) {
    const user = state.users.find((candidate) => candidate.userUuid === loginResult.userUuid)!;
    const sessionId = createSession(sessions, user.userUuid);
    const nextState = {
      ...state,
      currentUserUuid: user.userUuid,
      testCases: markPassed(state, "MVP1-AUTH-T007", "MVP1-AUTH-T020")
    };
    return {
      user,
      sessionId,
      state: persistence ? await persistence.persist(nextState) : nextState
    };
  }

  const loginId = uniqueLoginId(state.users, `kakao-${profile.providerUserId}`);
  const user = createOAuthUser({
    loginId,
    email: profile.emailFromProvider ?? `${loginId}@kakao.local.test`,
    password: randomUUID(),
    displayName: profile.displayName,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    emailFromProvider: profile.emailFromProvider
  });
  const sessionId = createSession(sessions, user.userUuid);
  const nextState = {
    ...state,
    users: [...state.users, user],
    currentUserUuid: user.userUuid,
    testCases: markPassed(state, "MVP1-AUTH-T006")
  };
  return {
    user,
    sessionId,
    state: persistence ? await persistence.persist(nextState) : nextState
  };
}

function uniqueLoginId(users: AuthUser[], requestedLoginId: string) {
  let loginId = requestedLoginId.replace(/[^a-zA-Z0-9._-]/g, "-");
  let suffix = 1;
  while (users.some((user) => user.loginId === loginId)) {
    suffix += 1;
    loginId = `${requestedLoginId}-${suffix}`;
  }
  return loginId;
}

async function readNodeRequestBody(request: IncomingMessage): Promise<BodyInit | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function staticResponse(pathname: string) {
  const relativePath = pathname === "/" ? "mvp1-review.html" : pathname.replace(/^\/+/, "");
  const filePath = join(PUBLIC_DIR, relativePath);

  if (!existsSync(filePath)) {
    return jsonResponse({ ok: false, error: "NOT_FOUND", message: "정적 파일을 찾을 수 없습니다." }, 404);
  }

  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  return new Response(createReadStream(filePath) as unknown as BodyInit, {
    headers: { "content-type": contentType }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startMvp1ReviewServer();
}
