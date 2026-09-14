/**
 * @file model.ts
 * @description 에이전트 서비스 도메인 모델 (Entities & Value Objects)
 * 
 * [설계 원칙]
 * - 풍부한 도메인 모델(Rich Domain Model): 엔티티 스스로 비즈니스 규칙과 불변식을 검증하고 상태를 변경합니다.
 * - 값 객체(Value Object): 불변성(Immutability)을 보장하며 값의 동등성으로 비교합니다.
 */

export type SessionStatus = "시작" | "작업" | "정리" | "종료" | "보류" | "폐기";
export type TaskStatus = "시작" | "분석" | "처리" | "정리" | "승급" | "완료" | "보류" | "폐기";
export type LoopStatus = "분석" | "기획" | "설계" | "처리" | "정리" | "정지" | "보류" | "보완" | "폐기";

/**
 * 1. 공통 메타데이터 값 객체 (AuditMetaVO)
 */
export interface AuditMeta {
  createdSys: string;
  createdAt: Date;
  createdBy: string;
  updatedSys: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export function createAuditMeta(actor: string = "system", system: string = "agent-service"): AuditMeta {
  const now = new Date();
  return {
    createdSys: system,
    createdAt: now,
    createdBy: actor,
    updatedSys: system,
    updatedAt: now,
    updatedBy: actor,
    version: 1
  };
}

export function touchAuditMeta(prev: AuditMeta, actor: string = "system", system: string = "agent-service"): AuditMeta {
  return {
    ...prev,
    updatedSys: system,
    updatedAt: new Date(),
    updatedBy: actor,
    version: prev.version + 1
  };
}

/**
 * 2. 토큰 소비량 값 객체 (TokenUsageVO)
 */
export class TokenUsage {
  constructor(
    public readonly promptTokens: number = 0,
    public readonly completionTokens: number = 0
  ) {
    if (promptTokens < 0 || completionTokens < 0) {
      throw new Error("토큰 수는 음수일 수 없습니다.");
    }
  }

  get totalTokens(): number {
    return this.promptTokens + this.completionTokens;
  }

  public add(other: TokenUsage): TokenUsage {
    return new TokenUsage(
      this.promptTokens + other.promptTokens,
      this.completionTokens + other.completionTokens
    );
  }

  public toJSON() {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens
    };
  }
}

/**
 * 3. 루프 WorkItem 값 객체
 */
export interface WorkItemVO {
  objective: string;
  scope: string;
  allowPaths: string[];
  completionCriteria: string[];
  verifyCommand: string;
}

/**
 * 4. 루프(Loop) 도메인 엔티티
 */
export class LoopEntity {
  private _status: LoopStatus;
  private _endedAt: Date | null = null;
  private _diffSummary: string | null = null;
  private _verifyResult: { status: "SUCCESS" | "FAILED" | "SKIPPED"; logs: string } | null = null;
  private _meta: AuditMeta;

  constructor(
    public readonly loopId: string,
    public readonly taskId: string,
    public readonly sessionId: string,
    public readonly loopName: string,
    public readonly startedAt: Date,
    public readonly workItem: WorkItemVO,
    initialStatus: LoopStatus = "분석",
    meta?: AuditMeta
  ) {
    this._status = initialStatus;
    this._meta = meta || createAuditMeta();
  }

  get status(): LoopStatus {
    return this._status;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }

  get diffSummary(): string | null {
    return this._diffSummary;
  }

  get verifyResult() {
    return this._verifyResult;
  }

  get meta(): AuditMeta {
    return this._meta;
  }

  /** 종결 상태 여부 확인 (정리 또는 정지 상태만 종결로 판단) */
  public isTerminalState(): boolean {
    return this._status === "정리" || this._status === "정지" || this._status === "폐기";
  }

  public process(actor: string = "system"): void {
    this._status = "처리";
    this._meta = touchAuditMeta(this._meta, actor);
  }

  public complete(diffSummary: string, verifyLogs: string, actor: string = "system"): void {

    this._status = "정리";
    this._diffSummary = diffSummary;
    this._verifyResult = { status: "SUCCESS", logs: verifyLogs };
    this._endedAt = new Date();
    this._meta = touchAuditMeta(this._meta, actor);
  }

  public control(action: "PAUSE" | "HOLD" | "REVISE" | "ABORT", reason: string, actor: string = "system"): void {
    switch (action) {
      case "PAUSE":
      case "HOLD":
        this._status = "보류";
        break;
      case "REVISE":
        this._status = "보완";
        break;
      case "ABORT":
        this._status = "정지";
        this._endedAt = new Date();
        break;
    }
    this._meta = touchAuditMeta(this._meta, actor);
  }
}

/**
 * 5. 태스크(Task) 도메인 엔티티
 */
export class TaskEntity {
  private _status: TaskStatus;
  private _endedAt: Date | null = null;
  private _gitInfo: {
    branch: string;
    startCommit?: string;
    endCommit?: string;
    pr?: { prNumber: number; title: string; body: string; url: string; mergedAt?: Date };
    promotionCommits?: { devToStgSha?: string; stgToMainSha?: string };
  };
  private _draftBacklogs: Array<{ draftId: string; title: string; content: string; status: string }> = [];
  private readonly _loops: Map<string, LoopEntity> = new Map();
  private _meta: AuditMeta;

  constructor(
    public readonly taskId: string,
    public readonly sessionId: string,
    public readonly taskName: string,
    public readonly startedAt: Date,
    gitBranch: string,
    initialStatus: TaskStatus = "시작",
    meta?: AuditMeta
  ) {
    this._status = initialStatus;
    this._gitInfo = { branch: gitBranch };
    this._meta = meta || createAuditMeta();
  }

  get status(): TaskStatus {
    return this._status;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }

  get gitInfo() {
    return this._gitInfo;
  }

  get draftBacklogs() {
    return [...this._draftBacklogs];
  }

  get loops(): LoopEntity[] {
    return Array.from(this._loops.values());
  }

  get meta(): AuditMeta {
    return this._meta;
  }

  public addLoop(loop: LoopEntity): void {
    this._loops.set(loop.loopId, loop);
  }

  public addDraftBacklog(draftId: string, title: string, content: string): void {
    this._draftBacklogs.push({ draftId, title, content, status: "DRAFT" });
  }

  /**
   * 태스크 처리 시작
   */
  public process(actor: string = "system"): void {
    this._status = "처리";
    this._meta = touchAuditMeta(this._meta, actor);
  }

  /**
   * 태스크 정리 (Loop Guard 검증 필수)
   */
  public clean(
    params: {
      endCommit?: string;
      pr?: { prNumber: number; title: string; body: string; url: string };
    },
    actor: string = "system"
  ): void {
    // ⭐️ 루프 가드 (Loop Guard): 미완료 상태의 루프가 있는지 검사
    const unresolvedLoops = this.loops.filter((l) => !l.isTerminalState());
    if (unresolvedLoops.length > 0) {
      throw new Error(
        `태스크를 정리할 수 없습니다. 미완료 루프가 ${unresolvedLoops.length}개 존재합니다: [${unresolvedLoops.map((l) => l.loopId).join(", ")}]`
      );
    }

    this._status = "정리";
    this._endedAt = new Date();
    if (params.endCommit) this._gitInfo.endCommit = params.endCommit;
    if (params.pr) this._gitInfo.pr = params.pr;
    this._meta = touchAuditMeta(this._meta, actor);
  }

  /**
   * 태스크 승급
   */
  public promote(
    promotionCommits: { devToStgSha?: string; stgToMainSha?: string },
    actor: string = "system"
  ): void {
    this._status = "승급";
    this._gitInfo.promotionCommits = promotionCommits;
    this._meta = touchAuditMeta(this._meta, actor);
  }
}

/**
 * 6. 세션(Session) 도메인 엔티티
 */
export class SessionEntity {
  private _status: SessionStatus;
  private _endedAt: Date | null = null;
  private _aiMeta: { agent: string; model: string; version: string; agentStatus: string; totalTokens: TokenUsage };
  private _retrospective: { docId?: string; docPath?: string; summary?: string; author?: string } | null = null;
  private _backlogIds: string[] = [];
  private readonly _tasks: Map<string, TaskEntity> = new Map();
  private _meta: AuditMeta;

  constructor(
    public readonly sessionId: string,
    public readonly sessionName: string,
    public readonly workGroup: string[],
    public readonly startedAt: Date,
    aiMeta: { agent: string; model: string; version: string; agentStatus: string },
    initialStatus: SessionStatus = "시작",
    meta?: AuditMeta
  ) {
    this._status = initialStatus;
    this._aiMeta = { ...aiMeta, totalTokens: new TokenUsage(0, 0) };
    this._meta = meta || createAuditMeta();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }

  get aiMeta() {
    return this._aiMeta;
  }

  get retrospective() {
    return this._retrospective;
  }

  get backlogIds(): string[] {
    return [...this._backlogIds];
  }

  get tasks(): TaskEntity[] {
    return Array.from(this._tasks.values());
  }

  get meta(): AuditMeta {
    return this._meta;
  }

  public addTask(task: TaskEntity): void {
    this._tasks.set(task.taskId, task);
  }

  public addTokenUsage(usage: TokenUsage): void {
    this._aiMeta.totalTokens = this._aiMeta.totalTokens.add(usage);
  }

  public startWorking(actor: string = "system"): void {
    this._status = "작업";
    this._meta = touchAuditMeta(this._meta, actor);
  }

  public complete(
    retrospective: { docId?: string; docPath?: string; summary?: string; author?: string },
    backlogIds: string[],
    tokenUsage?: TokenUsage,
    actor: string = "system"
  ): void {
    this._status = "종료";
    this._endedAt = new Date();
    this._retrospective = retrospective;
    this._backlogIds = backlogIds;
    if (tokenUsage) {
      this.addTokenUsage(tokenUsage);
    }
    this._meta = touchAuditMeta(this._meta, actor);
  }
}
