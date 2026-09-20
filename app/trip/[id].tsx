import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  MAX_MEMBERS,
  fetchMembers,
  fetchTrip,
  leaveTrip,
  type TripMemberRow,
  type TripSummary,
} from '@/features/trips/api';
import { GUTTER, MIN_TOUCH, colors, radius, spacing, type } from '@/theme/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [members, setMembers] = useState<TripMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([fetchTrip(id), fetchMembers(id)])
      .then(([tripData, memberData]) => {
        if (!active) return;
        setTrip(tripData);
        setMembers(memberData);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : '여행을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const share = useCallback(async () => {
    if (!trip) return;
    await Share.share({
      message: `[릴스팟] "${trip.title}" 여행에 스팟원으로 초대합니다.\n초대 코드: ${trip.invite_code}`,
    });
  }, [trip]);

  const copy = useCallback(async () => {
    if (!trip) return;
    await Clipboard.setStringAsync(trip.invite_code);
    setCopied(true);
    // 별도 토스트 없이 라벨만 잠깐 바꿔 알린다.
    setTimeout(() => setCopied(false), 1500);
  }, [trip]);

  const leave = useCallback(() => {
    if (!trip || !user) return;

    Alert.alert('여행 나가기', `"${trip.title}"에서 나가시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveTrip(trip.id, user.id);
            router.replace('/(tabs)');
          } catch (e) {
            Alert.alert('나가기 실패', e instanceof Error ? e.message : '다시 시도해 주세요.');
          }
        },
      },
    ]);
  }, [trip, user, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? '존재하지 않는 여행입니다.'}</Text>
      </View>
    );
  }

  const isOwner = trip.owner_id === user?.id;
  const openSlots = MAX_MEMBERS - members.length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.headline}>{trip.title}</Text>
          <Text style={styles.sub}>
            {trip.destination} · {trip.start_date} ~ {trip.end_date}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            스팟원 {members.length}/{MAX_MEMBERS}
          </Text>

          <View style={styles.memberCard}>
            {members.map((member, index) => (
              <View
                key={member.user_id}
                style={[styles.memberRow, index > 0 && styles.memberDivider]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(member.profile?.nickname ?? '?').slice(0, 1)}
                  </Text>
                </View>
                <Text style={styles.memberName}>{member.profile?.nickname ?? '알 수 없음'}</Text>
                {member.user_id === user?.id && <Text style={styles.meBadge}>나</Text>}
                {member.role === 'owner' && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>방장</Text>
                  </View>
                )}
              </View>
            ))}

            {Array.from({ length: openSlots }).map((_, index) => (
              <View
                key={`empty-${index}`}
                style={[styles.memberRow, styles.memberDivider]}
              >
                <View style={[styles.avatar, styles.avatarEmpty]} />
                <Text style={styles.emptySlot}>비어 있음</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>초대 코드</Text>

          <Pressable
            onPress={copy}
            style={({ pressed }) => [styles.codeBox, pressed && styles.codeBoxPressed]}
          >
            <Text style={styles.code}>{trip.invite_code}</Text>
            <Text style={styles.copyHint}>{copied ? '복사했어요' : '눌러서 복사'}</Text>
          </Pressable>

          <Text style={styles.codeGuide}>
            {openSlots > 0
              ? `이 코드를 친구에게 보내면 스팟원으로 참여해요. ${openSlots}자리 남았어요.`
              : '스팟원 5명이 모두 찼어요.'}
          </Text>
        </View>

        {!isOwner && (
          <Pressable onPress={leave} style={styles.leave}>
            <Text style={styles.leaveText}>여행 나가기</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing(4) + insets.bottom }]}>
        <Button label="초대 코드 보내기" onPress={share} disabled={openSlots === 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { ...type.body, color: colors.textMuted },
  // 하단 고정 버튼에 마지막 내용이 가리지 않도록 넉넉히 비운다.
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing(24), gap: spacing(8) },
  intro: { gap: spacing(2) },
  headline: { ...type.display, color: colors.text },
  sub: { ...type.label, color: colors.textBody },
  section: { gap: spacing(3) },
  sectionTitle: { ...type.heading, color: colors.text },
  memberCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing(4) },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    minHeight: MIN_TOUCH + 4,
  },
  memberDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmpty: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  avatarText: { ...type.bodyStrong, color: colors.accent },
  memberName: { ...type.bodyStrong, color: colors.text, flex: 1 },
  meBadge: { ...type.caption, color: colors.textMuted },
  ownerBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  ownerBadgeText: { ...type.caption, fontWeight: '700', color: colors.accent },
  emptySlot: { ...type.body, color: colors.textMuted, flex: 1 },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing(5),
    alignItems: 'center',
    gap: spacing(1),
  },
  codeBoxPressed: { backgroundColor: colors.accentSoft },
  code: { fontSize: 36, fontWeight: '700', letterSpacing: 10, color: colors.text, paddingLeft: 10 },
  copyHint: { ...type.caption, color: colors.textMuted },
  codeGuide: { ...type.label, color: colors.textBody },
  leave: { alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  leaveText: { ...type.label, color: colors.danger },
  footer: { paddingHorizontal: GUTTER, paddingTop: spacing(3) },
});
