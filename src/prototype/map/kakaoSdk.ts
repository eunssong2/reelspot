import { Platform } from 'react-native';

import { env } from '../config/env';

/** 카카오맵 JavaScript SDK 주소. autoload=false 로 받고 kakao.maps.load() 로 초기화한다. */
export function kakaoSdkUrl(jsKey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    jsKey,
  )}&libraries=services&autoload=false`;
}

/** 화면·로그에 키가 그대로 나오지 않도록 가린다. */
export function redactKey(text: string): string {
  return env.kakaoJsKey ? text.split(env.kakaoJsKey).join('<키>') : text;
}

export interface SdkAccessResult {
  status: number;
  /** 카카오 서버가 돌려준 원문 메시지 (키는 가려짐). 200 이면 빈 문자열 */
  message: string;
}

/**
 * SDK 스크립트 요청이 실패했을 때 카카오 서버가 실제로 뭐라고 답하는지 다시 물어본다.
 * - 스크립트 태그의 실패 응답 본문은 페이지에서 읽을 수 없어서(CORS) 별도 요청이 필요하다.
 * - 모바일: 앱이 직접 요청하되 Referer 를 WebView 가 보고한 출처로 맞춘다.
 * - 웹: 브라우저는 CORS 로 못 읽으므로 개발 서버(metro.config.js)의 /__kakao-sdk-check 를 거친다.
 */
export async function diagnoseSdkAccess(origin: string): Promise<SdkAccessResult | null> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`/__kakao-sdk-check?origin=${encodeURIComponent(origin)}`);
      return (await res.json()) as SdkAccessResult;
    }
    const res = await fetch(kakaoSdkUrl(env.kakaoJsKey), {
      headers: { Referer: `${origin}/` },
    });
    if (res.ok) return { status: res.status, message: '' };
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // 본문이 JSON 이 아니면 상태 코드만 표시
    }
    return { status: res.status, message: redactKey(message) };
  } catch {
    return null;
  }
}

/** 카카오가 돌려준 메시지를 보고 콘솔에서 무엇을 해야 하는지 알려 준다. */
export function hintFor(message: string): string | null {
  if (/domain mismatched/i.test(message)) {
    const caller = message.match(/caller=(\S+?)\.?(\s|$)/)?.[1];
    return `[앱] > [플랫폼 키] > JavaScript 키 > JavaScript SDK 도메인에 ${caller ?? '이 출처'} 를 추가하세요.`;
  }
  if (/disabled OPEN_MAP_AND_LOCAL/i.test(message)) {
    return '[카카오맵] > [사용 설정] 상태를 ON 으로 바꾸세요.';
  }
  if (/wrong appKey|appkey/i.test(message)) {
    return 'JavaScript 키가 맞는지(REST API 키 아님), 공백이 없는지 확인하세요.';
  }
  return null;
}

/** 화면에 보여 줄 실패 설명: 원인 + 카카오 실제 응답 + 조치 + 요청 출처. */
export function buildFailureMessage(base: string, origin: string | undefined, access: SdkAccessResult | null): string {
  const lines = [base];
  if (access && access.status !== 200) {
    lines.push(`카카오 응답 ${access.status}: ${access.message}`);
    const hint = hintFor(access.message);
    if (hint) lines.push(`→ ${hint}`);
  } else if (!access) {
    lines.push('카카오 서버 응답을 다시 조회하지 못했습니다(네트워크 확인).');
  }
  if (origin) lines.push(`요청 출처(origin): ${origin}`);
  return lines.join('\n');
}
