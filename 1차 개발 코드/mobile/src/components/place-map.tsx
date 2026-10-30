import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Linking } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { kakaoMapHtml, scriptJson } from '../lib/kakao-map-html';
import { P, Button } from './ui';
export function PlaceMap({
  center,
  places,
  selectedId,
  pin,
  onSelect,
  onRegion,
  onPin,
}: {
  center: { lat: number; lng: number };
  places: any[];
  selectedId?: string;
  pin?: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  onRegion: (value: { lat: number; lng: number; bounds: string }) => void;
  onPin?: (p: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<WebView>(null),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [generation, setGeneration] = useState(0);
  const key = Constants.expoConfig?.extra?.kakaoJsKey as string | undefined;
  const origin = Constants.expoConfig?.extra?.kakaoWebOrigin || 'https://sphan0325.ddns.net';
  const source = useMemo(() => ({ html: kakaoMapHtml(key ?? ''), baseUrl: origin }), [key, origin]);
  useEffect(() => {
    if (ready)
      ref.current?.injectJavaScript(
        `window.updateMap && window.updateMap(${scriptJson({ center, places: places.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, name: p.name, lat: Number(p.lat), lng: Number(p.lng) })), selectedId, pin })});true;`,
      );
  }, [ready, center, places, selectedId, pin]);
  if (!key) return <P>지도 연결을 준비하고 있어요. 목록 검색이나 직접 등록을 이용해 주세요.</P>;
  return (
    <View>
      <View
        style={{ height: 300, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F2F4F6' }}
      >
        <WebView
          key={generation}
          ref={ref}
          source={source}
          javaScriptEnabled
          domStorageEnabled={false}
          originWhitelist={[origin, 'https://*']}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(r) => {
            if (r.url === 'about:blank' || r.url === origin || r.url === origin + '/') return true;
            try {
              const target = new URL(r.url);
              if (
                target.protocol === 'https:' &&
                ['map.kakao.com', 'apis.map.kakao.com'].includes(target.hostname)
              )
                void Linking.openURL(r.url).catch(() => {});
            } catch {
              /* Reject unknown navigation targets. */
            }
            return false;
          }}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onMessage={(event) => {
            try {
              const m = JSON.parse(event.nativeEvent.data);
              if (m.type === 'ready') {
                setReady(true);
                setFailed(false);
              }
              if (m.type === 'error') setFailed(true);
              if (m.type === 'select' && places.some((p) => p.id === m.id)) onSelect(m.id);
              const valid =
                Number.isFinite(m.lat) &&
                Number.isFinite(m.lng) &&
                Math.abs(m.lat) <= 90 &&
                Math.abs(m.lng) <= 180;
              if (m.type === 'region' && valid && typeof m.bounds === 'string') onRegion(m);
              if (m.type === 'pin' && valid) onPin?.({ lat: m.lat, lng: m.lng });
            } catch {
              /* Ignore malformed/untrusted bridge messages. */
            }
          }}
        />
      </View>
      {failed && (
        <>
          <P>지도 연결을 확인해 주세요. 검색 결과와 입력은 유지됩니다.</P>
          <Button
            secondary
            onPress={() => {
              setReady(false);
              setFailed(false);
              setGeneration((v) => v + 1);
            }}
          >
            지도 다시 시도
          </Button>
        </>
      )}
    </View>
  );
}
