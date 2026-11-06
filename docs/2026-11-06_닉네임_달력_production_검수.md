# 닉네임·달력 보완과 production 기동 검수 (2026-11-06)

**후속 보완 완료:** 아래 「닉네임 후속 보완」에서 성공 토스트와 12자 상태의 앞·중간 삽입 거부를 추가했다. 최신 앱 테스트는 **87개 통과**이며, Android 15의 Gboard 두벌식·이모지 입력과 화면 이동 후 성공 안내까지 확인했다. 아래 83개 수치와 검수 IME 설명은 최초 라운드 기록이다. SIGSEGV에는 검토자 반복 측정 결과를 추가했다.

요청한 닉네임·달력 수정과 해당 Android 15 화면 검수, 격리 production 이미지 기동 검사를 완료했다. 서버 100개·앱 83개 테스트와 양쪽 타입 검사가 통과했다. 다만 **검수용 debug 앱 시작 중 SIGSEGV가 두 번 발생했으며 원인은 미확정**이다. 앱 실행 안정성이나 출시 검수가 모두 끝났다는 뜻은 아니다. 새 결함을 먼저 보고하라는 지시에 따라 이 문제의 제품 코드 수정은 하지 않았다.

커밋·푸시·배포, 실제 서버 `.env`와 카카오 콘솔 변경은 하지 않았다. 기존 미커밋 수정은 보존했고 이번 backend 제품 코드 변경은 없다.

## 수정한 원천

| 항목 | 파일 | 변경 |
| --- | --- | --- |
| 닉네임 | `src/app/my-page.tsx`, `src/app/account.tsx`, `src/lib/nickname.ts`, `src/components/ui.tsx` | 사용자 인식 문자 단위로 12자 제한. 기존 초과 이름은 열 때 보존하고 늘리기는 막되 삭제·같은 길이 수정은 허용. 초과 상태의 버튼·키보드 저장 차단. 안내문과 완료 저장 연결 |
| 달력 | `src/app/group/[id].tsx`, `src/lib/group-calendar.ts` | 계정·모임·월별 메모리 캐시, 빈 달도 성공으로 기록. 첫 조회/재조회/접근 불가 안내 분리. 이전 요청의 늦은 응답 무시. 권한 상실 시 캐시와 쓰기 동작 숨김 |
| 오류 전파 | `src/lib/api.ts`, `src/lib/api-errors.ts` | 달력이 보낸 개별 조회에만 전역 접근 상실 이동을 생략. 다른 화면의 기본 처리 유지 |
| 회귀 검사 | `tests/nickname.test.ts`, `tests/api-errors.test.ts`, `tests/flows/nickname.test.tsx`, `tests/flows/calendar.test.tsx`, `tests/flows/setup.tsx` | 실제 화면 컴포넌트의 저장·취소, 문자 경계, 월별 오류, 빈 달, 접근 상실, 늦은 응답, 기본 전역 처리 검증 |

Android `maxLength`와 사용자 인식 문자 수의 단위가 다르므로 숫자 12를 그대로 전달하지 않았다. 조합 중인 원문은 정규화하지 않고 보존하고, 카운터·제한·저장 판정에는 NFC와 앞뒤 공백 제거 기준을 적용했다. 기존 13~20자 이름이 조용히 잘린 상태로 저장되는 경로도 막았다.

## Android 15 결과

Android 15/API 35, `emulator-5556`, 720×1560px, 293dpi. 최신 작업 트리로 새로 빌드한 `kr.atthatplace.app.verify` debug APK와 기기 내부에 로드된 최신 Metro 번들을 사용했다. 최신 backend를 읽기 전용 마운트한 격리 API·워커, 일회용 PostgreSQL/파일 저장소, 마이그레이션 001~015, 개발 인증·검토 설정에 연결했다. 실제 사용자 카카오 세션이 있는 `.qa` 앱과 분리했다.

아래 `artifacts/` 링크는 **Git에서 제외되는 로컬 증거 경로**다. 다른 체크아웃에는 별도 전달이 필요하다.

| 시나리오 | 확인 결과와 로컬 근거 |
| --- | --- |
| 기존 긴 이름 | 마이페이지 20자 원문 보존·완료 차단, 13자로 줄여도 저장 비활성, 취소 후 원문 유지. 계정 화면은 기존 13자 보존·완료 차단, 12자로 수정 가능, 취소 후 13자 복원. [20자](../artifacts/android15-final-20261106/08-my-legacy20-open.png), [13자 차단](../artifacts/android15-final-20261106/15-my-legacy13-blocked.png), [계정 복원](../artifacts/android15-final-20261106/26-account-reopen13.png) |
| 한글 경계 | 11음절 뒤 `ㅎ→하→한` 조합을 거쳐 12자가 되고 추가 한 글자 입력 차단. [마이페이지](../artifacts/android15-final-20261106/18-my-korean13-blocked.png), [계정](../artifacts/android15-final-20261106/27-account-korean12.png) |
| 이모지·완료 저장 | 가족 이모지 13개 입력 시 결합 문자를 자르지 않고 12개 유지. 두 화면에서 완료 저장과 서버 결과 반영 확인. [마이페이지](../artifacts/android15-final-20261106/20-my-emoji12.png), [계정 저장](../artifacts/android15-final-20261106/29-account-done-saved.png). 한글 12자도 마이페이지 완료 저장 후 격리 DB 값 확인 |
| 첫 조회 | 응답을 7초 지연해 스피너와 `일정을 불러오는 중` 확인. [화면](../artifacts/android15-final-20261106/30-calendar-first-loading.png) |
| 받은 달 재조회 실패 | 11월 일정 표시 → 친구 화면 왕복 → 달력만 503. `최신 정보를 불러오지 못했어요`, 다시 시도, 기존 일정 유지. [화면](../artifacts/android15-final-20261106/32-calendar-cached-error.png) |
| 새 달 실패 | 12월 이동 시 503. `일정을 불러오지 못했어요`, 다시 시도 표시. 11월 일정은 남지 않음. [화면](../artifacts/android15-final-20261106/33-calendar-new-month-error.png) |
| 빈 달 재조회 실패 | 12월 빈 결과 성공 → 친구 화면 왕복·503. 빈 결과 유지와 재조회 안내. 11월 복귀 시 해당 월 캐시 유지. [빈 달](../artifacts/android15-final-20261106/35-calendar-empty-refresh-error.png), [11월](../artifacts/android15-final-20261106/36-calendar-cached-november-return.png) |
| 조회 중 접근 불가 | 달력에 서버 형식의 403/FORBIDDEN 주입. 내 기록으로 튕기지 않고 `이 모임을 확인할 수 없어요.`와 `내 모임으로` 표시. 버튼으로 내 모임 이동. [접근 불가](../artifacts/android15-final-20261106/37-calendar-access-lost.png), [이동](../artifacts/android15-final-20261106/38-calendar-back-to-groups.png) |

한글·이모지는 별도 검수 IME가 Android `InputConnection.setComposingText/commitText/performEditorAction`을 호출해 입력했다. JS 함수 시뮬레이션은 아니지만 **사람이 Gboard·삼성 키보드로 타이핑한 실기기 검수는 아니다.** 달력 오류는 격리 TLS 프록시가 해당 요청에만 주입했으며 실제 탈퇴·강퇴 경합을 재현한 것은 아니다.

## 새로 발견한 시작 종료 — 미해결

후속 검토자가 제공한 Android 15 에뮬레이터 반복 시작 결과는 다음과 같다. 아래 수치는 작업자가 재측정한 것이 아니다.

| 빌드·JS | 비정상 종료 |
| --- | --- |
| debug + Metro, 이번 수정본 | 11/30 |
| debug + Metro, 이전 커밋 `8694b11` JS | 4/30 |
| 비디버그, 닉네임 성공 토스트 추가 전 수정본 별도 빌드 | 0/50 |
| 비디버그, 이전 라운드 `.qa` | 0/50 |

**위 0/50은 닉네임 성공 토스트 추가 전 측정이다. 토스트를 포함한 최신 코드의 비디버그 반복 시작은 미측정이다.**

이전 커밋 JS에서도 같은 스택으로 발생했으므로 이번 수정에서 새로 생긴 문제로 볼 수 없다. **측정 범위에서는 debug에서만 발생했다.** 이번 변경이 빈도에 미치는 영향, 근본 원인과 실기기 결과는 미확인이다. 신규 비디버그 앱은 로그인 없이 서버 연결이 안 되는 상태, 기존 `.qa`는 로그인 세션이 있는 상태였다. 이 결과만으로 모든 배포 흐름의 안정성을 보장하지는 않지만, SIGSEGV를 이번 닉네임·달력 변경 고유의 배포 차단 결함으로 분류할 근거도 없다. 이후 debug 검수에서도 화면과 함께 프로세스·crash 로그를 확인한다.

아래는 작업자의 최초 관찰 기록이며, 당시의 원인 미확정 판단을 보존한다.

- 09:27:11 KST 첫 실행 중, 09:38:31 KST 강제 종료 후 재시작 중 SIGSEGV 발생. 모두 `mqt_v_js`, `libreactnative.so`, `MountingCoordinator::pullTransaction(bool)` / Fabric 화면 구성 경로다.
- 마지막 검사는 `am force-stop` 후 동일 Expo 개발 클라이언트 URL로 시작하는 3회 중 1회 실패, 2회 정상이다. 실패 시 뒤에 있던 다른 앱 화면이 보였으므로 화면만으로 정상 기동이라 판정하지 않았다. 프로세스와 crash 로그를 함께 확인했다.
- clean 빌드·재설치 뒤에도 발생했으므로 빌드 캐시 문제로 해결됐다고 볼 수 없다. 이전 검수 APK와 이번 최초 APK의 native 라이브러리·DEX는 같고 인증서 리소스가 달랐다. 이것만으로 이번 JS 변경, 개발 도구, 에뮬레이터 중 원인을 구분할 수 없다.
- **원인 분석과 수정은 보류했다.** 새 결함은 수정 전에 보고하라는 조건에 따라 사용자에게 알렸다. release APK·실기기에서도 발생하는지는 미확인이다. 기존 `.qa` 앱은 이번 코드로 교체하지 않았다.
- 근거: [종료 스택](../artifacts/android15-final-20261106/startup-crash-excerpt.txt), [재시작 결과](../artifacts/android15-final-20261106/cold-restarts.json), 같은 로컬 폴더의 `startup-logcat.txt`, `final-logcat.txt`, `apk-comparison.json`, `native-comparison.json`.

## production 이미지 기동

별도 태그 `samsun-server:qa-production-20261106`로 새 이미지를 빌드했다. 실제 사용 태그 `samsun-server:local`의 이미지 ID는 전후 동일하다. 이미지 안의 코드로 실행했으며 source bind mount는 하지 않았다.

일회용 DB/내부 네트워크/파일 저장소에서 production/provider/OIDC와 `MODERATION_MODE=disabled`, `ALLOW_TEST_MODERATION_BYPASS=true`, 임시 비밀값·검수용 OIDC 설정을 사용했다.

- 001~015 마이그레이션, `/health`의 production/provider/disabled 응답 확인.
- 인증 시도 생성 API가 DB에 기록됨을 확인.
- 워커를 시작하고 합성 신고 근거 파일 정리 작업이 complete가 되며 실제 파일도 삭제되는 것 확인.
- **실제 카카오·외부 OIDC 인증은 미검수.** 새 이미지 빌드·설정·API/워커 기동 범위다. 실제 서버 배포·데이터 마이그레이션 결과가 아니다.
- [결과](../artifacts/android15-final-20261106/production-smoke.json), [이미지 ID](../artifacts/android15-final-20261106/production-image.json), 빌드·마이그레이션·API/워커 로그와 검수 helper를 같은 로컬 폴더에 보존했다.

## 자동 검사·남은 항목

- 서버: 별도 `qa_tests` DB의 마이그레이션·seed 후 `RUN_INTEGRATION=1 MEDIA_TESTS=1`, 외부 `MODERATION_MODE=review`로 **100개 통과, 실패·생략 0**. 처음 시도는 seed 누락, 다음은 작업 디렉터리의 문서 fixture 경로 누락으로 실패했다. 준비 절차를 바로잡아 새 DB에서 전체 통과했으며 제품 코드는 바꾸지 않았다. 실패 로그도 보존했다.
- 앱: 단위 **37개**, 화면 흐름 **46개**, 합 **83개 통과**. 양쪽 TypeScript 검사 통과. 마지막 403 판정 보완 후 앱 타입 검사·달력 흐름 6개도 재실행 통과.
- Android debug APK clean 빌드 성공. [검증 메타데이터](../artifacts/android15-final-20261106/verification.json)에 APK·기기 실제 JS·소스 해시, 수치, 한계를 기록했다. [달력 화면 자동 대조](../artifacts/android15-final-20261106/native-calendar-assertions.json)도 통과했다.
- UI 담당 확인 항목: 자르기 손잡이 28dp는 명세 최소 48dp와 차이가 있다. 이전 측정 조건에서 터치 사각형이 시스템 뒤로가기 구역과 양쪽 약 7px 겹친다는 계산이 남아 있다. 앱은 사진 주위 조작 여백을 추가했지만 프로토타입은 그대로다. 이번에는 자르기 코드·프로토타입 수정이나 UI 담당자 연락을 하지 않았다.
- TalkBack, VB05, v3.3 아코디언 UI, 날짜 이동·저장본 규격·참여자 메뉴 정책 결정은 별도 범위다. 닉네임 성공 토스트는 아래 후속 보완에서 추가했으며, 다른 화면의 모든 차이를 해소한 것은 아니다.

## 정리

검수용 API·워커·DB·네트워크, Metro·프록시, `.verify` 앱과 검수 IME를 제거하고 기존 입력기로 복원했다. 임시 인증서 개인키·테스트 토큰 파일을 삭제하고 Git 제외 Android 빌드 입력도 복원했다. 기존 `.qa` 앱의 실제 카카오 세션은 유지했다. 이 앱은 이전 라운드 APK와 기존 서버를 사용하며 이번 수정의 최종 설치본이 아니다.

## 닉네임 후속 보완

### 변경 및 자동 검사

- `src/app/my-page.tsx`, `src/app/account.tsx`: 저장 작업과 프로필 새로고침 성공 뒤 `닉네임을 바꿨어요` 표시. 실패 시 성공 문구를 표시하지 않는다.
- `src/components/toast-provider.tsx`, `src/app/_layout.tsx`: 기존 브이로그의 토스트 UI·표시 시간을 재사용하고 화면 전환 밖에서 유지한다. 계정의 `edit=yes` 경로가 저장 후 돌아가도 안내가 사라지지 않는다. 기존 브이로그 토스트 코드는 변경하지 않았다.
- `src/lib/nickname.ts`: 기존 값이 12자인데 새 값이 초과하면 전체 편집을 거부한다. 기존 코드처럼 새 값 앞 12자만 잘라 기존 마지막 글자를 잃지 않는다. 12자 이내의 한글 조합·선택 영역 교체, 빈 값에서 이모지 붙여넣기, 기존 긴 이름 보존 규칙은 유지한다.
- `tests/nickname.test.ts`, `tests/flows/nickname.test.tsx`: 앞·중간·끝 삽입, 한글·이모지, 유효한 글자 교체, 두 화면의 성공/실패, 이전 화면 복귀 뒤 토스트 유지 검증.
- 단위 **38개**, 화면 흐름 **49개**, 합 **87개 통과**. 앱 TypeScript·`git diff --check` 통과. backend 제품 코드 변경은 없으며 서버 100개 테스트는 앞선 라운드 결과이고 이번에는 재실행하지 않았다.

### Android 15 재검수

동일 Android 15 에뮬레이터에 이번 소스의 새 debug APK와 최신 Metro 번들을 실행했다. 별도 API·워커·일회용 DB/저장소에 최신 backend를 읽기 전용 마운트하고 개발 인증·검토 설정으로 연결했다. 기존 `.qa` 앱·실제 카카오 세션과 분리했다. 이번에는 검수 IME를 설치하지 않고 **Gboard의 화면 키를 ADB 터치로 눌렀다.** 물리 기기나 사람이 손가락으로 수행한 검수는 아니다.

아래 링크 역시 Git 제외 **로컬 증거**다.

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 12자 ASCII 앞·중간·끝 | `abcdefghijkl`의 각 위치에서 Gboard X 키 입력. 기존 12자 모두 유지 | [앞](../artifacts/android15-nickname-20261106/06-gboard-prefix-rejected.png), [중간](../artifacts/android15-nickname-20261106/07-gboard-middle-rejected.png), [끝](../artifacts/android15-nickname-20261106/08-gboard-suffix-rejected.png) |
| Gboard 두벌식 조합 | 11자 `abcdefghijk` 뒤에 Gboard `ㅎ→ㅏ→ㄴ` 키를 눌러 12번째 글자가 `ㅎ→하→한`으로 바뀜. 추가 ㄱ은 거부 | [ㅎ](../artifacts/android15-nickname-20261106/20-gboard-hieuh.png), [하](../artifacts/android15-nickname-20261106/21-gboard-ha.png), [한](../artifacts/android15-nickname-20261106/22-gboard-han.png), [초과 거부](../artifacts/android15-nickname-20261106/23-gboard-korean13-rejected.png) |
| 한글 앞·중간 삽입 | 위 12자 이름의 앞·중간에서 Gboard ㅎ 키 입력. 원문과 12/12 유지 | [앞](../artifacts/android15-nickname-20261106/24-gboard-korean-prefix-rejected.png), [중간](../artifacts/android15-nickname-20261106/25-gboard-korean-middle-rejected.png) |
| 마이페이지 성공 | Gboard 완료 키로 저장. 이름 반영 및 `닉네임을 바꿨어요` 표시 | [화면](../artifacts/android15-nickname-20261106/26-my-korean-success-toast.png) |
| 계정 이모지 | Gboard의 😀를 13번 선택해도 12개 유지. 앞에 다른 이모지를 넣어도 기존 12개 유지. 저장 버튼으로 저장 후 성공 토스트 표시 | [12개](../artifacts/android15-nickname-20261106/30-account-gboard-emoji12.png), [앞 삽입](../artifacts/android15-nickname-20261106/31-account-emoji-prefix-rejected.png), [저장](../artifacts/android15-nickname-20261106/32-account-success-toast.png) |
| 계정 저장 후 복귀 | `account?edit=yes`에서 `newname` 저장. 이전 내 모임 화면으로 돌아간 뒤에도 성공 토스트 표시 | [화면](../artifacts/android15-nickname-20261106/41-return-success-toast.png) |

시험용 기본 문자열 준비와 커서 이동에는 ADB text/keyevent도 사용했다. `returntoast`를 ADB text로 주입할 때 개발 앱의 재로드가 발생해 `newname`으로 다시 확인했다. 당시 로그의 `Running main` 재실행을 확인했으며, 33~39번 진단 캡처는 성공 판정 근거에서 제외했다. Gboard 키로 수행한 위 시나리오에서는 해당 현상이 없었다.

이번 실행 중 프로세스와 crash 로그를 함께 확인했고 SIGSEGV는 관찰하지 않았다. 반복 시작 검사는 다시 하지 않았으므로 앞선 검토자의 빈도 측정을 대체하지 않는다. 실제 카카오 로그인·외부 OIDC·production 인증 상태의 전체 앱 흐름·실기기는 이번에도 미검수다.

`artifacts/android15-nickname-20261106/verification.json`에 APK·설치본·기기 실제 번들·수정 소스 해시, 테스트 결과와 범위를 기록했다. 빌드 로그·테스트 로그·화면 근거도 같은 로컬 폴더에 있다. 검수를 위해 추가한 Gboard 한국어 두벌식은 제거해 원래 English (US) QWERTY 구성으로 돌렸다. 격리 환경과 검수 앱을 정리하고 Android 빌드 입력을 복원했으며, 기존 카카오 앱·세션은 보존했다. 커밋·푸시·배포와 실제 서버 설정 변경은 하지 않았다.

## 이후 카카오 세션 상태 정정

위 세션 보존 문구는 각 검수 종료 당시 상태다. 이후 검토자가 전달한 경과에 따르면 메모리 부족으로 세션을 잃어 앱을 재설치하고 카카오에 재로그인했다. 12:32 캡처의 `.qa`는 내 모임 화면이지만 이후 세션 유지 여부를 재확인한 근거는 아니다. 이번 후속 보완에서는 로그인된 `.qa` 앱을 실행·교체·초기화하지 않는다.
