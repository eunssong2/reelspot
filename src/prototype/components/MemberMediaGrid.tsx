import { StyleSheet, View } from 'react-native';

import type { PlaceRecordItem } from '../mock/tripData';
import { PlaceRecordThumb } from './PlaceRecordThumb';

interface Props {
  items: PlaceRecordItem[];
  onPressItem?: (item: PlaceRecordItem) => void;
}

/** 한 줄에 보여줄 칸 수(2열 그리드). */
const COLUMNS = 2;
/** 이보다 많으면 마지막 칸을 어둡게 덮고 남은 개수를 보여준다. */
const MAX_VISIBLE = 4;

const chunk = <T,>(list: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
};

/**
 * 한 스팟원이 올린 사진·동영상을 2열 그리드로 보여준다.
 * 4장을 넘기면 4번째 칸에 "+N"(남은 개수)을 덮어 전부를 한눈에 알 수 있게 한다.
 */
export function MemberMediaGrid({ items, onPressItem }: Props) {
  const overflow = items.length > MAX_VISIBLE;
  const visible = items.slice(0, MAX_VISIBLE);
  // 4번째 칸 자체도 가려지므로, 남은 개수는 "전체 - 앞의 3장"으로 센다.
  const hiddenCount = items.length - (MAX_VISIBLE - 1);
  const rows = chunk(visible, COLUMNS);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item, colIndex) => {
            const isLastVisible = rowIndex * COLUMNS + colIndex === visible.length - 1;
            return (
              <PlaceRecordThumb
                key={item.id}
                item={item}
                overlayCount={overflow && isLastVisible ? hiddenCount : undefined}
                onPress={() => onPressItem?.(item)}
              />
            );
          })}
          {/* 마지막 줄이 1칸만 있으면 빈 칸으로 자리를 채워 정렬을 맞춘다. */}
          {row.length < COLUMNS && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  spacer: { flex: 1 },
});
