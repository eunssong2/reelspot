/**
 * 일정 화면에서 쓰는 날짜 표시 유틸. ISO 날짜 문자열(YYYY-MM-DD)만 다룬다.
 *
 * `new Date(isoString)` 은 UTC 자정으로 해석되어 기기 시간대에 따라 하루 앞뒤로 밀릴 수 있다.
 * 그래서 문자열을 직접 분해해 연·월·일로만 계산하고, 요일 계산에만 로컬 Date 를 쓴다(시간 성분 없이
 * 연/월/일로 생성하므로 시간대 변환이 끼어들지 않는다).
 */

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10));
  return { y, m, d };
}

/** 요일 글자 하나(예: '토'). */
export function dayOfWeekLabel(iso: string): string {
  const { y, m, d } = parseIsoDate(iso);
  return DOW[new Date(y, m - 1, d).getDay()];
}

/** "10월 17일" */
export function monthDayLabel(iso: string): string {
  const { m, d } = parseIsoDate(iso);
  return `${m}월 ${d}일`;
}

/** "2026.10.17" */
export function dotDateLabel(iso: string): string {
  const { y, m, d } = parseIsoDate(iso);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/** "10.17" */
export function shortDotDateLabel(iso: string): string {
  const { m, d } = parseIsoDate(iso);
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/** "10월 17일 토요일" */
export function fullDateLabel(iso: string): string {
  const { y, m, d } = parseIsoDate(iso);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 ${dow}요일`;
}

/** 하루 일정이면 "2026.10.17 토요일", 여러 날이면 "2026.10.17 - 10.19". */
export function tripRangeLabel(startIso: string, endIso: string): string {
  if (startIso === endIso) {
    return `${dotDateLabel(startIso)} ${dayOfWeekLabel(startIso)}요일`;
  }
  return `${dotDateLabel(startIso)} - ${shortDotDateLabel(endIso)}`;
}

/**
 * 날짜 제목을 따로 적지 않았을 때 보여 주는 이름.
 * 여러 날 일정이면 "1일차 · 일정 이름", 하루 일정이면 일정 이름 그대로다.
 */
export function defaultDayTitle(itineraryName: string, dayNumber: number, dayCount: number): string {
  return dayCount > 1 ? `${dayNumber}일차 · ${itineraryName}` : itineraryName;
}
