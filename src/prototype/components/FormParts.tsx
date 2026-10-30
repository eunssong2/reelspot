import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, MIN_TOUCH, radius } from '../styles/tokens';

/**
 * 로그인~달력~초대 화면이 함께 쓰는 작은 부품.
 * 디자인(docs/stitch)의 구성을 따르되 색은 팀 프로토타입 토큰(흰 배경 + 회색 면 + 코랄)을 쓴다.
 */

type Tone = 'primary' | 'secondary' | 'dark' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
  loading?: boolean;
  /** 글자 앞에 붙는 기호(이모지·글리프) */
  icon?: string;
  /** 글자 뒤에 붙는 기호 */
  trailing?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** 높이 56의 주요 버튼. loading 이면 눌리지 않고 안에 로딩 표시만 보인다. */
export function ActionButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  icon,
  trailing,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const off = disabled || loading;
  const fg = tone === 'secondary' ? colors.text : tone === 'danger' ? colors.onPrimary : colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        toneStyle[tone],
        pressed && !off && pressedStyle[tone],
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Text style={[styles.buttonIcon, { color: fg }]}>{icon}</Text> : null}
          <Text style={[styles.buttonLabel, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
          {trailing ? <Text style={[styles.buttonIcon, { color: fg }]}>{trailing}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const toneStyle = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface },
  dark: { backgroundColor: colors.ink },
  danger: { backgroundColor: colors.danger },
});
const pressedStyle = StyleSheet.create({
  primary: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.surfaceStrong },
  dark: { opacity: 0.85 },
  danger: { opacity: 0.85 },
});

/** 작은 둥근 배지. tone=coral 은 연한 코랄 면 + 코랄 글자. */
export function Pill({
  label,
  tone = 'gray',
  style,
}: {
  label: string;
  tone?: 'coral' | 'gray' | 'solid';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, pillBg[tone], style]}>
      <Text style={[styles.pillText, pillFg[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
const pillBg = StyleSheet.create({
  coral: { backgroundColor: colors.primarySoft },
  gray: { backgroundColor: colors.surface },
  solid: { backgroundColor: colors.primary },
});
const pillFg = StyleSheet.create({
  coral: { color: colors.primary },
  gray: { color: colors.textSub },
  solid: { color: colors.onPrimary },
});

/** 입력 위의 이름표. required 면 코랄 * 를 붙인다. hint 는 오른쪽 회색 글자. */
export function FieldLabel({
  label,
  required,
  hint,
  right,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {right ?? (hint ? <Text style={styles.fieldHint}>{hint}</Text> : null)}
    </View>
  );
}

/** 안내 상자: 기호 + 문장 여러 줄 */
export function NoteBox({ lines, tone = 'gray' }: { lines: { icon: string; text: string }[]; tone?: 'gray' | 'coral' }) {
  return (
    <View style={[styles.note, tone === 'coral' && styles.noteCoral]}>
      {lines.map((line) => (
        <View key={line.text} style={styles.noteRow}>
          <Text style={styles.noteIcon}>{line.icon}</Text>
          <Text style={styles.noteText}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** 오류 문구(빨간 글씨 + 다시 시도 등 다음 행동) */
export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/** 체크 동그라미 */
export function CheckCircle({ checked, size = 24 }: { checked: boolean; size?: number }) {
  return (
    <View style={[styles.check, { width: size, height: size, borderRadius: size / 2 }, checked && styles.checkOn]}>
      <Text style={[styles.checkGlyph, { fontSize: size * 0.58 }]}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonLabel: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  buttonIcon: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  required: { color: colors.primary },
  fieldHint: { fontSize: 12, color: colors.textMuted },
  note: { backgroundColor: colors.surface, borderRadius: radius.item, padding: 14, gap: 8 },
  noteCoral: { backgroundColor: colors.primarySoft },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteIcon: { fontSize: 14, lineHeight: 20 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.textSub },
  error: { fontSize: 13, lineHeight: 19, color: colors.danger, fontWeight: '600' },
  check: { backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary },
  checkGlyph: { color: colors.onPrimary, fontWeight: '900' },
});
