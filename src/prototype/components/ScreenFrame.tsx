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

/** 화면 하나의 공통 배경: 팀 앱과 같은 흰 배경. */
export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>{children}</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.surface, alignItems: 'center' },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
});
