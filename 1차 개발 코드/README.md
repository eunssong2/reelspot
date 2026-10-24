# At that place · 1차 개발 코드

`1차 개발 설계서` v0.3, 기능명세서 v2(2026-10-22)를 기준으로 작성한 Android 앱·업무 API·미디어 작업자·운영 웹입니다. 기존 DayLog 앱의 업무 DB나 편집 기능을 복사하지 않고 별도 앱으로 구현했습니다.

화면 확인용 [APK](artifacts/at-that-place-preview.apk), [검증 결과](docs/검증결과.md), [기능별 구현 위치](docs/기능별_구현위치.md)를 함께 제공합니다. 확인용 APK는 Metro 없이 실행하며, 현재 API 주소는 `http://sphan0325.ddns.net:8081`입니다. 별도의 개발 APK는 Metro를 실행한 환경에서 사용합니다.

인증 외 누락 점검과 이번 보완 내용은 [비인증 기능 검증 보고서](docs/비인증_누락점검_및_보완.md)에 정리했습니다. Google 키가 없는 현재 환경에서도 장소 직접 등록은 가능합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `mobile/` | Expo 57 / React Native 0.86 Android 앱, Expo Router 화면 |
| `mobile/modules/atp-transfer/` | WorkManager 전송·알림, Keystore 자격 증명, SHA256, 촬영 영상 AAC 호환 준비, MediaStore 앨범 저장 |
| `server/api/` | Fastify API, OpenAPI 요청 검증, 인증·멱등 처리 |
| `server/services/` | 계정·동의·모임·일정·방문·초대·미디어·신고·복구 업무 |
| `server/worker/` | 실제 미디어 처리·검사·완료 확정·만료·물리 정리 |
| `server/adapters/` | 공급자 인증·지도·콘텐츠 판정·비공개 로컬 저장소 |
| `server/db/migrations/` | 설계 원본 DDL + 구현용 추가 마이그레이션 |
| `ops-web/` | 신고·검사·이의·방장 부재 복구 운영 화면 |
| `contracts/` | 원본 OpenAPI, 구현 보완 OpenAPI, 생성 TypeScript 타입 |
| `tests/` | 정책·실제 PostgreSQL API·경쟁·실파일 통합 검증 |
| `docs/` | 결정 기록·기능별 구현 위치·검증 상태 |

## 로컬 실행

Node.js 24, Docker Compose가 필요합니다. Android 빌드에는 **전체 JDK 21**과 Android SDK 36/NDK 27.1이 필요합니다. JRE만으로는 Android의 `jlink` 단계가 실행되지 않습니다.

이 폴더에서 실행합니다.

```bash
npm ci
npm run setup
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

API는 `http://sphan0325.ddns.net:8081` (서버 바인딩 `0.0.0.0:8081`), 상태 확인은 `/health`, 구현 계약은 `/openapi.json`입니다. `setup`은 기존 `.env`를 덮어쓰지 않고 개발 전용 비밀값을 생성합니다. 운영 DB나 기존 앱의 DB를 사용하지 않습니다.

미디어 처리는 별도 터미널에서 실행합니다.

```bash
docker compose build worker
docker compose --profile worker up worker
```

호스트에 FFmpeg·ffprobe·ImageMagick·ExifTool이 모두 설치되어 있으면 `npm run worker`로 실행할 수도 있습니다. 단순한 파일 업로드 성공만으로 완료 파일을 만들지 않습니다.

운영 화면은 별도 터미널에서 실행합니다.

```bash
npm run ops
```

`http://localhost:5173`을 엽니다. 로컬 운영 토큰은 생성한 `.env`의 `DEV_OPS_TOKEN`입니다. 운영 화면은 토큰을 디스크나 localStorage에 저장하지 않습니다. 실제 배포에서는 별도 OIDC 토큰의 issuer·audience·MFA·역할을 검사합니다.

## Android 앱

```bash
cd mobile
npm ci
npx expo prebuild --platform android
npm run android
```

이미 설치한 개발 빌드에서는 `npm start`로 Metro를 실행합니다. 파일 전송과 앨범 저장에 로컬 네이티브 모듈을 사용하므로 Expo Go 대신 개발 빌드가 필요합니다.

화면 확인에는 [로컬 확인용 APK](artifacts/at-that-place-preview.apk)를 사용할 수 있습니다. 이 APK는 Android x86_64 에뮬레이터와 ARM64 기기용이며 JavaScript가 포함되어 **Metro 없이 API와 워커만 실행**하면 됩니다. 개발 서명으로 빌드하며 `http://sphan0325.ddns.net:8081` API를 사용합니다. 재생성은 `mobile/`에서 `npm run preview:android -- --abi=x86_64,arm64-v8a`이며, 첫 네이티브 최적화 빌드는 시간이 걸릴 수 있습니다. ARM64 확인용은 `npm run preview:android -- --abi=arm64-v8a`로 생성합니다.

현재 PC의 원격 데스크톱에서 에뮬레이터를 다시 열려면 코드 폴더에서 `npm run emulator:fast`를 실행합니다. NVIDIA/Mesa Zink 경로와 호환성 설정을 해당 프로세스에만 적용합니다. 현재 AVD는 720×1560으로 조정했으며, 같은 에뮬레이터가 이미 실행 중이면 중복 실행하지 않습니다. 성능 측정과 남은 표시 지연은 [성능 조정 기록](docs/에뮬레이터_성능조정.md)에 기록했습니다.

앱의 기본 API 주소와 `mobile/.env`의 `EXPO_PUBLIC_API_URL`은 `http://sphan0325.ddns.net:8081`입니다. 서버 `.env`는 `HOST=0.0.0.0`, `PORT=8081`, `PUBLIC_URL=http://sphan0325.ddns.net:8081`을 사용합니다. 주소 변경 후에는 서버를 재시작하고 APK를 다시 빌드합니다. 공유기를 사용하는 환경에서는 외부 TCP 8081을 서버 PC의 TCP 8081로 전달해야 합니다. 확인용 APK는 HTTP 접속을 허용하며, 운영 배포에서는 HTTPS를 사용합니다.

개발 모드 로그인에서 테스트 사용자 식별자를 입력합니다. 같은 공급자·식별자로 로그인하면 같은 사용자로 연결되며 공급자가 다르면 별도 계정입니다. 실제 카카오·Google 인증, 지도, 콘텐츠 판정은 아래 설정을 사용합니다.

## 실제 외부 연동 설정

| 설정 | 설명 |
| --- | --- |
| `AUTH_MODE=provider` | 개발용 `dev:` 자격 증명 거부, 실제 공급자 검증 |
| `GOOGLE_CLIENT_ID` | 서버가 검증하는 Google ID 토큰 audience |
| `KAKAO_APP_ID` | 카카오 access token의 발급 앱 검증 |
| `PLACES_PROVIDER=google`, `GOOGLE_PLACES_API_KEY` | 서버의 Google Places API(New) 장소 검색. 키는 서버에만 보관 |
| `KAKAO_REST_KEY` | 선택적 기존 카카오 검색 어댑터용 |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_KAKAO_CLIENT_ID` | 앱 OAuth 등록 정보 |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Android Maps SDK 지도 키. 패키지·서명 및 API 제한 설정 후 APK 재빌드 |
| `MODERATION_MODE=review` | 엔진이 없거나 실패하면 비공개 운영 검토 |
| `MODERATION_URL`, `MODERATION_TOKEN` | 판정 어댑터. 텍스트는 JSON, 미디어는 multipart로 전달, `{verdict: passed\|review\|rejected}` 반환 |
| `OPS_MODE=oidc`, `OPS_ISSUER`, `OPS_AUDIENCE` | 일반 앱 토큰과 분리한 운영 인증 |
| `SUPPORT_EMAIL` | 실제 문의 채널 |
| `OPS_HOLIDAYS` | 이의 3영업일 계산에서 제외할 한국 휴일(YYYY-MM-DD 쉼표 구분). 주말은 자동 제외 |

`NODE_ENV=production`에서는 개발 인증·개발 운영 토큰·개발 판정 대역으로 시작할 수 없습니다. `db:seed`의 약관은 개발용 예시입니다. 실제 문서·동의 버전·문의 연락처·공급자 등록 정보와 실연동 검수가 필요합니다.

## 검증

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
cd mobile
npm run typecheck
npm run lint
npm run export
```

`test:integration`은 전용 로컬 개발 DB에 UUID별 테스트 데이터를 생성합니다. 실제 미디어 검증은 도구가 포함된 컨테이너에서 실행합니다.

```bash
docker compose run --rm -e MEDIA_TESTS=1 worker npm run test:integration
```

이 명령은 이미지 빌드 시점의 코드를 검사하므로 코드를 바꾼 뒤에는 `docker compose build worker`를 먼저 실행합니다. 실행 결과와 아직 실측하지 않은 항목은 `docs/검증결과.md`에 기록합니다.

## 계약과 변경

`contracts/design.openapi.json`과 `001_initial.sql`은 설계 원본입니다. 원본을 덮어쓰지 않고 구현용 계약·추가 마이그레이션을 분리했습니다. 계약 타입 재생성은 `npm run contracts`입니다. 이미 적용한 마이그레이션의 SHA256이 바뀌면 실행을 중단합니다.

사진 5·영상 2, 방문 15, 초대 확인 50, 10명 정원, 고정 보관 기한, 참여 종료 후 본인 열람/삭제, 만료·차단 후 새 파일 GET 차단을 서버에서 판정합니다. 실패 작업은 자리를 반환하고 재시도 시 다시 확보합니다. 초대 50번째 확인 뒤 참여가 거부되는 현행 정책은 유지했습니다. 자세한 보완 내용은 `docs/구현결정.md`를 참고하세요.
