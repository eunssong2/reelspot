import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { signOut } from '@/features/auth/api';
import { LayoutPreview } from '@/components/LayoutPreview';
import { fetchMyTrips, type TripSummary } from '@/features/trips/api';
import { formatRangeShort } from '@/features/trips/dates';
import { findLayout } from '@/features/trips/layouts';
import { GUTTER, colors, palette, radius, spacing, type } from '@/theme/theme';

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={trips}
        keyExtractor={(trip) => trip.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>내 여행</Text>
            <Pressable onPress={() => void signOut()} hitSlop={spacing(3)}>
              <Text style={styles.logout}>로그아웃</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/trip/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardBody}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.destination} · {formatRangeShort(item.start_date, item.end_date)}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    스팟원 {item.member_count}/{item.capacity}
                  </Text>
                </View>
              </View>

              <LayoutPreview layout={findLayout(item.layout)} width={52} numbered={false} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{error ?? '아직 여행이 없어요'}</Text>
            {!error && (
              <Text style={styles.emptyBody}>
                여행을 만들고 스팟원을 부르면{'\n'}각자 찍은 사진을 한곳에 모을 수 있어요.
              </Text>
            )}
          </View>
        }
      />

      <View style={[styles.actions, { paddingBottom: spacing(4) + insets.bottom }]}>
        <Button label="여행 만들기" onPress={() => router.push('/trip/new')} />
        <Button label="UI 프로토타입(임시)" variant="secondary" onPress={() => router.push('/prototype')} />
        <Button
          label="초대 코드로 참여"
          variant="secondary"
          onPress={() => router.push('/trip/join')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing(6), gap: spacing(3) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing(4),
    paddingBottom: spacing(4),
  },
  title: { ...type.display, color: colors.text },
  logout: { ...type.label, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(5),
    gap: spacing(2),
  },
  cardPressed: { backgroundColor: palette.gray200 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  cardText: { flex: 1, gap: spacing(2) },
  cardTitle: { ...type.heading, color: colors.text },
  cardMeta: { ...type.label, color: colors.textBody },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginTop: spacing(1),
  },
  badgeText: { ...type.caption, fontWeight: '700', color: colors.accent },
  empty: { alignItems: 'center', paddingTop: spacing(20), gap: spacing(3) },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: { ...type.label, color: colors.textMuted, textAlign: 'center' },
  actions: { paddingHorizontal: GUTTER, paddingTop: spacing(3), gap: spacing(2) },
});
