import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDistance } from '../map/geo';
import { toItineraryPlace } from '../map/placeStyle';
import type { Place } from '../map/types';
import { colors, radius, shadow } from '../styles/tokens';
import { PlaceThumb } from './PlaceThumb';

export type SortKey = 'relevance' | 'distance';

/** 접었을 때 보이는 높이(핸들 + 헤더) */
export const SHEET_COLLAPSED_HEIGHT = 84;

interface Props {
  places: Place[];
  /** 장소 id → 검색 위치에서의 거리(m) */
  distances: Record<string, number>;
  selectedId: string | null;
  sort: SortKey;
  onToggleSort: () => void;
  open: boolean;
  onToggleOpen: () => void;
  height: number;
  dayNumber: number;
  /** 이미 이 Day 일정에 담긴 장소 id */
  addedIds: Set<string>;
  /** 장소 항목을 누름 → 사진·동영상 올리기로 이동 */
  onPressPlace: (place: Place) => void;
  onAdd: (place: Place) => void;
}

/**
 * 검색 결과 목록 시트(네이버 지도 스타일). 항목을 누르면 그 장소의 사진·동영상 올리기로 이동하고,
 * 각 항목의 '+ Day n에 추가' 버튼은 별도 동작이다. 지도에서 핀을 누르면 해당 항목으로 스크롤된다.
 */
export function PlaceResultSheet({
  places,
  distances,
  selectedId,
  sort,
  onToggleSort,
  open,
  onToggleOpen,
  height,
  dayNumber,
  addedIds,
  onPressPlace,
  onAdd,
}: Props) {
  const scroll = useRef<ScrollView>(null);
  const itemY = useRef<Record<string, number>>({});

  // 지도 핀을 눌러 선택이 바뀌면 그 항목이 보이게 스크롤한다.
  useEffect(() => {
    if (!selectedId || !open) return;
    const y = itemY.current[selectedId];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [selectedId, open]);

  return (
    <View style={[styles.sheet, { height: open ? height : SHEET_COLLAPSED_HEIGHT }]}>
      <Pressable
        onPress={onToggleOpen}
        accessibilityRole="button"
        accessibilityLabel={open ? '결과 목록 접기' : '결과 목록 펼치기'}
        style={styles.handleArea}
      >
        <View style={styles.handle} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerText}>
          검색 위치 기준 <Text style={styles.headerCount}>{places.length}곳</Text>
        </Text>
        <Pressable
          onPress={onToggleSort}
          accessibilityRole="button"
          accessibilityLabel="정렬 바꾸기"
          hitSlop={8}
          style={styles.sort}
        >
          <Text style={styles.sortText}>{sort === 'relevance' ? '관련도순' : '거리순'} ▾</Text>
        </Pressable>
      </View>

      {open ? (
        <ScrollView ref={scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {places.map((place) => {
            const thumb = toItineraryPlace(place);
            const selected = place.id === selectedId;
            const added = addedIds.has(place.id);
            const distance = distances[place.id];
            return (
              <View
                key={place.id}
                onLayout={(e) => {
                  itemY.current[place.id] = e.nativeEvent.layout.y;
                }}
                style={[styles.item, selected && styles.itemSelected]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name} 사진·동영상 올리기`}
                  onPress={() => onPressPlace(place)}
                  style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
                >
                  <View style={styles.itemText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {place.name} <Text style={styles.category}>{thumb.categoryLabel}</Text>
                    </Text>
                    <Text style={styles.addr} numberOfLines={1}>
                      {distance !== undefined ? <Text style={styles.distance}>{formatDistance(distance)} · </Text> : null}
                      {thumb.address}
                    </Text>
                  </View>
                  <PlaceThumb place={thumb} size={60} />
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${place.name} Day ${dayNumber} 일정에 추가`}
                    disabled={added}
                    onPress={() => onAdd(place)}
                    style={({ pressed }) => [styles.action, added && styles.actionDone, pressed && styles.pressed]}
                  >
                    <Text style={[styles.actionText, added && styles.actionTextDone]}>
                      {added ? `✓ Day ${dayNumber}에 추가됨` : `+ Day ${dayNumber}에 추가`}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0px -6px 20px rgba(20, 60, 110, 0.18)',
    zIndex: 10,
    overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#C9D8E6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerText: { fontSize: 14, fontWeight: '700', color: colors.text },
  headerCount: { color: colors.primary },
  sort: { paddingVertical: 2 },
  sortText: { fontSize: 14, fontWeight: '700', color: colors.text },
  list: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 24, gap: 6 },
  item: {
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.item,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemSelected: { borderColor: colors.primary, backgroundColor: '#F4FAFF' },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemText: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '800', color: '#1B62A8' },
  category: { fontSize: 13, fontWeight: '500', color: colors.textSub },
  addr: { fontSize: 13, color: colors.textSub },
  distance: { fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
    boxShadow: shadow.soft,
  },
  actionDone: { backgroundColor: colors.primarySoft, boxShadow: 'none' },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  actionTextDone: { color: colors.textSub },
  pressed: { opacity: 0.8 },
});
