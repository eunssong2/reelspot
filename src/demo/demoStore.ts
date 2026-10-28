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

/** 한 일정에 둘 수 있는 최대 날짜 수(끝없이 늘어나는 것을 막는다). */
export const MAX_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' 의 다음 날을 같은 형식으로 돌려준다(시간대 영향 없이 UTC 로 계산). */
export function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** 날짜순으로 정렬하고 일차 번호를 1부터 다시 매긴다. 시작일·종료일은 첫·마지막 날짜로 맞춘다. */
function normalizeDays(itinerary: Itinerary, days: Itinerary['days']): Itinerary {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date)).map((d, i) => ({ ...d, dayNumber: i + 1 }));
  return {
    ...itinerary,
    startDate: sorted[0]?.date ?? itinerary.startDate,
    endDate: sorted[sorted.length - 1]?.date ?? itinerary.endDate,
    days: sorted,
  };
}

export interface AddDatesResult {
  itineraries: Itinerary[];
  /** 실제로 새로 만든 날짜의 id 목록. */
  addedDayIds: string[];
}

/**
 * 고른 날짜들을 일정에 빈 날짜로 추가한다. 이어지지 않는 날짜도 되고, 일정 기간 앞뒤·중간 어디든 된다.
 * - 이미 있는 날짜, 형식이 틀린 날짜, 중복은 건너뛴다. 최대 날짜 수(MAX_DAYS)를 넘는 만큼은 추가하지 않는다.
 * - 기존 날짜의 id 는 바뀌지 않는다(그 날짜의 장소 기록이 id 로 연결되어 있다). 새 id 는 `day-{큰 번호+1}`부터 쓴다.
 * - 추가 후 날짜순으로 정렬하고 일차(dayNumber)와 일정 시작일·종료일을 다시 맞춘다.
 */
export function addDatesToItinerary(itineraries: Itinerary[], itineraryId: string, dates: string[]): AddDatesResult {
  const addedDayIds: string[] = [];
  const next = itineraries.map((itinerary) => {
    if (itinerary.id !== itineraryId) return itinerary;
    const have = new Set(itinerary.days.map((d) => d.date));
    const usedIds = new Set(itinerary.days.map((d) => d.id));
    let seq = itinerary.days.reduce((max, d) => Math.max(max, Number(/^day-(\d+)$/.exec(d.id)?.[1] ?? 0)), 0);
    const added: Itinerary['days'] = [];
    for (const date of [...dates].sort()) {
      if (!DATE_RE.test(date) || have.has(date)) continue;
      if (itinerary.days.length + added.length >= MAX_DAYS) break;
      do seq += 1;
      while (usedIds.has(`day-${seq}`));
      have.add(date);
      added.push({ id: `day-${seq}`, date, dayNumber: 0, places: [] });
      addedDayIds.push(`day-${seq}`);
    }
    return added.length === 0 ? itinerary : normalizeDays(itinerary, [...itinerary.days, ...added]);
  });
  return { itineraries: addedDayIds.length > 0 ? next : itineraries, addedDayIds };
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
 * 일정 이름·시작일·기본 날짜는 기본값을 쓰고, 저장본에서는 날짜별 장소·메모·제목과 뒤에 추가한 날짜만 가져온다.
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
      // 기본 날짜보다 적으면 깨진 저장본. 더 많은 것은 사용자가 뒤에 추가한 날짜다(아래에서 검증).
      if (!Array.isArray(saved.days) || saved.days.length < base.days.length) return null;

      const days: Itinerary['days'] = [];
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
      // 사용자가 추가한 날짜: id·날짜 형식이 맞고, 기존 날짜와 겹치지 않을 때만 받아들인다(이어지지 않아도 된다).
      const baseIds = new Set(base.days.map((d) => d.id));
      const extras = saved.days.filter((d: unknown) => !baseIds.has((d as { id?: unknown })?.id as string));
      for (const raw of extras) {
        const e = raw as { id?: unknown; date?: unknown; places?: unknown; memo?: unknown; title?: unknown };
        if (!isStr(e.id) || !e.id || !isStr(e.date) || !DATE_RE.test(e.date)) return null;
        if (!Array.isArray(e.places) || !e.places.every(validPlace)) return null;
        if (days.some((d) => d.id === e.id || d.date === e.date)) return null;
        const places = e.places as ItineraryPlace[];
        if (new Set(places.map((p) => p.id)).size !== places.length) return null;
        if (days.length >= MAX_DAYS) return null;
        days.push({
          id: e.id,
          date: e.date,
          dayNumber: 0,
          places: places.map((p) => ({ ...p, visitId: p.visitId ?? visitKey(base.id, e.id as string, p.id) })),
          memo: isStr(e.memo) && e.memo ? e.memo : undefined,
          title: isStr(e.title) ? e.title.trim() || undefined : undefined,
        });
      }
      result.push(normalizeDays(base, days));
    }
    return result;
  } catch {
    return null;
  }
}
