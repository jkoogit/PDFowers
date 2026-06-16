const state = {
  busy: false,
  reviewState: null
};

const elements = {
  currentUser: document.querySelector("#current-user"),
  metricUsers: document.querySelector("#metric-users"),
  metricIdentities: document.querySelector("#metric-identities"),
  metricMerges: document.querySelector("#metric-merges"),
  metricPassed: document.querySelector("#metric-passed"),
  metricDbMode: document.querySelector("#metric-db-mode"),
  metricDbUsers: document.querySelector("#metric-db-users"),
  metricDbIdentities: document.querySelector("#metric-db-identities"),
  metricDbAudit: document.querySelector("#metric-db-audit"),
  metricNotifications: document.querySelector("#metric-notifications"),
  apiResult: document.querySelector("#api-result"),
  kakaoConfigStatus: document.querySelector("#kakao-config-status"),
  messageList: document.querySelector("#message-list"),
  notificationList: document.querySelector("#notification-list"),
  auditList: document.querySelector("#audit-list"),
  accountList: document.querySelector("#account-list"),
  testCaseList: document.querySelector("#test-case-list")
};

renderKakaoCallbackResult();

document.querySelector("#refresh-state")?.addEventListener("click", () => {
  void loadState();
});

document.querySelector("#reset-state")?.addEventListener("click", () => {
  void resetState();
});

for (const button of document.querySelectorAll("[data-scenario]")) {
  button.addEventListener("click", () => {
    const scenarioId = button.getAttribute("data-scenario");
    if (scenarioId) {
      void runScenario(scenarioId);
    }
  });
}

for (const button of document.querySelectorAll("[data-api-action]")) {
  button.addEventListener("click", () => {
    const action = button.getAttribute("data-api-action");
    if (action) {
      void runApiAction(action);
    }
  });
}

await Promise.all([loadState(), loadKakaoConfigStatus()]);

async function loadState() {
  const response = await fetch("/api/review/state");
  renderState(await response.json());
}

async function loadKakaoConfigStatus() {
  const status = await getJson("/auth/kakao/config-status");
  renderKakaoConfigStatus(status);
}

async function resetState() {
  await withBusy(async () => {
    const response = await fetch("/api/review/reset", { method: "POST" });
    const body = await response.json();
    renderState(body.state);
  });
}

async function runScenario(scenarioId) {
  await withBusy(async () => {
    const response = await fetch(`/api/review/scenarios/${scenarioId}`, { method: "POST" });
    const body = await response.json();
    renderState(body.state);
  });
}

async function runApiAction(action) {
  await withBusy(async () => {
    if (action === "api-local-signup") {
      const prefix = reviewPrefix();
      await postJson("/auth/signup/local", {
        loginId: `${prefix}-api-local`,
        email: `${prefix}-api-local@example.test`,
        password: "correct-password",
        displayName: "API 검수 로컬",
        emailVerified: true
      });
      setText(elements.apiResult, "API 회원가입 완료: /auth/signup/local");
    }

    if (action === "api-local-login") {
      const prefix = reviewPrefix();
      await postJson("/auth/login/local", {
        loginId: `${prefix}-api-local`,
        password: "correct-password",
        emailVerificationRequired: true
      });
      setText(elements.apiResult, "API 로그인 완료: /auth/login/local");
    }

    if (action === "api-session") {
      const body = await getJson("/auth/session");
      setText(
        elements.apiResult,
        body.authenticated
          ? `API 세션 확인: ${body.user.loginId}`
          : "API 세션 확인: 로그인 상태 없음"
      );
      renderState(body.state);
      return;
    }

    if (action === "api-oauth-signup") {
      const prefix = reviewPrefix();
      await postJson("/auth/oauth/kakao/callback", {
        providerUserId: `${prefix}-api-kakao`,
        emailFromProvider: `${prefix}-api-kakao@example.test`,
        loginId: `${prefix}-api-kakao-owner`,
        password: "correct-password",
        displayName: "API 검수 카카오"
      });
      setText(elements.apiResult, "API OAuth 가입 완료: /auth/oauth/kakao/callback");
    }

    if (action === "api-oauth-login") {
      const prefix = reviewPrefix();
      await postJson("/auth/oauth/kakao/callback", {
        providerUserId: `${prefix}-api-kakao`
      });
      setText(elements.apiResult, "API OAuth 로그인 완료: /auth/oauth/kakao/callback");
    }

    if (action === "api-merge-flow") {
      const prefix = reviewPrefix();
      await postJson("/auth/signup/local", {
        loginId: `${prefix}-api-merge-requester`,
        email: `${prefix}-api-merge-requester@example.test`,
        password: "correct-password",
        displayName: "API 병합 요청자",
        emailVerified: true
      });
      await postJson("/auth/oauth/google/callback", {
        providerUserId: `${prefix}-api-merge-google`,
        emailFromProvider: `${prefix}-api-merge-target@example.test`,
        loginId: `${prefix}-api-merge-target`,
        password: "correct-password",
        displayName: "API 병합 대상"
      });
      await postJson("/auth/login/local", {
        loginId: `${prefix}-api-merge-requester`,
        password: "correct-password",
        emailVerificationRequired: true
      });
      const conflict = await postJson("/auth/identities/google", {
        providerUserId: `${prefix}-api-merge-google`
      });
      if (conflict.mergeRequest?.mergeRequestUuid) {
        await postJson(`/auth/merge-requests/${conflict.mergeRequest.mergeRequestUuid}/approve`, {});
      }
      setText(elements.apiResult, "API 병합 흐름 완료: identity 충돌 및 승인");
    }

    if (action === "api-kakao-start") {
      const status = await getJson("/auth/kakao/config-status");
      renderKakaoConfigStatus(status);
      if (!status.enabled) {
        setText(
          elements.apiResult,
          `카카오 설정 필요: ${status.missing?.join(", ") || "Kakao OAuth client"}`
        );
        return;
      }
      window.location.assign("/auth/kakao/start");
      return;
    }

    await loadState();
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (body.state) {
    renderState(body.state);
  }
  if (!response.ok && !body.mergeRequest) {
    throw new Error(body.error ?? "API request failed");
  }
  return body;
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "API request failed");
  }
  return body;
}

async function withBusy(work) {
  if (state.busy) return;
  state.busy = true;
  setButtonsDisabled(true);
  try {
    await work();
  } catch (error) {
    setText(
      elements.apiResult,
      error instanceof Error ? `API 오류: ${error.message}` : "API 오류가 발생했습니다."
    );
  } finally {
    state.busy = false;
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled) {
  for (const button of document.querySelectorAll("button")) {
    button.disabled = disabled;
  }
}

function renderState(reviewState) {
  state.reviewState = reviewState;
  const users = Array.isArray(reviewState.users) ? reviewState.users : [];
  const mergeRequests = Array.isArray(reviewState.mergeRequests) ? reviewState.mergeRequests : [];
  const notifications = Array.isArray(reviewState.notifications) ? reviewState.notifications : [];
  const testCases = Array.isArray(reviewState.testCases) ? reviewState.testCases : [];
  const currentUser = users.find((user) => user.userUuid === reviewState.currentUserUuid);
  const identityCount = users.reduce((sum, user) => sum + safeArray(user.identities).length, 0);
  const auditLogs = users.flatMap((user) =>
    safeArray(user.auditLogs).map((log) => ({
      user: user.loginId,
      eventType: log.eventType,
      provider: log.provider
    }))
  );
  const passedCount = testCases.filter((testCase) => testCase.status === "passed").length;

  setText(elements.currentUser, currentUser ? `현재 사용자: ${currentUser.loginId}` : "현재 사용자 없음");
  setText(elements.metricUsers, String(users.length));
  setText(elements.metricIdentities, String(identityCount));
  setText(elements.metricMerges, String(mergeRequests.length));
  setText(elements.metricPassed, String(passedCount));
  setText(elements.metricDbMode, reviewState.database?.connected ? "DB" : "메모리");
  setText(elements.metricDbUsers, String(reviewState.database?.userRows ?? 0));
  setText(elements.metricDbIdentities, String(reviewState.database?.identityRows ?? 0));
  setText(elements.metricDbAudit, String(reviewState.database?.auditLogRows ?? 0));
  setText(elements.metricNotifications, String(notifications.length));

  renderMessages(reviewState.messages ?? []);
  renderNotifications(notifications);
  renderAuditLogs(auditLogs);
  renderAccounts(users, mergeRequests);
  renderTestCases(testCases);
}

function renderKakaoConfigStatus(status) {
  if (status.enabled) {
    setText(
      elements.kakaoConfigStatus,
      `연결 가능 / Redirect URI: ${status.redirectUri}${status.scope ? ` / Scope: ${status.scope}` : ""}`
    );
    return;
  }

  setText(
    elements.kakaoConfigStatus,
    `설정 필요: ${safeArray(status.missing).join(", ") || "Kakao OAuth client"}`
  );
}

function renderKakaoCallbackResult() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("kakao") === "success") {
    setText(elements.apiResult, "Kakao login completed. Review state has been refreshed.");
    clearKakaoCallbackQuery(params);
    return;
  }

  const error = params.get("kakao_error");
  if (error) {
    setText(elements.apiResult, `Kakao login failed: ${error}`);
    clearKakaoCallbackQuery(params);
  }
}

function clearKakaoCallbackQuery(params) {
  params.delete("kakao");
  params.delete("kakao_error");
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function reviewPrefix() {
  return state.reviewState?.runId ?? `review-${Date.now()}`;
}

function renderMessages(messages) {
  clear(elements.messageList);
  for (const message of messages.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = message;
    elements.messageList?.append(item);
  }
}

function renderAuditLogs(auditLogs) {
  clear(elements.auditList);
  for (const log of auditLogs.slice(-8).reverse()) {
    const item = document.createElement("li");
    item.textContent = `${log.user}: ${log.eventType}${log.provider ? ` (${log.provider})` : ""}`;
    elements.auditList?.append(item);
  }
}

function renderNotifications(notifications) {
  clear(elements.notificationList);
  for (const notification of notifications.slice(-8).reverse()) {
    const item = document.createElement("li");
    item.className = `notification-${notification.status}`;
    item.textContent =
      `${notification.eventType} / ${notification.channel} / ${notification.status} / ` +
      `${notification.recipientEmail}`;
    elements.notificationList?.append(item);
  }
}

function renderAccounts(users, mergeRequests) {
  clear(elements.accountList);
  for (const user of users) {
    const item = document.createElement("article");
    item.className = "account-item";

    const title = document.createElement("h3");
    title.textContent = `${user.loginId} / ${user.displayName}`;

    const details = document.createElement("dl");
    appendDetail(details, "상태", user.status);
    appendDetail(details, "이메일", user.primaryEmail);
    appendDetail(details, "Identity", safeArray(user.identities).map((identity) => identity.provider).join(", ") || "없음");
    appendDetail(details, "병합 대상", user.mergedIntoUserUuid ?? "없음");

    item.append(title, details);
    elements.accountList?.append(item);
  }

  for (const mergeRequest of mergeRequests) {
    const item = document.createElement("article");
    item.className = "account-item";

    const title = document.createElement("h3");
    title.textContent = `병합 요청 ${mergeRequest.provider}`;

    const details = document.createElement("dl");
    appendDetail(details, "상태", mergeRequest.status);
    appendDetail(details, "요청 계정", mergeRequest.requestUserUuid);
    appendDetail(details, "대상 계정", mergeRequest.targetUserUuid);
    appendDetail(details, "제공자 식별자", maskProviderUserId(mergeRequest.providerUserId));
    appendDetail(details, "만료", new Date(mergeRequest.expiresAt).toLocaleString());

    item.append(title, details);
    elements.accountList?.append(item);
  }
}

function renderTestCases(testCases) {
  clear(elements.testCaseList);
  for (const testCase of testCases) {
    const item = document.createElement("article");
    item.className = "test-case-item";

    const title = document.createElement("h3");
    title.textContent = testCase.id;

    const status = document.createElement("span");
    status.className = `status status-${testCase.status}`;
    status.textContent = statusLabel(testCase.status);

    const description = document.createElement("p");
    description.textContent = testCase.title;

    item.append(title, status, description);
    elements.testCaseList?.append(item);
  }
}

function appendDetail(parent, term, description) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = String(description);
  parent.append(dt, dd);
}

function statusLabel(status) {
  if (status === "passed") return "통과";
  if (status === "failed") return "실패";
  return "대기";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function maskProviderUserId(value) {
  const text = String(value ?? "");
  if (text.length <= 6) {
    return text ? "***" : "없음";
  }
  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function clear(element) {
  if (element) {
    element.replaceChildren();
  }
}
