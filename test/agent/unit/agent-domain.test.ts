/**
 * @file agent-domain.test.ts
 * @description 에이전트 서비스 순수 도메인 모델 단위 테스트 (No DB / Fast execution)
 */

import { describe, it, expect } from "vitest";
import { SessionEntity, TaskEntity, LoopEntity, TokenUsage } from "../../../src/agent/domain/model.js";
import { validateSessionTransition, validateTaskTransition, validateLoopTransition } from "../../../src/agent/domain/state-machine.js";
import { reconcileSessionState } from "../../../src/agent/domain/reconciler.js";

describe("1. Value Object & Entity 도메인 규칙 검증", () => {
  it("TokenUsage VO는 불변성을 유지하며 토큰을 정확히 합산해야 한다", () => {
    const token1 = new TokenUsage(100, 50);
    const token2 = new TokenUsage(200, 150);
    const combined = token1.add(token2);

    expect(combined.promptTokens).toBe(300);
    expect(combined.completionTokens).toBe(200);
    expect(combined.totalTokens).toBe(500);
    expect(token1.totalTokens).toBe(150); // 원본 객체 불변
  });

  it("음수 토큰 값으로 TokenUsage 생성 시 예외가 발생해야 한다", () => {
    expect(() => new TokenUsage(-1, 50)).toThrowError("토큰 수는 음수일 수 없습니다.");
  });

  it("세션 엔티티는 토큰 누적 및 완료 상태 전이를 정확히 수행해야 한다", () => {
    const session = new SessionEntity(
      "SES-01",
      "설계 세션",
      ["기획", "설계"],
      new Date(),
      { agent: "gemini", model: "gemini-3.7-flash", version: "1.0", agentStatus: "ACTIVE" }
    );

    expect(session.status).toBe("시작");
    session.addTokenUsage(new TokenUsage(500, 200));
    expect(session.aiMeta.totalTokens.totalTokens).toBe(700);

    session.complete({ summary: "회고 요약" }, ["BL-01"], new TokenUsage(300, 100));
    expect(session.status).toBe("종료");
    expect(session.endedAt).toBeDefined();
    expect(session.aiMeta.totalTokens.totalTokens).toBe(1100);
    expect(session.meta.version).toBe(2); // 낙관적 잠금 버전 증가
  });
});

describe("2. ⭐️ 루프 가드 (Loop Guard) 도메인 규칙 검증", () => {
  it("태스크 내에 미완료 상태(처리/보완/보류)인 루프가 있으면 태스크 정리를 거부하고 예외를 던져야 한다", () => {
    const task = new TaskEntity("TSK-01", "SES-01", "인증 구현", new Date(), "task/auth_gemini", "처리");
    const activeLoop = new LoopEntity("LP-01", "TSK-01", "SES-01", "단위테스트", new Date(), {
      objective: "테스트 작성",
      scope: "test/",
      allowPaths: ["test/"],
      completionCriteria: ["통과"],
      verifyCommand: "npm test"
    }, "처리");

    task.addLoop(activeLoop);

    // 루프가 '처리' 상태일 때 태스크 clean 호출 시 예외 발생 검증
    expect(() => task.clean({ endCommit: "abc1234" })).toThrowError(/미완료 루프가 1개 존재합니다/);
    expect(task.status).toBe("처리"); // 상태가 보호되어야 함
  });

  it("태스크 내 모든 루프가 '정리' 또는 '정지' 상태로 종결되면 정상적으로 태스크 정리가 완료되어야 한다", () => {
    const task = new TaskEntity("TSK-01", "SES-01", "인증 구현", new Date(), "task/auth_gemini", "처리");
    const loop1 = new LoopEntity("LP-01", "TSK-01", "SES-01", "단위테스트", new Date(), {
      objective: "테스트",
      scope: "test/",
      allowPaths: ["test/"],
      completionCriteria: ["통과"],
      verifyCommand: "npm test"
    }, "분석");
    const loop2 = new LoopEntity("LP-02", "TSK-01", "SES-01", "리팩터링", new Date(), {
      objective: "리팩터링",
      scope: "src/",
      allowPaths: ["src/"],
      completionCriteria: ["완료"],
      verifyCommand: "npm test"
    }, "분석");

    // 루프1 완료, 루프2 정지
    loop1.complete("diff 요약", "테스트 성공 logs");
    loop2.control("ABORT", "방향성 전환");

    task.addLoop(loop1);
    task.addLoop(loop2);

    task.clean({ endCommit: "def5678", pr: { prNumber: 77, title: "PR 제목", body: "PR 본문", url: "https://github.com" } });
    expect(task.status).toBe("정리");
    expect(task.endedAt).toBeDefined();
    expect(task.gitInfo.pr?.prNumber).toBe(77);
  });
});

describe("3. 상태 머신(State Machine) 전이 규칙 검증", () => {
  it("허용되지 않은 잘못된 상태 전이 시 InvalidStateTransitionError를 던져야 한다", () => {
    expect(() => validateSessionTransition("종료", "작업")).toThrowError(/Session/);
    expect(() => validateTaskTransition("시작", "승급")).toThrowError(/Task/);
    expect(() => validateLoopTransition("정리", "처리")).toThrowError(/Loop/);
  });
});

describe("4. 상시 자가 치유(Reconciliation) 도메인 규칙 검증", () => {
  it("하위 태스크 및 루프 레코드가 상위 목록에 누락되어 있으면 자동으로 스캔하여 보정해야 한다", () => {
    const session = new SessionEntity("SES-01", "세션", ["개발"], new Date(), { agent: "gemini", model: "flash", version: "1", agentStatus: "ACTIVE" });
    const task = new TaskEntity("TSK-01", "SES-01", "태스크", new Date(), "branch", "처리");
    const loop = new LoopEntity("LP-01", "TSK-01", "SES-01", "루프", new Date(), { objective: "obj", scope: "sc", allowPaths: [], completionCriteria: [], verifyCommand: "" }, "정리");

    const tasks = [task];
    const loopsByTaskId = new Map([["TSK-01", [loop]]]);

    // 자가 치유 실행 전: 세션에 태스크가 없고 태스크에 루프가 없음
    expect(session.tasks.length).toBe(0);
    expect(task.loops.length).toBe(0);

    const result = reconcileSessionState(session, tasks, loopsByTaskId);

    expect(result.inconsistenciesFound).toBe(2);
    expect(result.repaired).toBe(true);
    expect(session.tasks.length).toBe(1);
    expect(task.loops.length).toBe(1);
  });
});
