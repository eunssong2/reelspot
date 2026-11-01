import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
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
const FooterContext = createContext<((content: React.ReactNode) => void) | null>(null);
export function ScreenFooter({ children }: { children: React.ReactNode }) {
  const setFooter = useContext(FooterContext);
  useEffect(() => {
    setFooter?.(children);
    return () => setFooter?.(null);
  }, [children, setFooter]);
  return setFooter ? null : children;
}
const scrollPositions = new Map<string, number>();
export const colors = {
  bg: '#FFFFFF',
  paper: '#FFFFFF',
  ink: '#191F28',
  muted: '#8B95A1',
  accent: '#F1706B',
  line: '#E5E8EB',
  sage: '#FDEDEB',
  surface: '#F2F4F6',
  sub: '#6B7684',
};
export function Screen({
  title,
  subtitle,
  children,
  back = true,
  scrollKey,
  footer,
  compact = false,
  tabs = false,
  headerRight,
  contentStyle,
  heading = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  scrollKey?: string;
  footer?: React.ReactNode;
  compact?: boolean;
  tabs?: boolean;
  headerRight?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  heading?: boolean;
}) {
  const [childFooter, setChildFooter] = useState<React.ReactNode>(null);
  const subtitleInBody = !!subtitle && subtitle.length > 35;
  const pathname = usePathname(),
    params = useLocalSearchParams();
  const key = `${currentSession()?.userId ?? 'guest'}:${scrollKey ?? pathname + ':' + JSON.stringify(params)}`;
  const scroll = useRef<ScrollView>(null),
    restored = useRef(false);
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {(!!title || back || headerRight) && (
          <View style={s.header}>
            <View style={s.headerSide}>
              {back && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="이전 화면"
                  hitSlop={4}
                  style={s.headerButton}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                >
                  <Text style={{ fontSize: 30, color: colors.ink, lineHeight: 34 }}>‹</Text>
                </Pressable>
              )}
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {!heading && (
                <Text numberOfLines={1} style={s.headerTitle}>
                  {title}
                </Text>
              )}
              {!heading && !!subtitle && !subtitleInBody && (
                <Text numberOfLines={1} style={s.headerSubtitle}>
                  {subtitle}
                </Text>
              )}
            </View>
            <View style={[s.headerSide, { alignItems: 'flex-end' }]}>{headerRight}</View>
          </View>
        )}
        <FooterContext.Provider value={setChildFooter}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={[s.screen, contentStyle]}
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
            {heading && (
              <>
                <Text style={s.h1}>{title}</Text>
                {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
              </>
            )}
            {!heading && subtitleInBody && <P>{subtitle}</P>}
            {children}
          </ScrollView>
        </FooterContext.Provider>
        {(childFooter || footer) && <View style={s.footer}>{childFooter || footer}</View>}
        {tabs && <BottomTabs />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function BottomTabs() {
  const path = usePathname();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line }}>
      {(
        [
          ['/', '모임', '👥'],
          ['/mine', '내 기록', '▣'],
          ['/my-page', '마이페이지', '●'],
        ] as const
      ).map(([href, label, icon]) => (
        <Pressable
          key={href}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: path === href }}
          onPress={() => router.replace(href)}
          style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}
        >
          {href === '/my-page' ? (
            <View
              style={{ width: 24, height: 26, alignItems: 'center', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: path === href ? colors.accent : colors.muted,
                  marginBottom: 2,
                }}
              />
              <View
                style={{
                  width: 19,
                  height: 11,
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  backgroundColor: path === href ? colors.accent : colors.muted,
                }}
              />
            </View>
          ) : (
            <Text style={{ fontSize: 23, color: path === href ? colors.accent : colors.muted }}>
              {icon}
            </Text>
          )}
          <Text style={{ fontSize: 12, color: path === href ? colors.accent : colors.muted }}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  tone,
  small = false,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  tone?: 'kakao' | 'dark' | 'outline' | 'danger';
  small?: boolean;
  style?: StyleProp<ViewStyle>;
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
        tone === 'dark' && { backgroundColor: colors.ink },
        tone === 'danger' && { backgroundColor: '#B8433F' },
        tone === 'outline' && { backgroundColor: 'white', borderWidth: 1, borderColor: '#F9C9C6' },
        small && { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 0 },
        style,
        pressed && s.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          (secondary || tone === 'kakao') && { color: colors.ink },
          tone === 'outline' && { color: colors.accent },
          small && { fontSize: 13 },
        ]}
      >
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
export function Field({
  label,
  hint,
  required,
  limit,
  helper,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  required?: boolean;
  limit?: number;
  helper?: string;
}) {
  const count = [
    ...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(props.value ?? ''),
  ].length;
  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 9,
        }}
      >
        <Text style={s.label}>
          {label}
          {required && <Text style={{ color: colors.accent }}> *</Text>}
        </Text>
        {!!hint && <Text style={{ fontSize: 11, color: colors.muted }}>{hint}</Text>}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {(helper || limit) && (
        <View style={{ flexDirection: 'row', marginTop: 6, gap: 8 }}>
          <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }}>{helper}</Text>
          {!!limit && (
            <Text style={{ fontSize: 11, color: count > limit ? '#B8433F' : colors.muted }}>
              {count}/{limit}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
export function TextButton({
  children,
  onPress,
  disabled = false,
  color = colors.accent,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 8,
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{children}</Text>
    </Pressable>
  );
}
export function Chip({
  children,
  selected = false,
  onPress,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.accent : colors.surface,
        borderRadius: 20,
        paddingHorizontal: 14,
        minHeight: 36,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 12, color: selected ? 'white' : colors.sub, fontWeight: '600' }}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Info({
  children,
  icon = 'ℹ️',
  title,
}: {
  children: React.ReactNode;
  icon?: string;
  title?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginVertical: 8,
        flexDirection: 'row',
        gap: 10,
      }}
    >
      {!!icon && <Text style={{ fontSize: title ? 22 : 14, marginTop: 2 }}>{icon}</Text>}
      <View style={{ flex: 1 }}>
        {!!title && (
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
            {title}
          </Text>
        )}
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.sub }}>{children}</Text>
      </View>
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <SafeAreaView
          edges={['bottom']}
          style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D1D6DB',
              marginTop: 10,
            }}
          />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <Text style={[s.h2, { marginBottom: 20 }]}>{title}</Text>
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
export function useAction({ inlineRetry = true }: { inlineRetry?: boolean } = {}) {
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
    operationId,
    errorView: error ? (
      <View>
        <Text
          accessibilityRole="alert"
          style={[s.error, operationId && { backgroundColor: colors.surface, color: colors.sub }]}
        >
          {error}
        </Text>
        {errorCode === 'CONSENT_REQUIRED' ? (
          <Button secondary onPress={() => router.push('/consents')}>
            최신 동의 확인
          </Button>
        ) : !inlineRetry ? null : operationId ? (
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
  screen: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headerSide: { width: 44 },
  headerButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 11, color: colors.muted, marginTop: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.bg },
  back: { minHeight: 48, justifyContent: 'center' },
  brand: {
    fontWeight: '800',
    color: colors.accent,
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 16,
  },
  h1: { fontSize: 24, fontWeight: '700', color: colors.ink, letterSpacing: -1, marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 24, color: colors.muted, marginBottom: 22 },
  h2: { fontSize: 18, fontWeight: '600', color: colors.ink, marginVertical: 8 },
  p: { fontSize: 13, lineHeight: 20, color: colors.muted, marginVertical: 5 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
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
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: colors.line,
    borderWidth: 1,
    marginVertical: 7,
  },
  pressed: { opacity: 0.72 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderRadius: 14,
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
    fontSize: 13,
    lineHeight: 20,
    borderRadius: 14,
    marginVertical: 10,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
});
