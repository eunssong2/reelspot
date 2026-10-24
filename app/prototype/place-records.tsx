import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { PlaceRecordsScreen } from '@/prototype/screens/PlaceRecordsScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypePlaceRecordsRoute() {
  const { tripId, itineraryId, dayId, placeId } = useLocalSearchParams<{
    tripId?: string;
    itineraryId?: string;
    dayId?: string;
    placeId?: string;
  }>();
  const { itineraries } = usePrototype();
  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);
  const day = itinerary?.days.find((d) => d.id === dayId);

  if (!tripId || !itinerary || !day || !placeId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>장소를 찾을 수 없어요.</Text>
      </View>
    );
  }

  return <PlaceRecordsScreen nav={usePrototypeNav()} tripId={tripId} itinerary={itinerary} day={day} placeId={placeId} />;
}
