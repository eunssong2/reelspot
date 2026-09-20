import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { signInWithKakao } from '@/features/auth/api';
import { isDemo } from '@/lib/env';
import { GUTTER, MIN_TOUCH, colors, palette, spacing, type } from '@/theme/theme';

const KAKAO_YELLOW = '#FEE500';
const KAKAO_PRESSED = '#F0D800';
const KAKAO_LABEL = '#191600';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithKakao();
      // 세션이 생기면 루트 게이트가 여행 목록으로 보낸다.
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Logo size={128} />

        <View>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkReel}>Reel</Text>
            <Text style={styles.wordmarkSpot}>Spot</Text>
          </Text>
          <Text style={styles.tag}>SPOT THE WORLD, IN REELS</Text>
        </View>
        <Text style={styles.tagline}>
          같이 간 여행,{'\n'}각자 찍은 순간을 한곳에.
        </Text>
      </View>

      <View style={styles.bottom}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
          disabled={busy}
          onPress={login}
          style={({ pressed }) => [
            styles.kakao,
            pressed && !busy && styles.kakaoPressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={KAKAO_LABEL} />
          ) : (
            <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
          )}
        </Pressable>

        {isDemo && (
          <Text style={styles.demoNote}>
            지금은 데모 모드입니다. Supabase 자격증명이 없어 목 데이터로 동작하며, 버튼을 누르면
            바로 입장합니다.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: GUTTER,
    justifyContent: 'space-between',
  },
  header: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing(6) },
  wordmark: { fontSize: 46, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  wordmarkReel: { color: palette.ink },
  wordmarkSpot: { color: colors.accent },
  // 로고의 영문 태그라인. 자간을 넓혀 원본 느낌을 살린다.
  tag: {
    ...type.caption,
    color: colors.textMuted,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: spacing(2),
  },
  tagline: {
    ...type.title,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing(2),
  },
  bottom: { gap: spacing(4), paddingBottom: spacing(8) },
  error: { ...type.label, color: colors.danger },
  kakao: {
    backgroundColor: KAKAO_YELLOW,
    borderRadius: 14,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoPressed: { backgroundColor: KAKAO_PRESSED },
  kakaoLabel: { ...type.heading, color: KAKAO_LABEL },
  disabled: { opacity: 0.45 },
  demoNote: { ...type.caption, color: colors.textMuted },
});
