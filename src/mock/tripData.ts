/**
 * 프로토타입 전용 mock 데이터(모임·초기 일정·템플릿). 서버·DB 없이 화면만 보여 준다.
 * 이미지 파일 대신 이모지 + 배경색으로 썸네일을 대신한다.
 */

// ---------- 내 모임 ----------

export type CoverKind = 'beach' | 'sunset' | 'town';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  period: string;
  memberCount: number;
  cover: CoverKind;
  /** 일정 화면 부제 */
  subtitle: string;
}

export const TRIPS: Trip[] = [
  {
    id: 'trip1',
    name: '여행모임 1',
    destination: '서울 근교 힐링 여행',
    period: '2025. 5. 12 ~ 5. 14',
    memberCount: 5,
    cover: 'beach',
    subtitle: '서울 근교 힐링 여행',
  },
  {
    id: 'trip2',
    name: '여행모임 2',
    destination: '제주도 이틀여행',
    period: '2025. 7. 1 ~ 7. 4',
    memberCount: 4,
    cover: 'sunset',
    subtitle: '제주도 이틀여행',
  },
  {
    id: 'trip3',
    name: '여행모임 3',
    destination: '유럽 배낭여행',
    period: '2025. 9. 10 ~ 9. 20',
    memberCount: 6,
    cover: 'town',
    subtitle: '유럽 배낭여행',
  },
];

/** 일정 화면 상단의 참여자 아바타(이모지) */
export const MEMBER_AVATARS = ['🧑', '👩', '🧒'];

// ---------- 일정 ----------

/**
 * 일정에 담긴 장소. 카카오 검색 결과(src/map/placeStyle.ts 에서 변환)와 초기 mock 이 같은 모양을 쓴다.
 * 이미지 대신 이모지 + 배경색으로 썸네일을 대신한다.
 */
export interface ItineraryPlace {
  /** 카카오 장소 ID (mock 은 'mock-…') */
  id: string;
  name: string;
  address: string;
  /** 관광지 · 맛집 · 카페 · 숙소 · 장소 */
  categoryLabel: string;
  emoji: string;
  /** 썸네일 배경색 */
  tint: string;
}

export interface TripDay {
  day: number;
  dateLabel: string;
  places: ItineraryPlace[];
}

/** 여행모임 1의 초기 일정(장소 검색에서 추가하면 앱 상태에서 늘어난다) */
export const INITIAL_DAYS: TripDay[] = [
  {
    day: 1,
    dateLabel: '5월 12일 (월)',
    places: [
      { id: 'mock-gyeongbok', name: '경복궁', address: '서울 종로구 사직로 161', categoryLabel: '관광지', emoji: '🏯', tint: '#F6D9A8' },
      { id: 'mock-hanbok', name: '빛나라한복', address: '서울 종로구 효자로 12', categoryLabel: '관광지', emoji: '👘', tint: '#F7C6D9' },
      { id: 'mock-moca', name: '국립현대미술관', address: '서울 종로구 삼청로 30', categoryLabel: '관광지', emoji: '🖼️', tint: '#CFE3F8' },
    ],
  },
  {
    day: 2,
    dateLabel: '5월 13일 (화)',
    places: [
      { id: 'mock-gwanghwamun', name: '광화문광장', address: '서울 종로구 세종대로 172', categoryLabel: '관광지', emoji: '⛲', tint: '#BFE3F5' },
      { id: 'mock-hanok-spa', name: '온천한옥', address: '서울 종로구 북촌로 15', categoryLabel: '숙소', emoji: '♨️', tint: '#F5D0C4' },
    ],
  },
];

// ---------- 사진·동영상 템플릿 ----------

/** [x, y, 너비, 높이] — 모두 0~1 비율 */
export type Rect = [number, number, number, number];

export interface Template {
  id: string;
  cuts: number;
  label: string;
  rects: Rect[];
}

const cols = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [i / n, 0, 1 / n, 1]);
const rows = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [0, i / n, 1, 1 / n]);

export const MAX_CUTS = 5;
export const CUT_OPTIONS = [1, 2, 3, 4, 5];

export const TEMPLATES: Template[] = [
  { id: 'c1-full', cuts: 1, label: '전체', rects: [[0, 0, 1, 1]] },
  { id: 'c1-frame', cuts: 1, label: '프레임', rects: [[0.12, 0.12, 0.76, 0.76]] },

  { id: 'c2-cols', cuts: 2, label: '좌우 2분할', rects: cols(2) },
  { id: 'c2-rows', cuts: 2, label: '상하 2분할', rects: rows(2) },
  { id: 'c2-wide', cuts: 2, label: '좌측 강조', rects: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]] },

  { id: 'c3-cols', cuts: 3, label: '세로 3분할', rects: cols(3) },
  { id: 'c3-rows', cuts: 3, label: '가로 3분할', rects: rows(3) },
  { id: 'c3-big', cuts: 3, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },

  { id: 'c4-grid', cuts: 4, label: '2×2 격자', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'c4-cols', cuts: 4, label: '세로 4분할', rects: cols(4) },
  { id: 'c4-top', cuts: 4, label: '상단 크게', rects: [[0, 0, 1, 0.55], [0, 0.55, 1 / 3, 0.45], [1 / 3, 0.55, 1 / 3, 0.45], [2 / 3, 0.55, 1 / 3, 0.45]] },

  { id: 'c5-mix', cuts: 5, label: '2+3 배열', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
  { id: 'c5-cols', cuts: 5, label: '세로 5분할', rects: cols(5) },
  { id: 'c5-big', cuts: 5, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]] },
];

export const templatesFor = (cuts: number): Template[] => TEMPLATES.filter((t) => t.cuts === cuts);
export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export type MediaKind = 'photo' | 'video';
