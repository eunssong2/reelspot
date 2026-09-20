import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { KAKAO_WEB_ORIGIN, env } from '../config/env';
import { buildFailureMessage, diagnoseSdkAccess } from './kakaoSdk';
import { buildKakaoMapHtml, categoryScript, clearScript, paddingScript, searchScript, selectScript } from './kakaoMapHtml';
import { CATEGORIES, parseMapEvent, type MapEvent, type MapHandle } from './types';

interface Props {
  onEvent: (event: MapEvent) => void;
}

/** 카카오 지도를 WebView 로 표시한다. 검색·마커 조작은 ref 로, 결과는 onEvent 로 받는다. */
export const KakaoMapView = forwardRef<MapHandle, Props>(function KakaoMapView(
  { onEvent },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildKakaoMapHtml(env.kakaoJsKey), []);

  useImperativeHandle(ref, () => ({
    search: (keyword) => webViewRef.current?.injectJavaScript(searchScript(keyword)),
    searchCategory: (key) => {
      const code = CATEGORIES.find((c) => c.key === key)?.code;
      if (code) webViewRef.current?.injectJavaScript(categoryScript(code));
    },
    clear: () => webViewRef.current?.injectJavaScript(clearScript),
    select: (id) => webViewRef.current?.injectJavaScript(selectScript(id)),
    setPadding: (bottom) => webViewRef.current?.injectJavaScript(paddingScript(bottom)),
  }));

  const handleMessage = (e: WebViewMessageEvent) => {
    const event = parseMapEvent(e.nativeEvent.data);
    if (!event) return;
    if (event.type !== 'sdkError') {
      onEvent(event);
      return;
    }
    // SDK 로딩 실패: 카카오 서버가 실제로 뭐라고 답하는지 다시 조회해 원인을 함께 보여 준다.
    const origin = event.origin;
    (origin ? diagnoseSdkAccess(origin) : Promise.resolve(null)).then((access) =>
      onEvent({
        type: 'sdkError',
        message: buildFailureMessage(event.message, origin, origin ? access : null),
        origin,
      }),
    );
  };

  return (
    <WebView
      ref={webViewRef}
      style={styles.map}
      // baseUrl 의 도메인이 카카오 개발자 콘솔의 Web 플랫폼 도메인과 일치해야 SDK 가 허용된다.
      source={{ html, baseUrl: KAKAO_WEB_ORIGIN }}
      originWhitelist={[KAKAO_WEB_ORIGIN, 'about:*']}
      javaScriptEnabled
      domStorageEnabled
      onMessage={handleMessage}
      // 지도 안에서 다른 페이지로 이동하는 것을 막는다.
      onShouldStartLoadWithRequest={(req) =>
        req.url.startsWith(KAKAO_WEB_ORIGIN) || req.url.startsWith('about:')
      }
      onError={(e) =>
        onEvent({ type: 'sdkError', message: `WebView 오류: ${e.nativeEvent.description}` })
      }
      onHttpError={(e) =>
        onEvent({ type: 'sdkError', message: `WebView HTTP 오류 ${e.nativeEvent.statusCode}: ${e.nativeEvent.url.split('?')[0]}` })
      }
      setSupportMultipleWindows={false}
      // 지도 드래그 중 화면 스크롤/바운스가 끼어들지 않도록 한다.
      bounces={false}
      scrollEnabled={false}
    />
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
