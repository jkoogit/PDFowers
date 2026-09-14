/**
 * @file state-machine.ts
 * @description 세션, 태스크, 루프의 상태 전이 규칙 및 유효성 검증 도메인 서비스
 */

import { SessionStatus, TaskStatus, LoopStatus } from "./model.js";

export class InvalidStateTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`[${entity}] 상태를 [${from}]에서 [${to}](으)로 변경할 수 없습니다.`);
    this.name = "InvalidStateTransitionError";
  }
}

/**
 * 1. 세션 상태 전이 규칙
 */
export const SESSION_ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  시작: ["작업", "정리", "종료", "보류", "폐기"],
  작업: ["정리", "종료", "보류", "폐기"],
  정리: ["종료", "작업", "보류", "폐기"],
  종료: [],
  보류: ["시작", "작업", "정리"],
  폐기: []
};


export function validateSessionTransition(from: SessionStatus, to: SessionStatus): void {
  const allowed = SESSION_ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError("Session", from, to);
  }
}

/**
 * 2. 태스크 상태 전이 규칙
 */
export const TASK_ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  시작: ["분석", "처리", "보류", "폐기"],
  분석: ["처리", "보류", "폐기"],
  처리: ["정리", "보류", "폐기"],
  정리: ["승급", "완료", "보류", "폐기"],
  승급: ["완료", "보류", "폐기"],
  완료: [],
  보류: ["시작", "분석", "처리", "정리"],
  폐기: []
};

export function validateTaskTransition(from: TaskStatus, to: TaskStatus): void {
  const allowed = TASK_ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError("Task", from, to);
  }
}

/**
 * 3. 루프 상태 전이 규칙
 */
export const LOOP_ALLOWED_TRANSITIONS: Record<LoopStatus, LoopStatus[]> = {
  분석: ["기획", "설계", "처리", "정지", "보류", "폐기"],
  기획: ["설계", "처리", "정지", "보류", "폐기"],
  설계: ["처리", "정지", "보류", "폐기"],
  처리: ["정리", "보완", "보류", "정지", "폐기"],
  보완: ["설계", "처리", "정지", "보류", "폐기"],
  보류: ["처리", "설계", "정지", "폐기"],
  정리: [],
  정지: [],
  폐기: []
};


export function validateLoopTransition(from: LoopStatus, to: LoopStatus): void {
  const allowed = LOOP_ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError("Loop", from, to);
  }
}
