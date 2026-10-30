import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Logo } from '@/components/Logo';

import { ScreenFrame } from '../components/ScreenFrame';
import { Toast, useToast } from '../components/Toast';
import type { Nav } from '../navigation/routes';
import { useGroups, type Provider } from '../state/GroupsProvider';
import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';

const KAKAO_YELLOW = '#FEE500';

const PROVIDER_NAME: Record<Provider, string> = { kakao: '카카오', google: 'Google' };

function loginErrorText(error: string, provider: Provider): string {
  if (error === 'OFFLINE') return '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.';
  if (error === 'PROVIDER_UNAVAILABLE')
    return `${PROVIDER_NAME[provider]} 로그인이 잠시 원활하지 않아요. 잠시 후 다시 시도하거나 다른 방법으로 시작해 주세요.`;
  return '로그인하지 못했어요. 다시 시도해 주세요.';
}
const KAKAO_LABEL = '#191600';

/**
 * UI01 시작과 로그인. 디자인: docs/stitch/UI01_시작과_로그인.html
 * 로그인 결과: 신규 → UI02, 기존 + 보류 초대 → UI24, 기존 → 내 모임(UI03).
 */
export function LoginScreen({ nav }: { nav: Nav }) {
  const { login, pendingInvite } = useGroups();
  const toast = useToast();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    try {
      const result = await login(provider);
      if (!result.ok) {
        // 인증 창을 닫은 경우는 안내 없이 원래 상태로 둔다. 보류 초대는 그대로 유지한다.
        if (result.error !== 'AUTH_CANCELLED') setError(loginErrorText(result.error, provider));
        return;
      }
      if (result.onboardingRequired) nav.push({ name: 'onboarding' });
      else if (pendingInvite) nav.push({ name: 'inviteJoin' });
      // 기존 사용자 + 보류 초대 없음: 입구(/prototype)가 세션을 보고 내 모임으로 바뀐다.
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.brand}>
          <View style={styles.logoRing}>
            <Logo size={76} />
          </View>
          <Text style={styles.wordmark}>
            <Text style={styles.wordAt}>AT THAT </Text>
            <Text style={styles.wordPlace}>PLACE</Text>
          </Text>
          <Text style={styles.tag}>SHARED MEMORY SPACE</Text>

          <Text style={styles.lead}>함께한 순간을{'\n'}한곳에 모아요</Text>
          <Text style={styles.hint}>모임의 일정별로 사진과 영상을 함께 보관해요.</Text>

          {pendingInvite ? (
            <View style={styles.inviteBanner}>
              <View style={styles.inviteIcon}>
                <Text style={styles.inviteGlyph}>✉️</Text>
              </View>
              <Text style={styles.inviteText}>초대받은 모임에 참여하려면 로그인해 주세요.</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카카오로 시작하기"
            disabled={busy !== null}
            onPress={() => start('kakao')}
            style={({ pressed }) => [
              styles.social,
              styles.kakao,
              pressed && styles.pressed,
              busy && busy !== 'kakao' && styles.dim,
            ]}
          >
            <View style={styles.socialIcon}>
              <Svg width={22} height={20} viewBox="0 0 22 20">
                <Path
                  fill="#000"
                  d="M11 0C4.925 0 0 3.86 0 8.623C0 11.605 1.954 14.225 4.939 15.688L3.935 19.385C3.843 19.721 4.223 19.988 4.516 19.794L8.91 16.883C9.59 16.974 10.287 17.022 11 17.022C17.075 17.022 22 13.162 22 8.623C22 3.86 17.075 0 11 0Z"
                />
              </Svg>
            </View>
            {busy === 'kakao' ? (
              <ActivityIndicator color={KAKAO_LABEL} />
            ) : (
              <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Google로 시작하기"
            disabled={busy !== null}
            onPress={() => start('google')}
            style={({ pressed }) => [
              styles.social,
              styles.google,
              pressed && styles.pressed,
              busy && busy !== 'google' && styles.dim,
            ]}
          >
            <View style={styles.socialIcon}>
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <Path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
                />
                <Path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27 0-.78.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 10.02 0 12c0 1.98.45 3.84 1.25 5.42l4.03-3.15Z"
                />
                <Path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </Svg>
            </View>
            {busy === 'google' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.googleLabel}>Google로 시작하기</Text>
            )}
          </Pressable>

          {/* 동의는 UI02 에서 항목별로 받는다. 로그인만으로 동의한 것으로 보지 않으므로 링크만 둔다. */}
          <View style={styles.links}>
            <Pressable
              onPress={() => toast.show('이용약관 문서는 운영 문서 확정 후 들어가요')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={styles.link}>이용약관</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable
              onPress={() => toast.show('개인정보처리방침은 운영 문서 확정 후 들어가요')}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={styles.link}>개인정보처리방침</Text>
            </Pressable>
          </View>

          {/* 프로토타입 전용: 초대 링크를 받은 사람의 흐름을 보기 위한 입구 */}
          {!pendingInvite ? (
            <Pressable
              onPress={() => nav.push({ name: 'inviteJoin', code: 'Q7KM2P8R' })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.demoLink, pressed && styles.pressed]}
            >
              <Text style={styles.demoLinkText}>예시: 받은 초대 링크로 열어 보기 ›</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <Toast message={toast.message} bottom={40} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 28 },
  brand: { alignItems: 'center', paddingTop: 44 },
  logoRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  wordmark: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  wordAt: { color: colors.ink },
  wordPlace: { color: colors.primary },
  tag: { fontSize: 11, fontWeight: '700', letterSpacing: 2.5, color: colors.primary, marginTop: 4 },
  lead: {
    fontSize: 26,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
    textAlign: 'center',
    marginTop: 28,
  },
  hint: { fontSize: 15, lineHeight: 22, color: colors.textSub, textAlign: 'center', marginTop: 10 },
  inviteBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.item,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 28,
  },
  inviteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteGlyph: { fontSize: 16 },
  inviteText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  actions: { gap: 12, marginTop: 40 },
  errorBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FDE7E9',
    borderRadius: radius.item - 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
  },
  errorIcon: { fontSize: 14, lineHeight: 20 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.danger },
  social: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  socialIcon: { position: 'absolute', left: 20 },
  kakao: { backgroundColor: KAKAO_YELLOW },
  kakaoLabel: { fontSize: 16, fontWeight: '600', color: KAKAO_LABEL },
  google: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  googleLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.5 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  link: { fontSize: 13, color: colors.textSub, textDecorationLine: 'underline' },
  linkDot: { fontSize: 13, color: colors.textMuted },
  demoLink: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginTop: 6,
  },
  demoLinkText: { fontSize: 12, fontWeight: '600', color: colors.textSub },
});
