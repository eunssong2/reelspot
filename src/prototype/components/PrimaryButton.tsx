import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, MIN_TOUCH, radius } from '../styles/tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** 하단 고정용 파란 둥근 버튼 (다음 등). */
export function PrimaryButton({ label, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  // 팀 Button 처럼 눌린 동안 한 단 어두워진다.
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.45 },
  label: { color: colors.onPrimary, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
});
