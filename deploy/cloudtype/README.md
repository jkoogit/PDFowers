# Cloudtype stg/prd 운영 후보 기준

## 목적

PDFowers MVP1 검수 서버를 Cloudtype에서 stg와 prd 환경으로 분리 운영하기로 결정할 경우 적용할 설정 기준이다. 현재 운영 위치는 NAS와 Cloudtype 중 추후 결정하며, 결정 전까지 운영 도메인은 NAS prd 후보에 연결할 수 있다. 실제 비밀번호, OAuth Client Secret, DB URL 원문은 배포 환경의 환경변수 또는 시크릿에만 저장한다.

## 공통 설정

| 항목 | 값 |
| :--- | :--- |
| 빌드 방식 | Dockerfile |
| 컨테이너 포트 | `4173` |
| 실행 명령 | Dockerfile `CMD` 사용 |
| Node 기준 | `package.json`의 `engines.node >=22.0.0` |
| 헬스 확인 | `GET /auth/kakao/config-status` 또는 `GET /` |

## 환경별 브랜치와 도메인

| 환경 | Git 브랜치 | 도메인 | 카카오 Redirect URI |
| :--- | :--- | :--- | :--- |
| stg | `stg` | `https://fowersstg.pdfrend.com` | `https://fowersstg.pdfrend.com/auth/kakao/callback` |
| prd | `main` | `https://fowers.pdfrend.com` | `https://fowers.pdfrend.com/auth/kakao/callback` |

## 필수 환경변수

| 변수 | stg 예시 | prd 예시 | 민감정보 |
| :--- | :--- | :--- | :---: |
| `APP_ENV` | `stg` | `prd` | 아니오 |
| `NODE_ENV` | `production` | `production` | 아니오 |
| `PORT` | `4173` | `4173` | 아니오 |
| `DATABASE_URL` | Cloudtype 시크릿 | Cloudtype 시크릿 | 예 |
| `KAKAO_REST_API_KEY` | stg REST API 키 | prd REST API 키 | 아니오 |
| `APP_BASE_URL` | stg 공개 도메인 | prd 공개 도메인 | 아니오 |
| `KAKAO_REDIRECT_PATH` | `/auth/kakao/callback` | `/auth/kakao/callback` | 아니오 |
| `KAKAO_REDIRECT_URI` | 명시 override 필요 시만 사용 | 명시 override 필요 시만 사용 | 아니오 |
| `KAKAO_CLIENT_SECRET` | Cloudtype 시크릿 | Cloudtype 시크릿 | 예 |
| `KAKAO_SCOPE` | 빈 값 또는 `account_email,profile_nickname` | 빈 값 또는 `account_email,profile_nickname` | 아니오 |
| `SMTP_HOST` | SMTP 서버 호스트 | SMTP 서버 호스트 | 아니오 |
| `SMTP_PORT` | `465` 후보 | `465` 후보 | 아니오 |
| `SMTP_SECURE` | `true` 후보 | `true` 후보 | 아니오 |
| `SMTP_USER` | Cloudtype 시크릿 | Cloudtype 시크릿 | 예 |
| `SMTP_PASS` | Cloudtype 시크릿 | Cloudtype 시크릿 | 예 |
| `SMTP_FROM` | 발신 이메일 주소 | 발신 이메일 주소 | 아니오 |

## 배포 절차

1. 작업 브랜치에서 `dev` 대상 PR을 생성한다.
2. `dev` 병합 후 `dev -> stg` PR을 생성한다.
3. stg 배포 위치가 Cloudtype이면 Cloudtype 배포와 검수 결과를 PR 또는 이슈 댓글에 기록한다.
4. 검수 완료 후 `stg -> main` PR을 생성한다.
5. prd 배포 위치가 Cloudtype이면 Cloudtype 배포 후 최종 커밋 SHA와 검증 결과를 이슈 댓글에 기록한다.

## DB 마이그레이션

Cloudtype 애플리케이션 컨테이너에서 직접 migration을 실행할 수 있는 경우 다음 명령을 사용한다.

```bash
npm run db:migrate
```

Cloudtype에서 one-off command가 제한되면 운영자 PC 또는 NAS에서 같은 `DATABASE_URL` 시크릿을 일시 주입해 migration을 실행한다. 이때 명령 로그에 URL 원문이 남지 않도록 쉘 히스토리와 터미널 공유를 주의한다.

## OAuth 운영 기준

- stg와 prd는 가능하면 카카오 REST API 키와 Client Secret을 분리한다.
- Cloudtype 도메인 연결 후 카카오 콘솔의 REST API 키 설정 화면에 Redirect URI를 등록한다.
- Client Secret은 stg/prd 모두 ON을 기본으로 한다.
- OAuth access token과 refresh token은 MVP1에서 저장하지 않는다.
## 2026-06-17 Kakao smoke check

stg 배포 후에는 다음 명령으로 카카오 로그인 화면 이동 가능 상태를 확인한다.

```powershell
npm run review:kakao-smoke -- --base-url https://fowersstg.pdfrend.com
```

이 검사는 `/auth/kakao/config-status`가 `enabled=true`인지, `/auth/kakao/start`가 `https://kauth.kakao.com/oauth/authorize`로 3xx redirect를 반환하는지만 확인한다. 실제 카카오 계정 인증 완료는 브라우저 수동 검증으로 진행한다.

운영 도메인을 NAS prd 후보에 임시 연결하더라도 Kakao Redirect URI는 실제 운영 도메인 기준으로 등록한다. 나중에 Cloudtype으로 이전할 때 같은 운영 도메인을 유지하면 Kakao callback URI는 바꾸지 않는다.
