import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageResizeMode, type ImageSourcePropType, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';

import { colors } from '../prototype/styles/tokens';

/**
 * URL(string)이면 { uri } 로, 번들 자산(require 결과)이면 그대로 Image source 로 쓴다.
 * 번들 자산은 네이티브에서는 숫자 ID, 웹에서는 { uri, width, height } 객체로 오므로 문자열만 감싼다.
 */
export const toImageSource = (value: string | number): ImageSourcePropType =>
  typeof value === 'string' ? { uri: value } : value;

interface Props {
  source: string | number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** 작은 썸네일에서는 안내 문구를 생략하고 아이콘만 보여준다. */
  compact?: boolean;
  accessibilityLabel?: string;
}

/**
 * 이미지 로딩에 실패하면 깨진 이미지 대신 "불러오지 못했어요" 자리표시를 보여준다.
 * (원격 URL 이 막히거나 파일이 손상된 경우)
 */
export function SafeImage({ source, style, resizeMode = 'cover', compact, accessibilityLabel }: Props) {
  const [failed, setFailed] = useState(false);

  // 다른 이미지로 바뀌면 실패 상태를 다시 판단한다.
  useEffect(() => setFailed(false), [source]);

  if (failed) {
    return (
      <View style={[style as StyleProp<ViewStyle>, styles.fallback]} accessibilityLabel="이미지를 불러오지 못했어요">
        <Text style={compact ? styles.glyphSmall : styles.glyph}>🖼️</Text>
        {compact ? null : <Text style={styles.message}>이미지를 불러오지 못했어요</Text>}
      </View>
    );
  }
  return (
    <Image
      source={toImageSource(source)}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', gap: 6 },
  glyph: { fontSize: 30, opacity: 0.6 },
  glyphSmall: { fontSize: 18, opacity: 0.6 },
  message: { fontSize: 12, color: colors.textSub },
});
