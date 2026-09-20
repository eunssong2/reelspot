import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PhoneFrame } from './src/components/ScreenFrame';
import { INITIAL_DAYS, type ItineraryPlace, type TripDay } from './src/mock/tripData';
import type { Nav, Route } from './src/navigation/routes';
import { ImageUploadScreen } from './src/screens/ImageUploadScreen';
import { ItineraryScreen } from './src/screens/ItineraryScreen';
import { MediaSettingsScreen } from './src/screens/MediaSettingsScreen';
import { MyTripsScreen } from './src/screens/MyTripsScreen';
import { PlaceSearchScreen } from './src/screens/PlaceSearchScreen';

/**
 * 프로토타입 루트. 화면 이동은 route 스택(배열)으로만 관리한다.
 * 일정(days)은 여러 화면이 공유하므로 여기서 들고 있다. 모두 mock 이며 저장하지 않는다.
 */
export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'trips' }]);
  const [days, setDays] = useState<TripDay[]>(INITIAL_DAYS);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const nav: Nav = { push, back };

  // Android 하드웨어 뒤로가기: 스택이 남아 있으면 이전 화면으로, 처음 화면이면 앱 종료
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const addPlace = useCallback((dayIndex: number, place: ItineraryPlace) => {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex && !d.places.some((p) => p.id === place.id) ? { ...d, places: [...d.places, place] } : d)),
    );
    setHighlightId(place.id);
  }, []);

  const route = stack[stack.length - 1];

  return (
    <SafeAreaProvider>
      <PhoneFrame>
        {route.name === 'trips' && <MyTripsScreen nav={nav} />}
        {route.name === 'itinerary' && (
          <ItineraryScreen nav={nav} tripId={route.tripId} days={days} highlightId={highlightId} />
        )}
        {route.name === 'placeSearch' && (
          <PlaceSearchScreen nav={nav} days={days} dayIndex={route.dayIndex} onAddPlace={addPlace} />
        )}
        {route.name === 'mediaSettings' && <MediaSettingsScreen nav={nav} placeName={route.placeName} />}
        {route.name === 'imageUpload' && (
          <ImageUploadScreen
            // 컷 수·종류가 바뀌면 칸 상태를 새로 만든다.
            key={`${route.cuts}-${route.kind}-${stack.length}`}
            nav={nav}
            cuts={route.cuts}
            templateId={route.templateId}
            kind={route.kind}
          />
        )}
      </PhoneFrame>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
