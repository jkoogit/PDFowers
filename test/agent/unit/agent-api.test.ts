/**
 * @file agent-api.test.ts
 * @description 에이전트 서비스 HTTP REST API 엔드포인트 테스트 (Native node:http & Fetch API)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, Server } from "node:http";
import { MemoryAgentRepository } from "../../../src/agent/adapters/out/persistence/memory-agent-repository.js";
import { AgentApplicationService } from "../../../src/agent/service/agent-application-service.js";
import { createAgentHttpHandler } from "../../../src/agent/adapters/in/web/agent-controller.js";

describe("Agent Service REST API Endpoints", () => {
  let server: Server;
  let service: AgentApplicationService;
  let repository: MemoryAgentRepository;
  let baseUrl: string;

  beforeEach(async () => {
    repository = new MemoryAgentRepository();
    service = new AgentApplicationService(repository);
    const handler = createAgentHttpHandler(service);

    server = createServer(async (req, res) => {
      const handled = await handler(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}/api/agent/v1`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("POST /api/agent/v1/sessions/start - 세션 시작 API", async () => {
    const res = await fetch(`${baseUrl}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "SES-API-01",
        sessionName: "API 테스트 세션",
        workGroup: ["개발"],
        agent: "gemini",
        model: "gemini-3.7-flash"
      })
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.sessionId).toBe("SES-API-01");
    expect(json.data.status).toBe("시작");
  });

  it("POST /api/agent/v1/tasks/start & clean - 태스크 시작 및 루프가드 검증", async () => {
    // 세션 생성
    await service.startSession({
      sessionId: "SES-API-01",
      sessionName: "API 테스트 세션",
      workGroup: ["개발"],
      agent: "gemini",
      model: "gemini-3.7-flash"
    });

    // 태스크 시작
    const startRes = await fetch(`${baseUrl}/tasks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "TSK-API-01",
        sessionId: "SES-API-01",
        taskName: "API 태스크",
        gitBranch: "task/api_gemini"
      })
    });
    const startJson = await startRes.json();
    expect(startRes.status).toBe(200);
    expect(startJson.data.taskId).toBe("TSK-API-01");

    // 태스크 처리
    await fetch(`${baseUrl}/tasks/TSK-API-01/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    // 태스크 정리 (루프 없음 -> 정상 완료)
    const cleanRes = await fetch(`${baseUrl}/tasks/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "TSK-API-01",
        endCommit: "commit-sha-999"
      })
    });
    const cleanJson = await cleanRes.json();
    expect(cleanRes.status).toBe(200);
    expect(cleanJson.data.status).toBe("정리");
  });

  it("POST /api/agent/v1/reconcile - 상시 자가 치유 API", async () => {
    await service.startSession({
      sessionId: "SES-API-02",
      sessionName: "자가치유 테스트",
      workGroup: ["개발"],
      agent: "gemini",
      model: "gemini-3.7-flash"
    });

    const res = await fetch(`${baseUrl}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "SES-API-02"
      })
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.sessionId).toBe("SES-API-02");
  });
});
