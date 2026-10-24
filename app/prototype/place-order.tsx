import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { PlaceOrderEditScreen } from '@/prototype/screens/PlaceOrderEditScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypePlaceOrderRoute() {
  const { tripId, itineraryId, dayId } = useLocalSearchParams<{
    tripId?: string;
    itineraryId?: string;
    dayId?: string;
  }>();
  const { itineraries, updateDay } = usePrototype();
  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);
  const day = itinerary?.days.find((d) => d.id === dayId);

  if (!tripId || !itinerary || !day) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>날짜를 찾을 수 없어요.</Text>
      </View>
    );
  }

  return (
    <PlaceOrderEditScreen
      nav={usePrototypeNav()}
      tripId={tripId}
      itinerary={itinerary}
      day={day}
      onSave={(places, memo, title) => updateDay(itinerary.id, day.id, { places, memo, title })}
    />
  );
}
