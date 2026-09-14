/**
 * @file drizzle-agent-repository.ts
 * @description PostgreSQL 및 Drizzle ORM 기반 프로덕션 영속성 아웃바운드 어댑터
 */

import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { SessionEntity, TaskEntity, LoopEntity } from "../../../domain/model.js";
import { AgentRepositoryPort, DocMetaRecord, ConversationTraceRecord } from "../../../ports/out/agent-repository.port.js";
import {
  harnessSessionMeta,
  harnessTaskMeta,
  harnessLoopMeta,
  agentDocsMeta,
  agentConversationTrace
} from "../../../../db/schema/agent.js";



export class DrizzleAgentRepository implements AgentRepositoryPort {
  constructor(private readonly db: NodePgDatabase<any>) {}

  async saveSession(session: SessionEntity): Promise<void> {
    const payload = {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      workGroup: session.workGroup,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() || null,
      aiMeta: {
        agent: session.aiMeta.agent,
        model: session.aiMeta.model,
        version: session.aiMeta.version,
        agentStatus: session.aiMeta.agentStatus,
        totalTokenUsage: session.aiMeta.totalTokens.toJSON()
      },
      retrospective: session.retrospective,
      backlogIds: session.backlogIds,
      taskList: session.tasks.map((t) => ({
        taskId: t.taskId,
        taskName: t.taskName,
        status: t.status
      })),
      meta: session.meta
    };

    await this.db
      .insert(harnessSessionMeta)
      .values({
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        workGroup: session.workGroup.join(","),
        statusCd: session.status,
        aiAgent: session.aiMeta.agent,
        aiModel: session.aiMeta.model,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        docPayload: payload,
        createdSys: session.meta.createdSys,
        createdAt: session.meta.createdAt,
        createdBy: session.meta.createdBy,
        updatedSys: session.meta.updatedSys,
        updatedAt: session.meta.updatedAt,
        updatedBy: session.meta.updatedBy,
        version: session.meta.version
      })
      .onConflictDoUpdate({
        target: harnessSessionMeta.sessionId,
        set: {
          sessionName: session.sessionName,
          workGroup: session.workGroup.join(","),
          statusCd: session.status,
          endedAt: session.endedAt,
          docPayload: payload,
          updatedSys: session.meta.updatedSys,
          updatedAt: session.meta.updatedAt,
          updatedBy: session.meta.updatedBy,
          version: session.meta.version
        }
      });
  }

  async findSessionById(sessionId: string): Promise<SessionEntity | null> {
    const rows = await this.db
      .select()
      .from(harnessSessionMeta)
      .where(eq(harnessSessionMeta.sessionId, sessionId))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    const doc = row.docPayload as any;

    const session = new SessionEntity(
      row.sessionId,
      row.sessionName,
      row.workGroup.split(","),
      new Date(row.startedAt),
      doc.aiMeta,
      row.statusCd as any,
      {
        createdSys: row.createdSys,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedSys: row.updatedSys,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        version: row.version
      }
    );

    return session;
  }

  async saveTask(task: TaskEntity): Promise<void> {
    const payload = {
      taskId: task.taskId,
      sessionId: task.sessionId,
      taskName: task.taskName,
      status: task.status,
      startedAt: task.startedAt.toISOString(),
      endedAt: task.endedAt?.toISOString() || null,
      gitInfo: task.gitInfo,
      draftBacklogs: task.draftBacklogs,
      loopList: task.loops.map((l) => ({
        loopId: l.loopId,
        loopName: l.loopName,
        status: l.status
      })),
      meta: task.meta
    };

    await this.db
      .insert(harnessTaskMeta)
      .values({
        taskId: task.taskId,
        sessionId: task.sessionId,
        taskName: task.taskName,
        statusCd: task.status,
        gitBranch: task.gitInfo.branch,
        startedAt: task.startedAt,
        endedAt: task.endedAt,
        docPayload: payload,
        createdSys: task.meta.createdSys,
        createdAt: task.meta.createdAt,
        createdBy: task.meta.createdBy,
        updatedSys: task.meta.updatedSys,
        updatedAt: task.meta.updatedAt,
        updatedBy: task.meta.updatedBy,
        version: task.meta.version
      })
      .onConflictDoUpdate({
        target: harnessTaskMeta.taskId,
        set: {
          taskName: task.taskName,
          statusCd: task.status,
          gitBranch: task.gitInfo.branch,
          endedAt: task.endedAt,
          docPayload: payload,
          updatedSys: task.meta.updatedSys,
          updatedAt: task.meta.updatedAt,
          updatedBy: task.meta.updatedBy,
          version: task.meta.version
        }
      });
  }

  async findTaskById(taskId: string): Promise<TaskEntity | null> {
    const rows = await this.db
      .select()
      .from(harnessTaskMeta)
      .where(eq(harnessTaskMeta.taskId, taskId))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];

    return new TaskEntity(
      row.taskId,
      row.sessionId,
      row.taskName,
      new Date(row.startedAt),
      row.gitBranch,
      row.statusCd as any,
      {
        createdSys: row.createdSys,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedSys: row.updatedSys,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        version: row.version
      }
    );
  }

  async findTasksBySessionId(sessionId: string): Promise<TaskEntity[]> {
    const rows = await this.db
      .select()
      .from(harnessTaskMeta)
      .where(eq(harnessTaskMeta.sessionId, sessionId));

    return rows.map(
      (row) =>
        new TaskEntity(
          row.taskId,
          row.sessionId,
          row.taskName,
          new Date(row.startedAt),
          row.gitBranch,
          row.statusCd as any,
          {
            createdSys: row.createdSys,
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            updatedSys: row.updatedSys,
            updatedAt: row.updatedAt,
            updatedBy: row.updatedBy,
            version: row.version
          }
        )
    );
  }

  async saveLoop(loop: LoopEntity): Promise<void> {
    const payload = {
      loopId: loop.loopId,
      taskId: loop.taskId,
      sessionId: loop.sessionId,
      loopName: loop.loopName,
      status: loop.status,
      startedAt: loop.startedAt.toISOString(),
      endedAt: loop.endedAt?.toISOString() || null,
      workItem: loop.workItem,
      diffSummary: loop.diffSummary,
      verifyResult: loop.verifyResult,
      meta: loop.meta
    };

    await this.db
      .insert(harnessLoopMeta)
      .values({
        loopId: loop.loopId,
        taskId: loop.taskId,
        sessionId: loop.sessionId,
        loopName: loop.loopName,
        statusCd: loop.status,
        startedAt: loop.startedAt,
        endedAt: loop.endedAt,
        docPayload: payload,
        createdSys: loop.meta.createdSys,
        createdAt: loop.meta.createdAt,
        createdBy: loop.meta.createdBy,
        updatedSys: loop.meta.updatedSys,
        updatedAt: loop.meta.updatedAt,
        updatedBy: loop.meta.updatedBy,
        version: loop.meta.version
      })
      .onConflictDoUpdate({
        target: harnessLoopMeta.loopId,
        set: {
          loopName: loop.loopName,
          statusCd: loop.status,
          endedAt: loop.endedAt,
          docPayload: payload,
          updatedSys: loop.meta.updatedSys,
          updatedAt: loop.meta.updatedAt,
          updatedBy: loop.meta.updatedBy,
          version: loop.meta.version
        }
      });
  }

  async findLoopById(loopId: string): Promise<LoopEntity | null> {
    const rows = await this.db
      .select()
      .from(harnessLoopMeta)
      .where(eq(harnessLoopMeta.loopId, loopId))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    const doc = row.docPayload as any;

    return new LoopEntity(
      row.loopId,
      row.taskId,
      row.sessionId,
      row.loopName,
      new Date(row.startedAt),
      doc.workItem,
      row.statusCd as any,
      {
        createdSys: row.createdSys,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        updatedSys: row.updatedSys,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        version: row.version
      }
    );
  }

  async findLoopsByTaskId(taskId: string): Promise<LoopEntity[]> {
    const rows = await this.db
      .select()
      .from(harnessLoopMeta)
      .where(eq(harnessLoopMeta.taskId, taskId));

    return rows.map((row) => {
      const doc = row.docPayload as any;
      return new LoopEntity(
        row.loopId,
        row.taskId,
        row.sessionId,
        row.loopName,
        new Date(row.startedAt),
        doc.workItem,
        row.statusCd as any,
        {
          createdSys: row.createdSys,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
          updatedSys: row.updatedSys,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
          version: row.version
        }
      );
    });
  }

  async saveDocMeta(doc: DocMetaRecord): Promise<void> {
    const now = new Date();
    await this.db
      .insert(agentDocsMeta)
      .values({
        docId: doc.docId,
        filePath: doc.filePath,
        category: doc.category,
        title: doc.title,
        contentHash: doc.contentHash,
        lastSyncedAt: doc.lastSyncedAt || now,
        docPayload: doc.docPayload,
        createdSys: "agent-service",
        createdAt: now,
        createdBy: "system",
        updatedSys: "agent-service",
        updatedAt: now,
        updatedBy: "system",
        version: 1
      })
      .onConflictDoUpdate({
        target: agentDocsMeta.filePath,
        set: {
          category: doc.category,
          title: doc.title,
          contentHash: doc.contentHash,
          lastSyncedAt: doc.lastSyncedAt || now,
          docPayload: doc.docPayload,
          updatedSys: "agent-service",
          updatedAt: now,
          updatedBy: "system"
        }
      });
  }

  async findAllDocsMeta(): Promise<DocMetaRecord[]> {
    const rows = await this.db.select().from(agentDocsMeta);
    return rows.map((r) => ({
      docId: r.docId,
      filePath: r.filePath,
      category: r.category,
      title: r.title,
      contentHash: r.contentHash,
      lastSyncedAt: r.lastSyncedAt,
      docPayload: r.docPayload
    }));
  }

  async findDocMetaByPath(filePath: string): Promise<DocMetaRecord | null> {
    const rows = await this.db
      .select()
      .from(agentDocsMeta)
      .where(eq(agentDocsMeta.filePath, filePath))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      docId: r.docId,
      filePath: r.filePath,
      category: r.category,
      title: r.title,
      contentHash: r.contentHash,
      lastSyncedAt: r.lastSyncedAt,
      docPayload: r.docPayload
    };
  }

  async saveConversationTrace(trace: ConversationTraceRecord): Promise<void> {
    const now = new Date();
    await this.db.insert(agentConversationTrace).values({
      traceId: trace.traceId,
      sessionId: trace.sessionId,
      taskId: trace.taskId,
      stepIndex: trace.stepIndex,
      agentName: trace.agentName,
      modelName: trace.modelName,
      userPrompt: trace.userPrompt,
      agentResponse: trace.agentResponse,
      toolCalls: trace.toolCalls || [],
      promptTokens: trace.promptTokens,
      completionTokens: trace.completionTokens,
      totalTokens: trace.totalTokens,
      createdSys: "agent-service",
      createdAt: trace.createdAt || now,
      createdBy: trace.agentName || "gemini",
      updatedSys: "agent-service",
      updatedAt: now,
      updatedBy: trace.agentName || "gemini",
      version: 1
    });
  }

  async findTracesBySessionId(sessionId: string): Promise<ConversationTraceRecord[]> {
    const rows = await this.db
      .select()
      .from(agentConversationTrace)
      .where(eq(agentConversationTrace.sessionId, sessionId));

    return rows.map((r) => ({
      traceId: r.traceId,
      sessionId: r.sessionId,
      taskId: r.taskId || undefined,
      stepIndex: r.stepIndex,
      agentName: r.agentName,
      modelName: r.modelName,
      userPrompt: r.userPrompt,
      agentResponse: r.agentResponse,
      toolCalls: r.toolCalls,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      createdAt: r.createdAt
    }));
  }
}
