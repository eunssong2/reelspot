import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  MAX_MEMBERS,
  fetchMembers,
  fetchTrip,
  leaveTrip,
  type TripMemberRow,
  type TripSummary,
} from '@/features/trips/api';
import { MIN_TOUCH, colors, font, radius, spacing } from '@/theme/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [members, setMembers] = useState<TripMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: trip.title,
          headerTitleStyle: { fontSize: font.heading, fontWeight: '700' },
        }}
      />

      <View>
        <Text style={styles.title}>{trip.title}</Text>
        <Text style={styles.meta}>
          {trip.destination} · {trip.start_date} ~ {trip.end_date}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          스팟원 {members.length} / {MAX_MEMBERS}명
        </Text>

        {members.map((member) => (
          <View key={member.user_id} style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(member.profile?.nickname ?? '?').slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.memberName}>{member.profile?.nickname ?? '알 수 없음'}</Text>
            {member.role === 'owner' && <Text style={styles.ownerBadge}>방장</Text>}
            {member.user_id === user?.id && <Text style={styles.meBadge}>나</Text>}
          </View>
        ))}

        {Array.from({ length: openSlots }).map((_, index) => (
          <View key={`empty-${index}`} style={styles.memberRow}>
            <View style={[styles.avatar, styles.avatarEmpty]} />
            <Text style={styles.emptySlot}>비어 있음</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>초대 코드</Text>
        <Text style={styles.code}>{trip.invite_code}</Text>
        <Text style={styles.codeGuide}>
          {openSlots > 0
            ? `이 코드를 친구에게 보내면 스팟원으로 참여합니다. ${openSlots}자리 남았습니다.`
            : '스팟원 5명이 모두 찼습니다.'}
        </Text>

        <Pressable
          style={[styles.primary, openSlots === 0 && styles.disabled]}
          onPress={share}
          disabled={openSlots === 0}
        >
          <Text style={styles.primaryText}>초대 코드 보내기</Text>
        </Pressable>
      </View>

      {!isOwner && (
        <Pressable style={styles.leave} onPress={leave}>
          <Text style={styles.leaveText}>여행 나가기</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(7), paddingBottom: spacing(12) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: font.body },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: font.body, marginTop: spacing(2) },
  section: { gap: spacing(3) },
  sectionTitle: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: MIN_TOUCH },
  avatar: {
    width: 44,
    height: 44,
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
  avatarText: { color: colors.accent, fontSize: font.heading, fontWeight: '700' },
  memberName: { color: colors.text, fontSize: font.body, fontWeight: '600', flex: 1 },
  ownerBadge: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  meBadge: { color: colors.textMuted, fontSize: font.label, fontWeight: '600' },
  emptySlot: { color: colors.textMuted, fontSize: font.body },
  code: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing(5),
  },
  codeGuide: { color: colors.textMuted, fontSize: font.body, lineHeight: 26 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: font.heading, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  leave: { alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  leaveText: { color: colors.danger, fontSize: font.body, fontWeight: '600' },
});
