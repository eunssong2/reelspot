import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { PlaceSearchScreen } from '@/prototype/screens/PlaceSearchScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypePlaceSearchRoute() {
  const { tripId, itineraryId, dayId } = useLocalSearchParams<{
    tripId?: string;
    itineraryId?: string;
    dayId?: string;
  }>();
  const { itineraries, addPlace } = usePrototype();
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
    <PlaceSearchScreen
      nav={usePrototypeNav()}
      tripId={tripId}
      itinerary={itinerary}
      day={day}
      onAddPlace={(place) => addPlace(itinerary.id, day.id, place)}
    />
  );
}
