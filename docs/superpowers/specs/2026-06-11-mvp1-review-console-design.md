# MVP1 검수화면 설계

## 목표

MVP1 인증 기능을 실제 서비스 흐름에 가깝게 확인할 수 있는 내부 검수화면을 만든다. 검수자는 브라우저에서 회원가입, 로그인, OAuth 연결/해제, 계정 통합 요청/승인, 이메일 인증 정책을 순서대로 실행하고, 각 실행 결과가 `MVP1-AUTH-T001`부터 `MVP1-AUTH-T020`까지의 완료 조건과 어떻게 연결되는지 확인할 수 있어야 한다.

## 범위

포함 범위:

- ID/PW 회원가입과 로그인 검수
- 이메일 인증 필수/선택 설정에 따른 로그인 결과 확인
- Kakao, Naver, Google OAuth identity 연결과 해제 검수
- 다른 계정에 연결된 OAuth identity 연결 시 계정 통합 요청 생성 확인
- 계정 통합 승인, 만료, 취소 상태 확인
- AuditLog, AuthIdentity, AccountMergeRequest 상태 패널 표시
- `MVP1-AUTH-T001`부터 `MVP1-AUTH-T020`까지의 검수 체크리스트 표시

제외 범위:

- 실제 OAuth 제공자 네트워크 연동
- 운영용 인증 세션, 쿠키, 권한 체계
- 실제 이메일 발송
- PDF 업로드, 주석, 공유, 동기화 기능
- 운영 관리자 콘솔 수준의 사용자 검색과 대량 데이터 관리

## 접근 방식

검수화면은 A 기반 혼합형으로 만든다. 첫 화면은 검수자가 자연스럽게 따라갈 수 있는 사용자 흐름 중심으로 구성하고, 같은 화면 안에 테스트 케이스 체크리스트와 현재 상태 패널을 함께 둔다.

권장 구조:

- 상단: MVP1 검수 요약, 현재 시나리오 상태, 초기화 버튼
- 좌측 또는 상단 탭: 회원가입, 로그인, OAuth 연결, 계정 통합, 이메일 정책
- 중앙: 선택한 시나리오의 입력값과 실행 버튼
- 우측 또는 하단: 계정, identity, merge request, audit log 상태
- 하단: `MVP1-AUTH-T001~T020` 체크리스트와 실행 결과

이 구조는 검수자가 실제 서비스 흐름처럼 기능을 확인하면서도 문서화된 완료 조건을 놓치지 않게 한다.

## 아키텍처

현재 저장소는 프론트엔드 프레임워크가 없고 TypeScript 도메인 함수와 Vitest 테스트가 중심이다. 따라서 MVP1 검수화면은 별도 프레임워크 도입 없이 Node.js 내장 HTTP 서버와 정적 HTML/JS로 구현한다.

구성:

- `src/review/mvp1-review-server.ts`: 로컬 검수 서버 진입점
- `src/review/mvp1-review-scenarios.ts`: 검수화면에서 호출할 시나리오 실행 함수
- `src/review/public/mvp1-review.html`: 검수 UI
- `src/review/public/mvp1-review.js`: 브라우저 상호작용과 API 호출
- `src/review/public/mvp1-review.css`: 검수화면 스타일
- `test/unit/mvp1-review-scenarios.test.ts`: 검수 시나리오와 MVP1 테스트 ID 매핑 검증

검수 서버는 개발용 도구이며 운영 빌드나 배포 대상이 아니다. 실제 서비스 코드와 혼동되지 않도록 `review` 네임스페이스에 둔다.

## 데이터 흐름

1. 검수자가 브라우저에서 시나리오 버튼을 누른다.
2. 브라우저 JS가 `POST /api/review/scenarios/:scenarioId`를 호출한다.
3. 서버는 메모리 기반 검수 상태를 사용해 기존 `src/domains/auth/auth-domain.ts` 함수를 실행한다.
4. 서버는 실행 결과, 현재 계정 상태, audit log, 관련 테스트 케이스 상태를 JSON으로 반환한다.
5. 화면은 응답을 받아 상태 패널과 체크리스트를 갱신한다.
6. 검수자는 필요하면 `POST /api/review/reset`으로 상태를 초기화한다.

초기 구현은 메모리 상태를 사용한다. PostgreSQL 저장소 검수는 기존 통합 테스트와 별도로 유지하고, 화면에서는 “DB 통합 검증은 자동 테스트에서 확인” 상태로 표시한다. 실제 DB 상태를 화면에 붙이는 작업은 MVP1 이후 확장으로 분리한다.

## API

검수 서버 API:

| 메서드 | 경로 | 목적 |
| :--- | :--- | :--- |
| `GET` | `/` | 검수화면 HTML 반환 |
| `GET` | `/api/review/state` | 현재 검수 상태 조회 |
| `POST` | `/api/review/reset` | 검수 상태 초기화 |
| `POST` | `/api/review/scenarios/:scenarioId` | 단일 검수 시나리오 실행 |

초기 시나리오 ID:

- `local-signup`
- `local-login-success`
- `local-login-email-required`
- `oauth-signup`
- `oauth-login`
- `oauth-link-current-user`
- `oauth-link-conflict`
- `merge-approve`
- `merge-cancel`
- `merge-expire`
- `oauth-unlink`
- `verified-email-delete-blocked`
- `email-change-confirm`

## 오류 처리

검수 시나리오는 민감정보를 응답하지 않는다. 비밀번호 원문, OAuth token, authorization code, client secret은 화면 상태와 로그에 포함하지 않는다.

오류 응답은 다음 형태로 통일한다.

```json
{
  "ok": false,
  "error": "AUTH_ERROR_CODE",
  "message": "검수자가 이해할 수 있는 한글 설명"
}
```

시나리오 전제 조건이 맞지 않으면 서버는 상태 초기화를 강제하지 않고 “먼저 실행해야 하는 시나리오”를 안내한다.

## UI 원칙

검수화면은 운영자용 도구처럼 조용하고 밀도 있게 만든다. 랜딩 페이지나 장식성 hero 없이 첫 화면에서 곧바로 검수 작업을 시작할 수 있어야 한다.

UI 구성:

- 기능 실행 버튼에는 명확한 동사와 상태 아이콘을 사용한다.
- 테스트 케이스는 통과, 대기, 실패 상태로 표시한다.
- 계정 상태는 `active`, `merged`, 연결 provider 수, primary email, pending email을 보여준다.
- audit log는 최근 이벤트를 시간 역순으로 보여준다.
- 위험하거나 초기화 성격의 버튼은 일반 실행 버튼과 시각적으로 구분한다.

## 검증

필수 검증:

- `npm run typecheck`
- `npm test`
- 검수 시나리오 단위 테스트
- 로컬 검수 서버 실행 후 브라우저에서 주요 시나리오 수동 확인

완료 기준:

- 검수화면이 로컬 브라우저에서 열린다.
- 검수자가 버튼만으로 MVP1 인증 핵심 흐름을 확인할 수 있다.
- 화면 체크리스트가 `MVP1-AUTH-T001~T020`의 현재 자동화/수동 검수 상태를 표시한다.
- 기존 도메인 테스트와 통합 테스트가 깨지지 않는다.

## 후속 작업

- 실제 서비스 프레임워크가 도입되면 검수화면을 해당 앱 라우트로 이전한다.
- PostgreSQL 연결 상태와 실제 DB 저장 결과를 화면 패널에 붙인다.
- Playwright 기반 smoke 테스트를 추가해 검수화면의 주요 버튼 흐름을 자동 확인한다.
