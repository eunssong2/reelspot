import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenFrame } from '../prototype/components/ScreenFrame';
import { usePrototype, usePrototypeNav } from '../prototype/state/PrototypeProvider';
import { colors, GUTTER, radius } from '../prototype/styles/tokens';
import { tripRangeLabel } from '../prototype/utils/date';
import { DEMO_TRIP_ID } from './config';

/**
 * 데모 첫 화면: 흰 화면에 일정 버튼만 놓은 간단한 선택 화면.
 * 일정을 고르면 일정 요약 화면으로 들어간다(3일 일정과 하루 일정 두 가지를 비교해 볼 수 있다).
 */
export function DemoHome() {
  const nav = usePrototypeNav();
  const { itineraries } = usePrototype();
  const list = itineraries.filter((it) => it.tripId === DEMO_TRIP_ID);

  return (
    <ScreenFrame>
      <View style={styles.wrap}>
        <Text style={styles.brand}>AT THAT PLACE</Text>
        <Text style={styles.title}>어떤 일정을 볼까요?</Text>

        {list.map((it) => {
          const days = it.days.length;
          return (
            <Pressable
              key={it.id}
              accessibilityRole="button"
              accessibilityLabel={`${it.name} 열기`}
              onPress={() => nav.push({ name: 'itinerarySummary', tripId: it.tripId, itineraryId: it.id })}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonTitle}>{it.name}</Text>
              <Text style={styles.buttonMeta}>
                {days <= 1 ? '하루 일정' : `${days}일 일정`} · {tripRangeLabel(it.startDate, it.endDate)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, gap: 14 },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: colors.primary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 10 },
  button: { backgroundColor: colors.primary, borderRadius: radius.card, paddingVertical: 20, paddingHorizontal: 20, gap: 4 },
  buttonTitle: { fontSize: 18, fontWeight: '800', color: colors.onPrimary },
  buttonMeta: { fontSize: 13, color: colors.onPrimary, opacity: 0.9 },
  pressed: { opacity: 0.85 },
});
