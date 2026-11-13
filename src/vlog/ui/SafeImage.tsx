import { useState } from 'react';
import { Image, Text, View, type ImageStyle, type StyleProp, type ImageResizeMode } from 'react-native';
import { API, api, currentSession } from '../../lib/api';
export function authorizedImage(uri: string) {
  return uri.startsWith(`${API}/v1/`) ? { uri, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } } : { uri };
}
/**
 * One retry for a server image that failed to load. The access token lasts 15 minutes and a
 * long editing session outlives it; any API call renews it, then the image is requested again.
 */
export function useImageRetry(source: string | number) {
  const [state, setState] = useState<{ source: string | number; attempt: number; failed: boolean }>({ source, attempt: 0, failed: false });
  const current = state.source === source ? state : { source, attempt: 0, failed: false };
  return {
    attempt: current.attempt,
    failed: current.failed,
    onError: () => {
      if (current.attempt > 0 || typeof source !== 'string' || !source.startsWith(`${API}/v1/`)) {
        setState({ ...current, failed: true });
        return;
      }
      void api('/me/profile')
        .catch(() => {})
        .then(() => setState({ source, attempt: 1, failed: false }));
    },
  };
}
export function SafeImage({ source, style, resizeMode = 'cover', accessibilityLabel }: { source: string | number; style?: StyleProp<ImageStyle>; resizeMode?: ImageResizeMode; accessibilityLabel?: string; compact?: boolean }) {
  const retry = useImageRetry(source);
  if (retry.failed) return <View style={style as any}><Text>이미지를 불러오지 못했어요</Text></View>;
  // The key remounts the image so the renewed token is sent instead of a cached failure.
  return <Image key={retry.attempt} source={typeof source === 'string' ? [authorizedImage(source)] : source} style={style} resizeMode={resizeMode} accessibilityLabel={accessibilityLabel} onError={retry.onError} />;
}
