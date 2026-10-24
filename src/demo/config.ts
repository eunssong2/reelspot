/**
 * 데모(테스트 APK) 모드 설정.
 *
 * EXPO_PUBLIC_DEMO_MODE=1 로 번들을 만들 때만 켜진다(빌드 스크립트: scripts/build-demo-apk.ps1).
 * 켜지면 로그인·서버 없이 내 담당 화면(일정 요약 → 날짜별 장소 → 장소 추가 → 순서 편집 → 장소 기록)으로
 * 바로 들어가고, 예시 데이터는 기기 안(AsyncStorage)에만 저장한다. 꺼져 있으면 기존 서비스 흐름 그대로다.
 *
 * Expo 는 `process.env.EXPO_PUBLIC_*` 를 정적 표기 그대로 찾아 빌드 시 치환하므로 리터럴로 읽는다.
 */
export const IS_DEMO_BUILD = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

/** 데모가 처음 여는 화면의 식별자(src/prototype/mock/tripData.ts 의 모임·일정 id 와 같다). */
export const DEMO_TRIP_ID = 'trip1';
export const DEMO_ITINERARY_ID = 'itin-seoul-1';
/** 하루짜리 일정 예시(날짜 탭 없이 그날의 장소만 보이는 화면 확인용). */
export const DEMO_ONEDAY_ITINERARY_ID = 'itin-seoul-oneday';

/** AsyncStorage 키. 저장 형식을 바꾸면 버전을 올려 이전 저장본을 무시한다. */
export const DEMO_STORAGE_KEY = 'reelspot.demo.itineraries.v1';
/** 일정 대표(배경) 사진 저장 키. { [일정 id]: data URI } 형태. */
export const DEMO_COVER_STORAGE_KEY = 'reelspot.demo.covers.v1';

