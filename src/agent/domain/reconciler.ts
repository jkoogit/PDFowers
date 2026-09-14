/**
 * @file reconciler.ts
 * @description 세션-태스크-루프 간 상위 요약 및 작업 그래프 불일치 자가 치유(Reconciliation) 도메인 서비스
 */

import { SessionEntity, TaskEntity, LoopEntity } from "./model.js";

export interface ReconcileDiff {
  entity: string;
  field: string;
  before: any;
  after: any;
  reason: string;
}

export interface ReconcileResult {
  sessionId: string;
  inconsistenciesFound: number;
  repaired: boolean;
  diffs: ReconcileDiff[];
}

/**
 * 세션 및 하위 태스크/루프 간의 불일치를 스캔하고 자가 치유(Reconcile)를 수행한다.
 */
export function reconcileSessionState(
  session: SessionEntity,
  tasks: TaskEntity[],
  loopsByTaskId: Map<string, LoopEntity[]>
): ReconcileResult {
  const diffs: ReconcileDiff[] = [];

  // 1. 태스크 목록 동기화 점검
  const sessionTaskIds = new Set(session.tasks.map((t) => t.taskId));
  for (const task of tasks) {
    if (!sessionTaskIds.has(task.taskId)) {
      diffs.push({
        entity: `Session[${session.sessionId}]`,
        field: "tasks",
        before: "MISSING",
        after: task.taskId,
        reason: "하위 태스크 레코드가 세션 태스크 목록에 누락되어 추가함"
      });
      session.addTask(task);
    }

    // 2. 루프 목록 동기화 점검
    const actualLoops = loopsByTaskId.get(task.taskId) || [];
    const taskLoopIds = new Set(task.loops.map((l) => l.loopId));
    for (const loop of actualLoops) {
      if (!taskLoopIds.has(loop.loopId)) {
        diffs.push({
          entity: `Task[${task.taskId}]`,
          field: "loops",
          before: "MISSING",
          after: loop.loopId,
          reason: "하위 루프 레코드가 태스크 루프 목록에 누락되어 추가함"
        });
        task.addLoop(loop);
      }
    }
  }

  return {
    sessionId: session.sessionId,
    inconsistenciesFound: diffs.length,
    repaired: diffs.length > 0,
    diffs
  };
}
