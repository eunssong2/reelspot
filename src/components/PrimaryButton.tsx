import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, shadow } from '../styles/tokens';

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
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: shadow.float,
  },
  pressed: { opacity: 0.88 },
  disabled: { backgroundColor: colors.primaryBorder, boxShadow: 'none' },
  label: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
