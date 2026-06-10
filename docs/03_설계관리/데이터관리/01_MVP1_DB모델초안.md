# 01. MVP1 DB 모델 초안

## 목적

Drizzle ORM 착수 전 인증 도메인의 파일 구조, 테이블 초안, 제약 조건, PR 분리 기준을 정리한다. 실제 Drizzle 설치와 마이그레이션 생성은 다음 PR에서 수행하는 것을 기본 판단으로 둔다.

## 파일 구조 제안

```text
src/
  db/
    schema/
      auth.ts
      job.ts
      index.ts
    migrations/
    client.ts
```

| 파일 | 책임 |
| :--- | :--- |
| `src/db/schema/auth.ts` | 인증 도메인 테이블 `user_account`, `local_credential`, `verified_email`, `auth_identity`, `account_merge_request`, `audit_log` 정의 |
| `src/db/schema/job.ts` | 비동기 작업 테이블 `job` 정의 |
| `src/db/schema/index.ts` | 도메인별 schema export 집계 |
| `src/db/client.ts` | DB 연결과 Drizzle client 생성 |
| `src/db/migrations/` | Drizzle Kit이 생성하는 SQL migration 보관 |

## 테이블 초안

| 테이블 | 주요 컬럼 | 핵심 제약 |
| :--- | :--- | :--- |
| `user_account` | `user_uuid`, `display_name`, `primary_email`, `user_status_cd`, `merged_into_user_uuid`, 공통 메타 7종 | `user_uuid` PK, `user_status_cd` 코드값 |
| `local_credential` | `user_uuid`, `login_id`, `password_hash`, `password_hash_alg_cd`, 공통 메타 7종 | `user_uuid` PK/FK, `login_id` unique |
| `verified_email` | `verified_email_uuid`, `user_uuid`, `email`, `email_verified_at`, `email_notification_opt_in`, 공통 메타 7종 | `verified_email_uuid` PK, `email` unique 후보 |
| `auth_identity` | `auth_identity_uuid`, `user_uuid`, `provider_cd`, `provider_user_id`, `email_from_provider`, `connected_at`, `last_login_at`, 공통 메타 7종 | `(provider_cd, provider_user_id)` unique |
| `account_merge_request` | `merge_request_uuid`, `request_user_uuid`, `target_user_uuid`, `provider_cd`, `provider_user_id`, `merge_status_cd`, `expires_at`, `approved_at`, 공통 메타 7종 | `merge_request_uuid` PK, 요청/대상 사용자 FK |
| `audit_log` | `audit_log_uuid`, `actor_user_uuid`, `audit_event_type_cd`, `target_type_cd`, `target_uuid`, `metadata_json`, `created_at` | append-only 원칙 |
| `job` | `job_uuid`, `job_type_cd`, `job_status_cd`, `payload_json`, `scheduled_at`, `started_at`, `completed_at`, `failed_reason`, 공통 메타 7종 | 후속 알림/재시도 작업의 최소 단위 |

## 공통 메타 7종

업무 테이블에는 기존 데이터관리 설계 기준의 공통 메타를 적용한다.

| 컬럼 | 의미 |
| :--- | :--- |
| `created_sys` | 최초 등록 시스템 |
| `created_at` | 최초 등록 일시 |
| `created_by` | 최초 등록 주체 |
| `updated_sys` | 최종 수정 시스템 |
| `updated_at` | 최종 수정 일시 |
| `updated_by` | 최종 수정 주체 |
| `version` | 낙관적 잠금과 변경 충돌 감지용 버전 |

## Drizzle 도입 분리 판단

이번 PR은 TypeScript/Vitest 기반과 인증 도메인 테스트 확장이 중심이다. Drizzle 설치, `drizzle.config.ts`, 실제 PostgreSQL 타입 매핑, migration SQL 생성은 다음 PR로 분리한다.

분리 이유는 다음과 같다.

1. 현재 PR은 도메인 순수 함수와 테스트 체계를 고정하는 목적이다.
2. Drizzle 도입은 DB 연결 문자열, migration 위치, 실행 명령, PostgreSQL 버전 기준을 함께 결정해야 한다.
3. 마이그레이션 파일은 한 번 생성되면 이후 변경 비용이 있으므로 스키마 초안 검토 후 별도 PR에서 확정하는 편이 안전하다.

## 다음 PR 완료 조건 제안

| 항목 | 완료 조건 |
| :--- | :--- |
| Drizzle 설치 | `drizzle-orm`, `drizzle-kit`, PostgreSQL driver 설치와 lockfile 갱신 |
| 설정 | `drizzle.config.ts`, `DATABASE_URL` 사용 기준 작성 |
| 스키마 | 위 7개 테이블의 Drizzle schema 작성 |
| 마이그레이션 | 최초 SQL migration 생성 |
| 검증 | `npm run typecheck`, Drizzle generate 명령 통과 |

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-10 00:00 KST | Codex | jkoogi | Drizzle 착수 전 MVP1 인증 DB 모델 구조와 PR 분리 기준 작성 |
