import { StyleSheet, View } from 'react-native';

import type { Rect } from '../mock/tripData';
import { colors } from '../styles/tokens';

interface Props {
  rects: Rect[];
  width: number;
  height: number;
  selected?: boolean;
}

/** 분할 레이아웃 모양을 작게 그려 주는 미리보기. rects 는 0~1 비율 좌표. */
export function TemplatePreview({ rects, width, height, selected }: Props) {
  return (
    <View style={{ width, height }}>
      {rects.map(([x, y, w, h], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${w * 100}%`,
            height: `${h * 100}%`,
            padding: 2,
          }}
        >
          <View style={[styles.cell, selected && styles.cellSelected]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, borderRadius: 4, backgroundColor: colors.surfaceStrong },
  cellSelected: { backgroundColor: colors.primary },
});
