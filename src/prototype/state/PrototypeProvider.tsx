import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { INITIAL_DAYS, type ItineraryPlace, type TripDay } from '../mock/tripData';
import type { Nav, Route } from '../navigation/routes';

interface PrototypeState {
  days: TripDay[];
  /** 방금 장소 검색에서 추가한 장소(일정 화면에서 잠깐 강조) */
  highlightId: string | null;
  addPlace: (dayIndex: number, place: ItineraryPlace) => void;
}

const PrototypeContext = createContext<PrototypeState | null>(null);

/**
 * 프로토타입 흐름(app/prototype/*) 안에서 화면들이 함께 쓰는 mock 일정 상태.
 * 서버·DB에 저장하지 않으며 프로토타입 화면을 벗어났다 돌아오면 초기화된다.
 */
export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<TripDay[]>(INITIAL_DAYS);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const addPlace = useCallback((dayIndex: number, place: ItineraryPlace) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex && !d.places.some((p) => p.id === place.id) ? { ...d, places: [...d.places, place] } : d,
      ),
    );
    setHighlightId(place.id);
  }, []);

  const value = useMemo(() => ({ days, highlightId, addPlace }), [days, highlightId, addPlace]);
  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype(): PrototypeState {
  const ctx = useContext(PrototypeContext);
  if (!ctx) throw new Error('usePrototype 는 PrototypeProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}

/** 경로 → expo-router 주소 변환. 화면들은 Route 만 알고 실제 URL 은 여기서만 안다. */
const toHref = (route: Route) => {
  switch (route.name) {
    case 'trips':
      return { pathname: '/prototype' } as const;
    case 'itinerary':
      return { pathname: '/prototype/itinerary', params: { tripId: route.tripId } } as const;
    case 'placeSearch':
      return {
        pathname: '/prototype/place-search',
        params: { tripId: route.tripId, dayIndex: String(route.dayIndex) },
      } as const;
    case 'mediaSettings':
      return { pathname: '/prototype/media-settings', params: { placeName: route.placeName ?? '' } } as const;
    case 'imageUpload':
      return {
        pathname: '/prototype/image-upload',
        params: { cuts: String(route.cuts), templateId: route.templateId, kind: route.kind },
      } as const;
  }
};

/** 프로토타입 화면이 쓰는 Nav 를 expo-router 로 구현한다. */
export function usePrototypeNav(): Nav {
  const router = useRouter();
  return useMemo<Nav>(
    () => ({
      push: (route) => router.push(toHref(route)),
      back: () => (router.canGoBack() ? router.back() : router.replace('/prototype')),
    }),
    [router],
  );
}
