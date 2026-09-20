import { useLocalSearchParams } from 'expo-router';

import { ItineraryScreen } from '@/prototype/screens/ItineraryScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeItineraryRoute() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { days, highlightId } = usePrototype();
  return <ItineraryScreen nav={usePrototypeNav()} tripId={tripId ?? 'trip1'} days={days} highlightId={highlightId} />;
}
