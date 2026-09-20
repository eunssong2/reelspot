import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { MIN_TOUCH, colors, radius, spacing, type } from '@/theme/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'characters';
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType,
  maxLength,
  autoCapitalize,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[styles.input, focused && styles.inputFocused, Boolean(error) && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(2) },
  label: { ...type.label, color: colors.textBody },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    color: colors.text,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing(4),
    ...type.body,
  },
  // 토스는 포커스를 테두리 색 하나로만 표시한다.
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.bg },
  inputError: { borderColor: colors.danger, backgroundColor: colors.bg },
  hint: { ...type.caption, color: colors.textMuted },
  error: { ...type.caption, color: colors.danger },
});
