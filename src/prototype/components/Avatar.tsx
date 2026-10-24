import { StyleSheet, View } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import { colors } from '../styles/tokens';

interface Props {
  /** 프로필 사진: URL(string) 또는 앱에 포함된 자산(number). */
  uri: string | number;
  size?: number;
}

/** 원형 프로필 이미지. 스팟원 아바타처럼 실제 사진이 들어가는 자리에 쓴다(이모지 대신). */
export function Avatar({ uri, size = 36 }: Props) {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <SafeImage source={uri} compact style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
