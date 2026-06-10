# Harness MVP1 Auth Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. Implementation must follow the documented ADRs and keep tests aligned with `docs/05_테스트관리/03_인증테스트.md`.

**Goal:** 하네스 기반 PDFowers 1차 MVP 인증 기능의 구조, 기술 선택, 구현 경계를 확정한다.

**Architecture:** 현재 저장소에는 앱 소스, `package.json`, 하네스 생성 코드가 없으므로 문서 기준으로 먼저 설계를 확정한다. 구현은 Node.js 기반 도메인 모듈형 모놀리식으로 시작하고, 인증 도메인을 프레임워크와 DB 어댑터에서 분리한다.

**Tech Stack:** Node.js, TypeScript, REST + OpenAPI, 서버 세션, 직접 OAuth 클라이언트, PostgreSQL, Drizzle ORM, Vitest 또는 Node.js 기본 테스트 러너, Playwright 최소 E2E.

---

## 1. 현재 구조 확인

2026-06-10 초기 기준 저장소 루트에는 `docs/`와 `AGENTS.md`만 존재했다. 이후 인증 도메인 개발환경 정식화 작업에서 `package.json`, `package-lock.json`, TypeScript/Vitest 설정, 인증 도메인 순수 함수와 테스트가 추가되었다.

현재 구현된 소스는 HTTP, DB, OAuth 네트워크 어댑터를 포함하지 않는다. 인증 정책은 `src/domains/auth` 아래 TypeScript 순수 함수로 먼저 고정했고, 외부 의존성이 필요한 계층은 후속 PR에서 붙인다. 하네스가 별도 생성물을 제공하면 이 설계의 도메인 경계와 ADR 선택을 기준으로 차이를 비교한다.

## 2. 구현 범위

MVP1은 인증, 간편로그인, 로그인 수단 연결, 승인 기반 계정 통합을 다룬다.

포함 범위:

- `login_id`, 이메일, 비밀번호, 표시명 기반 회원가입
- ID/PW 로그인과 이메일 인증 정책
- 카카오, 네이버, 구글 OAuth 식별자 연결 모델
- 로그인 상태에서 간편로그인 추가 연결과 해제
- 다른 계정에 연결된 OAuth 식별자 연결 시 계정 통합 요청 생성
- 대상 계정 승인 후 AuthIdentity 이전과 보조 계정 `merged` 처리
- 인증 이벤트 감사 로그

제외 범위:

- 휴대폰 본인확인, 실명확인, 주민등록 기반 동일인 인증
- PDF 업로드, 주석, 공유, 동기화
- RabbitMQ 등 외부 MQ 운영
- 실제 OAuth 제공자 네트워크 호출을 전제로 한 테스트

## 3. 아키텍처

초기 앱은 도메인 모듈형 모놀리식으로 구성한다.

```text
src/
  domains/
    auth/
      auth-domain.ts
      auth-errors.ts
  db/
    schema/
      auth.ts
      job.ts
      index.ts
    migrations/
    client.ts
  app/
    http/
    config/
  shared/
    errors/
    validation/
    crypto/
test/
  auth-domain.test.ts
```

현재 구현은 `src/domains/auth/auth-domain.ts`에 순수 도메인 규칙을 모아 두었다. 다음 단계에서 코드가 커지면 `model`, `usecase`, `port`, `adapter`, `api`로 분리하되, 의존성 방향은 도메인 규칙에서 외부 어댑터로 나가지 않게 유지한다. `api`와 `adapter`는 도메인 유스케이스를 호출하는 외부 계층이며, 도메인 규칙을 직접 구현하지 않는다.

## 4. API 결정

MVP1 API는 REST + OpenAPI를 기본으로 한다. 인증 API는 외부 클라이언트와 운영 검증 도구가 호출할 수 있는 명시적 계약이 필요하므로 tRPC나 서버 액션보다 REST를 우선한다.

초기 엔드포인트 후보:

| 메서드 | 경로 | 목적 |
| :--- | :--- | :--- |
| `POST` | `/auth/signup/local` | ID/PW 회원가입 |
| `POST` | `/auth/login/local` | ID/PW 로그인 |
| `POST` | `/auth/oauth/:provider/callback` | 모의 또는 실제 OAuth 콜백 처리 |
| `POST` | `/auth/identities/:provider` | 로그인 상태에서 제공자 연결 |
| `DELETE` | `/auth/identities/:provider` | 제공자 연결 해제 |
| `POST` | `/auth/merge-requests/:id/approve` | 계정 통합 승인 |

OpenAPI 문서는 입력 검증 스키마와 같은 소스에서 생성하거나, 생성이 어렵다면 테스트에서 예제 요청/응답을 검증한다.

## 5. 인증 결정

MVP1 인증은 서버 세션 + 직접 OAuth 클라이언트를 채택한다. 서버 세션은 계정 통합 승인, OAuth `state`, 이메일 인증 상태 반영에 유리하고, JWT보다 폐기와 권한 반영이 단순하다.

직접 OAuth 클라이언트는 제공자별 차이를 `OAuthProviderPort` 뒤에 숨긴다. MVP1 코딩 착수 단계에서는 실제 제공자 호출 대신 모의 제공자 어댑터를 먼저 구현한다.

## 6. 데이터와 ORM 결정

DB는 PostgreSQL, ORM은 Drizzle ORM을 1차 선택으로 둔다. Drizzle은 SQL 제약과 마이그레이션 산출물을 확인하기 쉬워 `AuthIdentity(provider_cd, provider_user_id)` 같은 유니크 제약과 공통 메타 컬럼을 명시하기 좋다.

초기 모델:

- `user_account`
- `local_credential`
- `verified_email`
- `auth_identity`
- `account_merge_request`
- `audit_log`
- `job`

Drizzle 설치, `drizzle.config.ts`, PostgreSQL 드라이버, 최초 migration SQL 생성은 TypeScript/Vitest 정식화 PR과 분리한다. 이번 세션에서는 `docs/03_설계관리/데이터관리/01_MVP1_DB모델초안.md`에 파일 구조와 테이블 초안을 기록하고, 실제 스키마 코드는 다음 PR에서 작성한다.

## 7. 비동기 처리 결정

계정 통합의 핵심 데이터 변경은 동기 트랜잭션으로 처리한다. 통합 완료 알림, 감사 로그 확장, 재색인, 대량 문서 소유권 이전은 DB Job Table로 분리한다.

MVP1에서는 외부 MQ를 도입하지 않는다. PDF 처리처럼 장시간 재시도 작업이 본격화될 때 RabbitMQ 또는 호환 MQ를 재검토한다.

## 8. 테스트 전략

구현은 테스트 우선으로 진행한다.

| 계층 | 우선 검증 |
| :--- | :--- |
| 단위 테스트 | 비밀번호 정책, 이메일 인증 정책, 계정 통합 상태 전이 |
| 통합 테스트 | 회원가입, 로그인, OAuth 식별자 연결, 계정 통합 승인 |
| E2E 테스트 | UI 생성 후 가입/로그인 핵심 3~5개 흐름 |

초기 스캐폴딩 단계에서는 외부 의존성 없이 Node.js 기본 테스트 러너로 도메인 규칙을 검증할 수 있게 시작했다. 2026-06-10 개발환경 정식화 작업에서 TypeScript와 Vitest를 도입했고, `MVP1-AUTH-T001`부터 `MVP1-AUTH-T020`까지 자동화 테스트로 표시했다.

현재 표준 검증 명령은 다음과 같다.

```text
npm test
npm run typecheck
```

## 9. 성공 기준

- 인증 도메인 TypeScript 순수 함수와 Vitest 테스트가 저장소에 존재한다.
- API, 인증, ORM, 비동기 처리 ADR이 승인 상태로 정리된다.
- `docs/04_기술관리/06_개발명령어.md`에 현재 실행 가능한 명령과 향후 명령이 분리된다.
- MVP1 인증 구현 계획이 테스트 우선 순서로 작성된다.
- 최소 스캐폴딩은 외부 네트워크 없이 실행 가능한 테스트부터 시작하고, `npm test`, `npm run typecheck`를 통과한다.

## 10. 자체 검토

- 미확정 하네스 생성물은 “현재 없음”으로 명확히 기록했다.
- API, 인증, ORM, 비동기 처리 선택은 ADR과 같은 방향이다.
- OAuth 제공자 최신 정책 확인은 실제 연동 전 별도 작업으로 남기고, MVP1 코딩 착수는 모의 제공자 기준으로 제한했다.
- 코딩 착수 범위는 도메인 규칙과 테스트 가능한 최소 스캐폴딩으로 제한했다.

## 11. 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-10 00:00 KST | Codex | jkoogi | 하네스 MVP1 인증 설계 초안 작성 |
| 2026-06-10 00:00 KST | Codex | jkoogi | TypeScript/Vitest 전환과 MVP1 인증 테스트 확장 결과 반영 |
