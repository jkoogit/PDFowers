/**
 * @file agent-repository.port.ts
 * @description 에이전트 서비스 영속성 아웃바운드 포트(Driven Port) 인터페이스
 */

import { SessionEntity, TaskEntity, LoopEntity } from "../../domain/model.js";

export interface DocMetaRecord {
  docId: string;
  filePath: string;
  category: string;
  title: string;
  contentHash: string;
  lastSyncedAt: Date;
  docPayload: any;
}

export interface ConversationTraceRecord {
  traceId: string;
  sessionId: string;
  taskId?: string;
  stepIndex: number;
  agentName: string;
  modelName: string;
  userPrompt: string;
  agentResponse: string;
  toolCalls?: any;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: Date;
}

export interface AgentRepositoryPort {
  // 세션
  saveSession(session: SessionEntity): Promise<void>;
  findSessionById(sessionId: string): Promise<SessionEntity | null>;

  // 태스크
  saveTask(task: TaskEntity): Promise<void>;
  findTaskById(taskId: string): Promise<TaskEntity | null>;
  findTasksBySessionId(sessionId: string): Promise<TaskEntity[]>;

  // 루프
  saveLoop(loop: LoopEntity): Promise<void>;
  findLoopById(loopId: string): Promise<LoopEntity | null>;
  findLoopsByTaskId(taskId: string): Promise<LoopEntity[]>;

  // 문서 메타
  saveDocMeta(doc: DocMetaRecord): Promise<void>;
  findAllDocsMeta(): Promise<DocMetaRecord[]>;
  findDocMetaByPath(filePath: string): Promise<DocMetaRecord | null>;

  // 감사 로그
  saveConversationTrace(trace: ConversationTraceRecord): Promise<void>;
  findTracesBySessionId(sessionId: string): Promise<ConversationTraceRecord[]>;
}
