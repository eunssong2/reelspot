import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, GUTTER } from '../styles/tokens';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** 오른쪽 영역(아바타, 버튼 등) */
  right?: ReactNode;
}

/** 뒤로가기 · 가운데 제목 · 오른쪽 영역으로 이루어진 상단 바. */
export function AppHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER - 6,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 56,
  },
  side: { width: 76, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { backgroundColor: colors.surface },
  backGlyph: { fontSize: 34, lineHeight: 38, color: colors.text, marginTop: -3 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSub, marginTop: 2 },
});
