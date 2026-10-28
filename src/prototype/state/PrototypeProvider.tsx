import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DEMO_COVER_STORAGE_KEY, DEMO_PROFILE_STORAGE_KEY, DEMO_STORAGE_KEY, IS_DEMO_BUILD } from '../../demo/config';
import { createDemoItineraries } from '../../demo/demoData';
import { addDatesToItinerary, addPlaceToDay, parseStoredItineraries, serializeItineraries, updateDayPlaces } from '../../demo/demoStore';
import { ITINERARIES, type Itinerary, type ItineraryPlace } from '../mock/tripData';
import type { Nav, Route } from '../navigation/routes';

interface PrototypeState {
  itineraries: Itinerary[];
  /** 방금 장소 검색에서 추가한 장소(일정 화면에서 잠깐 강조) */
  highlightId: string | null;
  /** 선택한 날짜에 장소를 담는다. 같은 날짜에 이미 있으면 담지 않고 false 를 돌려준다. */
  addPlace: (itineraryId: string, dayId: string, place: ItineraryPlace) => boolean;
  /** 순서 편집 저장: 장소 순서(이미 정렬된 배열) · 방문 시간 · 날짜 메모를 한 번에 반영한다. */
  updateDay: (itineraryId: string, dayId: string, patch: { places: ItineraryPlace[]; memo: string; title?: string }) => void;
  /** 고른 날짜들(이어지지 않아도 됨)을 빈 날짜로 더한다. 실제로 더한 날짜 수를 돌려준다(이미 있는 날짜는 건너뜀). */
  addDays: (itineraryId: string, dates: string[]) => number;
  /** 일정 대표(배경) 사진. 일정 id → 이미지 URI(data URI). 없으면 기본 그림을 쓴다. */
  covers: Record<string, string>;
  /** 대표 사진을 바꾼다. null 이면 기본 그림으로 되돌린다. */
  setCover: (itineraryId: string, uri: string | null) => void;
  /** 데모 전용: 추가한 장소·순서 변경을 지우고 예시 데이터를 처음 상태로 되돌린다. */
  resetDemo: () => void;
  /** 마이페이지 프로필. avatarUri 가 null 이면 기본 프로필 사진을 쓴다. */
  profile: MyProfile;
  setNickname: (nickname: string) => void;
  setAvatar: (uri: string | null) => void;
}

export interface MyProfile {
  nickname: string;
  /** 직접 고른 프로필 사진(data URI). 없으면 null. */
  avatarUri: string | null;
}

const DEFAULT_PROFILE: MyProfile = { nickname: '나', avatarUri: null };

const PrototypeContext = createContext<PrototypeState | null>(null);

/**
 * 프로토타입 흐름(app/prototype/*) 안에서 화면들이 함께 쓰는 mock 일정 상태.
 * 일반 프로토타입은 서버·DB에 저장하지 않으며 화면을 벗어났다 돌아오면 초기화된다.
 * 데모 빌드(IS_DEMO_BUILD)는 예시 일정으로 시작하고, 장소 추가·순서 변경을 기기 안(AsyncStorage)에 저장해
 * 앱을 껐다 켜도 유지한다. 저장소를 읽지 못하거나 저장본이 깨져 있으면 처음 상태로 시작한다.
 */
export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [itineraries, setItineraries] = useState<Itinerary[]>(() =>
    IS_DEMO_BUILD ? createDemoItineraries() : ITINERARIES,
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  /** 데모: 저장된 상태를 읽어 오기 전에는 화면을 그리지 않는다(처음 상태가 잠깐 비치지 않도록). */
  const [profile, setProfile] = useState<MyProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(!IS_DEMO_BUILD);
  // 연속으로 호출해도 최신 상태를 보고 중복 여부를 판단하기 위한 참조.
  const itinerariesRef = useRef(itineraries);
  itinerariesRef.current = itineraries;

  useEffect(() => {
    if (!IS_DEMO_BUILD) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
        const stored = parseStoredItineraries(raw, createDemoItineraries());
        if (!cancelled && stored) setItineraries(stored);
        const rawCovers = await AsyncStorage.getItem(DEMO_COVER_STORAGE_KEY);
        const parsedCovers: unknown = rawCovers ? JSON.parse(rawCovers) : null;
        if (!cancelled && parsedCovers && typeof parsedCovers === 'object') {
          const clean: Record<string, string> = {};
          for (const [id, uri] of Object.entries(parsedCovers as Record<string, unknown>)) {
            if (typeof uri === 'string' && uri) clean[id] = uri;
          }
          setCovers(clean);
        }
        const rawProfile = await AsyncStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
        const parsedProfile: unknown = rawProfile ? JSON.parse(rawProfile) : null;
        if (!cancelled && parsedProfile && typeof parsedProfile === 'object') {
          const p = parsedProfile as Record<string, unknown>;
          setProfile({
            nickname: typeof p.nickname === 'string' && p.nickname.trim() ? p.nickname : DEFAULT_PROFILE.nickname,
            avatarUri: typeof p.avatarUri === 'string' && p.avatarUri ? p.avatarUri : null,
          });
        }
      } catch {
        // 저장소를 읽지 못하면 예시 처음 상태로 시작한다.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 읽어 온 뒤에 바뀐 상태만 저장한다(읽기 전에 처음 상태로 덮어쓰지 않도록 hydrated 를 확인).
  useEffect(() => {
    if (!IS_DEMO_BUILD || !hydrated) return;
    AsyncStorage.setItem(DEMO_STORAGE_KEY, serializeItineraries(itineraries)).catch(() => {
      // 저장 실패는 이번 실행 동안의 화면에는 영향이 없다. 다음 변경 때 다시 시도한다.
    });
  }, [itineraries, hydrated]);

  const addPlace = useCallback((itineraryId: string, dayId: string, place: ItineraryPlace) => {
    const result = addPlaceToDay(itinerariesRef.current, itineraryId, dayId, place);
    if (!result.added) return false;
    itinerariesRef.current = result.itineraries;
    setItineraries(result.itineraries);
    setHighlightId(place.id);
    return true;
  }, []);

  const updateDay = useCallback(
    (itineraryId: string, dayId: string, patch: { places: ItineraryPlace[]; memo: string; title?: string }) => {
      const next = updateDayPlaces(itinerariesRef.current, itineraryId, dayId, patch);
      itinerariesRef.current = next;
      setItineraries(next);
    },
    [],
  );

  const addDays = useCallback((itineraryId: string, dates: string[]) => {
    const result = addDatesToItinerary(itinerariesRef.current, itineraryId, dates);
    if (result.addedDayIds.length === 0) return 0;
    itinerariesRef.current = result.itineraries;
    setItineraries(result.itineraries);
    return result.addedDayIds.length;
  }, []);

  const setCover = useCallback((itineraryId: string, uri: string | null) => {
    setCovers((prev) => {
      const next = { ...prev };
      if (uri) next[itineraryId] = uri;
      else delete next[itineraryId];
      if (IS_DEMO_BUILD) {
        AsyncStorage.setItem(DEMO_COVER_STORAGE_KEY, JSON.stringify(next)).catch(() => {
          // 저장 실패는 이번 실행의 화면에는 영향이 없다.
        });
      }
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<MyProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      if (IS_DEMO_BUILD) {
        AsyncStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(next)).catch(() => {
          // 저장 실패는 이번 실행의 화면에는 영향이 없다.
        });
      }
      return next;
    });
  }, []);
  const setNickname = useCallback((nickname: string) => updateProfile({ nickname }), [updateProfile]);
  const setAvatar = useCallback((uri: string | null) => updateProfile({ avatarUri: uri }), [updateProfile]);

  const resetDemo = useCallback(() => {
    if (!IS_DEMO_BUILD) return;
    setProfile(DEFAULT_PROFILE);
    AsyncStorage.removeItem(DEMO_PROFILE_STORAGE_KEY).catch(() => {});
    setCovers({});
    AsyncStorage.removeItem(DEMO_COVER_STORAGE_KEY).catch(() => {});
    const fresh = createDemoItineraries();
    itinerariesRef.current = fresh;
    setItineraries(fresh);
    setHighlightId(null);
  }, []);

  const value = useMemo(
    () => ({ itineraries, highlightId, addPlace, updateDay, addDays, resetDemo, covers, setCover, profile, setNickname, setAvatar }),
    [itineraries, highlightId, addPlace, updateDay, addDays, resetDemo, covers, setCover, profile, setNickname, setAvatar],
  );

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
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
    case 'itinerarySummary':
      return {
        pathname: '/prototype/itinerary',
        params: { tripId: route.tripId, itineraryId: route.itineraryId },
      } as const;
    case 'itineraryDay':
      return {
        pathname: '/prototype/itinerary-day',
        params: { tripId: route.tripId, itineraryId: route.itineraryId, dayId: route.dayId },
      } as const;
    case 'placeOrderEdit':
      return {
        pathname: '/prototype/place-order',
        params: { tripId: route.tripId, itineraryId: route.itineraryId, dayId: route.dayId },
      } as const;
    case 'placeSearch':
      return {
        pathname: '/prototype/place-search',
        params: { tripId: route.tripId, itineraryId: route.itineraryId, dayId: route.dayId },
      } as const;
    case 'placeRecords':
      return {
        pathname: '/prototype/place-records',
        params: { tripId: route.tripId, itineraryId: route.itineraryId, dayId: route.dayId, placeId: route.placeId },
      } as const;
    case 'mediaUpload':
      return {
        pathname: '/prototype/media-upload',
        params: {
          placeName: route.placeName ?? '',
          clipSeconds: route.clipSeconds ? String(route.clipSeconds) : '',
        },
      } as const;
    case 'videoMerge':
      return { pathname: '/prototype/video-merge' } as const;
    case 'myPage':
      return { pathname: '/prototype/my-page' } as const;
    case 'members':
      return { pathname: '/prototype/members', params: { tripId: route.tripId, itineraryId: route.itineraryId } } as const;
    case 'settings':
      return { pathname: '/prototype/settings' } as const;
    case 'account':
      return { pathname: '/prototype/account' } as const;
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
