# 08. Node/npm 환경 확인

## 목적

TypeScript/Vitest 도입 전 로컬 실행 환경의 Node/npm 경로 문제와 fallback 기준을 기록한다.

## 확인 결과

| 항목 | 결과 | 판단 |
| :--- | :--- | :--- |
| `node --version` | WindowsApps 경로의 Codex 앱 Node가 잡히지만 실행 시 `액세스가 거부되었습니다` 발생 | 로컬 PATH의 `node`는 현재 신뢰할 수 없음 |
| `npm --version` | `npm` 명령을 찾을 수 없음 | 로컬 npm PATH 미구성 |
| 번들 Node | `C:\Users\jkoog\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` 실행 가능, `v24.14.0` | Codex 작업 중 기본 fallback으로 사용 |
| 번들 npm/corepack | 번들 Node 디렉터리에 npm/corepack 실행 파일 없음 | 의존성 설치가 필요하면 임시 npm CLI 확보 필요 |
| `package-lock.json` | 임시 npm CLI를 통해 생성 성공 | 저장소 기준 lockfile 유지 가능 |

## 현재 명령 기준

| 목적 | 명령 |
| :--- | :--- |
| 테스트 | `npm test` |
| 타입 검사 | `npm run typecheck` |

로컬 PATH에 npm이 없을 때 Codex 환경에서는 임시 npm CLI를 번들 Node로 실행해 의존성을 설치할 수 있다. 다만 개발자가 반복적으로 사용할 환경에서는 Node.js LTS 또는 현재 프로젝트 요구 버전 이상의 Node와 npm을 PATH에 정식 등록하는 편이 좋다.

## fallback 원칙

1. 일반 개발 환경에서는 `npm test`, `npm run typecheck`를 표준 명령으로 둔다.
2. Codex 작업 환경에서 `node`가 WindowsApps 경로로 잡혀 실행 거부되면 번들 Node 절대 경로를 사용한다.
3. npm이 없으면 임시 npm CLI로 설치와 lockfile 갱신을 수행하되, 임시 CLI 자체는 저장소에 커밋하지 않는다.
4. `package-lock.json`은 저장소에 포함해 의존성 해석 결과를 고정한다.

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-10 00:00 KST | Codex | jkoogi | TypeScript/Vitest 도입 전 Node/npm PATH 문제와 번들 Node fallback 기준 기록 |
