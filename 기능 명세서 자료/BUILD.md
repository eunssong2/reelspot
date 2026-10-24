# 빌드 가이드 (Android 로컬 / iOS Mac 없이)

## 1. Android — 이 Linux 머신에서 로컬 빌드

sudo 없이 홈 디렉터리에 설치한 구성입니다.

| 구성 요소 | 위치 |
|---|---|
| JDK 17 (Temurin) | `~/.jdks/jdk-17.0.20.1+1` |
| Android SDK (cmdline-tools, platform-tools, platforms;android-36, build-tools;36.0.0, ndk;27.1.12297006, cmake;3.22.1) | `~/Android/Sdk` |
| 네이티브 프로젝트 | `mobile/android` (`npx expo prebuild`로 생성, git 무시 대상) |

셸에 환경변수를 넣어 두면 이후 `npm run android`가 바로 동작합니다.

```bash
cat >> ~/.bashrc <<'EOS'
export JAVA_HOME=$HOME/.jdks/jdk-17.0.20.1+1
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
EOS
source ~/.bashrc
```

빌드와 설치:

```bash
cd mobile
npx expo prebuild --platform android            # android/ 재생성 (설정 변경 시)
cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
# 결과: android/app/build/outputs/apk/debug/app-debug.apk

adb install -r app/build/outputs/apk/debug/app-debug.apk   # USB 디버깅 켠 폰 연결 후
cd .. && npx expo start --dev-client                         # 개발 서버 연결
```

첫 빌드 실측(2026-10-12, 16코어): **8분 18초**, 결과 `app-debug.apk` 343MB(디버그 심볼 + 4개 ABI 포함. 릴리스 AAB는 기기별로 수십 MB 수준). 시간의 대부분은 Skia와 New Architecture의 C++ 컴파일이며 Android API 레벨과는 무관합니다.

빌드 시간을 줄이려면 명령줄 `-P` 옵션이 아니라 `android/gradle.properties`의 `reactNativeArchitectures=arm64-v8a`로 고정하세요(일부 라이브러리는 명령줄 옵션을 읽지 않습니다). 두 번째 빌드부터는 Gradle 캐시로 수 분 내에 끝납니다. 스토어 배포(AAB, 전 ABI)는 `./gradlew :app:bundleRelease`를 쓰고, 릴리스 서명은 `android/app/build.gradle`의 `signingConfigs`에 keystore를 넣거나 EAS에 맡깁니다.

폰에 설치하려면 설정 → 개발자 옵션 → USB 디버깅을 켜고 연결한 뒤 `adb install -r daylog-debug.apk`를 실행합니다(이 자료 폴더에 복사본 `daylog-debug.apk`).

### 빌드 이력

| 날짜 | 내용 | 결과 |
|---|---|---|
| 2026-10-12 | MVP + video-composer | 8분 18초, 343MB |
| 2026-10-14 | Android 네이티브 모듈 5개(camerax, mlkit, home-widget, android-utils, video-composer 확장) 포함 | 8분 23초, 368MB. APK 안에 CameraX Extensions, ML Kit Subject Segmentation, 위젯 리소스 포함 확인 |

ML Kit 메타데이터(`com.google.mlkit.vision.DEPENDENCIES`)는 expo-dev-launcher와 충돌하므로 `mobile/plugins/withMlKitDependencies.js`가 앱 매니페스트에서 합쳐 덮어씁니다. 모듈 매니페스트에 같은 키를 다시 넣지 마세요.

## 1.1 개발 서버 주소 고정 (sphan0325.ddns.net:8081)

- `mobile/app.json`의 `expo-dev-client` 플러그인에 `defaultLaunchURL: "http://sphan0325.ddns.net:8081"`을 넣었습니다. 개발 빌드가 실행될 때 이 주소를 기본 서버로 사용하고, `launchMode: "most-recent"`로 마지막에 성공한 서버에 자동 재접속합니다. 네이티브 설정이므로 APK를 다시 빌드해야 반영됩니다.
- `npm start`는 `REACT_NATIVE_PACKAGER_HOSTNAME=sphan0325.ddns.net`을 포함하도록 바꿨습니다. 같은 Wi-Fi에서만 쓸 때는 `npm run start:lan`, 포트포워딩 없이 외부에서 쓸 때는 `npm run start:tunnel`.
- 2026-10-12 확인: DNS가 공인 IP 211.202.56.90을 가리키고, 외부 5개 지점(ES·IN·NL·RU·SG)에서 8081 TCP 연결 성공, 내부에서 도메인으로 HTTP 200 응답. 공유기 8081 → 192.168.45.97 포워딩이 동작 중.

**보안 주의**: Metro 개발 서버는 인증이 없습니다. 포트가 열려 있는 동안 인터넷의 누구나 JS 소스 번들을 내려받을 수 있고, Metro의 개발용 엔드포인트에 접근할 수 있습니다. 개발할 때만 서버를 띄우고, 끝나면 종료하거나 공유기 포워딩을 끄는 것을 권합니다. 장기적으로는 `npm run start:tunnel`(Expo 터널, 임의 URL)이나 Tailscale 같은 사설망이 더 안전합니다.

접속 장애를 추적하는 파일 로그·사용자 서비스·진단 명령을 추가했습니다.
`cd mobile`에서 `npm run server:logs`로 출력을 보고, 장애가 나면 재시작 전에
`npm run server:diagnose`로 보고서를 저장하세요. 사용법과 결과 해석은
[mobile/README.md의 서버 로그와 접속 장애 진단](mobile/README.md#서버-로그와-접속-장애-진단)을 참고하세요.

## 1.2 Android 15 에뮬레이터 테스트 (이 PC)

| 항목 | 설정 |
|---|---|
| AVD | `daylog35` (Pixel 7, `system-images;android-35;google_apis;x86_64`, Play Store 없음) |
| 가속 | KVM. `sudo usermod -aG kvm $USER` 후 **재로그인**해야 적용. 재로그인 전에는 `sg kvm -c "emulator ..."`로 실행 가능 |
| GPU | `-gpu host`는 xrdp용 Xorg에 NVIDIA GLX가 없어 실패. `-gpu auto`(ANGLE/lavapipe 소프트웨어)로 동작하며, `-gpu swiftshader_indirect -no-window`는 화면 캡처가 검게 나오고 시스템 UI ANR이 발생해 사용하지 않음 |
| 실행 예 | `sg kvm -c "DISPLAY=:10 emulator -avd daylog35 -gpu auto -memory 4096 -cores 4 -camera-back virtualscene -no-audio -no-boot-anim"` |
| 개발 서버 | 에뮬레이터에서는 DDNS 주소 대신 호스트 루프백 `http://10.0.2.2:8081` 사용. `adb shell am start -a android.intent.action.VIEW -d "daylog://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"` |
| 개발자 메뉴 | 첫 실행 안내가 입력을 가로막으면 `adb root` 후 `shared_prefs/expo.modules.devmenu.sharedpreferences.xml`에 `isOnboardingFinished=true`를 써서 건너뜀. 우상단 플로팅 버튼이 저장/내보내기 버튼과 겹치므로 버튼 왼쪽 부분을 탭 |
| 한계 | ML Kit Subject Segmentation(배경 제거)·문서 스캐너는 Play 서비스 모듈 다운로드가 필요해 이 이미지에서는 동작하지 않음. CameraX Extensions(야간/HDR/보케), RAW, HDR 영상도 에뮬레이터 카메라에는 없음 |

2026-10-14 에뮬레이터 검증 결과: 순간기록 녹화·저장, 사진 촬영·검토·저장, 사진 편집(자동 보정 → Skia 렌더 → 내보내기 → 갤러리 저장), 하루 브이로그 Media3 내보내기, 2배속 내보내기, 타임랩스(6프레임 → 영상) 모두 성공. 발견·수정한 버그: CameraX 뷰의 PreviewView 미측정으로 프리뷰 검정/녹화 불가(onMeasure 추가), 설정 화면 행 레이아웃 깨짐(Row/Segmented 스타일 수정).

## 2. iOS — Mac 없이 가능한 세 가지 길

| 방법 | 비용 | 실기기 설치 | 비고 |
|---|---|---|---|
| **EAS Build** (권장) | 무료 플랜은 월 빌드 한도 있음(2025년 기준 월 30회, 그중 iOS 15회), 큐 대기 발생 | 가능 | Expo 클라우드 Mac에서 빌드. `eas build -p ios --profile development`. 서명·프로비저닝을 EAS가 대행 |
| **GitHub Actions macOS 러너** | 공개 저장소 무료, 비공개는 분당 Linux의 10배 과금 | 가능(서명 필요) | `.github/workflows/mobile-build.yml`의 `ios-simulator`(서명 없음)와 `ios-device`(EAS 호출) 잡 참고 |
| 시뮬레이터 빌드만 | 위와 동일 | 불가 | 서명 없이 `.app` 생성. 실행하려면 어차피 Mac이 필요하므로 CI 컴파일 검증 용도 |

**어떤 방법이든 iPhone 실기기에 올리려면 Apple Developer Program(연 $99)이 필요합니다.** 무료 Apple ID로는 Xcode에서 직접 7일짜리 서명만 가능하고, 이는 Mac이 있어야 합니다.

### 2.1 EAS Build 절차

```bash
npx eas-cli@latest login
cd mobile
npx eas-cli@latest build --platform ios --profile development
# 처음 한 번 Apple 계정 로그인 → 인증서·프로비저닝 프로파일 자동 생성 (기기 UDID 등록)
# 완료되면 QR/링크로 폰에 설치, 이후 npx expo start --dev-client
```

TestFlight 배포는 `--profile production` 후 `eas submit -p ios`.

### 2.2 GitHub Actions 사용 시 준비

1. 저장소를 GitHub에 올리고 `Settings → Secrets`에 `EXPO_TOKEN` 추가(https://expo.dev/settings/access-tokens).
2. `Actions` 탭에서 `mobile-build` 워크플로를 `Run workflow`로 실행하면 `ios-device` 잡이 EAS 빌드를 트리거합니다.
3. `ios-simulator` 잡은 push마다 macOS 러너에서 Xcode 컴파일만 수행합니다. Swift 네이티브 모듈(`modules/video-composer`)이 컴파일되는지 확인하는 용도입니다.

Fastlane + match로 GitHub Actions에서 직접 서명 빌드도 가능하지만, 인증서 관리를 직접 해야 하므로 1인 개발에서는 EAS가 가장 단순합니다.
