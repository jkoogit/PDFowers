/**
 * @file agent-usecases.ts
 * @description 에이전트 서비스 인바운드 유스케이스(Driving Ports) 인터페이스
 */

import { SessionEntity, TaskEntity, LoopEntity, SessionStatus, TaskStatus, LoopStatus, TokenUsage } from "../../domain/model.js";
import { ReconcileResult } from "../../domain/reconciler.js";

export interface StartSessionCommand {
  sessionId: string;
  sessionName: string;
  parentSessionId?: string | null;
  relatedSessions?: Array<{ sessionId: string; relationType: string }>;
  workGroup: string[];
  agent: string;
  model: string;
  version?: string;
  actor?: string;
}

export interface CompleteSessionCommand {
  sessionId: string;
  retrospective: { docId?: string; docPath?: string; summary?: string; author?: string };
  officialBacklogs: string[];
  tokenUsage?: { promptTokens: number; completionTokens: number };
  actor?: string;
}

export interface StartTaskCommand {
  taskId: string;
  sessionId: string;
  taskName: string;
  gitBranch: string;
  actor?: string;
}

export interface CleanTaskCommand {
  taskId: string;
  endCommit?: string;
  pr?: { prNumber: number; title: string; body: string; url: string };
  actor?: string;
}

export interface PromoteTaskCommand {
  taskId: string;
  promotionCommits: { devToStgSha?: string; stgToMainSha?: string };
  actor?: string;
}

export interface StartLoopCommand {
  loopId: string;
  taskId: string;
  sessionId: string;
  loopName: string;
  workItem: {
    objective: string;
    scope: string;
    allowPaths: string[];
    completionCriteria: string[];
    verifyCommand: string;
  };
  actor?: string;
}

export interface CompleteLoopCommand {
  loopId: string;
  diffSummary: string;
  verifyLogs: string;
  actor?: string;
}

export interface ControlLoopCommand {
  loopId: string;
  action: "PAUSE" | "HOLD" | "REVISE" | "ABORT";
  reason: string;
  actor?: string;
}

export interface TraceConversationCommand {
  sessionId: string;
  taskId?: string;
  stepIndex: number;
  agentName: string;
  modelName: string;
  userPrompt: string;
  agentResponse: string;
  toolCalls?: any[];
  tokenUsage?: { promptTokens: number; completionTokens: number };
  actor?: string;
}

export interface AgentUseCasePort {
  // 세션
  startSession(cmd: StartSessionCommand): Promise<SessionEntity>;
  completeSession(cmd: CompleteSessionCommand): Promise<SessionEntity>;
  getSession(sessionId: string): Promise<SessionEntity | null>;

  // 태스크
  startTask(cmd: StartTaskCommand): Promise<TaskEntity>;
  processTask(taskId: string, actor?: string): Promise<TaskEntity>;
  cleanTask(cmd: CleanTaskCommand): Promise<TaskEntity>;
  promoteTask(cmd: PromoteTaskCommand): Promise<TaskEntity>;
  getTask(taskId: string): Promise<TaskEntity | null>;

  // 루프
  startLoop(cmd: StartLoopCommand): Promise<LoopEntity>;
  processLoop(loopId: string, actor?: string): Promise<LoopEntity>;
  completeLoop(cmd: CompleteLoopCommand): Promise<LoopEntity>;
  controlLoop(cmd: ControlLoopCommand): Promise<LoopEntity>;


  // 자가 치유
  reconcile(sessionId: string, actor?: string): Promise<ReconcileResult>;

  // 대화 및 감사 로그
  traceConversation(cmd: TraceConversationCommand): Promise<void>;

  // 문서 동기화 및 크로스체크
  syncDocs(actor?: string): Promise<{ syncedCount: number }>;
  verifyDocsConsistency(): Promise<{ isConsistent: boolean; totalFiles: number; missingInDb: string[]; outdatedInDb: string[] }>;
}
