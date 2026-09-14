/**
 * @file agent-service.test.ts
 * @description 에이전트 서비스 헥사고날 유스케이스 오케스트레이션 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgentApplicationService } from "../../../src/agent/service/agent-application-service.js";
import { MemoryAgentRepository } from "../../../src/agent/adapters/out/persistence/memory-agent-repository.js";

describe("AgentApplicationService - 헥사고날 유스케이스 검증", () => {
  let repository: MemoryAgentRepository;
  let service: AgentApplicationService;

  beforeEach(() => {
    repository = new MemoryAgentRepository();
    service = new AgentApplicationService(repository);
  });

  it("세션 시작 ➔ 태스크 시작 ➔ 루프 실행 ➔ 태스크 정리 ➔ 승급 ➔ 세션 종료의 전체 라이프사이클이 정상 동작해야 한다", async () => {
    // 1. #세션시작
    const session = await service.startSession({
      sessionId: "SES-20260915-01",
      sessionName: "에이전트 서비스 구현 세션",
      workGroup: ["개발", "테스트"],
      agent: "gemini",
      model: "gemini-3.7-flash"
    });
    expect(session.status).toBe("시작");

    // 2. #태스크시작
    const task = await service.startTask({
      taskId: "TSK-01",
      sessionId: "SES-20260915-01",
      taskName: "도메인 모델 및 유스케이스 구현",
      gitBranch: "task/에이전트서비스_gemini"
    });
    expect(task.status).toBe("시작");

    // 3. #태스크처리 진입
    await service.processTask("TSK-01");
    const processingTask = await service.getTask("TSK-01");
    expect(processingTask?.status).toBe("처리");

    // 4. #루프시작
    const loop = await service.startLoop({
      loopId: "LP-01",
      taskId: "TSK-01",
      sessionId: "SES-20260915-01",
      loopName: "도메인 엔티티 단위테스트 작성",
      workItem: {
        objective: "단위테스트",
        scope: "test/unit/",
        allowPaths: ["test/unit/"],
        completionCriteria: ["100% 통과"],
        verifyCommand: "npm test"
      }
    });
    expect(loop.status).toBe("분석");

    // #루프처리 진입
    await service.processLoop("LP-01");
    const processingLoop = await repository.findLoopById("LP-01");
    expect(processingLoop?.status).toBe("처리");

    // 5. #루프완료
    await service.completeLoop({
      loopId: "LP-01",
      diffSummary: "+ 120 lines",
      verifyLogs: "All tests passed"
    });

    // 6. #태스크정리 (루프 가드 통과 확인)
    const cleanedTask = await service.cleanTask({
      taskId: "TSK-01",
      endCommit: "commit-sha-1234",
      pr: {
        prNumber: 78,
        title: "에이전트 서비스 구현 PR",
        body: "PR 본문",
        url: "https://github.com/jkoogit/PDFowers/pull/78"
      }
    });
    expect(cleanedTask.status).toBe("정리");

    // 7. #태스크승급
    const promotedTask = await service.promoteTask({
      taskId: "TSK-01",
      promotionCommits: {
        devToStgSha: "stg-sha-5678",
        stgToMainSha: "main-sha-9999"
      }
    });
    expect(promotedTask.status).toBe("승급");

    // 8. #세션정리 및 종료
    const completedSession = await service.completeSession({
      sessionId: "SES-20260915-01",
      retrospective: {
        summary: "에이전트 서비스 DDD 구현 완료",
        author: "gemini"
      },
      officialBacklogs: ["BL-20260915-001"],
      tokenUsage: { promptTokens: 3500, completionTokens: 1200 }
    });
    expect(completedSession.status).toBe("종료");
    expect(completedSession.aiMeta.totalTokens.totalTokens).toBe(4700);
  });

  it("대화 턴 감사 로그가 정상적으로 영속화되어야 한다", async () => {
    await service.traceConversation({
      sessionId: "SES-01",
      taskId: "TSK-01",
      stepIndex: 1,
      agentName: "gemini",
      modelName: "gemini-3.7-flash",
      userPrompt: "코드작성 가이드 만들어줘",
      agentResponse: "가이드 문서를 작성했습니다.",
      tokenUsage: { promptTokens: 500, completionTokens: 200 }
    });

    const traces = await repository.findTracesBySessionId("SES-01");
    expect(traces.length).toBe(1);
    expect(traces[0].userPrompt).toBe("코드작성 가이드 만들어줘");
    expect(traces[0].totalTokens).toBe(700);
  });
});
