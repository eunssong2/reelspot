import { IS_DEMO_BUILD } from '../../demo/config';
import { DEMO_AVATARS, DEMO_IMAGES, DEMO_VIDEOS } from '../../demo/demoAssets';

/**
 * 프로토타입 전용 mock 데이터(모임·초기 일정·템플릿). 서버·DB 없이 화면만 보여 준다.
 * 모임 커버·일정 장소는 이모지 + 배경색으로, 스팟원 프로필과 장소 기록 썸네일은
 * 공개 플레이스홀더 이미지 URL(picsum.photos, i.pravatar.cc)로 실제 사진처럼 보여 준다.
 */

// ---------- 내 모임 ----------

export type CoverKind = 'beach' | 'sunset' | 'town';

/** 방 만들 때 고르는 동영상 길이(초). 스팟원 전원이 이 길이로만 올린다. */
export type ClipSeconds = 5 | 10 | 15;
export const CLIP_SECONDS_OPTIONS: ClipSeconds[] = [5, 10, 15];

export interface Trip {
  id: string;
  name: string;
  destination: string;
  period: string;
  memberCount: number;
  cover: CoverKind;
  /** 일정 화면 부제 */
  subtitle: string;
  /**
   * 이 방의 동영상 길이. 방장이 방을 만들 때 정하고 이후 모든 업로드에 그대로 적용된다.
   * 방 만들기 화면에 아직 이 값을 고르는 UI는 없어 mock 값으로 고정해 뒀다 — 업로드 화면 검증용.
   */
  clipSeconds: ClipSeconds;
}

export const TRIPS: Trip[] = [
  {
    id: 'trip1',
    name: '퇴근 후 우리',
    destination: '회사 밖에서 만나는 소소한 저녁',
    period: '오늘도 기록 중',
    memberCount: 5,
    cover: 'beach',
    subtitle: '우리의 일상 스팟',
    clipSeconds: 10,
  },
  {
    id: 'trip2',
    name: '주말 산책단',
    destination: '걷다가 발견한 동네의 좋은 곳',
    period: '매주 토요일',
    memberCount: 4,
    cover: 'sunset',
    subtitle: '천천히 걷고 함께 남기기',
    clipSeconds: 5,
  },
  {
    id: 'trip3',
    name: '맛있는 사이',
    destination: '같이 먹어서 더 기억나는 한 끼',
    period: '이번 달 8개 스팟',
    memberCount: 6,
    cover: 'town',
    subtitle: '우리만의 맛집 아카이브',
    clipSeconds: 15,
  },
];

// ---------- 스팟원 ----------

/** 여행 방에 함께하는 스팟원. 프로토타입은 로그인 없이 항상 첫 번째(나)를 기준으로 화면을 보여 준다. */
export interface TripMember {
  id: string;
  name: string;
  /**
   * 원형 프로필 사진. 문자열이면 URL, 숫자면 앱에 포함된 자산(require)이다.
   * 일반 프로토타입은 공개 플레이스홀더 인물 사진을 쓰고, 데모 APK 는 인터넷 없이도 보이도록 번들 자산을 쓴다.
   */
  avatarUrl: string | number;
  /** 지금 이 프로토타입을 보고 있는 사람인지. 내 카드에서만 업로드로 이동할 수 있다. */
  isMe?: boolean;
}

/** 데모 빌드에서는 번들 자산을, 아니면 기존 URL 을 쓴다. */
const avatar = (demoAsset: number, url: string): string | number => (IS_DEMO_BUILD ? demoAsset : url);

const ME: TripMember = { id: 'me', name: '나', avatarUrl: avatar(DEMO_AVATARS.me, 'https://i.pravatar.cc/150?img=12'), isMe: true };

/** 나를 제외한 스팟원 후보. 모임 정원(memberCount)만큼 앞에서부터 채운다. */
const MEMBER_POOL: TripMember[] = [
  { id: 'm-suah', name: '수아', avatarUrl: avatar(DEMO_AVATARS.suah, 'https://i.pravatar.cc/150?img=47') },
  { id: 'm-doyun', name: '도윤', avatarUrl: avatar(DEMO_AVATARS.doyun, 'https://i.pravatar.cc/150?img=13') },
  { id: 'm-haeun', name: '하은', avatarUrl: avatar(DEMO_AVATARS.haeun, 'https://i.pravatar.cc/150?img=32') },
  { id: 'm-jiho', name: '지호', avatarUrl: avatar(DEMO_AVATARS.jiho, 'https://i.pravatar.cc/150?img=22') },
  { id: 'm-yuna', name: '유나', avatarUrl: 'https://i.pravatar.cc/150?img=39' },
];

/** 이 모임의 스팟원 목록(나 + 정원만큼의 나머지 스팟원). 항상 '나'가 첫 번째다. */
export const membersFor = (trip: Trip): TripMember[] => [ME, ...MEMBER_POOL.slice(0, Math.max(0, trip.memberCount - 1))];

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
  /** 직접 등록한 장소에서 지도로 지정한 위치(선택) */
  lat?: number;
  lng?: number;
  /**
   * 방문 시간(HH:mm, 24시간제). 장소 검색에서 막 추가했을 때는 없다(undefined) —
   * "순서 편집"에서 정할 때까지 임의의 시간을 넣지 않고 화면에서 "시간 미정"으로 보여준다.
   */
  visitTime?: string;
  /**
   * 방문 장소 식별자. 같은 장소(id)라도 여행(일정)·날짜가 다르면 서로 다른 방문이므로,
   * 장소 기록은 이 값(없으면 src/demo/records.ts 의 visitKey)으로 구분한다.
   */
  visitId?: string;
}

/** 일정의 하루. 같은 일정 안에서 날짜별로 장소를 따로 관리한다. */
export interface ItineraryDay {
  /** 일정 안에서 날짜를 가리키는 고정 id(라우팅용). 날짜 문자열 자체는 date 에 있다. */
  id: string;
  /** ISO 날짜(YYYY-MM-DD). */
  date: string;
  /** 일정 시작일 기준 1부터 시작하는 일차. */
  dayNumber: number;
  /** 날짜별 제목. 없으면 화면에서 "10월 17일의 장소"처럼 만들어 보여준다. */
  title?: string;
  places: ItineraryPlace[];
  /** 이 날짜의 장소 구성에 대한 메모(순서 편집에서 적는다, 최대 100자). */
  memo?: string;
  /** 취소된 날짜(기록은 남기고 새로 올릴 수 없다). 모임 달력에서 취소선으로 보인다. */
  cancelled?: boolean;
}

/**
 * 이미 만들어진 일정(여행). "모임"(Trip) 안에 여러 개가 있을 수 있다 —
 * 일정을 새로 만드는 기능(이름·기간 입력)은 다른 팀원 담당이라 여기서는 조회만 한다.
 * 지금은 모임 하나(trip1)에 샘플 일정 하나만 둔다.
 */
export interface Itinerary {
  id: string;
  /** 이 일정이 속한 모임(Trip.id). 모임 id 와 일정 id 는 같은 값이 아니다. */
  tripId: string;
  name: string;
  /** ISO 날짜(YYYY-MM-DD). 하루 일정이면 startDate === endDate. */
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
}

export const ITINERARIES: Itinerary[] = [
  {
    id: 'itin-seoul-1',
    tripId: 'trip1',
    name: '우리의 서울 여행',
    startDate: '2026-10-17',
    endDate: '2026-10-19',
    days: [
      {
        id: 'day-1',
        date: '2026-10-17',
        dayNumber: 1,
        title: '성수에서 느긋한 오후',
        places: [
          { id: 'mock-gyeongbok', name: '오후의 커피', address: '서울 성동구 연무장길 21', categoryLabel: '카페', emoji: '☕', tint: '#FFE7D6', visitTime: '14:00' },
          { id: 'mock-hanbok', name: '서울숲 산책길', address: '서울 성동구 뚝섬로 273', categoryLabel: '산책', emoji: '🌳', tint: '#E3F1DC', visitTime: '15:10' },
          { id: 'mock-moca', name: '작은책방 하루', address: '서울 성동구 서울숲길 18', categoryLabel: '문화', emoji: '📚', tint: '#E8E2F4', visitTime: '16:20' },
        ],
        memo: '커피 마시고 서울숲 걸어요',
      },
      {
        id: 'day-2',
        date: '2026-10-18',
        dayNumber: 2,
        title: '연남동 골목 산책',
        places: [
          { id: 'mock-gwanghwamun', name: '골목 분식집', address: '서울 마포구 동교로 36', categoryLabel: '맛집', emoji: '🍜', tint: '#FDE4DB' },
          { id: 'mock-hanok-spa', name: '한강 노을 벤치', address: '서울 마포구 한강난지로 162', categoryLabel: '산책', emoji: '🌅', tint: '#FFECCB' },
        ],
      },
      {
        id: 'day-3',
        date: '2026-10-19',
        dayNumber: 3,
        places: [],
      },
    ],
  },
];

/** 모임(tripId)에 속한 일정 목록을 돌려준다. 실제 데이터 연동 전까지 쓰는 조회 어댑터. */
export const itinerariesForTrip = (tripId: string): Itinerary[] => ITINERARIES.filter((it) => it.tripId === tripId);

// ---------- 장소별 기록 ----------

/** 기록 한 장(사진 또는 동영상 한 건). 실제 이미지 파일이 없는 프로토타입이라 공개 플레이스홀더 사진 URL을 쓴다. */
export interface PlaceRecordItem {
  id: string;
  kind: MediaKind;
  /** 썸네일 이미지: URL(string) 또는 번들 자산(number). 사진은 사진 자체, 동영상은 커버 프레임이다. */
  imageUrl: string | number;
  /** 동영상일 때만: 앱에 포함된 재생 가능한 영상 자산(require). 없는 동영상은 목록에 두지 않는다. */
  videoSource?: number;
  /** 동영상일 때만: 목록에 보여줄 길이(mm:ss 문자열) */
  durationLabel?: string;
  /** 올릴 때 같이 적은 짧은 설명. 없으면 화면에서 설명 줄을 보여주지 않는다. */
  caption?: string;
}

/** 한 스팟원이 한 장소에 올린 기록 묶음(여러 장 가능). */
export interface PlaceRecord {
  id: string;
  /** membersFor() 가 반환하는 TripMember.id */
  memberId: string;
  /** 올린 시각(상대 시간 표시용 문자열, 예: '방금 전', '12분 전') */
  time: string;
  items: PlaceRecordItem[];
}

const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/400/400`;

/**
 * 장소 id → 그 장소에 이미 올라온 스팟원별 기록.
 * 아직 기록이 없는 장소는 이 맵에 없어도 된다(빈 배열과 동일하게 다룬다).
 * 'me' 기록은 일부러 넣지 않는다 — 장소 기록 화면의 "내 순간 올리기"는 별도 영역이다.
 */
export const PLACE_RECORDS: Record<string, PlaceRecord[]> = {
  // 브이로그 만들기 예시: 장소마다 기록 4개 또는 2개(사진·동영상 섞음)
  'vlog-cafe': [
    {
      id: 'rv-vlog-cafe',
      memberId: 'm-suah',
      time: '10.20 18:42',
      items: [
        { id: 'vc1', kind: 'photo', imageUrl: thumb('vlog-cafe-1'), caption: '라떼 한 잔' },
        { id: 'vc2', kind: 'photo', imageUrl: thumb('vlog-cafe-2') },
        { id: 'vc3', kind: 'video', imageUrl: DEMO_IMAGES.videoCafePoster, videoSource: DEMO_VIDEOS.cafe.source, durationLabel: `0:0${DEMO_VIDEOS.cafe.seconds}` },
        { id: 'vc4', kind: 'video', imageUrl: DEMO_IMAGES.videoForestPoster, videoSource: DEMO_VIDEOS.forest.source, durationLabel: `0:0${DEMO_VIDEOS.forest.seconds}` },
      ],
    },
  ],
  'vlog-park': [
    {
      id: 'rv-vlog-park',
      memberId: 'm-doyun',
      time: '10.20 19:51',
      items: [
        { id: 'vp1', kind: 'photo', imageUrl: thumb('vlog-park-1'), caption: '노을이 예뻐요' },
        { id: 'vp2', kind: 'video', imageUrl: DEMO_IMAGES.videoForestPoster, videoSource: DEMO_VIDEOS.forest.source, durationLabel: `0:0${DEMO_VIDEOS.forest.seconds}` },
      ],
    },
  ],
  'vlog-noodle': [
    {
      id: 'rv-vlog-noodle',
      memberId: 'm-suah',
      time: '10.21 12:20',
      items: [
        { id: 'vn1', kind: 'photo', imageUrl: thumb('vlog-noodle-1') },
        { id: 'vn2', kind: 'photo', imageUrl: thumb('vlog-noodle-2'), caption: '국물이 진해요' },
        { id: 'vn3', kind: 'photo', imageUrl: thumb('vlog-noodle-3') },
        { id: 'vn4', kind: 'photo', imageUrl: thumb('vlog-noodle-4') },
      ],
    },
  ],
  'vlog-book': [
    {
      id: 'rv-vlog-book',
      memberId: 'm-doyun',
      time: '10.21 14:44',
      items: [
        { id: 'vb1', kind: 'video', imageUrl: DEMO_IMAGES.videoCafePoster, videoSource: DEMO_VIDEOS.cafe.source, durationLabel: `0:0${DEMO_VIDEOS.cafe.seconds}` },
        { id: 'vb2', kind: 'video', imageUrl: DEMO_IMAGES.videoForestPoster, videoSource: DEMO_VIDEOS.forest.source, durationLabel: `0:0${DEMO_VIDEOS.forest.seconds}` },
      ],
    },
  ],
  'vlog-bridge': [
    {
      id: 'rv-vlog-bridge',
      memberId: 'm-suah',
      time: '10.22 17:08',
      items: [
        { id: 'vg1', kind: 'photo', imageUrl: thumb('vlog-bridge-1') },
        { id: 'vg2', kind: 'photo', imageUrl: thumb('vlog-bridge-2') },
        { id: 'vg3', kind: 'photo', imageUrl: thumb('vlog-bridge-3') },
        { id: 'vg4', kind: 'video', imageUrl: DEMO_IMAGES.videoCafePoster, videoSource: DEMO_VIDEOS.cafe.source, durationLabel: `0:0${DEMO_VIDEOS.cafe.seconds}` },
      ],
    },
  ],
  'vlog-picnic': [
    {
      id: 'rv-vlog-picnic',
      memberId: 'm-doyun',
      time: '10.22 18:35',
      items: [
        { id: 'vk1', kind: 'photo', imageUrl: thumb('vlog-picnic-1'), caption: '돗자리 펴고' },
        { id: 'vk2', kind: 'photo', imageUrl: thumb('vlog-picnic-2') },
      ],
    },
  ],
  'mock-gyeongbok': [
    {
      id: 'r1',
      memberId: 'm-suah',
      time: '방금 전',
      // 5장(4장 초과) — 갤러리의 "+N" 남은 개수 표시를 확인할 수 있게 일부러 4장을 넘겼다.
      items: [
        { id: 'r1-1', kind: 'photo', imageUrl: thumb('gyeongbok-suah-1'), caption: '커피 한 잔의 여유' },
        { id: 'r1-2', kind: 'photo', imageUrl: thumb('gyeongbok-suah-2'), caption: '햇살 좋은 창가 자리' },
        { id: 'r1-3', kind: 'photo', imageUrl: thumb('gyeongbok-suah-3') },
        { id: 'r1-4', kind: 'photo', imageUrl: thumb('gyeongbok-suah-4') },
        { id: 'r1-5', kind: 'photo', imageUrl: thumb('gyeongbok-suah-5') },
      ],
    },
    {
      id: 'r2',
      memberId: 'm-doyun',
      time: '12분 전',
      items: [
        { id: 'r2-1', kind: 'video', imageUrl: thumb('gyeongbok-doyun-1'), durationLabel: '0:08' },
        { id: 'r2-2', kind: 'video', imageUrl: thumb('gyeongbok-doyun-2'), durationLabel: '0:15' },
      ],
    },
  ],
};

// ---------- 사진·동영상 템플릿 ----------

/** [x, y, 너비, 높이] — 모두 0~1 비율 */
export type Rect = [number, number, number, number];

/** 칸을 감싸는 테두리 모양: 폴라로이드(아래가 넓은 흰 테두리) · 카드(얇은 흰 테두리) */
export type CellLook = 'polaroid' | 'card';

export interface Template {
  id: string;
  cuts: number;
  label: string;
  rects: Rect[];
  /** 칸마다 기울이는 각도(도). 없으면 반듯하게 */
  rots?: number[];
  /** 칸 테두리 모양. 없으면 테두리 없이 사진만 */
  look?: CellLook;
  /** 장면 바탕색(칸 사이 틈이 이 색으로 보인다). 없으면 기본 회색 */
  bg?: string;
}

const cols = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [i / n, 0, 1 / n, 1]);
const rows = (n: number): Rect[] => Array.from({ length: n }, (_, i) => [0, i / n, 1, 1 / n]);

export const MAX_CUTS = 5;
export const CUT_OPTIONS = [1, 2, 3, 4, 5];

export const TEMPLATES: Template[] = [
  { id: 'c1-full', cuts: 1, label: '전체', rects: [[0, 0, 1, 1]] },
  { id: 'c1-frame', cuts: 1, label: '프레임', rects: [[0.12, 0.12, 0.76, 0.76]] },
  { id: 'c1-cinema', cuts: 1, label: '시네마', rects: [[0, 0.2, 1, 0.6]] },
  { id: 'c1-small', cuts: 1, label: '작은 프레임', rects: [[0.2, 0.2, 0.6, 0.6]] },
  { id: 'c1-polaroid', cuts: 1, label: '폴라로이드', rects: [[0.08, 0.08, 0.84, 0.7]] },
  { id: 'c1-tall', cuts: 1, label: '좁게', rects: [[0.15, 0, 0.7, 1]] },
  { id: 'p1-card-tilt', cuts: 1, label: '기울인 카드', rects: [[0.1, 0.12, 0.8, 0.7]], rots: [-4], look: 'card', bg: '#111' },
  { id: 'p1-tilt', cuts: 1, label: '기울인 폴라로이드', rects: [[0.1, 0.1, 0.8, 0.62]], rots: [-3], look: 'polaroid', bg: '#111' },

  { id: 'c2-cols', cuts: 2, label: '좌우 2분할', rects: cols(2) },
  { id: 'c2-rows', cuts: 2, label: '상하 2분할', rects: rows(2) },
  { id: 'c2-wide', cuts: 2, label: '좌측 강조', rects: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]] },
  { id: 'c2-top', cuts: 2, label: '상단 강조', rects: [[0, 0, 1, 0.65], [0, 0.65, 1, 0.35]] },
  { id: 'c2-pip', cuts: 2, label: '작은 창', rects: [[0, 0, 1, 1], [0.54, 0.6, 0.4, 0.34]] },
  { id: 'c2-pip-top', cuts: 2, label: '작은 창 (위)', rects: [[0, 0, 1, 1], [0.06, 0.06, 0.4, 0.3]] },
  { id: 'c2-right', cuts: 2, label: '우측 강조', rects: [[0, 0, 0.38, 1], [0.38, 0, 0.62, 1]] },
  { id: 'c2-bottom', cuts: 2, label: '하단 강조', rects: [[0, 0, 1, 0.35], [0, 0.35, 1, 0.65]] },
  { id: 'c2-card-cols', cuts: 2, label: '카드 2장', rects: [[0.04, 0.1, 0.44, 0.8], [0.52, 0.1, 0.44, 0.8]], bg: '#111' },
  { id: 'c2-card-rows', cuts: 2, label: '카드 위아래', rects: [[0.08, 0.04, 0.84, 0.44], [0.08, 0.52, 0.84, 0.44]], bg: '#111' },
  { id: 'p2-stack', cuts: 2, label: '폴라로이드 2장', rects: [[0.1, 0.05, 0.8, 0.43], [0.1, 0.5, 0.8, 0.43]], rots: [-3, 3], look: 'polaroid', bg: '#111' },
  { id: 'p2-side', cuts: 2, label: '나란히 폴라로이드', rects: [[0.04, 0.2, 0.46, 0.5], [0.5, 0.28, 0.46, 0.5]], rots: [-5, 5], look: 'polaroid', bg: '#111' },
  { id: 'p2-diag', cuts: 2, label: '사선 폴라로이드', rects: [[0.06, 0.06, 0.6, 0.42], [0.34, 0.5, 0.6, 0.42]], rots: [-6, 5], look: 'polaroid', bg: '#111' },
  { id: 'p2-tilt', cuts: 2, label: '기울인 카드', rects: [[0.06, 0.08, 0.6, 0.4], [0.34, 0.5, 0.6, 0.4]], rots: [-5, 5], look: 'card', bg: '#111' },
  { id: 'c2-overlap', cuts: 2, label: '겹치기', rects: [[0.05, 0.08, 0.62, 0.55], [0.33, 0.4, 0.62, 0.5]] },

  { id: 'c3-cols', cuts: 3, label: '세로 3분할', rects: cols(3) },
  { id: 'c3-rows', cuts: 3, label: '가로 3분할', rects: rows(3) },
  { id: 'c3-big', cuts: 3, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'c3-top', cuts: 3, label: '상단 크게', rects: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'c3-mosaic', cuts: 3, label: '모자이크', rects: [[0, 0, 0.62, 0.6], [0.62, 0, 0.38, 0.6], [0, 0.6, 1, 0.4]] },
  { id: 'c3-right', cuts: 3, label: '우측 크게', rects: [[0.5, 0, 0.5, 1], [0, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]] },
  { id: 'c3-bottom', cuts: 3, label: '하단 크게', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1, 0.5]] },
  { id: 'c3-card-rows', cuts: 3, label: '카드 3장', rects: [[0.05, 0.05, 0.9, 0.28], [0.05, 0.36, 0.9, 0.28], [0.05, 0.67, 0.9, 0.28]], bg: '#111' },
  { id: 'p3-scatter', cuts: 3, label: '흩뿌린 폴라로이드', rects: [[0.06, 0.04, 0.56, 0.3], [0.38, 0.32, 0.56, 0.3], [0.06, 0.6, 0.56, 0.3]], rots: [-6, 5, -4], look: 'polaroid', bg: '#111' },
  { id: 'p3-trio', cuts: 3, label: '삼각 폴라로이드', rects: [[0.04, 0.08, 0.5, 0.34], [0.46, 0.24, 0.5, 0.34], [0.2, 0.58, 0.6, 0.34]], rots: [-5, 6, -3], look: 'polaroid', bg: '#111' },
  { id: 'p3-fan', cuts: 3, label: '부채꼴 폴라로이드', rects: [[0.1, 0.1, 0.55, 0.5], [0.3, 0.2, 0.55, 0.5], [0.2, 0.4, 0.6, 0.5]], rots: [-12, 8, -2], look: 'polaroid', bg: '#111' },
  { id: 'p3-card', cuts: 3, label: '흩뿌린 카드', rects: [[0.06, 0.04, 0.56, 0.3], [0.38, 0.32, 0.56, 0.3], [0.06, 0.6, 0.56, 0.3]], rots: [-6, 5, -4], look: 'card', bg: '#111' },
  { id: 'p3-pile', cuts: 3, label: '쌓아 놓은 사진', rects: [[0.12, 0.08, 0.76, 0.46], [0.1, 0.26, 0.76, 0.46], [0.14, 0.44, 0.76, 0.46]], rots: [-5, 4, -2], look: 'polaroid', bg: '#111' },
  { id: 'c3-film', cuts: 3, label: '필름 스트립', rects: [[0, 0.1, 1, 0.26], [0, 0.37, 1, 0.26], [0, 0.64, 1, 0.26]], bg: '#000' },
  { id: 'c3-pip', cuts: 3, label: '작은 창 2개', rects: [[0, 0, 1, 1], [0.05, 0.05, 0.3, 0.22], [0.05, 0.3, 0.3, 0.22]] },

  { id: 'c4-grid', cuts: 4, label: '2×2 격자', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'c4-cols', cuts: 4, label: '세로 4분할', rects: cols(4) },
  { id: 'c4-rows', cuts: 4, label: '가로 4분할', rects: rows(4) },
  { id: 'c4-left', cuts: 4, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1 / 3], [0.5, 1 / 3, 0.5, 1 / 3], [0.5, 2 / 3, 0.5, 1 / 3]] },
  { id: 'c4-cards', cuts: 4, label: '카드 격자', rects: [[0.05, 0.05, 0.43, 0.43], [0.52, 0.05, 0.43, 0.43], [0.05, 0.52, 0.43, 0.43], [0.52, 0.52, 0.43, 0.43]], bg: '#111' },
  { id: 'c4-right', cuts: 4, label: '우측 크게', rects: [[0.5, 0, 0.5, 1], [0, 0, 0.5, 1 / 3], [0, 1 / 3, 0.5, 1 / 3], [0, 2 / 3, 0.5, 1 / 3]] },
  { id: 'c4-bottom', cuts: 4, label: '하단 크게', rects: [[0, 0, 1 / 3, 0.45], [1 / 3, 0, 1 / 3, 0.45], [2 / 3, 0, 1 / 3, 0.45], [0, 0.45, 1, 0.55]] },
  { id: 'p4-scatter', cuts: 4, label: '흩뿌린 폴라로이드', rects: [[0.04, 0.04, 0.5, 0.26], [0.46, 0.1, 0.5, 0.26], [0.04, 0.42, 0.5, 0.26], [0.46, 0.5, 0.5, 0.26]], rots: [-7, 6, 5, -6], look: 'polaroid', bg: '#111' },
  { id: 'p4-wall', cuts: 4, label: '폴라로이드 벽', rects: [[0.04, 0.06, 0.46, 0.4], [0.5, 0.04, 0.46, 0.4], [0.04, 0.5, 0.46, 0.4], [0.5, 0.52, 0.46, 0.4]], rots: [-3, 3, 3, -3], look: 'polaroid', bg: '#111' },
  { id: 'p4-pile', cuts: 4, label: '쌓아 놓은 사진', rects: [[0.1, 0.05, 0.7, 0.3], [0.2, 0.22, 0.7, 0.3], [0.08, 0.4, 0.7, 0.3], [0.2, 0.58, 0.7, 0.3]], rots: [-5, 4, -3, 3], look: 'polaroid', bg: '#111' },
  { id: 'p4-card', cuts: 4, label: '흩뿌린 카드', rects: [[0.04, 0.04, 0.5, 0.26], [0.46, 0.1, 0.5, 0.26], [0.04, 0.42, 0.5, 0.26], [0.46, 0.5, 0.5, 0.26]], rots: [-7, 6, 5, -6], look: 'card', bg: '#111' },
  { id: 'c4-stagger', cuts: 4, label: '엇갈림', rects: [[0, 0, 0.5, 0.6], [0.5, 0, 0.5, 0.4], [0, 0.6, 0.5, 0.4], [0.5, 0.4, 0.5, 0.6]] },
  { id: 'c4-top', cuts: 4, label: '상단 크게', rects: [[0, 0, 1, 0.55], [0, 0.55, 1 / 3, 0.45], [1 / 3, 0.55, 1 / 3, 0.45], [2 / 3, 0.55, 1 / 3, 0.45]] },

  { id: 'c5-mix', cuts: 5, label: '2+3 배열', rects: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
  { id: 'c5-cols', cuts: 5, label: '세로 5분할', rects: cols(5) },
  { id: 'c5-rows', cuts: 5, label: '가로 5분할', rects: rows(5) },
  { id: 'c5-cards', cuts: 5, label: '카드 5장', rects: [[0.05, 0.04, 0.9, 0.3], [0.05, 0.36, 0.43, 0.28], [0.52, 0.36, 0.43, 0.28], [0.05, 0.68, 0.43, 0.28], [0.52, 0.68, 0.43, 0.28]], bg: '#111' },
  { id: 'c5-bottom', cuts: 5, label: '하단 크게', rects: [[0, 0, 0.25, 0.5], [0.25, 0, 0.25, 0.5], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0, 0.5, 1, 0.5]] },
  { id: 'p5-scatter', cuts: 5, label: '흩뿌린 폴라로이드', rects: [[0.04, 0.03, 0.46, 0.24], [0.52, 0.06, 0.44, 0.24], [0.3, 0.31, 0.42, 0.24], [0.04, 0.58, 0.46, 0.24], [0.5, 0.62, 0.46, 0.24]], rots: [-8, 6, -3, 5, -6], look: 'polaroid', bg: '#111' },
  { id: 'p5-wall', cuts: 5, label: '폴라로이드 벽', rects: [[0.04, 0.03, 0.46, 0.3], [0.5, 0.03, 0.46, 0.3], [0.04, 0.35, 0.46, 0.3], [0.5, 0.35, 0.46, 0.3], [0.27, 0.67, 0.46, 0.3]], rots: [-3, 3, 3, -3, 0], look: 'polaroid', bg: '#111' },
  { id: 'p5-card', cuts: 5, label: '흩뿌린 카드', rects: [[0.04, 0.03, 0.46, 0.24], [0.52, 0.06, 0.44, 0.24], [0.3, 0.31, 0.42, 0.24], [0.04, 0.58, 0.46, 0.24], [0.5, 0.62, 0.46, 0.24]], rots: [-8, 6, -3, 5, -6], look: 'card', bg: '#111' },
  { id: 'p5-pile', cuts: 5, label: '쌓아 놓은 사진', rects: [[0.1, 0.04, 0.7, 0.3], [0.2, 0.16, 0.7, 0.3], [0.08, 0.3, 0.7, 0.3], [0.22, 0.45, 0.7, 0.3], [0.12, 0.6, 0.7, 0.3]], rots: [-6, 5, -4, 4, -2], look: 'polaroid', bg: '#111' },
  { id: 'c5-cross', cuts: 5, label: 'X 배치', rects: [[0, 0, 0.4, 0.4], [0.6, 0, 0.4, 0.4], [0.35, 0.35, 0.3, 0.3], [0, 0.6, 0.4, 0.4], [0.6, 0.6, 0.4, 0.4]] },
  { id: 'c5-top', cuts: 5, label: '상단 크게', rects: [[0, 0, 1, 0.4], [0, 0.4, 0.5, 0.3], [0.5, 0.4, 0.5, 0.3], [0, 0.7, 0.5, 0.3], [0.5, 0.7, 0.5, 0.3]] },
  { id: 'c5-big', cuts: 5, label: '좌측 크게', rects: [[0, 0, 0.5, 1], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]] },
];

/** 템플릿 묶음(선택 화면의 탭). 순서가 화면에 보이는 순서다. */
export const TEMPLATE_GROUPS = [
  { id: 'basic', label: '기본 분할' },
  { id: 'polaroid', label: '폴라로이드' },
  { id: 'card', label: '카드·여백' },
  { id: 'focus', label: '강조 배치' },
  { id: 'overlap', label: '겹치기' },
] as const;
export type TemplateGroupId = (typeof TEMPLATE_GROUPS)[number]['id'];

const CARD_IDS = new Set(['c1-frame', 'c1-small', 'c1-polaroid', 'c1-tall', 'c1-cinema', 'c3-film']);
const OVERLAP_IDS = new Set(['c2-pip', 'c2-pip-top', 'c2-overlap', 'c3-pip', 'c5-cross']);
const BASIC_IDS = new Set(['c1-full', 'c2-cols', 'c2-rows', 'c3-cols', 'c3-rows', 'c4-grid', 'c4-cols', 'c4-rows', 'c5-cols', 'c5-rows']);

/** 한 템플릿이 속한 묶음: 기울이거나 테두리를 두른 것은 폴라로이드, 나머지는 모양으로 나눈다. */
export function templateGroup(t: Template): TemplateGroupId {
  if (t.look === 'polaroid' || t.id.startsWith('p')) return 'polaroid';
  if (t.id.includes('card') || CARD_IDS.has(t.id)) return 'card';
  if (OVERLAP_IDS.has(t.id)) return 'overlap';
  if (BASIC_IDS.has(t.id)) return 'basic';
  return 'focus';
}

export const templatesFor = (cuts: number): Template[] => TEMPLATES.filter((t) => t.cuts === cuts);
export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export type MediaKind = 'photo' | 'video';

/**
 * 프로필 및 계정 화면에 보여 줄 로그인 방식 예시. 프로토타입에는 로그인 기능이 없어 고정값이며,
 * 실제 서비스에서는 로그인한 계정의 공급자(카카오·구글 등)로 바뀐다.
 */
export const LOGIN_PROVIDER_EXAMPLE = { label: '카카오', color: '#FEE500' } as const;
