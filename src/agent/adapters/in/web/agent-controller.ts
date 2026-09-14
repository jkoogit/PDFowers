/**
 * @file agent-controller.ts
 * @description 에이전트 서비스 표준 HTTP 인바운드 웹 어댑터 (Node.js native http & Fetch API 지원)
 * 
 * [설계 의도]
 * - 외부 웹 프레임워크(Express, Fastify 등) 종속성을 제거하고 표준 Node.js http 및 Fetch Request/Response를 지원합니다.
 * - 필요 시 Express나 Fastify의 미들웨어로도 쉽게 래핑하여 사용할 수 있습니다.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { AgentUseCasePort } from "../../../ports/in/agent-usecases.js";

export type AgentHttpRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createAgentHttpHandler(service: AgentUseCasePort): AgentHttpRequestHandler {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() || "GET";

    if (!pathname.startsWith("/api/agent/v1")) {
      return false; // 에이전트 API 경로가 아니면 다음 핸들러로 위임
    }

    const subPath = pathname.replace("/api/agent/v1", "");

    // JSON 본문 읽기 헬퍼
    const readJsonBody = async <T>(): Promise<T> => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      return raw ? JSON.parse(raw) : ({} as T);
    };

    // JSON 응답 전송 헬퍼
    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    };

    try {
      // 1. 세션 시작 (POST /sessions/start)
      if (method === "POST" && subPath === "/sessions/start") {
        const body = await readJsonBody<any>();
        const session = await service.startSession(body);
        sendJson(200, {
          success: true,
          data: {
            sessionId: session.sessionId,
            status: session.status,
            startedAt: session.startedAt,
            version: session.meta.version
          },
          message: "세션이 성공적으로 시작되었습니다."
        });
        return true;
      }

      // 2. 세션 완료 (POST /sessions/complete)
      if (method === "POST" && subPath === "/sessions/complete") {
        const body = await readJsonBody<any>();
        const session = await service.completeSession(body);
        sendJson(200, {
          success: true,
          data: {
            sessionId: session.sessionId,
            status: session.status,
            endedAt: session.endedAt,
            totalTokens: session.aiMeta.totalTokens.toJSON(),
            version: session.meta.version
          },
          message: "세션이 완료되었습니다."
        });
        return true;
      }

      // 3. 세션 조회 (GET /sessions/:sessionId)
      if (method === "GET" && subPath.startsWith("/sessions/")) {
        const sessionId = subPath.replace("/sessions/", "");
        const session = await service.getSession(sessionId);
        if (!session) {
          sendJson(404, { success: false, error: { message: "세션을 찾을 수 없습니다." } });
          return true;
        }
        sendJson(200, {
          success: true,
          data: {
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            status: session.status,
            workGroup: session.workGroup,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            aiMeta: session.aiMeta,
            retrospective: session.retrospective,
            backlogIds: session.backlogIds,
            tasks: session.tasks.map((t) => ({
              taskId: t.taskId,
              taskName: t.taskName,
              status: t.status,
              loops: t.loops.map((l) => ({ loopId: l.loopId, status: l.status }))
            }))
          }
        });
        return true;
      }

      // 4. 태스크 시작 (POST /tasks/start)
      if (method === "POST" && subPath === "/tasks/start") {
        const body = await readJsonBody<any>();
        const task = await service.startTask(body);
        sendJson(200, {
          success: true,
          data: {
            taskId: task.taskId,
            sessionId: task.sessionId,
            status: task.status,
            startedAt: task.startedAt
          }
        });
        return true;
      }

      // 5. 태스크 처리 (POST /tasks/:taskId/process)
      if (method === "POST" && subPath.startsWith("/tasks/") && subPath.endsWith("/process")) {
        const taskId = subPath.replace("/tasks/", "").replace("/process", "");
        const body = await readJsonBody<any>();
        const task = await service.processTask(taskId, body.actor);
        sendJson(200, {
          success: true,
          data: { taskId: task.taskId, status: task.status }
        });
        return true;
      }

      // 6. 태스크 정리 (POST /tasks/clean)
      if (method === "POST" && subPath === "/tasks/clean") {
        const body = await readJsonBody<any>();
        const task = await service.cleanTask(body);
        sendJson(200, {
          success: true,
          data: {
            taskId: task.taskId,
            status: task.status,
            endedAt: task.endedAt,
            gitInfo: task.gitInfo
          },
          message: "태스크가 정리되었습니다."
        });
        return true;
      }

      // 7. 태스크 승급 (POST /tasks/promote)
      if (method === "POST" && subPath === "/tasks/promote") {
        const body = await readJsonBody<any>();
        const task = await service.promoteTask(body);
        sendJson(200, {
          success: true,
          data: {
            taskId: task.taskId,
            status: task.status,
            promotionCommits: task.gitInfo.promotionCommits
          }
        });
        return true;
      }

      // 8. 루프 시작 (POST /loops/start)
      if (method === "POST" && subPath === "/loops/start") {
        const body = await readJsonBody<any>();
        const loop = await service.startLoop(body);
        sendJson(200, {
          success: true,
          data: {
            loopId: loop.loopId,
            taskId: loop.taskId,
            status: loop.status,
            startedAt: loop.startedAt
          }
        });
        return true;
      }

      // 8-1. 루프 처리 (POST /loops/:loopId/process)
      if (method === "POST" && subPath.startsWith("/loops/") && subPath.endsWith("/process")) {
        const loopId = subPath.replace("/loops/", "").replace("/process", "");
        const body = await readJsonBody<any>();
        const loop = await service.processLoop(loopId, body.actor);
        sendJson(200, {
          success: true,
          data: { loopId: loop.loopId, status: loop.status }
        });
        return true;
      }

      // 9. 루프 완료 (POST /loops/complete)

      if (method === "POST" && subPath === "/loops/complete") {
        const body = await readJsonBody<any>();
        const loop = await service.completeLoop(body);
        sendJson(200, {
          success: true,
          data: {
            loopId: loop.loopId,
            status: loop.status,
            endedAt: loop.endedAt,
            diffSummary: loop.diffSummary,
            verifyResult: loop.verifyResult
          }
        });
        return true;
      }

      // 10. 상시 자가 치유 (POST /reconcile)
      if (method === "POST" && subPath === "/reconcile") {
        const body = await readJsonBody<any>();
        const result = await service.reconcile(body.sessionId, body.actor);
        sendJson(200, {
          success: true,
          data: result
        });
        return true;
      }

      // 11. 문서 동기화 (POST /docs/sync)
      if (method === "POST" && subPath === "/docs/sync") {
        const body = await readJsonBody<any>();
        const result = await service.syncDocs(body.actor);
        sendJson(200, {
          success: true,
          data: result,
          message: `${result.syncedCount}개 문서가 DB에 성공적으로 동기화되었습니다.`
        });
        return true;
      }

      // 12. 문서 크로스체크 (POST /docs/verify-consistency)
      if (method === "POST" && subPath === "/docs/verify-consistency") {
        const result = await service.verifyDocsConsistency();
        sendJson(200, {
          success: true,
          data: result
        });
        return true;
      }

      // 13. 대화 감사 로그 (POST /trace/conversation)
      if (method === "POST" && subPath === "/trace/conversation") {
        const body = await readJsonBody<any>();
        await service.traceConversation(body);
        sendJson(200, {
          success: true,
          message: "대화 감사 로그가 저장되었습니다."
        });
        return true;
      }

      sendJson(404, { success: false, error: { message: "알 수 없는 엔드포인트입니다." } });
      return true;
    } catch (err: any) {
      sendJson(400, { success: false, error: { message: err.message } });
      return true;
    }
  };
}
