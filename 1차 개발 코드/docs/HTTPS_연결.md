# HTTPS 연결 설정 — 2026-10-30

앱에서 사용하는 API, 로그인 콜백, 게시 문서, 지도 웹 출처는 모두 HTTPS다.

| 용도 | 값 |
| --- | --- |
| 앱 API / `PUBLIC_URL` / `EXPO_PUBLIC_API_URL` | `https://sphan0325.ddns.net` |
| 카카오 콘솔 Redirect URI / `KAKAO_REDIRECT_URI` | `https://sphan0325.ddns.net/v1/auth/kakao/callback` |
| 카카오 지도 웹 도메인 / `EXPO_PUBLIC_KAKAO_WEB_ORIGIN` | `https://sphan0325.ddns.net` |
| API 상태 확인 | `https://sphan0325.ddns.net/health` |

카카오의 **로그인 Redirect URI**와 **지도 웹 도메인** 등록은 별도다. 위 값을 각각 등록한다. 카카오 앱 ID·REST API 키·Client Secret은 `1차 개발 코드/.env`에서 관리한다. 앱에는 서버 비밀키를 넣지 않는다.

## 현재 확인 상태

- 실행 복구: API·DB·워커를 실제로 실행했고, 내부 `/health`·앱 설정·카카오 로그인 시작과 임시 Nginx 프록시를 검증했다. 시스템 Nginx는 sudo 적용 전까지 준비 응답을 유지한다. 상세 원인·결과는 [공개 서버 실행 복구](2026-10-30_공개서버_실행복구.md)를 참조한다.
- 2026-10-30 재확인: 카카오 지도 SDK 200, REST 장소 검색 200, 인가 요청은 카카오 계정 화면으로 302. 앱 ID·REST 키·Client Secret 입력을 확인했다. 실제 사용자 인증 완료·콜백은 HTTPS API 연결 후 검수해야 한다. 키 값은 로그/문서에 기록하지 않았다.
- 도메인 HTTPS 인증서는 유효하다. 외부 443 연결을 확인했다.
- 사용자가 준비 스크립트를 실행한 뒤 2026-10-30 재확인: `/guacamole/`는 200, `/health`와 `/v1/app-config`는 503 준비 중이다. 실제 API 연결은 아직 활성화하지 않았다.
- [Nginx location 설정](../deploy/nginx-app-locations.conf)을 바탕으로 `install-nginx.py --prepare`가 준비 응답을 설치했다. 에뮬레이터 검증에서는 시스템 Nginx 설정을 변경하지 않았다.
- APK와 `.env`의 외부 주소는 HTTPS로 변경했다. API가 HTTPS 경로에 연결되기 전에는 해당 APK에서 서버 기능을 이용할 수 없다.
- 구 HTTP 주소 `http://sphan0325.ddns.net:8081`은 최신 앱에서 사용하지 않으며 카카오에 등록하지 않는다.

## 서버 연결 절차

1. 기존 Nginx의 `sphan0325.ddns.net` **443 TLS server 블록 안**에 준비본의 `/v1/`, `/documents/`, `/health`, `/invite`, `/.well-known/assetlinks.json` location을 추가한다. `/guacamole/`와 기존 인증서 설정은 유지한다. 파일은 검토용이며 자동으로 설치되지 않는다.
2. API를 PC의 `127.0.0.1:8081`에 실행한다. 앱 및 카카오는 이 내부 주소에 접속하지 않고 외부 HTTPS 주소를 사용한다. 외부 8081 포트 개방은 필요 없다.
3. `nginx -t` 성공을 확인한 후 Nginx를 reload한다.
4. HTTPS `/health`의 JSON 응답, `/v1/app-config`, 게시 문서, 카카오 콜백 경로를 확인한다. 콜백에 정상 state 없이 직접 접근하면 인증 오류가 나야 하며 404면 연결 설정이 잘못된 것이다.
5. 실제 카카오 콘솔 설정 후 브라우저 로그인 → 서버 콜백 → 앱 복귀를 기기에서 확인한다.

TLS는 Nginx에서 종료하며 Nginx→API의 같은 PC 내부 loopback만 HTTP다. 휴대폰, 브라우저, 카카오를 오가는 트래픽은 HTTPS다. 내부 hop까지 TLS가 필요한 별도 요구가 있으면 API 서버 인증서 구성을 추가해야 한다.

공개 서비스 실행 전에는 기존 개발용 인증/운영 모드를 그대로 노출하지 않는다. 이 파일은 공개 배포 완료나 일반 사용자 출시를 의미하지 않는다.

## 코드에서 강제하는 항목

- `mobile/src/lib/https.ts`: 앱 API와 문서 URL은 HTTPS만 허용. URL 안의 사용자명/비밀번호 거부.
- `mobile/app.config.ts`: Android 배포 APK의 `usesCleartextTraffic=false`.
- 네이티브 업로드 워커: HTTPS가 아닌 API base URL 거부.
- `server/core/config.ts`: `PUBLIC_URL`의 HTTPS 강제.
- 카카오 콜백: HTTPS Redirect URI만 허용. 앱 복귀 스킴 `atthatplace://oauth/kakao`는 웹 네트워크 URL이 아닌 OS 앱 진입 주소다.

## 준비한 실행 명령

root 소유 Nginx 설정은 사용자가 sudo로 준비 스크립트를 실행해 적용했다. 현재는 준비 응답만 활성화된 상태이며, 실제 서버 연결 활성화는 아래 절차로 별도 진행한다.

### Nginx 먼저 준비하기

서버 준비 전에는 아래 한 줄을 실행한다. 기존 설정을 백업하고 앱 경로를 추가한 뒤 문법 검사에 성공하면 reload한다. Guacamole과 TLS 설정은 유지하며, 실패하면 설정 파일을 백업으로 복원한다.

```bash
sudo python3 "/home/sphan/Documents/samsun/1차 개발 코드/deploy/install-nginx.py" --prepare
```

`Nginx 준비 완료`가 나오면 준비가 끝난다. 이 모드는 앱 경로에 `503 SERVICE_NOT_READY`를 반환하며 API 서버를 외부에 연결하지 않는다. 실제 로그인은 아래 서버 준비와 연결 활성화 후 가능하다. 이미 활성화한 서버에 `--prepare`를 다시 실행하면 앱 경로가 준비 중 상태로 돌아간다.

### 서버 준비 후 연결 활성화

```bash
cd '/home/sphan/Documents/samsun/1차 개발 코드'
# 한글 경로 BuildKit 오류 회피 → DB 백업·마이그레이션 → API·워커 실행
npm run server:start
python3 deploy/install-nginx.py --dry-run
# 준비 응답을 실제 API 프록시로 교체. --prepare를 붙이지 않는다.
sudo python3 deploy/install-nginx.py
# 게시 문서를 완성한 뒤 별도 실행
# npm run documents:publish -- /실제/검토완료/manifest.json
```

Compose의 API·워커는 `.env`의 개발 모드를 덮어써 `production/provider/oidc/review`로 실행한다. 실제 Google 키가 없으면 Google 로그인은 비활성화된다. 약관이 없으면 신규 가입 완료가 차단되지만, `/health`·앱 설정·카카오 로그인 경로의 연결 자체는 가능하다. 운영자 OIDC가 미설정이면 검토 승인이 불가능하며, 콘텐츠는 자동 통과하지 않는다. API 연결 완료와 일반 사용자 출시 준비 완료를 구분한다.

`server:start`는 `samsun-server:local` 이미지를 빌드한다. 한글 경로에서 Compose/BuildKit의 `x-docker-expose-session-sharedkey` 오류가 발생하므로, 소스의 허용 목록을 tar 스트림으로 보내 ASCII 임시 경로에서 빌드한다. `.env`·로컬 파일 저장소·APK는 이미지에 포함하지 않는다. 기존 DB와 볼륨을 초기화하지 않는다.

Google 로그인은 사용자 결정에 따라 보류한다. 추후 활성화할 때 Google 콘솔에는 웹 애플리케이션 클라이언트의 Redirect URI로 `https://sphan0325.ddns.net/v1/auth/google/callback`을 등록하고, 서버 `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 입력한다. 앱에 비밀키를 입력하지 않는다.

Android App Links의 `ANDROID_APP_SHA256`은 설치할 APK의 **서명 인증서** SHA-256 지문이다. APK 파일 자체의 SHA-256과 다르다. 개발 서명 APK의 지문은 Play Store 앱 서명 지문으로 대신 사용할 수 없다.
