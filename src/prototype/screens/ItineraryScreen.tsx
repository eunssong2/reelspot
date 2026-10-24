import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { countMedia, recordsForVisit } from '../../demo/records';
import { AppHeader } from '../components/AppHeader';
import { MemberAvatarStack } from '../components/MemberAvatarStack';
import { TimeEditModal } from '../components/TimeEditModal';
import { PlaceThumb } from '../components/PlaceThumb';
import { ScreenFrame } from '../components/ScreenFrame';
import { TRIPS, membersFor, type Itinerary } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { dayOfWeekLabel, fullDateLabel, monthDayLabel, tripRangeLabel } from '../utils/date';

interface Props {
  nav: Nav;
  tripId: string;
  itinerary: Itinerary;
  /** 진입할 때 열어 둘 날짜(일정 요약 카드에서 들어온 경우). 없으면 첫 날짜. */
  initialDayId: string;
  /** 방금 장소 검색에서 추가한 장소(잠깐 강조 표시) */
  highlightId: string | null;
}

/**
 * 2. 날짜별 장소 구성: 하루 일정이면 날짜 탭 없이 그날의 장소만, 여러 날이면 날짜 탭으로 골라 본다.
 * "사진 보기"는 그 장소의 사진 화면(4)으로, "+ 장소 추가"는 지도 검색(3)으로, "순서 편집"은 순서·시간 편집으로 이동한다.
 */
export function ItineraryScreen({ nav, tripId, itinerary, initialDayId, highlightId }: Props) {
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const members = membersFor(trip);
  const singleDay = itinerary.days.length <= 1;

  const [selectedDayId, setSelectedDayId] = useState(
    itinerary.days.some((d) => d.id === initialDayId) ? initialDayId : itinerary.days[0]?.id,
  );
  const day = itinerary.days.find((d) => d.id === selectedDayId) ?? itinerary.days[0];
  const { updateDay } = usePrototype();
  /** 방문 시간을 고치는 중인 장소 id */
  const [timeTargetId, setTimeTargetId] = useState<string | null>(null);
  const timeTarget = day?.places.find((p) => p.id === timeTargetId);

  return (
    <ScreenFrame>
      <AppHeader
        title={itinerary.name}
        subtitle={tripRangeLabel(itinerary.startDate, itinerary.endDate)}
        onBack={nav.back}
        right={
          <View style={styles.members}>
            <MemberAvatarStack members={members} size={24} max={3} />
            <Text style={styles.count}>{members.length}명</Text>
          </View>
        }
      />

      {!singleDay && (
        <View style={styles.tabs}>
          {itinerary.days.map((d) => {
            const active = d.id === day?.id;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedDayId(d.id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabDay, active && styles.tabTextActive]}>DAY {d.dayNumber}</Text>
                <Text style={[styles.tabDate, active && styles.tabTextActive]}>
                  {monthDayLabel(d.date)} {dayOfWeekLabel(d.date)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {day ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.dateHeading}>{fullDateLabel(day.date)}</Text>
          {day.title ? <Text style={styles.dayTitle}>{day.title}</Text> : null}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>오늘의 장소</Text>
            {day.places.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="방문 순서 편집"
                onPress={() => nav.push({ name: 'placeOrderEdit', tripId, itineraryId: itinerary.id, dayId: day.id })}
                hitSlop={8}
              >
                <Text style={styles.editLink}>☰ 순서 편집</Text>
              </Pressable>
            )}
          </View>

          {day.places.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>가고 싶은 곳을 담아 하루를 채워보세요.</Text>
            </View>
          ) : (
            <Text style={styles.introText}>가고 싶은 곳을 담아 하루를 채워보세요.</Text>
          )}

          {day.places.map((place, index) => {
            const isNew = place.id === highlightId;
            const media = countMedia(recordsForVisit(itinerary.id, day.id, place));
            return (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 사진 보기`}
                onPress={() =>
                  nav.push({ name: 'placeRecords', tripId, itineraryId: itinerary.id, dayId: day.id, placeId: place.id })
                }
                style={({ pressed }) => [styles.placeCard, isNew && styles.placeCardNew, pressed && styles.pressed]}
              >
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{index + 1}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name} 방문 시간 수정`}
                  onPress={() => setTimeTargetId(place.id)}
                  hitSlop={6}
                  style={styles.placeTimeCol}
                >
                  <Text style={place.visitTime ? styles.placeTime : styles.placeTimeMuted}>
                    {place.visitTime ?? '시간 미정'}
                  </Text>
                  <Text style={styles.placeTimeEdit}>✎ 수정</Text>
                </Pressable>

                <PlaceThumb place={place} size={48} />

                <View style={styles.placeInfo}>
                  <View style={styles.placeNameRow}>
                    <Text style={styles.placeCategory}>{place.categoryLabel}</Text>
                    <Text style={styles.placeName} numberOfLines={1}>
                      {place.name}
                    </Text>
                  </View>
                  <Text style={styles.placeSub} numberOfLines={1}>
                    {place.address}
                  </Text>
                  <Text style={media.total > 0 ? styles.photoLink : styles.photoLinkEmpty}>
                    {media.total > 0 ? `사진 ${media.photos}·동영상 ${media.videos} 보기 ›` : '아직 기록 없음 ›'}
                  </Text>
                </View>

                {isNew ? <Text style={styles.newBadge}>추가됨</Text> : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 날의 장소 추가"
            onPress={() => nav.push({ name: 'placeSearch', tripId, itineraryId: itinerary.id, dayId: day.id })}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addText}>＋ 장소 추가</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>이 일정에는 날짜가 없어요.</Text>
        </View>
      )}
      <TimeEditModal
        visible={!!timeTarget}
        placeName={timeTarget?.name ?? ''}
        value={timeTarget?.visitTime}
        onSave={(time) => {
          if (day && timeTargetId) {
            updateDay(itinerary.id, day.id, {
              places: day.places.map((p) => (p.id === timeTargetId ? { ...p, visitTime: time } : p)),
              memo: day.memo ?? '',
            });
          }
          setTimeTargetId(null);
        }}
        onClose={() => setTimeTargetId(null)}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  members: { alignItems: 'flex-end', gap: 2 },
  count: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  tabs: { flexDirection: 'row', paddingHorizontal: GUTTER, gap: 8, paddingBottom: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: radius.item,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary },
  tabDay: { fontSize: 12, fontWeight: '800', color: colors.textSub },
  tabDate: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.onPrimary },
  content: { paddingHorizontal: GUTTER, paddingBottom: 32, gap: 10 },
  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.textSub, marginTop: -4 },
  dateHeading: { fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  editLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  introText: { fontSize: 12, color: colors.textMuted, marginTop: -4, marginBottom: 2 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: shadow.soft,
  },
  placeCardNew: { borderColor: colors.primary },
  orderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: { fontSize: 11, fontWeight: '800', color: colors.onPrimary },
  placeTimeCol: { width: 52 },
  placeTime: { fontSize: 12, fontWeight: '800', color: colors.text },
  placeTimeEdit: { fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 2 },
  placeTimeMuted: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  placeInfo: { flex: 1, gap: 2 },
  placeNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  placeCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  placeName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  placeSub: { fontSize: 12, color: colors.textSub },
  photoLink: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 2 },
  photoLinkEmpty: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  newBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  emptyCard: { backgroundColor: colors.pageBg, borderRadius: radius.card, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSub, textAlign: 'center' },
  addButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.item,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.8 },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
