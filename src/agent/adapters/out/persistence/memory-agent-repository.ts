/**
 * @file memory-agent-repository.ts
 * @description 초고속 단위 테스트 및 로컬 실행을 위한 인메모리 아웃바운드 어댑터
 */

import { SessionEntity, TaskEntity, LoopEntity } from "../../../domain/model.js";
import { AgentRepositoryPort, DocMetaRecord, ConversationTraceRecord } from "../../../ports/out/agent-repository.port.js";

export class MemoryAgentRepository implements AgentRepositoryPort {
  private sessions: Map<string, SessionEntity> = new Map();
  private tasks: Map<string, TaskEntity> = new Map();
  private loops: Map<string, LoopEntity> = new Map();
  private docs: Map<string, DocMetaRecord> = new Map();
  private traces: ConversationTraceRecord[] = [];

  async saveSession(session: SessionEntity): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async findSessionById(sessionId: string): Promise<SessionEntity | null> {
    return this.sessions.get(sessionId) || null;
  }

  async saveTask(task: TaskEntity): Promise<void> {
    this.tasks.set(task.taskId, task);
  }

  async findTaskById(taskId: string): Promise<TaskEntity | null> {
    return this.tasks.get(taskId) || null;
  }

  async findTasksBySessionId(sessionId: string): Promise<TaskEntity[]> {
    return Array.from(this.tasks.values()).filter((t) => t.sessionId === sessionId);
  }

  async saveLoop(loop: LoopEntity): Promise<void> {
    this.loops.set(loop.loopId, loop);
  }

  async findLoopById(loopId: string): Promise<LoopEntity | null> {
    return this.loops.get(loopId) || null;
  }

  async findLoopsByTaskId(taskId: string): Promise<LoopEntity[]> {
    return Array.from(this.loops.values()).filter((l) => l.taskId === taskId);
  }

  async saveDocMeta(doc: DocMetaRecord): Promise<void> {
    this.docs.set(doc.filePath, doc);
  }

  async findAllDocsMeta(): Promise<DocMetaRecord[]> {
    return Array.from(this.docs.values());
  }

  async findDocMetaByPath(filePath: string): Promise<DocMetaRecord | null> {
    return this.docs.get(filePath) || null;
  }

  async saveConversationTrace(trace: ConversationTraceRecord): Promise<void> {
    this.traces.push(trace);
  }

  async findTracesBySessionId(sessionId: string): Promise<ConversationTraceRecord[]> {
    return this.traces.filter((t) => t.sessionId === sessionId);
  }

  public clear(): void {
    this.sessions.clear();
    this.tasks.clear();
    this.loops.clear();
    this.docs.clear();
    this.traces = [];
  }
}
