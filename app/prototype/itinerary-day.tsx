import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { ItineraryScreen } from '@/prototype/screens/ItineraryScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeItineraryDayRoute() {
  const { tripId, itineraryId, dayId } = useLocalSearchParams<{
    tripId?: string;
    itineraryId?: string;
    dayId?: string;
  }>();
  const { itineraries, highlightId } = usePrototype();
  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);

  if (!tripId || !itinerary) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>일정을 찾을 수 없어요.</Text>
      </View>
    );
  }

  return (
    <ItineraryScreen
      nav={usePrototypeNav()}
      tripId={tripId}
      itinerary={itinerary}
      initialDayId={dayId ?? itinerary.days[0]?.id ?? ''}
      highlightId={highlightId}
    />
  );
}
