/**
 * @file agent-application-service.ts
 * @description 에이전트 서비스 유스케이스 애플리케이션 서비스 (오케스트레이터)
 * 
 * [설계 원칙]
 * - 인바운드 포트(AgentUseCasePort)를 구현하여 클라이언트(웹/CLI)에 유스케이스를 제공합니다.
 * - 아웃바운드 포트(AgentRepositoryPort, DocsScannerPort)를 주입받아 도메인 모델과 협력합니다.
 */

import * as crypto from "node:crypto";
import {
  AgentUseCasePort,
  StartSessionCommand,
  CompleteSessionCommand,
  StartTaskCommand,
  CleanTaskCommand,
  PromoteTaskCommand,
  StartLoopCommand,
  CompleteLoopCommand,
  ControlLoopCommand,
  TraceConversationCommand
} from "../ports/in/agent-usecases.js";
import { AgentRepositoryPort } from "../ports/out/agent-repository.port.js";
import { DocsScannerPort } from "../ports/out/docs-scanner.port.js";
import { SessionEntity, TaskEntity, LoopEntity, TokenUsage } from "../domain/model.js";
import { validateSessionTransition, validateTaskTransition, validateLoopTransition } from "../domain/state-machine.js";
import { reconcileSessionState, ReconcileResult } from "../domain/reconciler.js";

export class AgentApplicationService implements AgentUseCasePort {
  constructor(
    private readonly repository: AgentRepositoryPort,
    private readonly docsScanner?: DocsScannerPort
  ) {}

  // ==========================================
  // 세션 (Session) 유스케이스
  // ==========================================

  async startSession(cmd: StartSessionCommand): Promise<SessionEntity> {
    const existing = await this.repository.findSessionById(cmd.sessionId);
    if (existing) {
      existing.startWorking(cmd.actor || cmd.agent);
      await this.repository.saveSession(existing);
      return existing;
    }

    const session = new SessionEntity(
      cmd.sessionId,
      cmd.sessionName,
      cmd.workGroup,
      new Date(),
      {
        agent: cmd.agent,
        model: cmd.model,
        version: cmd.version || "1.0",
        agentStatus: "ACTIVE"
      },
      "시작"
    );

    await this.repository.saveSession(session);
    return session;
  }

  async completeSession(cmd: CompleteSessionCommand): Promise<SessionEntity> {
    const session = await this.repository.findSessionById(cmd.sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${cmd.sessionId}`);
    }

    validateSessionTransition(session.status, "종료");

    const tokenUsage = cmd.tokenUsage ? new TokenUsage(cmd.tokenUsage.promptTokens, cmd.tokenUsage.completionTokens) : undefined;
    session.complete(cmd.retrospective, cmd.officialBacklogs, tokenUsage, cmd.actor);

    await this.repository.saveSession(session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionEntity | null> {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) return null;

    // 하위 태스크 및 루프 결합
    const tasks = await this.repository.findTasksBySessionId(sessionId);
    for (const task of tasks) {
      const loops = await this.repository.findLoopsByTaskId(task.taskId);
      loops.forEach((l) => task.addLoop(l));
      session.addTask(task);
    }

    return session;
  }

  // ==========================================
  // 태스크 (Task) 유스케이스
  // ==========================================

  async startTask(cmd: StartTaskCommand): Promise<TaskEntity> {
    const session = await this.repository.findSessionById(cmd.sessionId);
    if (!session) {
      throw new Error(`부모 세션이 존재하지 않습니다: ${cmd.sessionId}`);
    }

    const task = new TaskEntity(
      cmd.taskId,
      cmd.sessionId,
      cmd.taskName,
      new Date(),
      cmd.gitBranch,
      "시작"
    );

    session.addTask(task);
    await this.repository.saveTask(task);
    await this.repository.saveSession(session);

    return task;
  }

  async processTask(taskId: string, actor: string = "system"): Promise<TaskEntity> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) {
      throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
    }

    validateTaskTransition(task.status, "처리");
    task.process(actor);
    await this.repository.saveTask(task);

    return task;
  }

  async cleanTask(cmd: CleanTaskCommand): Promise<TaskEntity> {
    const task = await this.repository.findTaskById(cmd.taskId);
    if (!task) {
      throw new Error(`태스크를 찾을 수 없습니다: ${cmd.taskId}`);
    }

    // 하위 루프들을 로드하여 태스크에 세팅 (루프 가드 검증을 위해 필수)
    const loops = await this.repository.findLoopsByTaskId(cmd.taskId);
    loops.forEach((l) => task.addLoop(l));

    validateTaskTransition(task.status, "정리");

    // ⭐️ 태스크 clean 내부에서 루프 가드(Loop Guard) 자동 검증 수행
    task.clean(
      {
        endCommit: cmd.endCommit,
        pr: cmd.pr
      },
      cmd.actor
    );

    await this.repository.saveTask(task);
    return task;
  }

  async promoteTask(cmd: PromoteTaskCommand): Promise<TaskEntity> {
    const task = await this.repository.findTaskById(cmd.taskId);
    if (!task) {
      throw new Error(`태스크를 찾을 수 없습니다: ${cmd.taskId}`);
    }

    validateTaskTransition(task.status, "승급");
    task.promote(cmd.promotionCommits, cmd.actor);
    await this.repository.saveTask(task);

    return task;
  }

  async getTask(taskId: string): Promise<TaskEntity | null> {
    const task = await this.repository.findTaskById(taskId);
    if (!task) return null;

    const loops = await this.repository.findLoopsByTaskId(taskId);
    loops.forEach((l) => task.addLoop(l));

    return task;
  }

  // ==========================================
  // 루프 (Loop) 유스케이스
  // ==========================================

  async startLoop(cmd: StartLoopCommand): Promise<LoopEntity> {
    const task = await this.repository.findTaskById(cmd.taskId);
    if (!task) {
      throw new Error(`부모 태스크가 존재하지 않습니다: ${cmd.taskId}`);
    }

    const loop = new LoopEntity(
      cmd.loopId,
      cmd.taskId,
      cmd.sessionId,
      cmd.loopName,
      new Date(),
      cmd.workItem,
      "분석"
    );

    task.addLoop(loop);
    await this.repository.saveLoop(loop);
    await this.repository.saveTask(task);

    return loop;
  }

  async processLoop(loopId: string, actor: string = "system"): Promise<LoopEntity> {
    const loop = await this.repository.findLoopById(loopId);
    if (!loop) {
      throw new Error(`루프를 찾을 수 없습니다: ${loopId}`);
    }

    validateLoopTransition(loop.status, "처리");
    loop.process(actor);
    await this.repository.saveLoop(loop);

    return loop;
  }

  async completeLoop(cmd: CompleteLoopCommand): Promise<LoopEntity> {

    const loop = await this.repository.findLoopById(cmd.loopId);
    if (!loop) {
      throw new Error(`루프를 찾을 수 없습니다: ${cmd.loopId}`);
    }

    validateLoopTransition(loop.status, "정리");
    loop.complete(cmd.diffSummary, cmd.verifyLogs, cmd.actor);
    await this.repository.saveLoop(loop);

    return loop;
  }

  async controlLoop(cmd: ControlLoopCommand): Promise<LoopEntity> {
    const loop = await this.repository.findLoopById(cmd.loopId);
    if (!loop) {
      throw new Error(`루프를 찾을 수 없습니다: ${cmd.loopId}`);
    }

    loop.control(cmd.action, cmd.reason, cmd.actor);
    await this.repository.saveLoop(loop);

    return loop;
  }

  // ==========================================
  // 상시 자가 치유 (Reconciliation) 유스케이스
  // ==========================================

  async reconcile(sessionId: string, actor: string = "system"): Promise<ReconcileResult> {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    const tasks = await this.repository.findTasksBySessionId(sessionId);
    const loopsByTaskId = new Map<string, LoopEntity[]>();

    for (const task of tasks) {
      const loops = await this.repository.findLoopsByTaskId(task.taskId);
      loopsByTaskId.set(task.taskId, loops);
    }

    // 도메인 자가 치유 실행
    const result = reconcileSessionState(session, tasks, loopsByTaskId);

    if (result.repaired) {
      await this.repository.saveSession(session);
      for (const task of tasks) {
        await this.repository.saveTask(task);
      }
    }

    return result;
  }

  // ==========================================
  // 대화 및 감사 로그 유스케이스
  // ==========================================

  async traceConversation(cmd: TraceConversationCommand): Promise<void> {
    const traceId = `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await this.repository.saveConversationTrace({
      traceId,
      sessionId: cmd.sessionId,
      taskId: cmd.taskId,
      stepIndex: cmd.stepIndex,
      agentName: cmd.agentName,
      modelName: cmd.modelName,
      userPrompt: cmd.userPrompt,
      agentResponse: cmd.agentResponse,
      toolCalls: cmd.toolCalls,
      promptTokens: cmd.tokenUsage?.promptTokens || 0,
      completionTokens: cmd.tokenUsage?.completionTokens || 0,
      totalTokens: (cmd.tokenUsage?.promptTokens || 0) + (cmd.tokenUsage?.completionTokens || 0),
      createdAt: new Date()
    });
  }

  // ==========================================
  // 문서 동기화 및 크로스체크 유스케이스
  // ==========================================

  async syncDocs(actor: string = "system"): Promise<{ syncedCount: number }> {
    if (!this.docsScanner) {
      throw new Error("문서 스캐너가 설정되지 않았습니다.");
    }

    const scannedDocs = await this.docsScanner.scanAllDocs();
    for (const doc of scannedDocs) {
      const pathHash = crypto.createHash("sha256").update(doc.filePath).digest("hex").substring(0, 24);
      await this.repository.saveDocMeta({
        docId: `DOC-${pathHash}`,
        filePath: doc.filePath,
        category: doc.category,
        title: doc.title,
        contentHash: doc.contentHash,
        lastSyncedAt: new Date(),
        docPayload: doc.docPayload
      });
    }

    return { syncedCount: scannedDocs.length };
  }

  async verifyDocsConsistency(): Promise<{ isConsistent: boolean; totalFiles: number; missingInDb: string[]; outdatedInDb: string[] }> {
    if (!this.docsScanner) {
      throw new Error("문서 스캐너가 설정되지 않았습니다.");
    }

    const scannedDocs = await this.docsScanner.scanAllDocs();
    const dbDocs = await this.repository.findAllDocsMeta();
    const dbDocsMap = new Map(dbDocs.map((d) => [d.filePath, d]));

    const missingInDb: string[] = [];
    const outdatedInDb: string[] = [];

    for (const scanned of scannedDocs) {
      const dbDoc = dbDocsMap.get(scanned.filePath);
      if (!dbDoc) {
        missingInDb.push(scanned.filePath);
      } else if (dbDoc.contentHash !== scanned.contentHash) {
        outdatedInDb.push(scanned.filePath);
      }
    }

    return {
      isConsistent: missingInDb.length === 0 && outdatedInDb.length === 0,
      totalFiles: scannedDocs.length,
      missingInDb,
      outdatedInDb
    };
  }
}
