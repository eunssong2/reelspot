import { PLACE_RECORDS, type ItineraryPlace, type PlaceRecord } from '../prototype/mock/tripData';
import { IS_DEMO_BUILD } from './config';
import { DEMO_RECORDS, visitKey } from './demoData';

export { visitKey };

/** 방문 식별자: 저장된 visitId 가 있으면 그것을, 없으면 일정·날짜·장소 id 로 만든다. */
export const visitIdOf = (itineraryId: string, dayId: string, place: Pick<ItineraryPlace, 'id' | 'visitId'>): string =>
  place.visitId ?? visitKey(itineraryId, dayId, place.id);

/**
 * 한 방문(일정·날짜·장소)의 스팟원 기록.
 * 데모에서는 방문 단위로 찾으므로 같은 장소를 다른 날짜에 담아도 기록이 섞이지 않는다.
 * 일반 프로토타입은 기존대로 장소 id 로 찾는다.
 */
export function recordsForVisit(
  itineraryId: string,
  dayId: string,
  place: Pick<ItineraryPlace, 'id' | 'visitId'>,
): PlaceRecord[] {
  if (IS_DEMO_BUILD) return DEMO_RECORDS[visitIdOf(itineraryId, dayId, place)] ?? [];
  return PLACE_RECORDS[place.id] ?? [];
}

const ABSOLUTE_TIME = /^(\d{2})\.(\d{2}) (\d{2}):(\d{2})$/;

/**
 * 게시물을 최신순/오래된순으로 정렬한다(원본 배열은 바꾸지 않는다).
 * 시각이 "MM.DD HH:mm" 이면 그 값으로, "방금 전"처럼 상대 표현이면 원래 순서(앞쪽이 더 최근)로 비교한다.
 * 같은 시각이면 원래 순서를 유지한다.
 */
export function sortRecords(records: PlaceRecord[], newestFirst: boolean): PlaceRecord[] {
  const key = (record: PlaceRecord, index: number): number => {
    const m = ABSOLUTE_TIME.exec(record.time);
    if (!m) return -index;
    const [, mo, d, h, mi] = m;
    return ((Number(mo) * 100 + Number(d)) * 100 + Number(h)) * 100 + Number(mi);
  };
  return records
    .map((record, index) => ({ record, index, k: key(record, index) }))
    .sort((a, b) => (newestFirst ? b.k - a.k : a.k - b.k) || a.index - b.index)
    .map((e) => e.record);
}

export interface MediaCounts {
  photos: number;
  videos: number;
  total: number;
}

export function countMedia(records: PlaceRecord[]): MediaCounts {
  let photos = 0;
  let videos = 0;
  for (const record of records) {
    for (const item of record.items) {
      if (item.kind === 'video') videos += 1;
      else photos += 1;
    }
  }
  return { photos, videos, total: photos + videos };
}
