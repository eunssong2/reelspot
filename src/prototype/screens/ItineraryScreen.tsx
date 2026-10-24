import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { countMedia, recordsForVisit } from '../../demo/records';
import { AppHeader } from '../components/AppHeader';
import { TimeEditModal } from '../components/TimeEditModal';
import { ScreenFrame } from '../components/ScreenFrame';
import type { Itinerary } from '../mock/tripData';
import type { Nav } from '../navigation/routes';
import { usePrototype } from '../state/PrototypeProvider';
import { colors, GUTTER, radius } from '../styles/tokens';
import { dayOfWeekLabel, monthDayLabel, tripRangeLabel } from '../utils/date';

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
  const singleDay = itinerary.days.length <= 1;

  const [selectedDayId, setSelectedDayId] = useState(
    itinerary.days.some((d) => d.id === initialDayId) ? initialDayId : itinerary.days[0]?.id,
  );
  const day = itinerary.days.find((d) => d.id === selectedDayId) ?? itinerary.days[0];
  const { updateDay } = usePrototype();
  /** 방문 시간을 고치는 중인 장소 id */
  const [timeTargetId, setTimeTargetId] = useState<string | null>(null);
  const timeTarget = day?.places.find((p) => p.id === timeTargetId);

  // 날짜 탭은 한 화면에 최대 4개만 보이고, 더 많으면 옆으로 넘겨 본다(3일 이하면 폭을 나눠 가득 채운다).
  const { width: windowWidth } = useWindowDimensions();
  const visibleTabs = Math.max(1, Math.min(itinerary.days.length, MAX_VISIBLE_TABS));
  const frameWidth = Math.min(windowWidth, 430);
  const tabWidth = Math.floor((frameWidth - GUTTER * 2 - TAB_GAP * (visibleTabs - 1)) / visibleTabs);
  const tabScroll = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, itinerary.days.findIndex((d) => d.id === day?.id));
  // 선택한 날짜가 항상 온전히 보이도록 탭 한 칸 단위로 옮긴다(앞 탭이 하나 보이게, 맨 앞·뒤는 거기서 멈춘다).
  useEffect(() => {
    const firstVisible = Math.min(Math.max(selectedIndex - 1, 0), Math.max(itinerary.days.length - visibleTabs, 0));
    tabScroll.current?.scrollTo({ x: firstVisible * (tabWidth + TAB_GAP), animated: true });
  }, [selectedIndex, tabWidth, visibleTabs, itinerary.days.length]);

  return (
    <ScreenFrame>
      <AppHeader
        title={itinerary.name}
        subtitle={tripRangeLabel(itinerary.startDate, itinerary.endDate)}
        onBack={nav.back}
      />

      {!singleDay && (
        <ScrollView
          ref={tabScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={tabWidth + TAB_GAP}
          decelerationRate="fast"
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
        >
          {itinerary.days.map((d) => {
            const active = d.id === day?.id;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedDayId(d.id)}
                style={[styles.tab, { width: tabWidth }, active && styles.tabActive]}
              >
                <Text style={[styles.tabDay, active && styles.tabTextActive]}>{monthDayLabel(d.date)}</Text>
                <Text style={[styles.tabDate, active && styles.tabTextActive]}>{dayOfWeekLabel(d.date)}요일</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {day ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeading}>
              {monthDayLabel(day.date)}
              <Text style={styles.dayHeadingDate}>
                {'  '}
                {dayOfWeekLabel(day.date)}요일
              </Text>
            </Text>
            {/* 장소가 없어도 날짜 제목은 고칠 수 있도록 항상 보인다. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="방문 순서 편집"
              onPress={() => nav.push({ name: 'placeOrderEdit', tripId, itineraryId: itinerary.id, dayId: day.id })}
              hitSlop={10}
            >
              <Text style={styles.editLink}>편집</Text>
            </Pressable>
          </View>
          {day.title ? <Text style={styles.dayTitle}>{day.title}</Text> : null}

          {day.places.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>가고 싶은 곳을 담아 하루를 채워보세요.</Text>
            </View>
          ) : null}

          <View style={styles.timeline}>
            {day.places.map((place, index) => {
              const isNew = place.id === highlightId;
              const isFirst = index === 0;
              const isLast = index === day.places.length - 1;
              const media = countMedia(recordsForVisit(itinerary.id, day.id, place));
              return (
                <View key={place.id} style={styles.row}>
                  {/* 왼쪽: 번호 동그라미와 세로 선, 방문 시간 */}
                  <View style={styles.rail}>
                    {!(isFirst && isLast) && (
                      <View
                        style={[
                          styles.railLine,
                          isFirst ? { top: BADGE / 2, bottom: 0 } : isLast ? { top: 0, height: BADGE / 2 } : { top: 0, bottom: 0 },
                        ]}
                      />
                    )}
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{index + 1}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${place.name} 방문 시간 수정`}
                      onPress={() => setTimeTargetId(place.id)}
                      hitSlop={6}
                      style={styles.timeButton}
                    >
                      <Text style={place.visitTime ? styles.placeTime : styles.placeTimeMuted}>
                        {place.visitTime ?? '시간 미정'}
                      </Text>
                      <Text style={styles.placeTimeEdit}>수정</Text>
                    </Pressable>
                  </View>

                  {/* 오른쪽: 장소 카드 */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${place.name} 사진 보기`}
                    onPress={() =>
                      nav.push({ name: 'placeRecords', tripId, itineraryId: itinerary.id, dayId: day.id, placeId: place.id })
                    }
                    style={({ pressed }) => [styles.placeCard, isNew && styles.placeCardNew, pressed && styles.pressed]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.placeName} numberOfLines={2}>
                        {place.name}
                      </Text>
                      {isNew ? <Text style={styles.newBadge}>추가됨</Text> : null}
                    </View>
                    <View style={styles.cardBottom}>
                      <Text style={media.total > 0 ? styles.photoLink : styles.photoLinkEmpty}>
                        {media.total > 0 ? `사진 ${media.photos} · 동영상 ${media.videos}` : '아직 기록 없음'}
                      </Text>
                      <Text style={media.total > 0 ? styles.chevron : styles.chevronMuted}>›</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 날의 장소 추가"
            onPress={() => nav.push({ name: 'placeSearch', tripId, itineraryId: itinerary.id, dayId: day.id })}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addText}>장소 추가</Text>
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

/** 타임라인 왼쪽 칸 너비와 번호 동그라미 크기 */
const RAIL = 60;
const BADGE = 30;

/** 날짜 탭: 한 화면에 보이는 최대 개수와 탭 사이 간격(px) */
const MAX_VISIBLE_TABS = 4;
const TAB_GAP = 8;

const styles = StyleSheet.create({
  tabsScroll: { flexGrow: 0, marginHorizontal: GUTTER, marginBottom: 10 },
  tabs: { gap: TAB_GAP },
  tab: {
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
  scroll: { backgroundColor: colors.pageBg },
  content: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 40, gap: 6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeading: { fontSize: 24, fontWeight: '900', color: colors.text },
  dayHeadingDate: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  editLink: { fontSize: 15, fontWeight: '600', color: colors.textSub },
  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  timeline: { marginTop: 14 },
  row: { flexDirection: 'row', paddingBottom: 14 },
  rail: { width: RAIL, alignItems: 'center' },
  railLine: { position: 'absolute', left: RAIL / 2 - 1, width: 2, backgroundColor: colors.primaryBorder },
  orderBadge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.pageBg,
  },
  orderBadgeText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
  timeButton: { alignItems: 'center', marginTop: 2, gap: 1, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: colors.pageBg },
  placeTime: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  placeTimeMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  placeTimeEdit: { fontSize: 10, fontWeight: '700', color: colors.primary },
  placeCard: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0px 2px 12px rgba(25, 31, 40, 0.08)',
  },
  placeCardNew: { borderColor: colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  placeName: { fontSize: 18, fontWeight: '800', color: colors.text, flexShrink: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  photoLinkEmpty: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chevron: { fontSize: 20, fontWeight: '700', color: colors.primary },
  chevronMuted: { fontSize: 20, fontWeight: '700', color: colors.textMuted },
  newBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    padding: 28,
    alignItems: 'center',
    marginTop: 14,
    boxShadow: '0px 2px 12px rgba(25, 31, 40, 0.08)',
  },
  emptyText: { fontSize: 14, color: colors.textSub, textAlign: 'center' },
  addButton: {
    backgroundColor: colors.bg,
    borderRadius: radius.item,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.8 },
  addText: { fontSize: 16, fontWeight: '800', color: colors.text },
});
