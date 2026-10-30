import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router, usePathname, useLocalSearchParams } from 'expo-router';
import { currentSession, PendingOperationError } from '../lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';
const scrollPositions = new Map<string, number>();
export const colors = {
  bg: '#FFFFFF',
  paper: '#FFFFFF',
  ink: '#191F28',
  muted: '#8B95A1',
  accent: '#F1706B',
  line: '#E5E8EB',
  sage: '#FDEDEB',
};
export function Screen({
  title,
  subtitle,
  children,
  back = true,
  scrollKey,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  scrollKey?: string;
}) {
  const pathname = usePathname(),
    params = useLocalSearchParams();
  const key = `${currentSession()?.userId ?? 'guest'}:${scrollKey ?? pathname + ':' + JSON.stringify(params)}`;
  const scroll = useRef<ScrollView>(null),
    restored = useRef(false);
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.screen}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={(e) => {
          scrollPositions.set(key, e.nativeEvent.contentOffset.y);
          if (scrollPositions.size > 100)
            scrollPositions.delete(scrollPositions.keys().next().value!);
        }}
        onContentSizeChange={(_, height) => {
          const y = scrollPositions.get(key) ?? 0;
          if (!restored.current && height > y) {
            restored.current = true;
            scroll.current?.scrollTo({ y, animated: false });
          }
        }}
      >
        {back && (
          <Pressable
            accessibilityLabel="이전 화면"
            android_ripple={{ color: '#F1706B20' }}
            style={({ pressed }) => [s.back, pressed && s.pressed]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          >
            <Text style={s.link}>‹ 돌아가기</Text>
          </Pressable>
        )}
        <Text style={s.brand}>At that place</Text>
        <Text style={s.h1}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  tone,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  tone?: 'kakao';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: secondary ? '#191F2826' : '#FFFFFF40' }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        tone === 'kakao' && { backgroundColor: '#FEE500' },
        pressed && s.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, (secondary || tone === 'kakao') && { color: colors.ink }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  onPress,
  onLongPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={onPress || onLongPress ? { color: '#F1706B20' } : undefined}
      style={({ pressed }) => [s.card, style, pressed && s.pressed]}
    >
      {children}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 17 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9A9D93"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export const H = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.h2}>{children}</Text>
);
export const P = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.p}>{children}</Text>
);
export const Badge = ({ children }: { children: React.ReactNode }) => (
  <View style={s.badge}>
    <Text style={s.badgeText}>{children}</Text>
  </View>
);
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [hasRun, setHasRun] = useState(false),
    [operationId, setOperationId] = useState<string | null>(null),
    [errorCode, setErrorCode] = useState('');
  const running = useRef(0),
    retry = useRef<(() => Promise<void>) | null>(null);
  async function run(fn: () => Promise<void>) {
    running.current++;
    setBusy(true);
    setError('');
    setOperationId(null);
    setErrorCode('');
    retry.current = fn;
    try {
      await fn();
      return true;
    } catch (e) {
      if (e instanceof PendingOperationError) setOperationId(e.operationId);
      const issue = e as Error & { requestId?: string; code?: string };
      setErrorCode(issue.code ?? '');
      setError(
        `${issue.message || '처리에 실패했습니다. 다시 시도해 주세요.'}${issue.requestId ? `\n문의 번호: ${issue.requestId}` : ''}`,
      );
      return false;
    } finally {
      running.current--;
      setBusy(running.current > 0);
      setHasRun(true);
    }
  }
  return {
    busy,
    run,
    error,
    errorCode,
    hasRun,
    errorView: error ? (
      <View>
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
        {errorCode === 'CONSENT_REQUIRED' ? (
          <Button secondary onPress={() => router.push('/consents')}>
            최신 동의 확인
          </Button>
        ) : operationId ? (
          <Button
            secondary
            onPress={() => router.push({ pathname: '/operations', params: { id: operationId } })}
          >
            처리 상태 확인
          </Button>
        ) : (
          <Button
            secondary
            disabled={busy}
            onPress={() => {
              if (retry.current) void run(retry.current);
            }}
          >
            다시 시도
          </Button>
        )}
      </View>
    ) : busy ? (
      <ActivityIndicator color={colors.accent} />
    ) : null,
  };
}
export function confirm(title: string, message: string, action: () => void) {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '확인', style: 'destructive', onPress: action },
  ]);
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: 20, paddingBottom: 48 },
  back: { minHeight: 48, justifyContent: 'center' },
  brand: {
    fontWeight: '800',
    color: colors.accent,
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 16,
  },
  h1: { fontSize: 30, fontWeight: '700', color: colors.ink, letterSpacing: -1, marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 24, color: colors.muted, marginBottom: 22 },
  h2: { fontSize: 19, fontWeight: '600', color: colors.ink, marginVertical: 8 },
  p: { fontSize: 15, lineHeight: 24, color: colors.muted, marginVertical: 5 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 56,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 7,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondary: { backgroundColor: '#F2F4F6' },
  card: {
    backgroundColor: colors.paper,
    padding: 18,
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: colors.line,
    borderWidth: 1,
    marginVertical: 7,
  },
  pressed: { opacity: 0.72 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 9 },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 52,
    color: colors.ink,
  },
  badge: {
    backgroundColor: colors.sage,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 7,
  },
  badgeText: { color: '#B8433F', fontSize: 12 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '500' },
  error: {
    color: '#A43D32',
    backgroundColor: '#F5E4DF',
    padding: 15,
    lineHeight: 22,
    borderRadius: 10,
    marginVertical: 10,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
});
