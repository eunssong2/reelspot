import { useState } from 'react';
import { Image, Text, View, type ImageStyle, type StyleProp, type ImageResizeMode } from 'react-native';
import { API, currentSession } from '../../lib/api';
export function authorizedImage(uri: string) {
  return uri.startsWith(`${API}/v1/`) ? { uri, headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } } : { uri };
}
export function SafeImage({ source, style, resizeMode = 'cover', accessibilityLabel, compact }: { source: string | number; style?: StyleProp<ImageStyle>; resizeMode?: ImageResizeMode; accessibilityLabel?: string; compact?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | number | null>(null);
  if (failedSource === source) return <View style={style as any}><Text>이미지를 불러오지 못했어요</Text></View>;
  return <Image source={typeof source === 'string' ? [authorizedImage(source)] : source} style={style} resizeMode={resizeMode} accessibilityLabel={accessibilityLabel} onError={() => setFailedSource(source)} />;
}
