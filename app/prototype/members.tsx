import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { MembersScreen } from '@/prototype/screens/MembersScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeMembersRoute() {
  const { tripId, itineraryId } = useLocalSearchParams<{ tripId?: string; itineraryId?: string }>();
  const { itineraries } = usePrototype();
  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);
  const nav = usePrototypeNav();

  if (!tripId || !itinerary) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>일정을 찾을 수 없어요.</Text>
      </View>
    );
  }
  return <MembersScreen nav={nav} tripId={tripId} itinerary={itinerary} />;
}
