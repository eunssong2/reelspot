import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/features/auth/api';
import { MAX_MEMBERS, fetchMyTrips, type TripSummary } from '@/features/trips/api';
import { MIN_TOUCH, colors, font, radius, spacing } from '@/theme/theme';

function formatRange(start: string, end: string) {
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  return `${Number(sm)}월 ${Number(sd)}일 – ${Number(em)}월 ${Number(ed)}일`;
}

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 방을 만들거나 참여하고 돌아올 수 있으니 포커스마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchMyTrips()
        .then((data) => active && setTrips(data))
        .catch(
          (e: unknown) =>
            active && setError(e instanceof Error ? e.message : '여행을 불러오지 못했습니다.'),
        )
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={trips}
        keyExtractor={(trip) => trip.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>내 여행</Text>
            <Pressable onPress={() => void signOut()} hitSlop={spacing(3)}>
              <Text style={styles.logout}>로그아웃</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/trip/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.destination} · {formatRange(item.start_date, item.end_date)}
            </Text>
            <Text style={styles.cardMembers}>
              스팟원 {item.member_count} / {MAX_MEMBERS}명
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error ?? '아직 여행이 없습니다.\n아래에서 여행을 만들고 스팟원을 불러 보세요.'}
          </Text>
        }
      />

      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={() => router.push('/trip/new')}>
          <Text style={styles.primaryText}>여행 만들기</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/trip/join')}>
          <Text style={styles.secondaryText}>초대 코드로 참여</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3), paddingBottom: spacing(10) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  logout: { color: colors.textMuted, fontSize: font.label, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(5),
    gap: spacing(1.5),
  },
  cardTitle: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: font.body },
  cardMembers: { color: colors.accent, fontSize: font.label, fontWeight: '700' },
  empty: {
    color: colors.textMuted,
    fontSize: font.body,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: spacing(12),
  },
  actions: {
    padding: spacing(5),
    gap: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: font.heading, fontWeight: '700' },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: font.heading, fontWeight: '600' },
});
