import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { countMedia, recordsForVisit } from '@/demo/records';
import { PlaceSearchScreen } from '@/prototype/screens/PlaceSearchScreen';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypePlaceSearchRoute() {
  const { tripId, itineraryId, dayId, placeId } = useLocalSearchParams<{
    tripId?: string;
    itineraryId?: string;
    dayId?: string;
    placeId?: string;
  }>();
  const { itineraries, addPlace, updateDay } = usePrototype();
  const nav = usePrototypeNav();
  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);
  const day = itinerary?.days.find((d) => d.id === dayId);
  // placeId 가 있으면 장소 수정. 못 찾으면 수정 대상이 없는 것이므로 안내한다.
  const editPlace = placeId ? day?.places.find((p) => p.id === placeId) : undefined;

  if (!tripId || !itinerary || !day || (placeId && !editPlace)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{placeId ? '장소를 찾을 수 없어요.' : '날짜를 찾을 수 없어요.'}</Text>
      </View>
    );
  }

  return (
    <PlaceSearchScreen
      nav={nav}
      tripId={tripId}
      itinerary={itinerary}
      day={day}
      onAddPlace={(place) => addPlace(itinerary.id, day.id, place)}
      editPlace={editPlace}
      editHasRecords={editPlace ? countMedia(recordsForVisit(itinerary.id, day.id, editPlace)).total > 0 : false}
      onUpdatePlace={(next) =>
        updateDay(itinerary.id, day.id, {
          places: day.places.map((p) => (p.id === editPlace?.id ? next : p)),
          memo: day.memo ?? '',
        })
      }
    />
  );
}
