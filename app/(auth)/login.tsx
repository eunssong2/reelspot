import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { signInWithKakao } from '@/features/auth/api';
import { isDemo } from '@/lib/env';
import { MIN_TOUCH, colors, font, radius, spacing } from '@/theme/theme';

const KAKAO_YELLOW = '#FEE500';
const KAKAO_LABEL = '#191600';

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithKakao();
      // 세션이 생기면 루트 게이트가 여행 방 목록으로 보낸다.
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>릴스팟</Text>
        <Text style={styles.tagline}>
          같이 간 여행,{'\n'}각자 찍은 순간을 한곳에.
        </Text>
      </View>

      <View style={styles.bottom}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.kakao, busy && styles.disabled]}
          onPress={login}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="카카오로 시작하기"
        >
          {busy ? (
            <ActivityIndicator color={KAKAO_LABEL} />
          ) : (
            <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
          )}
        </Pressable>

        {isDemo && (
          <Text style={styles.demoNote}>
            지금은 데모 모드입니다. Supabase 자격증명이 없어 목 데이터로 동작하며,
            버튼을 누르면 바로 입장합니다.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(6), justifyContent: 'space-between' },
  header: { flex: 1, justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 44, fontWeight: '800', letterSpacing: -1.5 },
  tagline: { color: colors.textMuted, fontSize: font.heading, lineHeight: 34, marginTop: spacing(4) },
  bottom: { gap: spacing(4), paddingBottom: spacing(6) },
  error: { color: colors.danger, fontSize: font.body, lineHeight: 24 },
  kakao: {
    backgroundColor: KAKAO_YELLOW,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoLabel: { color: KAKAO_LABEL, fontSize: font.heading, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  demoNote: { color: colors.textMuted, fontSize: font.label, lineHeight: 22 },
});
