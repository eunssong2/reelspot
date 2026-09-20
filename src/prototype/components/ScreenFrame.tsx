import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../styles/tokens';

/** 모바일 폭(최대 430px)으로 고정하고, 넓은 웹 화면에서는 가운데에 폰처럼 보여 주는 바깥 틀. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.outer}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

/**
 * 화면 하나의 공통 배경: 연한 하늘색 + 물결 느낌의 반투명 원형 장식.
 * 장식은 터치를 가로채지 않는다.
 */
export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#CFE7F7', alignItems: 'center' },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  blobTop: {
    position: 'absolute',
    pointerEvents: 'none',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  blobBottom: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: -160,
    left: -120,
    width: 420,
    height: 300,
    borderRadius: 210,
    backgroundColor: 'rgba(181,217,245,0.35)',
  },
});
