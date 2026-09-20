/** 날짜는 앱 전체에서 'YYYY-MM-DD' 문자열로만 다룬다 (DB의 date 타입과 같은 표현). */
export type DateString = string;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function todayString(): DateString {
  const now = new Date();
  // toISOString 은 UTC 기준이라 한국 시간대에서 하루 밀릴 수 있다.
  return format(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function format(year: number, month: number, day: number): DateString {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' 를 현지 자정 Date 로 — new Date(문자열) 은 UTC 로 읽혀 하루가 밀린다. */
function toDate(value: DateString) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: DateString, days: number): DateString {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return format(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** 시작일과 종료일 사이의 모든 날짜 (양 끝 포함). */
export function datesBetween(start: DateString, end: DateString): DateString[] {
  const out: DateString[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function nightsAndDays(start: DateString, end: DateString) {
  const nights = datesBetween(start, end).length - 1;
  return { nights, days: nights + 1 };
}

/** "10월 2일 (금)" */
export function formatDay(value: DateString) {
  const date = toDate(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

/** "2026년 10월 2일 (금) – 10월 5일 (월) · 3박 4일" */
export function formatRange(start: DateString, end: DateString) {
  const startDate = toDate(start);
  const { nights, days } = nightsAndDays(start, end);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);

  const head = `${startDate.getFullYear()}년 ${formatDay(start)}`;
  const tail = sameYear ? formatDay(end) : `${end.slice(0, 4)}년 ${formatDay(end)}`;
  const nightsLabel = nights === 0 ? '당일' : `${nights}박 ${days}일`;

  return `${head} – ${tail} · ${nightsLabel}`;
}

/** 목록 카드처럼 좁은 자리에 쓰는 짧은 형태: "10월 2일 – 10월 5일" */
export function formatRangeShort(start: DateString, end: DateString) {
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  return `${Number(sm)}월 ${Number(sd)}일 – ${Number(em)}월 ${Number(ed)}일`;
}
