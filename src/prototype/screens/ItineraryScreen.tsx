import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PlaceThumb } from '../components/PlaceThumb';
import { ScreenFrame } from '../components/ScreenFrame';
import { MEMBER_AVATARS, TRIPS, type TripDay } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';

interface Props {
  nav: Nav;
  tripId: string;
  days: TripDay[];
  /** 방금 장소 검색에서 추가한 장소(잠깐 강조 표시) */
  highlightId: string | null;
}

/**
 * 2. 여행 일정: Day 별 장소 카드와 + 추가 버튼.
 * + 추가는 장소 검색으로, 장소 카드는 그 장소의 사진·동영상 올리기로 이동한다.
 */
export function ItineraryScreen({ nav, tripId, days, highlightId }: Props) {
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];

  return (
    <ScreenFrame>
      <AppHeader
        title={trip.name}
        subtitle={trip.subtitle}
        onBack={nav.back}
        right={
          <View style={styles.members}>
            <View style={styles.avatars}>
              {MEMBER_AVATARS.map((emoji, i) => (
                <View key={i} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -8 }]}>
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.count}>{trip.memberCount}명</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>일정</Text>

        {days.map((day, dayIndex) => (
          <View key={day.day} style={styles.dayCard}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>Day {day.day}</Text>
              <Text style={styles.dayDate}>{day.dateLabel}</Text>
            </View>

            {day.places.map((place) => {
              const isNew = place.id === highlightId;
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name} 사진·동영상 올리기`}
                  onPress={() => nav.push({ name: 'mediaSettings', placeName: place.name })}
                  style={({ pressed }) => [styles.placeCard, isNew && styles.placeCardNew, pressed && styles.pressed]}
                >
                  <PlaceThumb place={place} size={48} />
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeSub} numberOfLines={1}>
                      {place.categoryLabel} · {place.address}
                    </Text>
                  </View>
                  {isNew ? <Text style={styles.newBadge}>추가됨</Text> : null}
                  <Text style={styles.handle} accessibilityElementsHidden>
                    ⋮⋮
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Day ${day.day} 장소 추가`}
              onPress={() => nav.push({ name: 'placeSearch', tripId, dayIndex })}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Text style={styles.addText}>+ 추가</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  members: { alignItems: 'flex-end', gap: 2 },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 13 },
  count: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  content: { paddingHorizontal: GUTTER, paddingBottom: 32, gap: 14 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 12,
    gap: 10,
  },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
  dayTitle: { fontSize: 16, fontWeight: '800', color: colors.primary },
  dayDate: { fontSize: 13, color: colors.textSub },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: shadow.soft,
  },
  placeCardNew: { borderColor: colors.primary },
  placeInfo: { flex: 1, gap: 2 },
  placeName: { fontSize: 15, fontWeight: '700', color: colors.text },
  placeSub: { fontSize: 12, color: colors.textSub },
  newBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  handle: { fontSize: 16, color: colors.textMuted, letterSpacing: -3, paddingHorizontal: 4 },
  addButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.item,
    paddingVertical: 13,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
