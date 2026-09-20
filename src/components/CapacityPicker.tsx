import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_CAPACITY, MIN_CAPACITY } from '@/features/trips/layouts';
import { MIN_TOUCH, colors, palette, radius, spacing, type } from '@/theme/theme';

const OPTIONS = Array.from(
  { length: MAX_CAPACITY - MIN_CAPACITY + 1 },
  (_, i) => MIN_CAPACITY + i,
);

type Props = {
  value: number;
  onChange: (next: number) => void;
  /** 이 인원보다 적게는 못 줄인다 (이미 들어온 스팟원 수). */
  min?: number;
};

export function CapacityPicker({ value, onChange, min = MIN_CAPACITY }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((count) => {
        const disabled = count < min;
        const selected = count === value;

        return (
          <Pressable
            key={count}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${count}명`}
            disabled={disabled}
            onPress={() => onChange(count)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.itemSelected,
              pressed && !selected && !disabled && styles.itemPressed,
              disabled && styles.itemDisabled,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing(2) },
  item: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSelected: { backgroundColor: colors.accent },
  itemPressed: { backgroundColor: palette.gray200 },
  itemDisabled: { opacity: 0.35 },
  label: { ...type.heading, color: colors.text },
  labelSelected: { color: colors.onAccent },
});
