/** 카카오 장소 검색 결과를 앱에서 쓰는 형태로 정리한 값. */
export interface Place {
  /** 카카오 장소 ID (같은 장소의 기록을 묶는 키) */
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  phone: string;
}

export type SearchStatus = 'idle' | 'searching' | 'done' | 'empty' | 'error';

/** WebView → RN */
export type MapEvent =
  | { type: 'ready'; origin?: string }
  | { type: 'tilesLoaded' }
  | { type: 'viewChanged'; lat: number; lng: number; level: number }
  | { type: 'sdkError'; message: string; origin?: string }
  | {
      type: 'searchResult';
      status: 'done' | 'empty' | 'error';
      places: Place[];
      /** 서울특별시 밖이라 제외한 결과 수 */
      excluded: number;
    }
  | { type: 'markerPress'; place: Place }
  | { type: 'mapPress' };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function parsePlace(raw: unknown): Place | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id,
    name: str(r.name),
    address: str(r.address),
    roadAddress: str(r.roadAddress),
    lat,
    lng,
    category: str(r.category),
    phone: str(r.phone),
  };
}

/** WebView 가 보낸 문자열을 검증해 MapEvent 로 바꾼다. 형식이 다르면 null. */
export function parseMapEvent(data: string): MapEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case 'ready':
      return { type: 'ready', origin: str(m.origin) || undefined };
    case 'mapPress':
      return { type: 'mapPress' };
    case 'tilesLoaded':
      return { type: 'tilesLoaded' };
    case 'viewChanged': {
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const level = Number(m.level);
      return Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(level)
        ? { type: 'viewChanged', lat, lng, level }
        : null;
    }
    case 'sdkError':
      return { type: 'sdkError', message: str(m.message), origin: str(m.origin) || undefined };
    case 'markerPress': {
      const place = parsePlace(m.place);
      return place ? { type: 'markerPress', place } : null;
    }
    case 'searchResult': {
      const status = m.status === 'done' || m.status === 'empty' ? m.status : 'error';
      const places = Array.isArray(m.places)
        ? m.places.map(parsePlace).filter((p): p is Place => p !== null)
        : [];
      const excluded = Number.isFinite(Number(m.excluded)) ? Number(m.excluded) : 0;
      return { type: 'searchResult', status, places, excluded };
    }
    default:
      return null;
  }
}

/** 지도 화면의 카테고리 버튼. code 는 카카오 카테고리 그룹 코드. */
export type CategoryKey = 'attraction' | 'food' | 'cafe' | 'stay';

export const CATEGORIES: { key: CategoryKey; label: string; code: string }[] = [
  { key: 'attraction', label: '관광지', code: 'AT4' },
  { key: 'food', label: '맛집', code: 'FD6' },
  { key: 'cafe', label: '카페', code: 'CE7' },
  { key: 'stay', label: '숙소', code: 'AD5' },
];

/** 지도 컴포넌트(실제 카카오 지도 / 임시 지도)가 공통으로 제공하는 조작 함수. */
export interface MapHandle {
  search(keyword: string): void;
  searchCategory(key: CategoryKey): void;
  clear(): void;
  /** 핀을 선택 상태로 강조하고 그 위치로 지도를 옮긴다. null 이면 선택 해제 */
  select(id: string | null): void;
  /** 화면 아래를 시트가 가리는 높이(px). 검색 결과 맞춤·핀 이동이 이 영역을 피한다. */
  setPadding(bottom: number): void;
}
