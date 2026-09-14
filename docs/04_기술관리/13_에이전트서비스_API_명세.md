# 13. 에이전트 서비스(Agent Service) API 명세서

## 1. 개요

에이전트 서비스(Agent Service)는 AI 에이전트(Codex, Gemini 등)의 하네스 3계층(**세션 - 태스크 - 루프**) 작업 정보와 작업 그래프(DAG), 문서(Markdown) DB 프로젝션 및 대화/토큰 이력을 REST API를 통해 체계적으로 영속화하고 조회하는 중앙 백엔드 서비스다.

### 1.1 기본 정보
- **기본 URL Prefix**: `/api/agent/v1`
- **데이터 교환 형식**: `application/json; charset=utf-8`
- **인증 방식**: 내부 API 토큰 (`X-Agent-Secret` 또는 로컬 IPC/서비스 계정)
- **공통 응답 규격**:
```json
// 성공 응답
{
  "success": true,
  "data": { ... },
  "message": "성공 메시지",
  "timestamp": "2026-09-15T01:00:00.000Z"
}

// 에러 응답
{
  "success": false,
  "error": {
    "code": "LOOP_GUARD_VIOLATION",
    "message": "미완료 상태의 루프가 존재하여 태스크를 정리할 수 없습니다.",
    "details": { "unresolved_loops": ["LP-01"] }
  },
  "timestamp": "2026-09-15T01:00:00.000Z"
}
```

---

## 2. 작업정보 관리 API (Work Management API)

### 2.1 세션 시작 (`#세션시작`)
- **HTTP Method & Path**: `POST /api/agent/v1/sessions/start`
- **설명**: 새로운 세션을 시작하거나 기존 세션의 시작 정보를 등록하고 작업 그래프를 초기화한다.
- **Request Body**:
```json
{
  "session_id": "SES-20260915-01",
  "session_name": "16-세션_태스크_진행관리_문서DB_기획분석설계",
  "parent_session_id": null,
  "related_sessions": [
    { "session_id": "SES-20260626-15", "relation_type": "PRECEDING" }
  ],
  "work_group": ["기획", "분석", "설계"],
  "ai_agent": {
    "agent": "gemini",
    "model": "gemini-3.7-flash",
    "version": "2.0",
    "agent_status": "ACTIVE"
  },
  "git_issue": {
    "issue_number": 76,
    "title": "세션/태스크 진행관리 프로세스 및 문서DB 설계",
    "body": "하네스 3계층 진행정보 및 문서DB 스키마 기획·분석·설계"
  },
  "created_by": "gemini"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "session_id": "SES-20260915-01",
    "status": "시작",
    "started_at": "2026-09-15T01:00:00.000Z",
    "version": 1
  }
}
```

---

### 2.2 세션 완료 및 정리 (`#세션정리`)
- **HTTP Method & Path**: `POST /api/agent/v1/sessions/complete`
- **설명**: 세션 회고 내용, 최종 백로그 ID 목록, 토큰 누적 소비량을 기록하고 세션을 완료 상태로 전이한다.
- **Request Body**:
```json
{
  "session_id": "SES-20260915-01",
  "retrospective": {
    "doc_id": "DOC-REV-260915-01",
    "doc_path": "docs/10_리뷰관리/202609/15/260915_01_세션리뷰_설계문서화.md",
    "author": "gemini",
    "summary": "세션-태스크-루프 진행관리 문서DB 설계 및 API 명세 완료"
  },
  "official_backlogs": [
    { "backlog_id": "BL-20260915-001", "title": "에이전트 서비스 API 구현", "priority": "높음" }
  ],
  "total_token_usage": {
    "prompt_tokens": 12500,
    "completion_tokens": 4200,
    "total_tokens": 16700
  },
  "final_status": "종료",
  "updated_by": "gemini"
}
```

---

### 2.3 태스크 시작 (`#태스크시작`)
- **HTTP Method & Path**: `POST /api/agent/v1/tasks/start`
- **설명**: 세션 내 하위 태스크를 시작하고 부모 세션의 `task_list`에 요약을 추가한다.
- **Request Body**:
```json
{
  "task_id": "TSK-20260915-01",
  "session_id": "SES-20260915-01",
  "task_name": "세션태스크루프_진행관리_설계문서화",
  "git_branch": "task/하네스규칙현행화-및-백로그체계구축_gemini",
  "created_by": "gemini"
}
```

---

### 2.4 태스크 정리 및 PR 등록 (`#태스크정리`)
- **HTTP Method & Path**: `POST /api/agent/v1/tasks/clean`
- **설명**: 단위 검증 결과, git 커밋 해시, PR 정보를 등록하고 태스크를 정리 상태로 전이한다. (루프 가드 검증 필수)
- **Request Body**:
```json
{
  "task_id": "TSK-20260915-01",
  "end_commit": "e8a7c2b",
  "pr": {
    "pr_number": 77,
    "title": "세션-태스크-루프 진행관리 문서DB 설계",
    "body": "하네스 3계층 스키마 및 API 명세 작성",
    "url": "https://github.com/jkoogit/PDFowers/pull/77"
  },
  "retrospective": {
    "summary": "3종 설계 문서 작성 및 규칙 현행화 완료",
    "completed_items": ["문서DB설계", "API명세", "하네스운영절차현행화"]
  },
  "updated_by": "gemini"
}
```

---

### 2.5 태스크 승급 (`#태스크승급`)
- **HTTP Method & Path**: `POST /api/agent/v1/tasks/promote`
- **설명**: `dev -> stg -> main` 직접 승급 머지 결과를 등록하고 태스크를 완료(`COMPLETED`) 상태로 종결한다.
- **Request Body**:
```json
{
  "task_id": "TSK-20260915-01",
  "promotion_commits": {
    "dev_to_stg_sha": "a1b2c3d4",
    "stg_to_main_sha": "e5f6g7h8"
  },
  "updated_by": "gemini"
}
```

---

### 2.6 루프 생명주기 및 제어 API
- **루프 시작**: `POST /api/agent/v1/loops/start`
  - Body: `loop_id`, `task_id`, `session_id`, `loop_name`, `work_item: { objective, scope, allow_paths, completion_criteria, verify_command }`
- **루프 완료**: `POST /api/agent/v1/loops/complete`
  - Body: `loop_id`, `checkpoint: { commit_hash }`, `diff_summary`, `verify_result: { status, logs }`
- **루프 제어 (정지/보류/보완)**: `POST /api/agent/v1/loops/control`
  - Body: `loop_id`, `action: 'PAUSE' | 'HOLD' | 'REVISE' | 'RESUME' | 'ABORT'`, `reason`

---

### 2.7 상시 자가 치유 실행 (Reconciler API)
- **HTTP Method & Path**: `POST /api/agent/v1/reconcile`
- **설명**: 지정된 세션 또는 태스크의 하위 레코드를 스캔하여 상위 문서의 요약 캐시 및 작업 그래프의 불일치를 자동 보정한다.
- **Request Body**:
```json
{
  "session_id": "SES-20260915-01",
  "auto_repair": true,
  "requested_by": "gemini"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "inconsistencies_found": 1,
    "repaired": true,
    "diffs": [
      {
        "entity": "task_list[TSK-01]",
        "before_status": "처리",
        "after_status": "정리",
        "reason": "Task record actual status is 정리"
      }
    ],
    "new_version": 2
  }
}
```

---

## 3. 문서 관리 및 뷰어 API (Docs & Viewer API)

### 3.1 단계별 문서 현행화 (`#루프정리`, `#태스크정리`, `#세션정리`)
- **HTTP Method & Path**: `POST /api/agent/v1/docs/sync`
- **설명**: 변경된 마크다운 문서 목록을 전달받아 파싱 후 `agent_docs_meta` DB에 현행화한다.
- **Request Body**:
```json
{
  "files": [
    {
      "file_path": "docs/03_설계관리/데이터관리/03_하네스_세션태스크루프_진행관리_문서DB설계.md",
      "category": "설계관리",
      "title": "03. 하네스 세션·태스크·루프 진행관리 문서 DB 설계서",
      "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "frontmatter": { "author": "gemini", "status": "APPROVED" }
    }
  ],
  "synced_by": "gemini"
}
```

---

### 3.2 세션정리 문서 크로스체크 검증
- **HTTP Method & Path**: `POST /api/agent/v1/docs/verify-consistency`
- **설명**: 로컬 `/docs` 전체 파일 목록 및 해시를 DB와 대조하여 누락, 미동기화 문서 여부를 리포트한다.
- **Request Body**:
```json
{
  "file_hashes": [
    { "file_path": "docs/README.md", "content_hash": "a1b2..." },
    { "file_path": "docs/03_설계관리/데이터관리/00_데이터관리설계기준.md", "content_hash": "c3d4..." }
  ]
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "is_consistent": true,
    "total_files": 35,
    "missing_in_db": [],
    "outdated_in_db": []
  }
}
```

---

### 3.3 문서 트리 및 상세 조회 (뷰어용 API)
- **문서 트리 조회**: `GET /api/agent/v1/docs/tree`
  - 카테고리별(산출물, 설계관리, 기술관리, 이슈관리 등) 계층형 문서 트리 반환
- **문서 상세 조회**: `GET /api/agent/v1/docs/{docId}`
  - 문서 메타, 헤딩 트리, 연관 링크 목록 및 마크다운 본문 반환

---

## 4. 대화 및 토큰 감사 API (Trace API)

### 4.1 대화 턴 및 실행 추적 저장
- **HTTP Method & Path**: `POST /api/agent/v1/trace/conversation`
- **Request Body**:
```json
{
  "session_id": "SES-20260915-01",
  "task_id": "TSK-20260915-01",
  "step_index": 12,
  "agent_name": "gemini",
  "model_name": "gemini-3.7-flash",
  "user_prompt": "기획을 좀 더 세분화 하여 놓친 부분을 점검해줘",
  "agent_response": "워크플로우 정밀 점검 리포트...",
  "tool_calls": [
    { "tool_name": "write_to_file", "summary": "설계 문서 작성", "status": "SUCCESS" }
  ],
  "token_usage": {
    "prompt_tokens": 3100,
    "completion_tokens": 1200,
    "total_tokens": 4300
  },
  "created_at": "2026-09-15T01:05:00.000Z"
}
```

---

## 5. 관련 문서

- [03. 하네스 세션·태스크·루프 진행관리 문서 DB 설계서](../../03_설계관리/데이터관리/03_하네스_세션태스크루프_진행관리_문서DB설계.md)
- [09. 하네스 작업 운영 절차](../../00_산출물/02_하네스산출물/09_하네스작업운영절차.md)
- [AGENTS.md](../../../AGENTS.md)

---

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-09-15 01:00 KST | Gemini | jkoogi | 에이전트 서비스 REST API 명세서 최초 작성 |
