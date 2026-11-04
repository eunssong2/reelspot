# At that place · frontend

Android 앱(Expo 57 / React Native 0.86, Expo Router)을 관리하는 `frontend` 브랜치입니다. 2026-11-03에 `docs` 브랜치의 `1차 개발 코드/mobile`에서 분리했으며 이전 이력은 그대로 남아 있습니다.

| 브랜치 | 로컬 폴더 | 내용 |
| --- | --- | --- |
| `frontend` | `samsun/frontend` | 이 저장소. Android 앱 |
| `backend` | `samsun/backend` | API 서버·미디어 작업자·운영 웹·API 계약·배포 |
| `docs` | `samsun/docs` | 기능명세서·1차 개발 설계서·회의록 |
| `feature/ui-prototype` | `samsun/feature-ui-prototype` | 디자이너·PM의 UI 프로토타입(기능 기준) |

> 현재 구현 기준은 `docs@ded2a6c`의 기능명세 v3.2·설계 v0.5.0(2026-11-04)입니다. 변경·제거 범위, 검증 결과와 남은 결정은 [후보 수명·복구 안내 보완 및 최신 검증](docs/2026-11-04_후보수명_복구안내_보완.md)에 기록했습니다. F30 편집 UI는 연결했으며 실제 영상 합성·결과 저장은 Q20 결정 대기입니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/app/` | Expo Router 화면 |
| `src/components/`, `src/lib/` | 공통 화면 요소, API·상태·검증·업로드 처리 |
| `modules/atp-transfer/` | WorkManager 전송·알림, Keystore 자격 증명, SHA256, 촬영 영상 AAC 호환 준비, MediaStore 앨범 저장 |
| `contracts/` | `backend`의 `contracts/generated.ts`·`openapi.json` 사본(API 타입) |
| `tests/` | 앱 로직 테스트, 앱·서버 공통 입력 규칙 대조 |
| `scripts/` | 확인용·릴리즈 APK 빌드, 에뮬레이터 실행 |
| `docs/` | 앱 사용설명서, 릴리즈·빌드 기록, 에뮬레이터 기록 |

## 실행

Node.js 24가 필요합니다. Android 빌드에는 **전체 JDK 21**과 Android SDK 36/NDK 27.1이 필요합니다(JRE만으로는 `jlink` 단계가 실행되지 않습니다). JDK가 없으면 `.data/tools/jdk21`을 씁니다.

```bash
npm ci
npx expo prebuild --platform android
npm run android
```

이미 설치한 개발 빌드에서는 `npm start`로 Metro를 실행합니다. 파일 전송과 앨범 저장에 로컬 네이티브 모듈을 쓰므로 Expo Go 대신 개발 빌드가 필요합니다.

앱의 기본 API 주소와 `.env`의 `EXPO_PUBLIC_API_URL`은 `https://sphan0325.ddns.net`입니다. 앱은 HTTPS만 허용합니다. 지도·로그인 공개 키는 `.env`의 `EXPO_PUBLIC_KAKAO_JS_KEY`, `EXPO_PUBLIC_KAKAO_WEB_ORIGIN`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`를 씁니다(`.env.example` 참고).

현재 PC의 원격 데스크톱에서 에뮬레이터를 다시 열려면 `npm run emulator:fast`를 실행합니다. 성능 기록은 [에뮬레이터 성능 조정](docs/에뮬레이터_성능조정.md)에 있습니다.

## APK

- 확인용: `npm run preview:android -- --abi=x86_64,arm64-v8a` → `artifacts/at-that-place-preview.apk`와 루트 `at-that-place-preview.apk`
- 릴리즈: `npm run release:android` → 전용 키(`.data/release-signing`)로 서명한 ARM64/x86_64 APK를 `artifacts/at-that-place-release.apk`와 루트 `at-that-place-release.apk`로 복사. **`.data/release-signing`은 이후 업데이트에도 같은 키가 필요하므로 따로 백업합니다.**

빌드 기록: [0.2.7](docs/2026-11-01_릴리즈_0.2.7.md) · [0.2.1](docs/2026-11-01_릴리즈_0.2.1.md) · [0.2.0](docs/2026-10-30_릴리즈_빌드_검증.md). 화면 사용법: [앱 사용설명서](docs/앱_사용설명서/README.md).

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run test:flows
npm run export
```

`npm test`의 앱·서버 공통 입력 대조(`tests/policy.test.mts`)는 옆 폴더 `../backend`의 `server/core/policy.ts`를 읽습니다. 다른 위치면 `ATP_BACKEND_DIR`로 지정하고, 없으면 그 테스트만 건너뜁니다.

## API 계약 동기화

`contracts/`는 `backend` 브랜치가 원본입니다. 서버 계약이 바뀌면 `backend`에서 `npm run contracts`를 실행한 뒤 `contracts/generated.ts`와 `contracts/openapi.json`을 이 저장소로 복사해 함께 커밋합니다. 이 폴더의 파일을 직접 고치지 않습니다.
