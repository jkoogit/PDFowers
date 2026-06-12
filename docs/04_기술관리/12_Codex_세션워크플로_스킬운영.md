# Codex 세션 워크플로 스킬 운영

## 목적

PDFowers 작업에서 반복되는 세션 시작, 세션 마무리, 브랜치 승급 절차를 Codex 스킬과 저장소 문서로 함께 관리한다.

로컬 Codex 스킬은 실제 자동 적용을 위한 실행 지침이고, 이 문서는 저장소에서 추적하는 운영 기준이다.

## 로컬 스킬 위치

현재 실행용 스킬은 다음 경로에 둔다.

```text
C:\Users\jkoog\.codex\skills\pdfowers-session-workflow\SKILL.md
```

Codex는 기본적으로 `C:\Users\jkoog\.codex\skills` 아래의 스킬을 자동 발견한다.

`D:\dev\workspace\ai.codex` 아래에 스킬 파일을 둘 수도 있지만, 기본 자동 발견 경로가 아니므로 별도 설치 또는 `CODEX_HOME` 구성이 필요하다. 따라서 실행용 스킬은 C 드라이브 기본 경로에 두고, 저장소 공유용 절차 문서는 이 문서처럼 `docs/`에 둔다.

## 스킬명

```text
pdfowers-session-workflow
```

## 트리거

다음 사용자 요청이 들어오면 스킬을 적용한다.

- `#세션시작`
- `#세션마무리`
- `#브랜치승급`

## #세션시작 절차

1. `git fetch origin`으로 원격 상태를 갱신한다.
2. 원격 `dev`, `stg`, `main`의 최신 commit SHA, 제목, tree hash를 확인한다.
3. 로컬 `main`과 `origin/main`이 일치하는지 확인한다.
4. 로컬 `main`이 `origin/main`의 조상이고 체크아웃 중이 아니면 `git branch -f main origin/main`으로 현행화한다.
5. 작업트리 상태를 확인하고 미추적 또는 수정 파일이 있으면 사용자 작업인지 구분한다.
6. 새 세션 작업 범위를 정리한다.
7. 작업에 필요한 정책 결정사항과 구체화 필요사항을 별도로 정리한다.
8. 구현 전 결정이 필요한 항목이 없으면 작업 브랜치를 생성하고 진행한다.

## #세션마무리 절차

1. 세션 중 진행한 작업과 업무 내용을 정리한다.
2. 변경 파일, 변경 의도, 검증 결과를 확인한다.
3. 심화학습 대상 또는 후속 검토 대상을 선별한다.
4. 관련 문서를 `docs/` 아래에 작성한다.
5. GitHub 이슈를 한글 제목/본문으로 생성한다.
6. 변경 파일을 명시적으로 staging한다.
7. 테스트와 빌드를 실행해 결과를 확인한다.
8. 한글 커밋 메시지로 커밋하고 원격 작업 브랜치에 push한다.
9. `dev` 대상 PR을 작성한다.
10. PR 본문에는 작업 요약, 변경 파일, 검증 내용, 후속 작업을 포함한다.

기본 검증 명령은 다음을 우선한다.

```powershell
git diff --check
npm run typecheck
npm run test:unit
npm test
npm run build
```

## #브랜치승급 절차

1. `git fetch origin`으로 원격 상태를 갱신한다.
2. `dev`에 병합된 최신 변경을 기준으로 `dev -> stg`, `stg -> main` 순서로 승급한다.
3. 각 승급은 GitHub PR을 생성해서 처리한다.
4. `dev -> stg` PR 본문에는 포함된 원천 PR 번호와 검증 결과를 적는다.
5. `dev -> stg` 머지 커밋 제목에는 승급 PR 번호와 원천 PR 번호를 포함한다.
   - 예: `PR #41 dev to stg 승급 - 작업명 반영 (#40)`
6. `stg -> main` PR 본문에는 포함된 `dev -> stg` PR 번호와 원천 PR 번호를 적는다.
7. `stg -> main` 머지 커밋 제목에는 승급 PR 번호와 관련 PR 번호를 포함한다.
   - 예: `PR #42 stg to main 승급 - 작업명 반영 (#41, #40)`
8. 승급 후 `origin/dev`, `origin/stg`, `origin/main`의 tree hash가 같은지 확인한다.
9. 관련 이슈에 승급 PR 번호, merge commit SHA, 최종 브랜치 상태, 검증 결과를 댓글로 기록한다.
10. 로컬 `main`이 체크아웃 중이 아니고 `origin/main`으로 fast-forward 가능한 상태면 `git branch -f main origin/main`으로 맞춘다.

## 운영 기준

- 실행용 스킬은 로컬 Codex 기본 경로에서 관리한다.
- 저장소 공유용 절차는 이 문서에서 관리한다.
- 스킬 내용을 바꿀 때는 이 문서도 같이 갱신한다.
- 이 문서만 변경해도 Codex 스킬 자동 적용에는 반영되지 않는다. 실행용 스킬 파일도 함께 수정해야 한다.
