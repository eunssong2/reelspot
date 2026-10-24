import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toItineraryPlace } from '../map/placeStyle';
import type { Place } from '../map/types';
import { colors, radius, shadow } from '../styles/tokens';
import { PlaceThumb } from './PlaceThumb';

interface Props {
  place: Place;
  /** 추가할 날짜 레이블(예: "10월 17일 토요일"). */
  dateLabel: string;
  added: boolean;
  saving: boolean;
  onClose: () => void;
  onAdd: () => void;
}

/**
 * 검색 결과(마커·목록)를 선택했을 때 목록 대신 보여주는 장소 상세 패널.
 * "이 날의 장소로 추가"를 누르면 진입할 때 정한 일정·날짜에 저장한다.
 */
export function PlaceDetailPanel({ place, dateLabel, added, saving, onClose, onAdd }: Props) {
  const styled = toItineraryPlace(place);

  return (
    <View style={styles.sheet}>
      <View style={styles.handleArea}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={styles.category}>{styled.categoryLabel}</Text>
          {place.sample ? <Text style={styles.sampleTag}>예시</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={10} style={styles.close}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.row}>📍 {styled.address}</Text>
      <Text style={styles.row}>📅 선택한 날짜 · {dateLabel}</Text>
      {place.sample ? <Text style={styles.sampleNote}>※ 데모용 예시 장소예요. 실제 장소 정보가 아닙니다.</Text> : null}

      <PlaceThumb place={styled} size={96} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={added ? '이미 이 날의 장소로 추가됨' : '이 날의 장소로 추가'}
        disabled={added || saving}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addButton,
          (added || saving) && styles.addButtonDisabled,
          pressed && !added && !saving && styles.pressed,
        ]}
      >
        <Text style={[styles.addButtonText, (added || saving) && styles.addButtonTextDisabled]}>
          {added ? '✓ 이 날의 장소에 추가됨' : saving ? '추가하는 중…' : '이 날의 장소로 추가'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sampleTag: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  sampleNote: { fontSize: 12, fontWeight: '600', color: colors.primary },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: shadow.float,
    zIndex: 11,
    padding: 20,
    paddingTop: 4,
    gap: 10,
  },
  handleArea: { alignItems: 'center', paddingBottom: 8 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceStrong },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, flexShrink: 1 },
  category: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 15, color: colors.textSub },
  row: { fontSize: 13, color: colors.textSub },
  addButton: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 15,
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.primaryPressed },
  addButtonText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  addButtonTextDisabled: { color: colors.primary },
});
