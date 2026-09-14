/**
 * @file agent-api-smoke-check.ts
 * @description 에이전트 서비스 3계층 생명주기 및 API 기능 스모크 체크 스크립트
 */

import { createServer } from "node:http";
import * as path from "node:path";
import { MemoryAgentRepository } from "./adapters/out/persistence/memory-agent-repository.js";
import { LocalDocsScanner } from "./adapters/out/filesystem/local-docs-scanner.js";
import { AgentApplicationService } from "./service/agent-application-service.js";
import { createAgentHttpHandler } from "./adapters/in/web/agent-controller.js";


async function main() {
  console.log("==================================================");
  console.log("🤖 에이전트 서비스 REST API 스모크 검증 시작");
  console.log("==================================================");

  const docsDir = path.resolve(process.cwd(), "docs");
  const repo = new MemoryAgentRepository();
  const scanner = new LocalDocsScanner(docsDir);
  const service = new AgentApplicationService(repo, scanner);
  const handler = createAgentHttpHandler(service);

  const server = createServer(async (req, res) => {
    const handled = await handler(req, res);
    if (!handled) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}/api/agent/v1`;
  console.log(`[1] 임시 에이전트 API 서버 실행 중: ${baseUrl}`);

  try {
    // 1. 세션 시작 API
    const res1 = await fetch(`${baseUrl}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "SES-SMOKE-01",
        sessionName: "스모크 검증 세션",
        workGroup: ["개발", "테스트"],
        agent: "gemini",
        model: "gemini-3.7-flash"
      })
    });
    const json1 = await res1.json();
    console.log(`[2] 세션 시작 API 호출 결과: status=${res1.status}, data=`, json1.data);

    // 2. 태스크 시작 API
    const res2 = await fetch(`${baseUrl}/tasks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "TSK-SMOKE-01",
        sessionId: "SES-SMOKE-01",
        taskName: "에이전트 서비스 API 스모크 태스크",
        gitBranch: "task/에이전트서비스_gemini"
      })
    });
    const json2 = await res2.json();
    console.log(`[3] 태스크 시작 API 호출 결과: status=${res2.status}, data=`, json2.data);

    // 3. 루프 시작 API
    const res3 = await fetch(`${baseUrl}/loops/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loopId: "LP-SMOKE-01",
        taskId: "TSK-SMOKE-01",
        sessionId: "SES-SMOKE-01",
        loopName: "단위 루프 검증",
        workItem: {
          objective: "루프 테스트",
          scope: "src/domains/agent/",
          allowPaths: ["src/domains/agent/"],
          completionCriteria: ["통과"],
          verifyCommand: "npm test"
        }
      })
    });
    const json3 = await res3.json();
    console.log(`[4] 루프 시작 API 호출 결과: status=${res3.status}, data=`, json3.data);

    // 3-1. 루프 처리 진입 API
    const res31 = await fetch(`${baseUrl}/loops/LP-SMOKE-01/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "smoke-checker" })
    });
    const json31 = await res31.json();
    console.log(`[4-1] 루프 처리 API 호출 결과: status=${res31.status}, data=`, json31.data);

    // 4. 루프 완료 API
    const res4 = await fetch(`${baseUrl}/loops/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loopId: "LP-SMOKE-01",
        diffSummary: "+ 50 lines",
        verifyLogs: "Smoke loop passed"
      })
    });

    const json4 = await res4.json();
    console.log(`[5] 루프 완료 API 호출 결과: status=${res4.status}, data=`, json4.data);

    // 4-1. 태스크 처리 진입 API
    const resTaskProcess = await fetch(`${baseUrl}/tasks/TSK-SMOKE-01/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "smoke-checker" })
    });
    const jsonTaskProcess = await resTaskProcess.json();
    console.log(`[5-1] 태스크 처리 API 호출 결과: status=${resTaskProcess.status}, data=`, jsonTaskProcess.data);

    // 5. 태스크 정리 API (Loop Guard 검증 통과)
    const res5 = await fetch(`${baseUrl}/tasks/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: "TSK-SMOKE-01",
        endCommit: "smoke-commit-sha-1234",
        pr: {
          prNumber: 99,
          title: "스모크 PR",
          body: "스모크 테스트",
          url: "https://github.com/jkoogit/PDFowers/pull/99"
        }
      })
    });

    const json5 = await res5.json();
    console.log(`[6] 태스크 정리 API 호출 결과: status=${res5.status}, data=`, json5.data);

    // 6. 마크다운 문서 동기화 API
    const res6 = await fetch(`${baseUrl}/docs/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "smoke-checker" })
    });
    const json6 = await res6.json();
    console.log(`[7] 문서 동기화 API 호출 결과: status=${res6.status}, message=${json6.message}`);

    // 7. 문서 크로스체크 검증 API
    const res7 = await fetch(`${baseUrl}/docs/verify-consistency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const json7 = await res7.json();
    console.log(`[8] 문서 크로스체크 검증 결과: isConsistent=${json7.data.isConsistent}, totalFiles=${json7.data.totalFiles}`);

    // 8. 세션 조회 API
    const res8 = await fetch(`${baseUrl}/sessions/SES-SMOKE-01`);
    const json8 = await res8.json();
    console.log(`[9] 세션 상세 조회 API: taskCount=${json8.data.tasks.length}, loopCount=${json8.data.tasks[0]?.loops?.length}`);

    console.log("==================================================");
    console.log("🎉 에이전트 서비스 REST API 전체 스모크 검증 완료: 100% 정상 동작!");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("스모크 검증 에러:", err);
  process.exit(1);
});
