import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { signOut } from '@/features/auth/api';
import { fetchMyProfile } from '@/features/profile/api';
import { GUTTER, MIN_TOUCH, colors, palette, radius, spacing, type } from '@/theme/theme';
import type { Profile } from '@/types/database';

/** "2026년 3월" — 언제부터 릴스팟을 썼는지만 보여주면 충분하다. */
function joinedLabel(createdAt: string) {
  const date = new Date(createdAt);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월부터 함께하고 있어요`;
}

type MenuItem = {
  label: string;
  hint: string;
  onPress: () => void;
};

export default function MyPageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 정보 수정 화면에 다녀오면 바뀐 닉네임을 바로 보여줘야 하니 포커스마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      setLoading(true);
      fetchMyProfile(user.id)
        .then((data) => active && setProfile(data))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [user]),
  );

  const logout = () => {
    Alert.alert('로그아웃', 'AT THAT PLACE에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const menu: MenuItem[] = [
    {
      label: '내 정보 수정',
      hint: '닉네임',
      onPress: () => router.push('/mypage/edit'),
    },
    {
      label: '내 여행',
      hint: '참여 중인 여행 보기',
      onPress: () => router.push('/(tabs)'),
    },
    {
      label: '스팟원 확인',
      hint: '여행별 스팟원 목록',
      onPress: () => router.push('/mypage/members'),
    },
  ];

  if (loading || !profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing(6) + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>마이페이지</Text>

        <Pressable
          onPress={() => router.push('/mypage/edit')}
          style={({ pressed }) => [styles.profileCard, pressed && styles.cardPressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.nickname.slice(0, 1)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            <Text style={styles.joined}>{joinedLabel(profile.created_at)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.menuCard}>
          {menu.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuRow,
                index > 0 && styles.menuDivider,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuHint}>{item.hint}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [styles.logoutRow, pressed && styles.cardPressed]}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, gap: spacing(3) },
  title: { ...type.display, color: colors.text, paddingTop: spacing(4), paddingBottom: spacing(2) },
  cardPressed: { backgroundColor: palette.gray200 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(5),
    marginBottom: spacing(2),
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.title, color: colors.accent },
  profileText: { flex: 1, gap: spacing(1) },
  nickname: { ...type.heading, color: colors.text },
  joined: { ...type.caption, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  menuCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing(5) },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: MIN_TOUCH + 8,
  },
  menuDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  menuText: { flex: 1, gap: spacing(0.5) },
  menuLabel: { ...type.bodyStrong, color: colors.text },
  menuHint: { ...type.caption, color: colors.textMuted },
  logoutRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
    marginTop: spacing(2),
    borderRadius: radius.lg,
  },
  logoutText: { ...type.label, color: colors.textMuted },
});
