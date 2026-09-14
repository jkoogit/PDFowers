-- ==============================================================================
-- PDFowers 전체 데이터베이스 테이블 및 컬럼 한글 주석 DDL 스크립트
-- 
-- 적용 대상: 전체 15개 테이블 (인증 7종, 시스템/공통 3종, 에이전트/하네스 5종)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 인증 및 계정 도메인 (7종)
-- ------------------------------------------------------------------------------

-- 1-1. user_account (통합 사용자 계정 마스터)
COMMENT ON TABLE user_account IS '통합 사용자 계정 마스터 테이블';
COMMENT ON COLUMN user_account.user_uuid IS '사용자 고유 식별자 (UUID PK)';
COMMENT ON COLUMN user_account.display_name IS '사용자 화면 표시명 및 닉네임';
COMMENT ON COLUMN user_account.primary_email IS '사용자 대표 이메일 주소';
COMMENT ON COLUMN user_account.user_status_cd IS '사용자 계정 상태 코드 (ACTIVE, PENDING, BLOCKED, WITHDRAWN)';
COMMENT ON COLUMN user_account.merged_into_user_uuid IS '계정 병합 완료 시 승계된 최종 대상 사용자 UUID';
COMMENT ON COLUMN user_account.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN user_account.created_at IS '최초 생성 일시';
COMMENT ON COLUMN user_account.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN user_account.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN user_account.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN user_account.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN user_account.version IS '낙관적 락 레코드 버전 번호';

-- 1-2. local_credential (로컬 자체 로그인 비밀번호 인증 정보)
COMMENT ON TABLE local_credential IS '로컬 자체 로그인 비밀번호 인증 정보 테이블';
COMMENT ON COLUMN local_credential.user_uuid IS '소속 사용자 고유 식별자 (PK, FK: user_account.user_uuid)';
COMMENT ON COLUMN local_credential.login_id IS '자체 로그인 아이디 (Unique)';
COMMENT ON COLUMN local_credential.password_hash IS '단방향 암호화된 비밀번호 해시 문자열';
COMMENT ON COLUMN local_credential.password_hash_alg_cd IS '비밀번호 해시 알고리즘 코드 (ARGON2ID, BCRYPT 등)';
COMMENT ON COLUMN local_credential.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN local_credential.created_at IS '최초 생성 일시';
COMMENT ON COLUMN local_credential.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN local_credential.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN local_credential.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN local_credential.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN local_credential.version IS '낙관적 락 레코드 버전 번호';

-- 1-3. verified_email (인증 완료된 사용자 이메일 목록)
COMMENT ON TABLE verified_email IS '인증 완료된 사용자 소유 이메일 목록 테이블';
COMMENT ON COLUMN verified_email.verified_email_uuid IS '인증 이메일 레코드 고유 식별자 (UUID PK)';
COMMENT ON COLUMN verified_email.user_uuid IS '소속 사용자 고유 식별자 (FK: user_account.user_uuid)';
COMMENT ON COLUMN verified_email.email IS '인증 완료된 이메일 주소 (Unique)';
COMMENT ON COLUMN verified_email.email_verified_at IS '이메일 소유권 인증 완료 일시';
COMMENT ON COLUMN verified_email.email_notification_opt_in IS '해당 이메일로의 시스템 알림 수신 동의 여부';
COMMENT ON COLUMN verified_email.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN verified_email.created_at IS '최초 생성 일시';
COMMENT ON COLUMN verified_email.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN verified_email.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN verified_email.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN verified_email.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN verified_email.version IS '낙관적 락 레코드 버전 번호';

-- 1-4. auth_identity (소셜 OAuth 및 외부 연동 인증 식별자)
COMMENT ON TABLE auth_identity IS '외부 OAuth(Google, GitHub 등) 연동 식별자 관리 테이블';
COMMENT ON COLUMN auth_identity.auth_identity_uuid IS '연동 식별자 고유 UUID PK';
COMMENT ON COLUMN auth_identity.user_uuid IS '소속 사용자 고유 식별자 (FK: user_account.user_uuid)';
COMMENT ON COLUMN auth_identity.provider_cd IS '외부 OAuth 제공자 코드 (GOOGLE, GITHUB 등)';
COMMENT ON COLUMN auth_identity.provider_user_id IS 'OAuth 제공자가 발급한 고유 사용자 ID';
COMMENT ON COLUMN auth_identity.email_from_provider IS 'OAuth 인증 시 제공받은 이메일 주소';
COMMENT ON COLUMN auth_identity.connected_at IS '외부 소셜 계정 최초 연동 일시';
COMMENT ON COLUMN auth_identity.last_login_at IS '해당 연동 계정을 통한 최근 로그인 일시';
COMMENT ON COLUMN auth_identity.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN auth_identity.created_at IS '최초 생성 일시';
COMMENT ON COLUMN auth_identity.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN auth_identity.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN auth_identity.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN auth_identity.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN auth_identity.version IS '낙관적 락 레코드 버전 번호';

-- 1-5. account_merge_request (이종 계정 간 통합 및 병합 요청)
COMMENT ON TABLE account_merge_request IS '이종 계정 간 데이터 통합 및 병합 요청 관리 테이블';
COMMENT ON COLUMN account_merge_request.merge_request_uuid IS '병합 요청 고유 식별자 (UUID PK)';
COMMENT ON COLUMN account_merge_request.request_user_uuid IS '병합을 신청한 원천 사용자 식별자 (FK: user_account.user_uuid)';
COMMENT ON COLUMN account_merge_request.target_user_uuid IS '병합 대상이 되는 목표 사용자 식별자 (FK: user_account.user_uuid)';
COMMENT ON COLUMN account_merge_request.provider_cd IS '병합 계기의 외부 OAuth 제공자 코드';
COMMENT ON COLUMN account_merge_request.provider_user_id IS '병합 계기의 외부 OAuth 제공자 사용자 ID';
COMMENT ON COLUMN account_merge_request.merge_status_cd IS '병합 요청 처리 상태 코드 (PENDING, APPROVED, REJECTED, EXPIRED)';
COMMENT ON COLUMN account_merge_request.expires_at IS '병합 요청 확인 만료 일시';
COMMENT ON COLUMN account_merge_request.approved_at IS '병합 최종 승인 일시';
COMMENT ON COLUMN account_merge_request.cancelled_at IS '병합 요청 취소/거절 일시';
COMMENT ON COLUMN account_merge_request.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN account_merge_request.created_at IS '최초 생성 일시';
COMMENT ON COLUMN account_merge_request.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN account_merge_request.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN account_merge_request.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN account_merge_request.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN account_merge_request.version IS '낙관적 락 레코드 버전 번호';

-- 1-6. email_verification_request (이메일 소유권 확인 토큰 및 인증 요청)
COMMENT ON TABLE email_verification_request IS '이메일 소유권 확인 토큰 및 인증 요청 관리 테이블';
COMMENT ON COLUMN email_verification_request.email_verification_request_uuid IS '인증 요청 고유 식별자 (UUID PK)';
COMMENT ON COLUMN email_verification_request.user_uuid IS '요청 사용자 식별자 (선택 FK: user_account.user_uuid)';
COMMENT ON COLUMN email_verification_request.email IS '인증 대상 이메일 주소';
COMMENT ON COLUMN email_verification_request.token_hash IS '이메일 발송 토큰 단방향 SHA-256 해시값';
COMMENT ON COLUMN email_verification_request.verification_status_cd IS '인증 요청 상태 코드 (PENDING, VERIFIED, EXPIRED, FAILED)';
COMMENT ON COLUMN email_verification_request.requested_at IS '인증 요청 일시';
COMMENT ON COLUMN email_verification_request.expires_at IS '인증 토큰 유효 만료 일시';
COMMENT ON COLUMN email_verification_request.verified_at IS '인증 완료 일시';
COMMENT ON COLUMN email_verification_request.cancelled_at IS '인증 취소 일시';
COMMENT ON COLUMN email_verification_request.failed_attempt_count IS '인증 토큰 입력 실패 횟수';
COMMENT ON COLUMN email_verification_request.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN email_verification_request.created_at IS '최초 생성 일시';
COMMENT ON COLUMN email_verification_request.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN email_verification_request.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN email_verification_request.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN email_verification_request.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN email_verification_request.version IS '낙관적 락 레코드 버전 번호';

-- 1-7. audit_log (인증 및 보안 활동 감사 로그)
COMMENT ON TABLE audit_log IS '사용자 및 시스템 활동 감사 로그 테이블';
COMMENT ON COLUMN audit_log.audit_log_uuid IS '감사 로그 고유 식별자 (UUID PK)';
COMMENT ON COLUMN audit_log.actor_user_uuid IS '행위자 사용자 식별자 (Nullable FK: user_account.user_uuid)';
COMMENT ON COLUMN audit_log.audit_event_type_cd IS '감사 이벤트 유형 코드 (LOGIN_SUCCESS, SIGNUP, MERGE_REQUEST 등)';
COMMENT ON COLUMN audit_log.target_type_cd IS '대상 리소스 유형 코드 (USER, MERGE_REQUEST 등)';
COMMENT ON COLUMN audit_log.target_uuid IS '대상 리소스 고유 식별자';
COMMENT ON COLUMN audit_log.metadata_json IS '이벤트 상세 메타데이터 (JSONB/Text)';
COMMENT ON COLUMN audit_log.created_at IS '감사 로그 기록 일시';

-- ------------------------------------------------------------------------------
-- 2. 시스템 및 공통 도메인 (3종)
-- ------------------------------------------------------------------------------

-- 2-1. common_code (시스템 공통 코드 마스터)
COMMENT ON TABLE common_code IS '시스템 공통 코드 및 분류 마스터 테이블';
COMMENT ON COLUMN common_code.code_group_cd IS '코드 그룹 식별 코드 (PK1, 예: USER_STATUS, HARNESS_STATUS)';
COMMENT ON COLUMN common_code.code_cd IS '개별 상세 코드값 (PK2, 예: ACTIVE, PENDING)';
COMMENT ON COLUMN common_code.code_label IS '코드 화면 표시 한글 레이블';
COMMENT ON COLUMN common_code.code_description IS '코드 용도 및 상세 설명';
COMMENT ON COLUMN common_code.sort_order IS '화면 표시 정렬 순서';
COMMENT ON COLUMN common_code.is_active IS '코드 사용 활성화 여부';
COMMENT ON COLUMN common_code.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN common_code.created_at IS '최초 생성 일시';
COMMENT ON COLUMN common_code.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN common_code.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN common_code.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN common_code.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN common_code.version IS '낙관적 락 레코드 버전 번호';

-- 2-2. system_property (동적 환경 설정 및 시스템 프로퍼티)
COMMENT ON TABLE system_property IS '동적 환경 설정 및 시스템 파라미터 관리 테이블';
COMMENT ON COLUMN system_property.property_key IS '프로퍼티 고유 키 식별자 (PK)';
COMMENT ON COLUMN system_property.property_value IS '설정값 문자열';
COMMENT ON COLUMN system_property.property_value_type_cd IS '값 데이터 타입 코드 (STRING, NUMBER, BOOLEAN, JSON)';
COMMENT ON COLUMN system_property.property_description IS '프로퍼티 상세 용도 및 설명';
COMMENT ON COLUMN system_property.is_active IS '프로퍼티 활성화 여부';
COMMENT ON COLUMN system_property.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN system_property.created_at IS '최초 생성 일시';
COMMENT ON COLUMN system_property.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN system_property.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN system_property.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN system_property.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN system_property.version IS '낙관적 락 레코드 버전 번호';

-- 2-3. job (비동기 백그라운드 작업 및 스케줄러 큐)
COMMENT ON TABLE job IS '비동기 백그라운드 작업 및 스케줄러 큐 관리 테이블';
COMMENT ON COLUMN job.job_uuid IS '작업 고유 식별자 (UUID PK)';
COMMENT ON COLUMN job.job_type_cd IS '작업 유형 코드 (EMAIL_SEND, BATCH_SYNC, DOC_INDEX 등)';
COMMENT ON COLUMN job.job_status_cd IS '작업 진행 상태 코드 (PENDING, RUNNING, COMPLETED, FAILED, RETRYING)';
COMMENT ON COLUMN job.payload_json IS '작업 실행에 필요한 파라미터 및 데이터 (JSONB)';
COMMENT ON COLUMN job.scheduled_at IS '작업 실행 예약 일시';
COMMENT ON COLUMN job.started_at IS '작업 실제 시작 일시';
COMMENT ON COLUMN job.completed_at IS '작업 최종 완료 일시';
COMMENT ON COLUMN job.failed_reason IS '작업 실패 시 에러 메시지 및 상세 사유';
COMMENT ON COLUMN job.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN job.created_at IS '최초 생성 일시';
COMMENT ON COLUMN job.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN job.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN job.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN job.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN job.version IS '낙관적 락 레코드 버전 번호';

-- ------------------------------------------------------------------------------
-- 3. AI 에이전트 및 하네스 도메인 (5종)
-- ------------------------------------------------------------------------------

-- 3-1. harness_session_meta (AI 세션 진행관리 및 문서 인덱스)
COMMENT ON TABLE harness_session_meta IS 'AI 에이전트 하네스 3계층 세션(Session) 진행관리 및 문서 인덱스 테이블';
COMMENT ON COLUMN harness_session_meta.session_id IS '세션 고유 식별자 (PK, 예: SES-20260915-01)';
COMMENT ON COLUMN harness_session_meta.session_name IS '세션 명칭 (예: 16-세션_태스크_진행관리_문서DB_기획분석설계)';
COMMENT ON COLUMN harness_session_meta.work_group IS '작업 그룹 또는 도메인 영역';
COMMENT ON COLUMN harness_session_meta.status_cd IS '세션 진행 상태 코드 (시작/작업/정리/종료)';
COMMENT ON COLUMN harness_session_meta.ai_agent IS '작업 수행 주체 AI 에이전트명 (gemini, codex 등)';
COMMENT ON COLUMN harness_session_meta.ai_model IS '작업 수행 AI LLM 모델명';
COMMENT ON COLUMN harness_session_meta.started_at IS '세션 시작 일시';
COMMENT ON COLUMN harness_session_meta.ended_at IS '세션 종료 일시';
COMMENT ON COLUMN harness_session_meta.doc_payload IS 'SessionDocument 본문 전체 (JSONB)';
COMMENT ON COLUMN harness_session_meta.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN harness_session_meta.created_at IS '최초 생성 일시';
COMMENT ON COLUMN harness_session_meta.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN harness_session_meta.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN harness_session_meta.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN harness_session_meta.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN harness_session_meta.version IS '낙관적 락 레코드 버전 번호';

-- 3-2. harness_task_meta (AI 태스크 진행관리 및 문서 인덱스)
COMMENT ON TABLE harness_task_meta IS 'AI 에이전트 하네스 3계층 태스크(Task) 진행관리 및 문서 인덱스 테이블';
COMMENT ON COLUMN harness_task_meta.task_id IS '태스크 고유 식별자 (PK, 예: TSK-20260915-01)';
COMMENT ON COLUMN harness_task_meta.session_id IS '소속 상위 세션 식별자 (FK: harness_session_meta.session_id)';
COMMENT ON COLUMN harness_task_meta.task_name IS '태스크 명칭 (예: 에이전트서비스_문서DB_및_API_구현)';
COMMENT ON COLUMN harness_task_meta.status_cd IS '태스크 진행 상태 코드 (시작/처리/정리/승급)';
COMMENT ON COLUMN harness_task_meta.git_branch IS '태스크 작업 브랜치명 (예: task/한글명_에이전트명)';
COMMENT ON COLUMN harness_task_meta.started_at IS '태스크 시작 일시';
COMMENT ON COLUMN harness_task_meta.ended_at IS '태스크 종료/정리 일시';
COMMENT ON COLUMN harness_task_meta.doc_payload IS 'TaskDocument 본문 전체 (JSONB)';
COMMENT ON COLUMN harness_task_meta.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN harness_task_meta.created_at IS '최초 생성 일시';
COMMENT ON COLUMN harness_task_meta.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN harness_task_meta.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN harness_task_meta.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN harness_task_meta.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN harness_task_meta.version IS '낙관적 락 레코드 버전 번호';

-- 3-3. harness_loop_meta (AI 루프 진행관리 및 문서 인덱스)
COMMENT ON TABLE harness_loop_meta IS 'AI 에이전트 하네스 3계층 루프(Loop) 단위 작업 진행관리 및 문서 인덱스 테이블';
COMMENT ON COLUMN harness_loop_meta.loop_id IS '루프 고유 식별자 (PK, 예: LP-20260915-01)';
COMMENT ON COLUMN harness_loop_meta.task_id IS '소속 상위 태스크 식별자 (FK: harness_task_meta.task_id)';
COMMENT ON COLUMN harness_loop_meta.session_id IS '소속 세션 식별자';
COMMENT ON COLUMN harness_loop_meta.loop_name IS '루프 단위 작업 명칭';
COMMENT ON COLUMN harness_loop_meta.status_cd IS '루프 진행 상태 코드 (분석/실행/처리/보완/정리/정지)';
COMMENT ON COLUMN harness_loop_meta.started_at IS '루프 시작 일시';
COMMENT ON COLUMN harness_loop_meta.ended_at IS '루프 종료 일시';
COMMENT ON COLUMN harness_loop_meta.doc_payload IS 'LoopDocument 본문 전체 (JSONB)';
COMMENT ON COLUMN harness_loop_meta.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN harness_loop_meta.created_at IS '최초 생성 일시';
COMMENT ON COLUMN harness_loop_meta.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN harness_loop_meta.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN harness_loop_meta.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN harness_loop_meta.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN harness_loop_meta.version IS '낙관적 락 레코드 버전 번호';

-- 3-4. agent_docs_meta (마크다운 문서 DB 메타데이터)
COMMENT ON TABLE agent_docs_meta IS '마크다운 문서 및 설계/지식 산출물 DB 메타데이터 관리 테이블';
COMMENT ON COLUMN agent_docs_meta.doc_id IS '문서 고유 식별자 (PK, SHA-256 또는 UUID 기반)';
COMMENT ON COLUMN agent_docs_meta.file_path IS '저장소 내 상대 파일 경로 (Unique)';
COMMENT ON COLUMN agent_docs_meta.category IS '문서 분류 카테고리 (설계관리, 기술관리, 로그 등)';
COMMENT ON COLUMN agent_docs_meta.title IS '문서 제목';
COMMENT ON COLUMN agent_docs_meta.content_hash IS '문서 내용의 SHA-256 무결성 검증 해시값';
COMMENT ON COLUMN agent_docs_meta.last_synced_at IS '최종 동기화 확인 일시';
COMMENT ON COLUMN agent_docs_meta.doc_payload IS 'AgentDocsMeta 파싱된 JSON 본문 및 섹션 메타';
COMMENT ON COLUMN agent_docs_meta.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN agent_docs_meta.created_at IS '최초 생성 일시';
COMMENT ON COLUMN agent_docs_meta.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN agent_docs_meta.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN agent_docs_meta.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN agent_docs_meta.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN agent_docs_meta.version IS '낙관적 락 레코드 버전 번호';

-- 3-5. agent_conversation_trace (AI 에이전트 대화 및 감사 로그)
COMMENT ON TABLE agent_conversation_trace IS 'AI 에이전트 대화 턴 및 도구 호출 토큰 감사 추적 로그 테이블';
COMMENT ON COLUMN agent_conversation_trace.trace_id IS '추적 로그 고유 식별자 (PK)';
COMMENT ON COLUMN agent_conversation_trace.session_id IS '소속 세션 식별자';
COMMENT ON COLUMN agent_conversation_trace.task_id IS '소속 태스크 식별자 (선택)';
COMMENT ON COLUMN agent_conversation_trace.step_index IS '대화 턴 단계 인덱스';
COMMENT ON COLUMN agent_conversation_trace.agent_name IS '수행 에이전트명';
COMMENT ON COLUMN agent_conversation_trace.model_name IS '사용된 LLM 모델명';
COMMENT ON COLUMN agent_conversation_trace.user_prompt IS '사용자 입력 프롬프트 원문/요약';
COMMENT ON COLUMN agent_conversation_trace.agent_response IS '에이전트 응답 본문/요약';
COMMENT ON COLUMN agent_conversation_trace.tool_calls IS '실행된 도구 호출 목록 및 인자 (JSONB)';
COMMENT ON COLUMN agent_conversation_trace.prompt_tokens IS '프롬프트 입력 토큰 수';
COMMENT ON COLUMN agent_conversation_trace.completion_tokens IS '응답 출력 토큰 수';
COMMENT ON COLUMN agent_conversation_trace.total_tokens IS '총 소비 토큰 수';
COMMENT ON COLUMN agent_conversation_trace.created_sys IS '최초 생성 시스템/서비스명';
COMMENT ON COLUMN agent_conversation_trace.created_at IS '최초 생성 일시';
COMMENT ON COLUMN agent_conversation_trace.created_by IS '최초 생성자 식별자';
COMMENT ON COLUMN agent_conversation_trace.updated_sys IS '최종 수정 시스템/서비스명';
COMMENT ON COLUMN agent_conversation_trace.updated_at IS '최종 수정 일시';
COMMENT ON COLUMN agent_conversation_trace.updated_by IS '최종 수정자 식별자';
COMMENT ON COLUMN agent_conversation_trace.version IS '낙관적 락 레코드 버전 번호';
