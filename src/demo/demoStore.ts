/**
 * 데모 일정 상태의 순수 로직(React·저장소 없음): 장소 추가(중복 방지), 순서·메모 저장, 저장본 검증.
 * 화면 상태는 PrototypeProvider 가 들고, 이 함수들은 새 배열을 돌려주기만 한다.
 */
import type { Itinerary, ItineraryPlace } from '../prototype/mock/tripData';
import { visitKey } from './demoData';

export const STORAGE_VERSION = 1;

export interface AddPlaceResult {
  itineraries: Itinerary[];
  /** 실제로 추가했으면 true. 같은 날짜에 이미 있거나 대상 날짜가 없으면 false. */
  added: boolean;
}

/**
 * 선택한 날짜에 장소를 맨 뒤에 추가한다.
 * - 같은 날짜에 같은 장소(id)가 이미 있으면 추가하지 않는다. 다른 날짜는 따로 추가할 수 있다.
 * - 방문 식별자(visitId)는 일정·날짜·장소 id 로 만든다: 같은 장소도 날짜별 기록이 섞이지 않는다.
 */
export function addPlaceToDay(
  itineraries: Itinerary[],
  itineraryId: string,
  dayId: string,
  place: ItineraryPlace,
): AddPlaceResult {
  let added = false;
  const next = itineraries.map((itinerary) => {
    if (itinerary.id !== itineraryId) return itinerary;
    return {
      ...itinerary,
      days: itinerary.days.map((day) => {
        if (day.id !== dayId || day.places.some((p) => p.id === place.id)) return day;
        added = true;
        return { ...day, places: [...day.places, { ...place, visitId: visitKey(itineraryId, dayId, place.id) }] };
      }),
    };
  });
  return { itineraries: added ? next : itineraries, added };
}

/** 순서 편집 저장: 이미 정렬된 장소 배열(방문 시간 포함)과 메모를 그 날짜에 반영한다. */
export function updateDayPlaces(
  itineraries: Itinerary[],
  itineraryId: string,
  dayId: string,
  /** title: 날짜 제목. 빈 문자열이면 제목을 지운다(기본 "○월 ○일의 장소"로 표시). 생략하면 그대로 둔다. */
  patch: { places: ItineraryPlace[]; memo: string; title?: string },
): Itinerary[] {
  return itineraries.map((itinerary) =>
    itinerary.id !== itineraryId
      ? itinerary
      : {
          ...itinerary,
          days: itinerary.days.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  // 순서 편집 화면이 visitId 를 모르는 경로로 만든 항목도 같은 방문 식별자를 갖도록 채운다.
                  places: patch.places.map((p) => ({ ...p, visitId: p.visitId ?? visitKey(itineraryId, dayId, p.id) })),
                  memo: patch.memo || undefined,
                  ...(patch.title === undefined ? {} : { title: patch.title.trim() || undefined }),
                }
              : day,
          ),
        },
  );
}

/**
 * 저장 문자열로 바꾼다. 제목을 지운 날짜도 기억하도록 title 이 없으면 빈 문자열로 적는다
 * (JSON 은 undefined 를 버리므로, 안 그러면 다시 읽을 때 기본 제목이 되살아난다).
 */
export const serializeItineraries = (itineraries: Itinerary[]): string =>
  JSON.stringify({
    version: STORAGE_VERSION,
    itineraries: itineraries.map((it) => ({ ...it, days: it.days.map((d) => ({ ...d, title: d.title ?? '' })) })),
  });

const isStr = (v: unknown): v is string => typeof v === 'string';

function validPlace(raw: unknown): raw is ItineraryPlace {
  if (typeof raw !== 'object' || raw === null) return false;
  const p = raw as Record<string, unknown>;
  return (
    isStr(p.id) &&
    p.id.length > 0 &&
    isStr(p.name) &&
    isStr(p.address) &&
    isStr(p.categoryLabel) &&
    isStr(p.emoji) &&
    isStr(p.tint) &&
    (p.visitTime === undefined || isStr(p.visitTime)) &&
    (p.visitId === undefined || isStr(p.visitId))
  );
}

/**
 * 저장된 문자열을 읽어 일정 배열로 돌려준다. 형식이 틀리거나 기본 일정과 구조(일정·날짜 id)가 다르면
 * null — 호출한 쪽이 처음 상태로 시작한다. 깨진 저장본이 앱을 멈추게 하지 않는다.
 * 일정 이름·기간·날짜는 기본값을 쓰고, 저장본에서는 날짜별 장소와 메모만 가져온다.
 */
export function parseStoredItineraries(raw: string | null, defaults: Itinerary[]): Itinerary[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const body = parsed as { version?: unknown; itineraries?: unknown };
    if (body.version !== STORAGE_VERSION || !Array.isArray(body.itineraries)) return null;

    const result: Itinerary[] = [];
    for (const base of defaults) {
      const saved = body.itineraries.find((it: unknown) => (it as { id?: unknown })?.id === base.id) as
        | { days?: unknown }
        | undefined;
      // 저장본에 없는 일정(앱 업데이트로 새로 생긴 예시 일정)은 기본값을 그대로 쓴다.
      if (!saved) {
        result.push(base);
        continue;
      }
      if (!Array.isArray(saved.days) || saved.days.length !== base.days.length) return null;

      const days = [];
      for (const baseDay of base.days) {
        const savedDay = saved.days.find((d: unknown) => (d as { id?: unknown })?.id === baseDay.id) as
          | { places?: unknown; memo?: unknown; title?: unknown }
          | undefined;
        if (!savedDay || !Array.isArray(savedDay.places) || !savedDay.places.every(validPlace)) return null;
        const places = savedDay.places as ItineraryPlace[];
        if (new Set(places.map((p) => p.id)).size !== places.length) return null; // 같은 날짜 중복 장소
        const memo = isStr(savedDay.memo) && savedDay.memo ? savedDay.memo : undefined;
        days.push({
          ...baseDay,
          places: places.map((p) => ({ ...p, visitId: p.visitId ?? visitKey(base.id, baseDay.id, p.id) })),
          memo,
          // 저장본에 title 이 없으면(이전 버전) 기본 제목을, 문자열이면 그 값을(빈 문자열은 제목 없음) 쓴다.
          title: isStr(savedDay.title) ? savedDay.title.trim() || undefined : baseDay.title,
        });
      }
      result.push({ ...base, days });
    }
    return result;
  } catch {
    return null;
  }
}
