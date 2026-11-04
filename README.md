# At that place · backend

API 서버·미디어 작업자·운영 웹·DB 마이그레이션·API 계약을 관리하는 `backend` 브랜치입니다. 2026-11-03에 `docs` 브랜치의 `1차 개발 코드/`에서 분리했으며 이전 이력은 그대로 남아 있습니다.

| 브랜치 | 로컬 폴더 | 내용 |
| --- | --- | --- |
| `backend` | `samsun/backend` | 이 저장소. 서버·작업자·운영 웹·계약·배포 |
| `frontend` | `samsun/frontend` | Android 앱(Expo/React Native). `contracts/generated.ts` 사본을 사용 |
| `docs` | `samsun/docs` | 기능명세서·1차 개발 설계서·회의록 |
| `feature/ui-prototype` | `samsun/feature-ui-prototype` | 디자이너·PM의 UI 프로토타입(기능 기준) |

> 현재 구현 기준은 `docs@ded2a6c`의 기능명세 v3.2·설계 v0.5.0(2026-11-04)입니다. 변경·제거 범위, 검증 결과와 남은 결정은 [후보 수명·복구 안내 보완 및 최신 검증](docs/2026-11-04_후보수명_복구안내_보완.md)에 기록했습니다. F30 편집 UI는 연결했으며 실제 영상 합성·결과 저장은 Q20 결정 대기입니다.

> 테스트 서버: HTTPS 연결과 가입이 동작하며 `MODERATION_MODE=disabled`입니다. [현재 서버 설정](docs/2026-11-01_테스트_서버_운영.md), [HTTPS 연결](docs/HTTPS_연결.md), [확정 기능 구현현황](docs/2026-10-30_확정기능_구현현황.md).

## 구성

| 경로 | 내용 |
| --- | --- |
| `server/api/` | Fastify API, OpenAPI 요청 검증, 인증·멱등 처리 |
| `server/services/` | 계정·동의·모임·일정·방문·초대·미디어·신고·복구 업무 |
| `server/worker/` | 실제 미디어 처리·검사·완료 확정·만료·물리 정리 |
| `server/adapters/` | 공급자 인증·지도·콘텐츠 판정·비공개 로컬 저장소 |
| `server/db/migrations/` | 설계 원본 DDL + 구현용 추가 마이그레이션 |
| `ops-web/` | 신고·검사·이의·방장 부재 복구 운영 화면 |
| `contracts/` | 원본 OpenAPI, 구현 보완 OpenAPI, 생성 TypeScript 타입(앱은 `generated.ts` 사본 사용) |
| `tests/` | 정책·실제 PostgreSQL API·경쟁·실파일 통합 검증 |
| `deploy/`, `compose.yaml`, `Dockerfile` | Nginx 연결, Docker 실행 |
| `docs/` | 서버 결정 기록·기능별 구현 위치·검증·운영 기록 |

## 로컬 실행

Node.js 24, Docker Compose가 필요합니다. Docker Compose 프로젝트 이름은 기존 DB 볼륨(`1_atp-db`)을 유지하려고 `compose.yaml`에 `name: "1"`로 고정했습니다.

이 폴더에서 실행합니다.

```bash
npm ci
npm run setup
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

API는 `https://sphan0325.ddns.net` (서버 바인딩 `127.0.0.1:8081`), 상태 확인은 `/health`, 구현 계약은 `/openapi.json`입니다. `setup`은 기존 `.env`를 덮어쓰지 않고 개발 전용 비밀값을 생성합니다. 운영 DB나 기존 앱의 DB를 사용하지 않습니다.

미디어 처리는 별도 터미널에서 실행합니다.

```bash
npm run server:start -- --build-only
docker compose --profile worker run --rm -e NODE_ENV=development -e AUTH_MODE=development -e OPS_MODE=development -e MODERATION_MODE=development worker
```

실제 소셜 인증으로 API·DB·워커를 상시 실행하려면 `npm run server:start`를 사용합니다. 이 명령은 DB 백업·마이그레이션 후 production/provider 모드로 시작하며, 콘텐츠는 운영 검토를 기다립니다. 공개 Nginx 연결은 [HTTPS 연결 절차](docs/HTTPS_연결.md)의 `sudo python3 deploy/install-nginx.py`로 별도 적용합니다.

호스트에 FFmpeg·ffprobe·ImageMagick·ExifTool이 모두 설치되어 있으면 `npm run worker`로 실행할 수도 있습니다. 단순한 파일 업로드 성공만으로 완료 파일을 만들지 않습니다.

운영 화면은 별도 터미널에서 실행합니다.

```bash
npm run ops
```

`http://localhost:5173`을 엽니다. 로컬 운영 토큰은 생성한 `.env`의 `DEV_OPS_TOKEN`입니다. 운영 화면은 토큰을 디스크나 localStorage에 저장하지 않습니다. 실제 배포에서는 별도 OIDC 토큰의 issuer·audience·MFA·역할을 검사합니다.

## Android 앱

앱은 `frontend` 브랜치(`samsun/frontend`)에서 관리합니다. 앱의 기본 API 주소는 `https://sphan0325.ddns.net`이며 서버 `.env`는 `HOST=127.0.0.1`, `PORT=8081`, `PUBLIC_URL=https://sphan0325.ddns.net`을 사용합니다. 외부 HTTPS 443에서 Nginx가 로컬 API로 전달합니다. [HTTPS 연결 안내](docs/HTTPS_연결.md)를 확인하세요.

API 계약을 바꾸면 `npm run contracts`로 `contracts/generated.ts`를 다시 만들고, 같은 파일을 `frontend` 브랜치의 `contracts/generated.ts`로 복사해 커밋합니다.

개발 모드 로그인에서 테스트 사용자 식별자를 입력합니다. 같은 공급자·식별자로 로그인하면 같은 사용자로 연결되며 공급자가 다르면 별도 계정입니다. 실제 카카오·Google 인증, 지도, 콘텐츠 판정은 아래 설정을 사용합니다.

## 실제 외부 연동 설정

| 설정 | 설명 |
| --- | --- |
| `AUTH_MODE=provider` | 개발용 `dev:` 자격 증명 거부, 실제 공급자 검증 |
| `GOOGLE_CLIENT_ID` | 서버가 검증하는 Google ID 토큰 audience |
| `KAKAO_APP_ID` | 카카오 access token의 발급 앱 검증 |
| `KAKAO_REST_KEY` | 서버의 카카오 장소 검색과 로그인 코드 교환. REST 키는 서버에만 보관 |
| `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI` | 서버 로그인 비밀키와 등록한 콜백 주소 |
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
```

`test:integration`은 전용 로컬 개발 DB에 UUID별 테스트 데이터를 생성합니다. 실제 미디어 검증은 도구가 포함된 컨테이너에서 실행합니다.

```bash
docker compose run --rm -e MEDIA_TESTS=1 worker npm run test:integration
```

이 명령은 이미지 빌드 시점의 코드를 검사하므로 코드를 바꾼 뒤에는 `docker compose build worker`를 먼저 실행합니다. 실행 결과와 아직 실측하지 않은 항목은 `docs/검증결과.md`에 기록합니다.

## 계약과 변경

`contracts/design.openapi.json`은 현재 설계 v0.5.0의 API 사본입니다. `001_initial.sql`과 적용된 추가 마이그레이션은 보존하고, 변경은 `013_spec_v32.sql`에 분리했습니다. 기준 문서의 커밋·해시는 `기준/설계기준선.json`에서 확인합니다. 계약 타입 재생성은 `npm run contracts`입니다. 이미 적용한 마이그레이션의 SHA256이 바뀌면 실행을 중단합니다.

사진 5·영상 2, 방문 15, 초대 확인 50, 10명 정원, 고정 보관 기한, 참여 종료 후 본인 열람/삭제, 만료·차단 후 새 파일 GET 차단을 서버에서 판정합니다. 실패 작업은 자리를 반환하고 재시도 시 다시 확보합니다. 초대 50번째 확인 뒤 참여가 거부되는 현행 정책은 유지했습니다. 자세한 보완 내용은 `docs/구현결정.md`를 참고하세요.

앱 빌드·릴리즈 기록과 사용설명서는 `frontend` 브랜치의 `docs/`에 있습니다.
