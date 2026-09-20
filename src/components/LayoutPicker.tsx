import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { layoutsFor } from '@/features/trips/layouts';
import { GUTTER, colors, spacing, type } from '@/theme/theme';

import { LayoutPreview } from './LayoutPreview';

type Props = {
  capacity: number;
  value: string;
  onChange: (layoutId: string) => void;
};

export function LayoutPicker({ capacity, value, onChange }: Props) {
  const options = layoutsFor(capacity);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // 좌우 여백을 스크롤 안쪽에 둬야 첫 칸과 마지막 칸이 화면 끝에 붙지 않는다.
      contentContainerStyle={styles.content}
      style={styles.scroll}
    >
      {options.map((layout) => {
        const selected = layout.id === value;

        return (
          <Pressable
            key={layout.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={layout.name}
            onPress={() => onChange(layout.id)}
            style={styles.item}
          >
            <LayoutPreview layout={layout} selected={selected} />
            <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={2}>
              {layout.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -GUTTER },
  content: { paddingHorizontal: GUTTER, gap: spacing(3) },
  item: { width: 76, gap: spacing(2), alignItems: 'center' },
  name: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  nameSelected: { color: colors.accent, fontWeight: '700' },
});
