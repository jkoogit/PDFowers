# Account Merge Notification UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP1 계정 통합 UX 기준을 구체화하고, 통합 요청/승인 시 샘플 이벤트와 실제 이메일 발송 이벤트를 검수할 수 있게 만든다.

**Architecture:** 기존 인증 도메인 로직은 유지하고, 검수 서버 계층에 알림 이벤트 생성과 SMTP 발송 어댑터를 붙인다. 알림은 계정 통합 트랜잭션의 핵심 상태 변경을 방해하지 않도록 발송 실패를 이벤트 상태로 기록한다.

**Tech Stack:** TypeScript, Node.js 내장 HTTP 서버, Vitest, Node `net`/`tls` 기반 SMTP 어댑터, PostgreSQL persistence.

---

## 확정 결정

- 이메일 인증은 환경별 dev/stg/prd 차이를 두지 않고 설정값에 따라 서비스 적용한다.
- MVP1 구현 단계에서는 이메일 인증 흐름을 구현 대상으로 둔다.
- 비밀번호 재설정은 후순위이며 추후 화면 설계 시 적용 대상을 정한다.
- 이메일 변경은 후순위이며 추후 화면 설계 시 적용 대상을 정한다.
- 네이버/구글 OAuth 실제 연동은 다음 세션에서 진행한다.
- DB는 dev와 동일하게 우분투 PostgreSQL을 기준으로 한다.
- QNAP NAS 배포 스크립트와 공유기/HTTPS 연결은 세션 후반 작업으로 분리한다.

## 계정 통합 UX 기준

1. 요청 계정 사용자가 다른 계정에 이미 연결된 OAuth 식별자를 연결하려 하면 자동 병합하지 않고 `ACCOUNT_MERGE_REQUIRED`를 반환한다.
2. MVP1 대표 계정은 요청 계정으로 고정한다.
3. 대상 계정 사용자가 승인하면 대상 계정의 OAuth 식별자가 요청 계정으로 이전되고 대상 계정은 `merged`가 된다.
4. 화면에는 제공자, 요청 계정, 대상 계정, 상태, 만료시각, 마스킹된 제공자 식별자를 표시한다.
5. 제공자 식별자와 이메일은 검수에 필요한 최소 범위만 노출하며 provider user id는 일부 마스킹한다.
6. 요청 취소, 만료, 중복 승인, 취소 후 승인 시도는 상태 오류로 방어한다.

## 알림 기준

1. 계정 통합 요청 생성 시 대상 계정에 샘플 이벤트와 이메일 발송 이벤트를 만든다.
2. 계정 통합 승인 완료 시 요청 계정과 대상 계정 양쪽에 샘플 이벤트와 이메일 발송 이벤트를 만든다.
3. 이메일 발송 성공은 `sent`, 실패는 `failed`, 샘플 이벤트는 `recorded`로 남긴다.
4. SMTP 설정이 없으면 이메일 이벤트는 `EMAIL_SENDER_NOT_CONFIGURED` 실패로 기록한다.
5. 실제 발송은 `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` 환경변수로 설정한다.

## 실행 작업

- [x] `test/unit/review-notifications.test.ts`에 계정 통합 요청/승인/발송 실패 테스트를 추가한다.
- [x] `src/review/review-notifications.ts`에 알림 이벤트 생성 모듈을 추가한다.
- [x] `test/unit/mvp1-review-server.test.ts`에 검수 서버 알림 누적 테스트를 추가한다.
- [x] `src/review/mvp1-review-server.ts`에 병합 요청/승인 알림 연동을 추가한다.
- [x] `test/unit/smtp-email-sender.test.ts`에 SMTP 환경/메시지 테스트를 추가한다.
- [x] `src/review/smtp-email-sender.ts`에 SMTP sender를 추가한다.
- [x] `src/review/mvp1-review-runner.ts`에서 SMTP 환경변수 기반 sender를 주입한다.
- [x] `src/review/public/*` 검수화면에 알림 이벤트 표시를 추가한다.

## 검증 기준

- `npx vitest run test/unit/review-notifications.test.ts`
- `npx vitest run test/unit/smtp-email-sender.test.ts`
- `npx vitest run test/unit/mvp1-review-server.test.ts`
- `npm run typecheck`
- `npm run test:unit`
- `npm test`
