import { StyleSheet, Text, View } from 'react-native';

import type { LayoutTemplate } from '@/features/trips/layouts';
import { colors, palette, radius } from '@/theme/theme';

type Props = {
  layout: LayoutTemplate;
  /** 미리보기 가로 길이. 세로는 9:16 비율로 잡는다. */
  width?: number;
  selected?: boolean;
  /** 칸마다 순번을 적어 누구 자리인지 감이 오게 한다. */
  numbered?: boolean;
};

const GAP = 2;

export function LayoutPreview({ layout, width = 76, selected = false, numbered = true }: Props) {
  const height = Math.round((width * 16) / 9);

  return (
    <View style={[styles.frame, { width, height }, selected && styles.frameSelected]}>
      {layout.panes.map((p, index) => (
        <View
          key={`${p.x}-${p.y}-${p.w}-${p.h}`}
          style={[
            styles.pane,
            selected && styles.paneSelected,
            {
              left: p.x * width + GAP,
              top: p.y * height + GAP,
              width: p.w * width - GAP * 2,
              height: p.h * height - GAP * 2,
            },
          ]}
        >
          {numbered && layout.panes.length > 1 && (
            <Text style={[styles.index, selected && styles.indexSelected]}>{index + 1}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: palette.gray200,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  frameSelected: { backgroundColor: colors.accent },
  pane: {
    position: 'absolute',
    backgroundColor: colors.bg,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paneSelected: { backgroundColor: colors.accentSoft },
  index: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  indexSelected: { color: colors.accent },
});
