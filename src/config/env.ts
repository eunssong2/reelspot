// Expo 는 `process.env.EXPO_PUBLIC_*` 를 정적 표기 그대로 찾아 빌드 시 치환한다.
// 동적 접근(process.env[name])은 치환되지 않으므로 값을 리터럴로 읽는다.

const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

export const env = {
  kakaoJsKey,
} as const;

/** 카카오 지도(WebView)가 등록해야 하는 Web 플랫폼 도메인과 일치해야 하는 baseUrl. */
export const KAKAO_WEB_ORIGIN = 'http://localhost';

export const missingMapConfig: string[] = kakaoJsKey ? [] : ['EXPO_PUBLIC_KAKAO_JS_KEY'];
