# 04. MVP1 인증 테스트 커버리지

## 목적

`MVP1-AUTH-T001`부터 `MVP1-AUTH-T020`까지 현재 자동화 테스트 반영 상태를 표시한다.

## 커버리지 현황

| 테스트 ID | 상태 | 자동화 위치 | 비고 |
| :--- | :---: | :--- | :--- |
| `MVP1-AUTH-T001` | 커버 | `test/auth-domain.test.ts` | ID/이메일 회원가입과 비밀번호 해시 저장 |
| `MVP1-AUTH-T002` | 커버 | `test/auth-domain.test.ts` | 이메일 인증 필수 설정 로그인 차단 |
| `MVP1-AUTH-T003` | 커버 | `test/auth-domain.test.ts` | 이메일 인증 선택 설정 로그인 허용 |
| `MVP1-AUTH-T004` | 커버 | `test/auth-domain.test.ts` | 기존 ID 로그인 성공 |
| `MVP1-AUTH-T005` | 커버 | `test/auth-domain.test.ts` | 잘못된 비밀번호 실패와 원문 비노출 |
| `MVP1-AUTH-T006` | 커버 | `test/auth-domain.test.ts` | 신규 간편로그인 회원가입 |
| `MVP1-AUTH-T007` | 커버 | `test/auth-domain.test.ts` | 기존 간편로그인 로그인 |
| `MVP1-AUTH-T008` | 커버 | `test/auth-domain.test.ts` | 기존 제공자 식별자 중복 가입 차단 |
| `MVP1-AUTH-T009` | 커버 | `test/auth-domain.test.ts` | 로그인 상태에서 미연결 제공자 연결 |
| `MVP1-AUTH-T010` | 커버 | `test/auth-domain.test.ts` | 현재 계정에 이미 연결된 제공자 재연결 거부 |
| `MVP1-AUTH-T011` | 커버 | `test/auth-domain.test.ts` | 다른 계정 제공자 연결 시 병합 요청 생성 |
| `MVP1-AUTH-T012` | 커버 | `test/auth-domain.test.ts` | 계정 통합 승인 |
| `MVP1-AUTH-T013` | 커버 | `test/auth-domain.test.ts` | 계정 통합 만료 |
| `MVP1-AUTH-T014` | 커버 | `test/auth-domain.test.ts` | 이메일 동일성만으로 자동 통합하지 않음 |
| `MVP1-AUTH-T015` | 커버 | `test/auth-domain.test.ts` | 카카오/네이버/구글 간편로그인 전체 해제 |
| `MVP1-AUTH-T016` | 커버 | `test/auth-domain.test.ts` | OAuth 실패 결과의 민감정보 비노출 |
| `MVP1-AUTH-T017` | 커버 | `test/auth-domain.test.ts` | 기본 ID/PW 삭제 차단 |
| `MVP1-AUTH-T018` | 커버 | `test/auth-domain.test.ts` | 이메일 인증 필수 설정에서 인증 이메일 삭제 차단 |
| `MVP1-AUTH-T019` | 커버 | `test/auth-domain.test.ts` | 이메일 변경은 새 이메일 인증 완료 후 교체 |
| `MVP1-AUTH-T020` | 커버 | `test/auth-domain.test.ts` | 간편로그인은 PDFowers 이메일 인증 없이 제공자 인증으로 로그인 |

## 추가 자동화 항목

| 항목 | 자동화 위치 | 비고 |
| :--- | :--- | :--- |
| 계정 통합 취소 | `test/auth-domain.test.ts` | 취소 후 승인 시 `MERGE_REQUEST_CANCELLED` 반환 |
| 중복 승인 방지 | `test/auth-domain.test.ts` | 병합 요청 상태 오류로 방어 |
| AuditLog 이벤트 | `test/auth-domain.test.ts` | 로그인, 연결, 해제, 병합 요청, 병합 승인 이벤트 확인 |

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-10 00:00 KST | Codex | jkoogi | MVP1 인증 자동화 테스트 커버리지 현황 작성 |
