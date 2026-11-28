# 2026-11-27 Android 15 대조 검수

검수 기기는 `Android15` AVD의 `emulator-5554`입니다. Android 15/API 35, 720×1560px, 소프트웨어 동영상 디코더를 사용했습니다. 제품과 프로토타입은 같은 기기에서 별도로 실행했습니다.

| 대상 | 버전과 환경 |
| --- | --- |
| 제품 앱 | `frontend@2b3aac2`에서 새로 빌드한 x86_64 release APK. 검수 패키지는 `kr.atthatplace.app.docsqa`입니다. APK SHA-256 `ec8b89767bbc56c2de76cb35b5860184955aa743e015cfa07a800fb527aa6470`. 별도 패키지 ID와 디버그 서명, 루프백 HTTPS와 해당 테스트 인증서, 개발용 로그인 분기의 release 허용만 검수 사본에 적용했습니다. |
| 제품 서버 | `backend@622ee17`의 서버 소스와 OpenAPI를 읽기 전용으로 사용했습니다. 격리 PostgreSQL 16(001~018), 별도 객체 디렉터리, 앱과 연결된 HTTPS 프록시, 개발 인증·`disabled` 판정, 워커 CPU 2·메모리 2GB·PID 256을 사용했습니다. |
| 프로토타입 | `feature/ui-prototype@702ba0c`를 별도 디렉터리에서 의존성 잠금 파일대로 설치했습니다. 로컬 Metro와 Expo Go 54.0.8에서 최신 소스를 실행했습니다. 예시 데이터를 사용했습니다. Expo Go APK SHA-256은 실행결과.json에 기록했습니다. |

## 검수 빌드 재현

[제품 Android 15 QA 패치](제품-Android15-QA.patch)는 실제 검수 사본과의 차이입니다. 추적 소스는 `frontend@2b3aac2410775f6b3310058c70516563360ac8b2`를 사용합니다. 네이티브 `android/`는 당시 생성된 로컬 프로젝트가 입력입니다. 원본 `build.gradle`과 manifest의 SHA-256은 아래와 같습니다. 같은 버전의 네이티브 입력이 없으면 재생성 후 차이를 확인하고, 다른 입력으로 재현한 결과는 새 검수 빌드로 기록합니다.

| 네이티브 입력 | SHA-256 |
| --- | --- |
| `android/app/build.gradle` | `3e417ab50499773996aa0d6290ead295c7bb99a640316a7c673d6687b2b577b4` |
| `android/app/src/main/AndroidManifest.xml` | `debb6db55c07b55d012abacae03ef10b50778e77f1f9c565348a5eea333724fb` |

추적 소스를 `git archive`로 빈 QA 디렉터리에 풀고 그곳에 당시 `android/` 입력을 복사합니다. `.env`, 운영 서명 자료, 네이티브 빌드 출력은 복사 대상에서 제외합니다. Node 24.18.0, JDK 21, SDK와 잠금 파일의 의존성을 사용합니다. 아래 변수에서 `ATP_QA_PATCH`는 이 문서와 함께 제공된 패치의 절대 경로입니다. 명령은 QA 사본 루트에서 실행합니다. `adb devices -l`로 검수 AVD의 시리얼을 확인하고, `emulator-5554`와 다르면 포트 연결과 설치 명령에 같은 시리얼을 지정합니다.

```bash
git apply --check "$ATP_QA_PATCH"
git apply "$ATP_QA_PATCH"
mkdir -p android/app/src/main/res/raw
openssl req -x509 -newkey rsa:2048 -nodes -days 5 \
  -keyout qa-tls.key -out qa-tls.crt -subj '/CN=127.0.0.1' \
  -addext 'subjectAltName=IP:127.0.0.1'
chmod 600 qa-tls.key
cp qa-tls.crt android/app/src/main/res/raw/qa_ca.crt
npm ci
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://127.0.0.1:19443 CI=1 \
  bash -c 'cd android && ./gradlew --offline -PreactNativeArchitectures=x86_64 :app:assembleRelease'
adb -s emulator-5554 reverse tcp:19443 tcp:19443
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
```

호스트 루프백의 HTTPS 19443에서 위 인증서를 사용해 격리 API의 HTTP 포트로 요청과 응답을 전달합니다. 검수 당시 API 호스트 포트는 19481, 작업자와 API의 DB·저장소는 별도였습니다. `AUTH_MODE=development`, `MODERATION_MODE=disabled`를 격리 서버에만 지정합니다. 새 인증서 및 빌드 서명으로 같은 검수 구성을 재현할 수 있으며 새 APK의 해시는 달라질 수 있습니다. 원래의 해시는 위에 기록했습니다.

## 제품 앱과 격리 백엔드

| 시나리오 | 관찰 결과 | 근거 |
| --- | --- | --- |
| 내 모임·통합 달력·모임 목록(C01~C03/C05) | 1인 모임에 혼자 기록할 수 있다는 문구가 표시됐습니다. 11월 27일에 서로 다른 모임의 일정 2개가 잡혔고, 모임을 선택하면 필터링됐습니다. 개별 모임에서 월별 목록과 브이로그 진입을 확인했습니다. | [내 모임](app-groups.png) · [통합 달력](app-calendar.png) · [필터](app-calendar-filter.png) · [모임 안 목록](app-group-list.png) |
| 초대(C04/C12) | 현재 코드와 접힌 관리 영역을 확인했습니다. 격리 DB에서 기존 코드의 확인 횟수를 50으로 설정하자 워커가 같은 모임에 새 코드 1개를 발급했습니다. 화면에 다시 들어갔을 때 새 코드가 표시됐습니다. 열린 화면에서 60초 자동 갱신은 별도로 확인하지 않았습니다. | [교체 전](app-invite.png) · [재진입 후](app-invite-rotated.png) |
| 장소 한 글자 검색(C08) | 입력창에 한 글자 `a`를 입력하자 검색 버튼을 누르기 전에 `GET /v1/places`가 호출됐습니다. 시험 서버는 공급자 키가 없는 상태를 HTTP 200의 준비 중 응답으로 반환했고 앱은 연결 준비 안내를 표시했습니다. 실제 카카오 검색 결과는 미확인입니다. | [한 글자 검색](app-one-letter-search.png) |
| 장소 수정(Q23·QA-01) | 기록이 있는 장소를 방문 시간 창에서 열어 이름을 수정했습니다. 목록에 새 이름이 표시됐고, DB에서 방문 ID·순서 0·연결 기록 4개가 유지됐습니다. | [장소 수정](app-place-edit.png) · [저장 후 목록](app-place-saved.png) |
| 브이로그(QA-06·C13) | 원음이 있는 4초 영상을 선택하고 자막을 입력했습니다. 서버가 1080×1920 H.264/AAC MP4를 생성했습니다. 기기에서 끝까지 재생하고 갤러리에 저장했습니다. MediaStore의 재생 길이는 4,021ms입니다. 출력 오디오 1초에 양의 영점 교차 439회를 확인해 원본의 440Hz 시험음이 유지됐음을 확인했습니다. 작업 생성 시각과 만료 시각 차이는 24시간이었습니다. 같은 결과 파일은 소유자에게 200, 다른 모임 참여자에게 404였고 격리 DB에서 만료를 앞당긴 뒤 소유자에게도 410을 반환했습니다. | [진행](app-vlog-render.png) · [재생](app-vlog-playing.png) · [저장 완료](app-vlog-saved.png) · [권한·만료](브이로그%20접근%20검증.json) |
| 카메라 동영상(QA-07·Q28) | Android 카메라에서 약 3초 촬영하고 Done을 누르니 후보 1개가 표시됐습니다. `1개 업로드하기`와 알림 권한 허용 후 서버 전송·처리가 완료됐고 같은 기록 화면에 동영상 1개가 표시됐습니다. 격리 DB 작업은 `complete`였습니다. | [촬영 확인](app-camera-confirm.png) · [후보](app-camera-candidate.png) · [전송 후](app-camera-upload-result.png) |
| 업로드 시트의 기존 기록 삭제(C10) | 같은 장소의 본인 사진에서 X를 누르고 확인했습니다. 목록에서 사진 1개가 사라지고 남은 사진 한도가 3/5에서 4/5로 늘었습니다. 같은 장소의 다른 사진·동영상은 표시됐습니다. | [삭제 전](app-existing-delete-before.png) · [삭제 확인](app-existing-delete-confirm.png) · [삭제 후](app-existing-delete-after.png) |
| 내가 올린 기록(C11) | 통합 달력에서 진입해 참여 상태와 모임 필터를 확인하고, 최근 기록순에서 보관 기한 임박순으로 전환했습니다. 참여 종료 기록이 있는 별도 계정은 이번 기기에서 만들지 않았습니다. | [진입](app-mine-entry.png) · [필터](app-mine.png) · [보관순](app-mine-ordered.png) |
| 키보드(VB05) | 이어 재생 9:16 편집에서 키보드를 열고 `Android15`를 입력했습니다. 입력 내용이 보이는 상태를 확인했습니다. | [키보드·자막](app-vlog-keyboard.png) |

## 최신 프로토타입

- 하단 통합 달력의 여러 모임 표시와 날짜별 장소 선택의 빠른 제작 버튼을 확인했습니다. 예시 날짜에서 빠른 제작을 실행하니 24초 전체 미리보기로 이동했습니다. [통합 달력](proto-calendar.png) · [빠른 제작](proto-places.png) · [미리보기](proto-quick-preview.png)
- 전체 구성의 끝 화면, 원음 음소거 선택, BGM 선택과 `잔잔한 오후` 미리 듣기 버튼의 재생 상태를 확인했습니다. 영상 생성은 미연결 안내를 보여 주고 초안을 보존했습니다. [전체 구성](proto-compose-initial.png) · [소리 설정](proto-sound.png) · [곡 선택·재생 상태](proto-music-selected.png) · [미연결 안내](proto-vlog-not-connected.png)
- 전체 템플릿·효과를 개별 실행하거나 자막·스티커 핀치·분할 드래그, VB01·VB02의 이전 재현 경로 전체를 다시 실행하지는 않았습니다. 기능 범위는 소스와 13번 설계에서 교차 확인했습니다.

## 자동 검증

- 제품 frontend 타입 검사, 단위 44개, 화면 흐름 117개를 통과했습니다. 최신 프로토타입도 타입 검사를 통과했습니다.
- backend는 별도 검수 DB와 쓰기 가능한 임시 저장소에서 통합·미디어를 포함한 125개를 통과했습니다.
- 설계 검증은 [OpenAPI 예제](../../1차%20개발%20설계서/부록/계약예제/검증결과.json), [PostgreSQL 제약](../../1차%20개발%20설계서/부록/DB/검증결과.json), [산출물 검증 결과](../../1차%20개발%20설계서/부록/산출물%20검증.json)를 참조합니다.


## 확인이 남은 항목

- 실제 카카오 OAuth·지도 검색, 삼성 단말의 QA-07 제보 재현, 실기기 성능, TalkBack 낭독은 미확인입니다.
- 제품 앱은 서버가 Google 공급자를 활성화하면 Google 버튼도 활성화하는 코드입니다. 11월 27일 격리 환경에서는 공급자 설정이 없어 비활성 버튼을 관찰했습니다. D36과의 차이는 신규 진입 제거 및 두 공급자 설정의 검수로 추적합니다.
- Q23의 기록 없는 방문 교체는 11월 13일 기존 검증 기록을 참조합니다. 이번 기기 검수는 기록이 연결된 방문의 이름 수정입니다.
- 추가 브이로그 오디오·편집 기능의 제품 채택과 Q24~Q29의 최종 회의 답변은 확인 대기입니다.
