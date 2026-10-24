import { useLocalSearchParams } from 'expo-router';

import { itinerariesForTrip } from '@/prototype/mock/tripData';
import { ItinerarySummaryScreen } from '@/prototype/screens/ItinerarySummaryScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeItinerarySummaryRoute() {
  const { tripId, itineraryId } = useLocalSearchParams<{ tripId?: string; itineraryId?: string }>();
  const { itineraries } = usePrototype();
  const resolvedTripId = tripId ?? 'trip1';
  // itineraryId 가 없으면 이 모임의 첫 일정으로 대신한다.
  const resolvedItineraryId = itineraryId ?? itinerariesForTrip(resolvedTripId)[0]?.id;
  const itinerary =
    itineraries.find((it) => it.id === resolvedItineraryId && it.tripId === resolvedTripId) ?? null;

  return <ItinerarySummaryScreen nav={usePrototypeNav()} tripId={resolvedTripId} itinerary={itinerary} />;
}
