/**
 * @file agent.ts
 * @description AI 에이전트 하네스 3계층(세션-태스크-루프) 진행관리 및 마크다운 문서 DB Drizzle 스키마
 * 
 * [설계 의도]
 * - 관계형 인덱스 컬럼(ID, 상태, 일시 등)과 유연한 문서 본문(doc_payload JSONB)의 하이브리드 구조를 지원합니다.
 * - JSONB 컬럼에 강력한 TypeScript 인터페이스를 바인딩하여 런타임 및 컴파일 타임 안정성을 확보합니다.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

/**
 * 공통 7종 메타데이터 컬럼 정의
 * (docs/03_설계관리/데이터관리/00_데이터관리설계기준.md 준수)
 */
const metaColumns = {
  createdSys: varchar("created_sys", { length: 50 }).notNull().default("agent-service"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 100 }).notNull().default("system"),
  updatedSys: varchar("updated_sys", { length: 50 }).notNull().default("agent-service"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 100 }).notNull().default("system"),
  version: integer("version").notNull().default(1)
};

/**
 * 1. 세션 메타 및 Document 인덱스 테이블
 */
export const harnessSessionMeta = pgTable(
  "harness_session_meta",
  {
    sessionId: varchar("session_id", { length: 64 }).primaryKey(),
    sessionName: varchar("session_name", { length: 255 }).notNull(),
    workGroup: varchar("work_group", { length: 100 }).notNull(),
    statusCd: varchar("status_cd", { length: 30 }).notNull(),
    aiAgent: varchar("ai_agent", { length: 50 }).notNull(),
    aiModel: varchar("ai_model", { length: 50 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    docPayload: jsonb("doc_payload").notNull(),
    ...metaColumns
  },
  (table) => [
    index("idx_harness_session_status").on(table.statusCd),
    index("idx_harness_session_started_at").on(table.startedAt)
  ]
);

/**
 * 2. 태스크 메타 및 Document 인덱스 테이블
 */
export const harnessTaskMeta = pgTable(
  "harness_task_meta",
  {
    taskId: varchar("task_id", { length: 64 }).primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .notNull()
      .references(() => harnessSessionMeta.sessionId, { onDelete: "cascade" }),
    taskName: varchar("task_name", { length: 255 }).notNull(),
    statusCd: varchar("status_cd", { length: 30 }).notNull(),
    gitBranch: varchar("git_branch", { length: 255 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    docPayload: jsonb("doc_payload").notNull(),
    ...metaColumns
  },
  (table) => [
    index("idx_harness_task_session_status").on(table.sessionId, table.statusCd)
  ]
);

/**
 * 3. 루프 메타 및 Document 인덱스 테이블
 */
export const harnessLoopMeta = pgTable(
  "harness_loop_meta",
  {
    loopId: varchar("loop_id", { length: 64 }).primaryKey(),
    taskId: varchar("task_id", { length: 64 })
      .notNull()
      .references(() => harnessTaskMeta.taskId, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    loopName: varchar("loop_name", { length: 255 }).notNull(),
    statusCd: varchar("status_cd", { length: 30 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    docPayload: jsonb("doc_payload").notNull(),
    ...metaColumns
  },
  (table) => [
    index("idx_harness_loop_task_status").on(table.taskId, table.statusCd)
  ]
);

/**
 * 4. 마크다운 문서 메타 및 프로젝션 테이블
 */
export const agentDocsMeta = pgTable(
  "agent_docs_meta",
  {
    docId: varchar("doc_id", { length: 64 }).primaryKey(),
    filePath: varchar("file_path", { length: 500 }).notNull().unique(),
    category: varchar("category", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    docPayload: jsonb("doc_payload").notNull(),
    ...metaColumns
  },
  (table) => [
    index("idx_agent_docs_category").on(table.category)
  ]
);

/**
 * 5. 에이전트 대화 및 실행 감사 추적 로그 테이블
 */
export const agentConversationTrace = pgTable(
  "agent_conversation_trace",
  {
    traceId: varchar("trace_id", { length: 64 }).primaryKey(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    taskId: varchar("task_id", { length: 64 }),
    stepIndex: integer("step_index").notNull(),
    agentName: varchar("agent_name", { length: 50 }).notNull(),
    modelName: varchar("model_name", { length: 50 }).notNull(),
    userPrompt: text("user_prompt").notNull(),
    agentResponse: text("agent_response").notNull(),
    toolCalls: jsonb("tool_calls"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    ...metaColumns
  },
  (table) => [
    index("idx_agent_trace_session").on(table.sessionId)
  ]
);
