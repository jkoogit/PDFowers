# 환경별 배포 구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDFowers MVP1 검수 서버를 dev NAS Container Station과 stg/prd Cloudtype에서 환경변수 기반으로 실행할 수 있게 만든다.

**Architecture:** 앱은 Dockerfile로 컨테이너 이미지를 만들고, GitHub Actions가 `dev` 브랜치 이미지를 GHCR에 발행한다. NAS Container Station은 GitHub 소스를 직접 빌드하지 않고 `ghcr.io/jkoogit/pdfowers:dev` 이미지를 pull해서 실행한다. DB는 NAS 컨테이너가 아니라 별도 우분투 PostgreSQL 서비스를 `DATABASE_URL`로 연결한다.

**Tech Stack:** Docker, Docker Compose, GitHub Actions, GHCR, Node.js 22, npm, TypeScript, Vitest, PostgreSQL, Cloudtype.

---

## File Structure

- Create `Dockerfile`: production container image build and runtime definition.
- Create `.dockerignore`: Docker build context에서 로컬 산출물과 민감정보 제외.
- Create `.github/workflows/docker-dev.yml`: `dev` 브랜치 push 시 GHCR dev 이미지 발행.
- Create `deploy/nas/docker-compose.dev.yml`: NAS Container Station용 PDFowers 앱 서비스 정의.
- Create `deploy/nas/.env.example`: NAS compose 실행에 필요한 환경변수 예시. 실제 비밀번호는 기록하지 않는다.
- Create `deploy/cloudtype/README.md`: stg/prd Cloudtype 빌드, 실행, 환경변수, 도메인, OAuth callback 운영 기준.
- Create `docs/04_기술관리/11_배포운영가이드.md`: dev/stg/prd 배포와 승급 운영 기준.
- Modify `docs/04_기술관리/README.md`: 신규 배포 운영 가이드 링크 추가.

## Task 1: Docker Image

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `package.json`

- [x] **Step 1: Add Docker build definition**

Docker image는 build stage에서 `npm run typecheck`, `npm run test:unit`, `npm run build`를 실행하고, runner stage에서는 production dependency와 `dist` 산출물만 포함한다. 검수화면 정적 파일은 runtime 이미지의 `dist/src/review/public`에 복사한다.

- [x] **Step 2: Add build script**

`package.json`에 `"build": "tsc --outDir dist"`를 추가한다.

- [x] **Step 3: Add build context exclusions**

`.dockerignore`에 `.env`, `node_modules`, `dist`, `.superpowers`, `deploy/**/.env`를 제외한다.

## Task 2: GitHub Actions Image Publish

**Files:**
- Create: `.github/workflows/docker-dev.yml`

- [x] **Step 1: Add dev image workflow**

`dev` 브랜치 push와 수동 실행 시 Dockerfile 이미지를 빌드하고 다음 태그로 GHCR에 push한다.

```text
ghcr.io/jkoogit/pdfowers:dev
ghcr.io/jkoogit/pdfowers:dev-${GITHUB_SHA}
```

## Task 3: NAS Dev Compose

**Files:**
- Create: `deploy/nas/docker-compose.dev.yml`
- Create: `deploy/nas/.env.example`

- [x] **Step 1: Add NAS compose**

NAS compose는 `build:`를 사용하지 않는다. QNAP Container Station의 Docker Build 환경에는 `git`이 없어 GitHub URL build context가 실패하므로 GHCR 이미지를 pull한다.

```yaml
services:
  pdfowers_dev:
    image: ghcr.io/jkoogit/pdfowers:dev
    pull_policy: always
    restart: unless-stopped
    container_name: pdfowers_dev
    ports:
      - "${PDFOWERS_DEV_PORT:-4173}:4173"
    environment:
      NODE_ENV: production
      APP_ENV: dev
      PORT: "4173"
      DATABASE_URL: ${DATABASE_URL}
      KAKAO_REST_API_KEY: ${KAKAO_REST_API_KEY}
      KAKAO_REDIRECT_URI: ${KAKAO_REDIRECT_URI}
      KAKAO_CLIENT_SECRET: ${KAKAO_CLIENT_SECRET}
      KAKAO_SCOPE: ${KAKAO_SCOPE:-}
```

- [x] **Step 2: Add NAS env example**

`.env.example`은 우분투 PostgreSQL `DATABASE_URL`, 카카오 OAuth 설정, 외부 공개 포트만 포함한다. DB/pgAdmin 컨테이너 설정은 포함하지 않는다.

## Task 4: Cloudtype stg/prd Guide

**Files:**
- Create: `deploy/cloudtype/README.md`

- [x] **Step 1: Document Cloudtype settings**

Cloudtype은 stg/prd 브랜치를 Dockerfile로 빌드하고, 환경별 `DATABASE_URL`과 OAuth 시크릿을 Cloudtype 시크릿으로 주입한다.

## Task 5: Operations Documentation

**Files:**
- Create: `docs/04_기술관리/11_배포운영가이드.md`
- Modify: `docs/04_기술관리/README.md`

- [x] **Step 1: Add operations guide**

문서에는 PR 기반 승급, NAS GHCR pull 방식, 우분투 PostgreSQL 연결, Cloudtype 환경변수, secret 처리 기준을 기록한다.

## Task 6: Verification

**Files:**
- Modify only if verification finds a defect.

- [x] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [x] **Step 2: Run unit tests**

Run: `npm run test:unit`

Expected: PASS.

- [x] **Step 3: Run full tests where NAS DB access is allowed**

Run: `npm test`

Expected: PASS with network access to the configured PostgreSQL.

- [ ] **Step 4: Verify Docker on NAS or CI**

Docker CLI is not available in the local Codex environment. Docker image build verification is delegated to GitHub Actions after this branch is merged to `dev`.

## Self-Review

- Spec coverage: dev NAS Container Station, GHCR image publish, stg/prd Cloudtype, PR-based promotion, secret handling, and verification are covered.
- Placeholder scan: placeholders exist only in `.env.example` values and are intentionally non-secret markers.
- Type consistency: compose service name, GHCR image name, and workflow tag all use `pdfowers_dev` / `ghcr.io/jkoogit/pdfowers:dev` consistently.
