/**
 * 로그인~달력~초대 화면이 쓰는 날짜·글자 수 계산.
 * 날짜는 모두 'YYYY-MM-DD' 문자열이고 한국 시간(Asia/Seoul) 기준이다. 기기 시간대와 상관없이 같은 결과를 낸다.
 */

export type DateStr = string;

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 한국 시간의 오늘. */
export function todayKst(now = Date.now()): DateStr {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 문자열 날짜를 UTC 자정의 epoch ms 로 바꾼다(날짜 계산 전용, 시간대 영향 없음). */
const toUtc = (date: DateStr) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number): DateStr => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: DateStr, n: number): DateStr => fromUtc(toUtc(date) + n * DAY_MS);

/** b - a (일). */
export const diffDays = (a: DateStr, b: DateStr) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** 시작·종료 날짜를 포함한 날짜 수. 당일이면 1. */
export const inclusiveDays = (start: DateStr, end: DateStr) => diffDays(start, end) + 1;

/** 일정 하나에 담을 수 있는 최대 날짜 수(시작·종료 포함). */
export const MAX_SCHEDULE_DAYS = 366;

/** 0=월 … 6=일 (달력은 월요일 시작). */
export const mondayIndex = (date: DateStr) => (new Date(toUtc(date)).getUTCDay() + 6) % 7;

export const weekdayLabel = (date: DateStr) => WEEKDAYS[new Date(toUtc(date)).getUTCDay()];

export const monthKey = (date: DateStr) => date.slice(0, 7);

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** 달력에 그릴 6주(42일). 월요일부터 시작한다. */
export function monthGrid(month: string): DateStr[] {
  const first = `${month}-01`;
  const start = addDays(first, -mondayIndex(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const isWithin = (date: DateStr, start: DateStr, end: DateStr) => date >= start && date <= end;

export const rangesOverlap = (aStart: DateStr, aEnd: DateStr, bStart: DateStr, bEnd: DateStr) => aStart <= bEnd && bStart <= aEnd;

// ---------- 표시 형식 ----------

const md = (date: DateStr) => `${date.slice(5, 7)}.${date.slice(8, 10)}`;

/** 입력 필드용 `2026.10.17` */
export const dotDate = (date: DateStr) => date.replace(/-/g, '.');

/** 카드용 기간 `10.17–10.19` / 당일 `10.24` / 해를 넘기면 `2026.12.30–2027.01.02` */
export function periodLabel(start: DateStr, end: DateStr): string {
  if (start === end) return md(start);
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${dotDate(start)}–${dotDate(end)}`;
  return `${md(start)}–${md(end)}`;
}

/** `10월 17일` */
export const monthDayLabel = (date: DateStr) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

/** `2026년 10월` */
export const monthTitle = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

/** epoch ms → 한국 시간 `MM.DD HH:mm` */
export function stamp(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS).toISOString();
  return `${d.slice(5, 7)}.${d.slice(8, 10)} ${d.slice(11, 16)}`;
}

// ---------- 글자 수 ----------

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (
        Intl as unknown as { Segmenter: new (l: string, o: object) => { segment: (s: string) => Iterable<unknown> } }
      ).Segmenter('ko', {
        granularity: 'grapheme',
      })
    : null;

/** NFC 정규화·앞뒤 공백 제거 후 사용자에게 보이는 글자 단위로 센다(이모지 1자). */
export function countChars(value: string): number {
  const text = value.normalize('NFC').trim();
  if (!text) return 0;
  if (segmenter) return Array.from(segmenter.segment(text)).length;
  return Array.from(text).length;
}

/** 이름·제목 입력 검사. 통과하면 null, 아니면 화면에 띄울 문구. */
export function checkName(value: string, max: number, emptyMessage: string, overMessage: string): string | null {
  const n = countChars(value);
  if (n === 0) return emptyMessage;
  if (n > max) return overMessage;
  return null;
}
