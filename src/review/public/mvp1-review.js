const state = {
  busy: false
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
  messageList: document.querySelector("#message-list"),
  auditList: document.querySelector("#audit-list"),
  accountList: document.querySelector("#account-list"),
  testCaseList: document.querySelector("#test-case-list")
};

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

await loadState();

async function loadState() {
  const response = await fetch("/api/review/state");
  renderState(await response.json());
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

async function withBusy(work) {
  if (state.busy) return;
  state.busy = true;
  setButtonsDisabled(true);
  try {
    await work();
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
  const users = Array.isArray(reviewState.users) ? reviewState.users : [];
  const mergeRequests = Array.isArray(reviewState.mergeRequests) ? reviewState.mergeRequests : [];
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

  renderMessages(reviewState.messages ?? []);
  renderAuditLogs(auditLogs);
  renderAccounts(users, mergeRequests);
  renderTestCases(testCases);
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
