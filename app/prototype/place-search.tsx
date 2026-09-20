import { useLocalSearchParams } from 'expo-router';

import { PlaceSearchScreen } from '@/prototype/screens/PlaceSearchScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypePlaceSearchRoute() {
  const { dayIndex } = useLocalSearchParams<{ dayIndex?: string }>();
  const { days, addPlace } = usePrototype();
  // 잘못된 값이 들어와도 없는 Day 를 가리키지 않게 범위 안으로 맞춘다.
  const index = Math.min(Math.max(Number.parseInt(dayIndex ?? '0', 10) || 0, 0), days.length - 1);
  return <PlaceSearchScreen nav={usePrototypeNav()} days={days} dayIndex={index} onAddPlace={addPlace} />;
}
