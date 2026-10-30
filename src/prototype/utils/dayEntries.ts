import type { Schedule } from '../mock/groupData';
import type { Itinerary } from '../mock/tripData';
import { addDays, type DateStr } from './calendar';
import { defaultDayTitle } from './date';

/** 모임 달력·일정 변경이 쓰는 "하루 일정" 한 줄. */
export interface DayEntry {
  dayId: string;
  date: DateStr;
  /** 날짜 제목. 적지 않았으면 "1일차 · 일정 이름" 같은 기본 이름 */
  title: string;
  places: number;
  firstPlace: string | null;
  /** 취소된 날짜 */
  cancelled: boolean;
}

/**
 * 일정을 하루씩 푼 목록. 일정 요약(날짜 목록)이 있으면 그 날짜들을, 아직 열어 본 적 없으면 시작~종료 기간의
 * 날짜마다 한 줄을 만든다(날짜 id 는 처음 열 때 만들어지는 day-1, day-2 … 와 같다).
 */
export function dayEntriesOf(sc: Schedule, itinerary?: Itinerary): DayEntry[] {
  if (itinerary && itinerary.days.length > 0) {
    return itinerary.days.map((day) => ({
      dayId: day.id,
      date: day.date,
      title: day.title?.trim() || defaultDayTitle(sc.title, day.dayNumber, itinerary.days.length),
      places: day.places.length,
      firstPlace: day.places[0]?.name ?? null,
      cancelled: Boolean(day.cancelled),
    }));
  }
  const out: DayEntry[] = [];
  const multi = sc.startDate !== sc.endDate;
  for (let d = sc.startDate, n = 1; d <= sc.endDate; d = addDays(d, 1), n += 1) {
    out.push({ dayId: `day-${n}`, date: d, title: defaultDayTitle(sc.title, n, multi ? 2 : 1), places: 0, firstPlace: null, cancelled: false });
  }
  return out;
}
