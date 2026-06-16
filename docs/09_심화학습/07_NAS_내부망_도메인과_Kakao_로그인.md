# 07. NAS 내부망 도메인과 Kakao 로그인 학습

## 목적

NAS를 dev 서비스로 사용할 때 외부망과 내부망에서 같은 카카오 간편로그인 흐름을 검증하기 위한 도메인 처리 기준을 정리한다.

## 핵심 원칙

카카오 REST OAuth는 서버가 authorize URL에 담아 보내는 `redirect_uri`가 카카오 개발자 콘솔에 등록된 Redirect URI와 정확히 일치해야 한다. PDFowers는 이 값을 다음처럼 만든다.

```text
APP_BASE_URL + KAKAO_REDIRECT_PATH
```

dev 우선 기준은 다음 값이다.

```dotenv
APP_BASE_URL=https://jkok2.myqnapcloud.com:4443
KAKAO_REDIRECT_PATH=/auth/kakao/callback
```

따라서 카카오 개발자 콘솔에는 다음 Redirect URI를 등록한다.

```text
https://jkok2.myqnapcloud.com:4443/auth/kakao/callback
```

## 외부망 흐름

외부망에서는 보통 다음 경로로 요청이 들어온다.

```text
브라우저
  -> https://jkok2.myqnapcloud.com:4443
  -> 공유기 공인 IP:443
  -> QNAP NAS
  -> PDFowers dev 컨테이너 4173
```

외부망에서 `https://jkok2.myqnapcloud.com:4443/auth/kakao/config-status`가 `enabled=true`, `missing=[]`를 반환하고 `/auth/kakao/start`가 카카오 authorize URL로 이동하면 카카오 화면 진입 조건은 충족된다.

## 내부망에서 실패하는 이유

내부망 PC가 `https://jkok2.myqnapcloud.com:4443`에 접속할 때 공유기 공인 IP로 다시 나갔다가 내부 NAS로 돌아와야 한다. 공유기가 이 동작을 지원하지 않으면 같은 도메인이 외부망에서는 열리고 내부망에서는 열리지 않는다. 이 기능을 보통 hairpin NAT 또는 NAT loopback이라고 부른다.

## 내부망 해결 방식

권장 방식은 내부망에서도 브라우저 주소는 `https://jkok2.myqnapcloud.com:4443`로 유지하고, 내부 DNS만 NAS 사설 IP로 보내는 것이다.

```text
jkok2.myqnapcloud.com -> 192.168.219.112
```

이 방식을 쓰면 브라우저 주소, 서버의 `redirect_uri`, 카카오 콘솔 Redirect URI가 모두 같은 도메인으로 유지된다.

대안은 각 PC의 `hosts` 파일에 같은 매핑을 넣는 것이다. 단일 개발 PC에서는 빠르지만, 휴대폰과 여러 PC까지 검증해야 하면 공유기 또는 내부 DNS에서 관리하는 편이 낫다.

## 피해야 할 방식

내부망에서 `http://192.168.219.112:4173`으로 직접 접속한 뒤 카카오 로그인을 검증하는 방식은 피한다. 이 주소로 접속하면 브라우저의 서비스 주소와 카카오 Redirect URI가 달라진다. 로컬 개발은 `localhost`, dev NAS 검증은 `jkok2.myqnapcloud.com`처럼 환경별 기준 URL을 분리한다.

## 환경별 기준 URL

| 환경 | 접속 기준 URL | Redirect URI |
| :--- | :--- | :--- |
| Codex 로컬/IntelliJ | `http://localhost:4173` | `http://localhost:4173/auth/kakao/callback` |
| dev NAS | `https://jkok2.myqnapcloud.com:4443` | `https://jkok2.myqnapcloud.com:4443/auth/kakao/callback` |
| stg | `https://fowersstg.pdfrend.com` | `https://fowersstg.pdfrend.com/auth/kakao/callback` |

## 배포 후 확인

dev NAS 배포 후 다음을 확인한다.

```powershell
npm run review:kakao-smoke -- --base-url https://jkok2.myqnapcloud.com:4443
```

기대 결과는 `ok=true`다. 컨테이너 내부 healthcheck는 같은 검사를 `http://127.0.0.1:4173`으로 호출한다. 이때도 서버가 만드는 카카오 authorize URL은 `APP_BASE_URL` 기준 Redirect URI를 사용한다.

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-17 00:10 KST | Codex | jkoogi | NAS 내부망 도메인과 Kakao Redirect URI 기준 정리 |

## 2026-06-17 dev request-host callback 기준

dev NAS에서는 `APP_ENV=dev`일 때만 요청 Host 기반 Kakao Redirect URI를 허용한다. 이 기준은 내부망 IP 직접 접속 검수를 지원하기 위한 dev 전용 동작이며, `stg`와 `prd`에서는 계속 `APP_BASE_URL` 기준 고정 Redirect URI를 사용한다.

```dotenv
APP_ENV=dev
APP_BASE_URL=https://jkok2.myqnapcloud.com:4443
KAKAO_REDIRECT_PATH=/auth/kakao/callback
KAKAO_ALLOWED_REDIRECT_ORIGINS=http://localhost:4173,http://127.0.0.1:4173,http://192.168.219.112:4173,https://jkok2.myqnapcloud.com:4443
```

동작 기준은 다음과 같다.

| 접속 URL | Kakao Redirect URI |
| :--- | :--- |
| `http://192.168.219.112:4173` | `http://192.168.219.112:4173/auth/kakao/callback` |
| `https://jkok2.myqnapcloud.com:4443` | `https://jkok2.myqnapcloud.com:4443/auth/kakao/callback` |

`http://127.0.0.1:4173`은 NAS 컨테이너 내부 healthcheck가 `/auth/kakao/start`를 확인할 때 사용한다. `KAKAO_ALLOWED_REDIRECT_ORIGINS`에 없는 Host는 request-host redirect 대상으로 사용하지 않는다. Kakao Developers REST API Redirect URI에는 브라우저에서 실제 로그인 검증에 사용할 callback URI를 등록한다.
