# 06. QNAP Nginx Proxy Manager 도메인 연결 학습

## 목적

PDFowers dev 서비스를 QNAP NAS Docker Station에서 실행한 뒤 `fowersdev.pdfrend.com` 도메인으로 안정적으로 접속하기 위한 리버스 프록시와 인증서 구성을 정리한다.

이 문서는 Nginx Proxy Manager 설치를 무조건 전제로 하지 않는다. QNAP 내장 리버스 프록시와 인증서 관리로 해결 가능한지 먼저 판단하고, 현재 PDFowers dev 환경에서 Nginx Proxy Manager가 왜 현실적인 대안인지 설명한다.

## 현재 상황

| 항목 | 상태 |
| :--- | :--- |
| 앱 컨테이너 | QNAP NAS Docker Station에서 실행 성공 |
| 앱 직접 접속 | `http://192.168.219.112:4173` 성공 |
| 도메인 HTTP 접속 | `http://fowersdev.pdfrend.com` 성공한 이력 있음 |
| 도메인 HTTPS 접속 | `fowersdev.pdfrend.com`은 미완료, QNAP DDNS 도메인 인증서는 발급 성공 |
| QNAP 관리 접속 | `http://192.168.219.112:8888/cgi-bin/` 사용 |
| 공유기 포워딩 | 외부 `80`, `443`을 NAS `192.168.219.112`로 전달 |

목표 흐름은 다음과 같다.

```text
브라우저
  -> https://fowersdev.pdfrend.com
  -> 공유기 공인 IP 58.77.51.49:443
  -> QNAP NAS 192.168.219.112:443
  -> 리버스 프록시
  -> PDFowers dev http://192.168.219.112:4173
```

## 왜 리버스 프록시가 필요한가

PDFowers dev 앱은 컨테이너 내부에서 `4173` 포트로 실행된다. 브라우저와 OAuth 제공자는 일반적으로 표준 HTTPS 포트인 `443`으로 접속한다.

따라서 외부 요청을 앱으로 연결하려면 앞단에서 다음 역할을 수행하는 구성 요소가 필요하다.

| 역할 | 설명 |
| :--- | :--- |
| 도메인 분기 | `fowersdev.pdfrend.com` 요청을 PDFowers dev 서비스로 보냄 |
| 포트 변환 | 외부 `443` 요청을 내부 `4173` 앱으로 전달 |
| TLS 종료 | 브라우저 HTTPS 연결을 처리하고 앱에는 HTTP로 전달 |
| 인증서 자동 갱신 | Let's Encrypt 인증서를 발급하고 만료 전에 갱신 |
| HTTP to HTTPS 전환 | `http://` 접속을 `https://`로 유도 |

QNAP 내장 리버스 프록시도 이 역할을 할 수 있다. 다만 현재 환경에서는 QNAP 내장 인증서 발급과 80번 포트 프록시가 서로 간섭했다.

## 현재 QNAP 내장 기능에서 발생한 문제

Let's Encrypt의 HTTP-01 검증은 외부에서 아래 URL로 접근해 인증 파일을 확인한다.

```text
http://fowersdev.pdfrend.com/.well-known/acme-challenge/<token>
```

현재 환경에서는 다음 현상이 있었다.

| 상태 | 결과 |
| :--- | :--- |
| QNAP 리버스 프록시 HTTP 80 규칙 활성화 | `http://fowersdev.pdfrend.com`이 앱 `4173`으로 연결됨 |
| QNAP 리버스 프록시 HTTP 80 규칙 비활성화 | 외부 HTTP 화면이 열리지 않음 |
| QNAP Let's Encrypt 발급 | ACME 서버가 도메인 검증 요청을 받지 못했다는 오류 발생 |
| QNAP 기본 도메인 인증서 | `myqnapcloud.com` 도메인으로는 발급 가능 |

이 상황은 외부 80 포트가 완전히 막힌 문제라기보다, `fowersdev.pdfrend.com`의 ACME challenge 요청을 QNAP 인증서 관리 기능이 안정적으로 처리하지 못하는 문제로 보는 것이 자연스럽다.

## 2026-06-14 임시 운영 결정

개발서비스는 우선 QNAP DDNS 도메인에 발급된 Let's Encrypt 인증서를 사용한다.

| 항목 | 결정 |
| :--- | :--- |
| dev 임시 HTTPS | QNAP DDNS 도메인 인증서 사용 |
| `fowersdev.pdfrend.com` 연결 | 보류 |
| Nginx Proxy Manager 설치 | 보류 |
| 운영 도메인 방식 | 운영 배포 전 재검토 |

이 결정은 개발 검수 속도를 우선하기 위한 임시 결정이다. `fowersdev.pdfrend.com`은 브랜드/운영 기준에 더 적합하지만, 현재 QNAP 내장 인증서 관리에서 커스텀 도메인 ACME challenge 처리가 안정적으로 완료되지 않았다.

운영서비스를 올릴 때는 다음 중 하나를 다시 결정한다.

1. Cloudtype 또는 별도 외부 서비스에서 운영 도메인을 처리한다.
2. NAS 앞단에 Nginx Proxy Manager 또는 Nginx를 두고 운영 도메인과 인증서를 관리한다.
3. DNS-01 방식 등 별도 ACME 발급 방식을 사용해 QNAP에 인증서를 가져온다.

## Nginx Proxy Manager의 역할

Nginx Proxy Manager는 Docker 컨테이너로 실행하는 리버스 프록시 관리 도구다. 웹 UI에서 도메인, 대상 서비스, SSL 인증서를 설정할 수 있다.

PDFowers dev 환경에서는 Nginx Proxy Manager가 다음을 한 번에 담당한다.

```text
공유기 80/443
  -> QNAP NAS 80/443
  -> Nginx Proxy Manager
       - Let's Encrypt HTTP-01 challenge 처리
       - fowersdev.pdfrend.com 인증서 발급
       - HTTP 요청을 HTTPS로 전환
       - HTTPS 요청을 PDFowers dev 4173으로 전달
```

핵심 장점은 인증서 발급과 프록시가 같은 도구 안에서 처리된다는 점이다. QNAP 내장 인증서 관리가 ACME challenge를 받고, QNAP 내장 리버스 프록시가 앱으로 보내는 식의 역할 충돌을 줄일 수 있다.

## Nginx Proxy Manager가 꼭 필요한가

필수는 아니다.

다음 조건을 만족하면 QNAP 내장 기능만으로도 가능하다.

1. QNAP 내장 Web Server 또는 인증서 관리 기능이 외부 80 요청을 받을 수 있다.
2. `fowersdev.pdfrend.com`의 ACME challenge 요청이 앱 `4173`이 아니라 QNAP 인증서 관리 쪽으로 전달된다.
3. 인증서 발급 후 QNAP 리버스 프록시가 `443 -> 4173`을 안정적으로 처리한다.
4. QNAP 관리 웹과 리버스 프록시가 80/443 포트를 두고 충돌하지 않는다.

현재는 위 조건 중 2번과 4번이 불안정했다. 그래서 `fowersdev.pdfrend.com`을 계속 사용한다면 Nginx Proxy Manager를 도입하는 편이 빠른 해결책이다.

다만 개발서비스만 빠르게 열어 검수하는 목적이라면 QNAP DDNS 도메인 인증서를 임시로 사용하는 것도 가능하다. 이 경우 카카오 Redirect URI와 공유 대상 URL은 QNAP DDNS 도메인 기준으로 맞춘다.

## 적용 전 점검표

| 확인 항목 | 기대 상태 | 확인 방법 |
| :--- | :--- | :--- |
| 앱 직접 접속 | 성공 | `http://192.168.219.112:4173` |
| DNS | 공인 IP 연결 | `fowersdev.pdfrend.com -> 58.77.51.49` |
| 공유기 80 포워딩 | NAS로 전달 | 외부 `80 -> 192.168.219.112:80` |
| 공유기 443 포워딩 | NAS로 전달 | 외부 `443 -> 192.168.219.112:443` |
| QNAP 관리 포트 | 80/443 미사용 권장 | 현재 `8888` 사용 |
| QNAP 내장 리버스 프록시 | 80/443 규칙 비활성화 | NPM과 포트 충돌 방지 |

## 권장 구성

### 컨테이너 구성

QNAP Docker Station 또는 Container Station에서 Nginx Proxy Manager 컨테이너를 생성한다.

필요 포트는 다음과 같다.

| 호스트 포트 | 컨테이너 포트 | 용도 |
| :---: | :---: | :--- |
| `80` | `80` | HTTP, Let's Encrypt HTTP-01 검증 |
| `443` | `443` | HTTPS 서비스 |
| `8181` | `81` | Nginx Proxy Manager 관리자 UI |

관리 UI 포트는 QNAP 관리 포트와 충돌하지 않도록 `8181` 같은 포트를 사용한다.

### Docker Compose 예시

아래 예시는 NAS에서 직접 compose로 실행할 때의 기준이다. QNAP UI에서 Application을 만들 때도 같은 포트와 볼륨 개념을 적용한다.

```yaml
services:
  nginx_proxy_manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx_proxy_manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8181:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

관리 UI 접속 주소는 다음과 같다.

```text
http://192.168.219.112:8181
```

초기 계정은 Nginx Proxy Manager 공식 이미지의 기본값을 확인해 사용한다. 첫 로그인 후 즉시 이메일과 비밀번호를 변경한다.

## QNAP Docker Station에서 따라 하기

### 1. 기존 QNAP 리버스 프록시 정리

QNAP 제어판의 리버스 프록시에서 `fowersdev.pdfrend.com` 관련 규칙을 비활성화한다.

특히 다음 규칙은 Nginx Proxy Manager와 충돌할 수 있다.

```text
HTTP 80  -> 4173
HTTPS 443 -> 4173
```

### 2. Nginx Proxy Manager 컨테이너 생성

QNAP Docker Station에서 새 Application 또는 Container를 만든다.

설정 기준은 다음과 같다.

| 항목 | 값 |
| :--- | :--- |
| 이미지 | `jc21/nginx-proxy-manager:latest` |
| 컨테이너 이름 | `nginx_proxy_manager` |
| 재시작 정책 | `unless-stopped` 또는 항상 재시작 |
| 포트 | `80:80`, `443:443`, `8181:81` |
| 볼륨 1 | NPM data 디렉터리 -> `/data` |
| 볼륨 2 | NPM 인증서 디렉터리 -> `/etc/letsencrypt` |

볼륨은 NAS 공유 폴더 아래에 명확히 잡는다.

예시:

```text
/share/Container/nginx-proxy-manager/data -> /data
/share/Container/nginx-proxy-manager/letsencrypt -> /etc/letsencrypt
```

### 3. Nginx Proxy Manager 관리자 UI 접속

브라우저에서 접속한다.

```text
http://192.168.219.112:8181
```

처음 로그인 후 관리자 계정 정보를 변경한다. 변경한 계정 정보는 저장소 문서, 이슈, PR에 기록하지 않는다.

### 4. Proxy Host 추가

Nginx Proxy Manager UI에서 `Proxy Hosts` 메뉴로 이동한 뒤 `Add Proxy Host`를 선택한다.

Details 탭:

| 항목 | 값 |
| :--- | :--- |
| Domain Names | `fowersdev.pdfrend.com` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.219.112` |
| Forward Port | `4173` |
| Cache Assets | OFF |
| Block Common Exploits | ON |
| Websockets Support | 현재는 OFF, 추후 필요 시 ON |

`Forward Hostname / IP`는 같은 NAS 내부 컨테이너 네트워크 구성이 명확하지 않으면 `127.0.0.1`보다 `192.168.219.112`를 우선 사용한다.

### 5. SSL 인증서 발급

SSL 탭:

| 항목 | 값 |
| :--- | :--- |
| SSL Certificate | `Request a new SSL Certificate` |
| Force SSL | ON |
| HTTP/2 Support | ON |
| HSTS Enabled | 초기에는 OFF |
| Email Address | 운영자 이메일 |
| I Agree to the Let's Encrypt Terms of Service | ON |

HSTS는 초기 검증 중에는 켜지 않는다. 인증서와 리버스 프록시가 안정화된 뒤 켠다. HSTS를 잘못 켜면 브라우저가 HTTPS 실패 상태를 강하게 캐시해 복구가 번거롭다.

### 6. 저장 후 검증

외부망에서 다음 URL을 확인한다. 내부망에서는 공유기 hairpin NAT 지원 여부에 따라 실패할 수 있으므로 휴대폰 LTE/5G 테스트가 더 정확하다.

```text
http://fowersdev.pdfrend.com
https://fowersdev.pdfrend.com
https://fowersdev.pdfrend.com/auth/kakao/config-status
```

기대 결과:

| URL | 기대 결과 |
| :--- | :--- |
| `http://fowersdev.pdfrend.com` | `https://fowersdev.pdfrend.com`으로 이동 |
| `https://fowersdev.pdfrend.com` | PDFowers MVP1 검수 화면 |
| `/auth/kakao/config-status` | JSON 응답, `enabled=true`, `missing=[]` |

## 장애 대응

### 인증서 발급 실패

확인 순서:

1. 공유기에서 외부 80이 QNAP 80으로 전달되는지 확인한다.
2. QNAP 내장 리버스 프록시나 Web Server가 80을 이미 점유하지 않는지 확인한다.
3. Nginx Proxy Manager 컨테이너 포트 매핑에 `80:80`이 있는지 확인한다.
4. 외부망에서 `http://fowersdev.pdfrend.com`이 NPM으로 도달하는지 확인한다.
5. DNS가 현재 공인 IP를 가리키는지 확인한다.

### HTTPS 접속이 QNAP 관리 화면으로 이동

QNAP 관리 HTTPS 또는 내장 리버스 프록시가 443을 점유하고 있을 가능성이 높다.

조치:

1. QNAP 관리 HTTPS 포트를 443이 아닌 값으로 변경하거나 비활성화한다.
2. QNAP 내장 리버스 프록시의 443 규칙을 비활성화한다.
3. Nginx Proxy Manager 컨테이너가 호스트 443을 사용 중인지 확인한다.

### HTTP는 되는데 HTTPS가 안 됨

확인 순서:

1. NPM 컨테이너 포트에 `443:443`이 있는지 확인한다.
2. Proxy Host SSL 탭에서 인증서 발급이 성공했는지 확인한다.
3. 공유기 외부 443이 NAS 443으로 전달되는지 확인한다.
4. NAS 방화벽에서 443이 허용되는지 확인한다.

### 내부망에서만 도메인이 안 열림

외부 LTE/5G에서는 열리는데 내부 PC에서만 안 열리면 hairpin NAT 문제일 수 있다.

해결:

```text
내부 DNS 또는 hosts
fowersdev.pdfrend.com -> 192.168.219.112
```

## 보안 기준

- NPM 관리자 비밀번호는 기본값에서 즉시 변경한다.
- NPM 관리자 UI `8181`은 외부 공유기 포트포워딩에 열지 않는다.
- GitHub, 문서, 이슈, PR에 DB 비밀번호, OAuth secret, SMTP 비밀번호를 기록하지 않는다.
- `fowersdev.pdfrend.com`은 dev 검수용 도메인으로 사용하고 운영 도메인과 분리한다.
- HSTS는 dev 연결이 안정화된 뒤에만 켠다.

## 같이 진행할 때 체크리스트

아래 순서대로 하나씩 확인한다.

| 순서 | 작업 | 완료 기준 |
| :---: | :--- | :--- |
| 1 | PDFowers 앱 직접 접속 확인 | `http://192.168.219.112:4173` 열림 |
| 2 | QNAP 내장 80/443 프록시 비활성화 | NPM과 포트 충돌 없음 |
| 3 | NPM 컨테이너 생성 | `80`, `443`, `8181` 포트 매핑 완료 |
| 4 | NPM 관리자 계정 변경 | 기본 계정 미사용 |
| 5 | Proxy Host 생성 | `fowersdev.pdfrend.com -> 192.168.219.112:4173` |
| 6 | Let's Encrypt 인증서 발급 | NPM SSL 탭에서 인증서 활성 |
| 7 | 외부 HTTPS 접속 확인 | `https://fowersdev.pdfrend.com` 검수 화면 |
| 8 | Kakao callback 확인 | `/auth/kakao/config-status` 정상 |

## Codex가 도울 수 있는 범위

Codex는 저장소 문서와 compose 파일 작성, 설정값 점검표 작성, 화면별 입력값 안내, 오류 메시지 분석을 도울 수 있다.

NAS 관리자 화면 조작은 사용자가 화면을 공유하고 명시적으로 요청하면 단계별로 안내할 수 있다. 계정 비밀번호, DB 비밀번호, OAuth Client Secret, SMTP 비밀번호는 Codex 채팅이나 문서에 원문으로 남기지 않는다.

## 결론

Nginx Proxy Manager는 PDFowers dev 앱 자체를 실행하기 위한 필수 구성 요소는 아니다. 하지만 현재 QNAP 내장 인증서 관리와 리버스 프록시가 `fowersdev.pdfrend.com`의 80/443 처리에서 충돌하고 있으므로, 커스텀 도메인 HTTPS 연결을 안정적으로 마무리하기 위한 실용적인 앞단 프록시로 도입할 가치가 있다.

이번 개발 환경에서는 우선 QNAP DDNS 인증서를 사용해 검수를 진행하고, 운영 도메인 또는 커스텀 dev 도메인을 정식으로 연결해야 할 때 NPM 도입 여부를 다시 결정한다.

## 작업 이력

| 작업일시 | 작업 에이전트 | 작성자 | 내용 한 줄 요약 |
| :--- | :--- | :--- | :--- |
| 2026-06-14 KST | Codex | jkoogi | QNAP NAS 개발서비스 도메인 연결을 위한 Nginx Proxy Manager 학습 문서 작성 |
| 2026-06-14 KST | Codex | jkoogi | dev 임시 HTTPS는 QNAP DDNS 인증서를 사용하고 커스텀/운영 도메인 방식은 보류하는 결정 반영 |
