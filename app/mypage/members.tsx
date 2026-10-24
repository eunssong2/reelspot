import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchMyTrips, type TripSummary } from '@/features/trips/api';
import { GUTTER, MIN_TOUCH, colors, palette, radius, spacing, type } from '@/theme/theme';

/**
 * 스팟원은 여행마다 다르니, 먼저 여행을 고르면 그 여행의 스팟원 화면(여행 상세)으로 보낸다.
 * 목록·역할·정원까지의 자세한 표시는 이미 여행 상세에 있어 여기서 다시 만들지 않는다.
 */
export default function MyPageMembersScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '스팟원 확인',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={trips}
          keyExtractor={(trip) => trip.id}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          ListHeaderComponent={
            <Text style={styles.guide}>여행을 고르면 그 여행의 스팟원을 볼 수 있어요.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/trip/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.destination}</Text>
              </View>
              <Text style={styles.cardCount}>
                {item.member_count}/{item.capacity}명
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{error ?? '아직 참여 중인 여행이 없어요'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: GUTTER, paddingTop: spacing(2), paddingBottom: spacing(8) },
  guide: { ...type.label, color: colors.textMuted, paddingBottom: spacing(3) },
  gap: { height: spacing(3) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH + 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing(5),
  },
  cardPressed: { backgroundColor: palette.gray200 },
  cardText: { gap: spacing(1) },
  cardTitle: { ...type.bodyStrong, color: colors.text },
  cardMeta: { ...type.caption, color: colors.textMuted },
  cardCount: { ...type.label, fontWeight: '700', color: colors.accent },
  empty: { alignItems: 'center', paddingTop: spacing(16) },
  emptyText: { ...type.body, color: colors.textMuted },
});
