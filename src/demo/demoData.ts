/**
 * 데모 전용 예시 데이터: 여행 일정, 장소별 기록, 오프라인 예시 검색용 장소 목록.
 * 모두 지어낸 예시이며 실제 계정·운영 데이터가 아니다.
 */
import type { Place } from '../prototype/map/types';
import type { Itinerary, PlaceRecord } from '../prototype/mock/tripData';
import { DEMO_ITINERARY_ID, DEMO_ONEDAY_ITINERARY_ID, DEMO_TRIP_ID } from './config';
import { DEMO_IMAGES, DEMO_VIDEOS } from './demoAssets';

/** 일정 안의 방문(장소+날짜) 식별자. 같은 장소도 날짜가 다르면 다른 방문이다. */
export const visitKey = (itineraryId: string, dayId: string, placeId: string) => `${itineraryId}/${dayId}/${placeId}`;

const IT = DEMO_ITINERARY_ID;
const OD = DEMO_ONEDAY_ITINERARY_ID;

type DemoPlace = Itinerary['days'][number]['places'][number];

const withVisit = (dayId: string, places: Omit<DemoPlace, 'visitId'>[], itineraryId: string = IT): DemoPlace[] =>
  places.map((p) => ({ ...p, visitId: visitKey(itineraryId, dayId, p.id) }));

/**
 * 처음 상태의 일정. 호출할 때마다 새 객체를 만든다(앱 상태가 이 원본을 바꾸지 않도록).
 *  - DAY 1: 장소 3개, 앞의 두 곳에 사진·동영상 기록 / 세 번째 장소는 기록 없음
 *  - DAY 2: 장소 2개, 첫 곳에만 기록 / 두 번째 장소는 기록 없음·방문 시간 미정
 *  - DAY 3: 장소 없음
 */
export function createDemoItineraries(): Itinerary[] {
  return [
    {
      id: IT,
      tripId: DEMO_TRIP_ID,
      name: '우리의 서울 여행',
      startDate: '2026-10-17',
      endDate: '2026-10-19',
      days: [
        {
          id: 'day-1',
          date: '2026-10-17',
          dayNumber: 1,
          title: '성수에서 느긋한 오후',
          memo: '커피 마시고 서울숲 걸어요',
          places: withVisit('day-1', [
            { id: 'demo-cafe', name: '오후의 커피', address: '서울 성동구 연무장길 21', categoryLabel: '카페', emoji: '☕', tint: '#FFE7D6', visitTime: '14:00' },
            { id: 'demo-forest', name: '서울숲 산책길', address: '서울 성동구 뚝섬로 273', categoryLabel: '산책', emoji: '🌳', tint: '#E3F1DC', visitTime: '15:10' },
            { id: 'demo-books', name: '작은책방 하루', address: '서울 성동구 서울숲길 18', categoryLabel: '문화', emoji: '📚', tint: '#E8E2F4', visitTime: '16:20' },
          ]),
        },
        {
          id: 'day-2',
          date: '2026-10-18',
          dayNumber: 2,
          title: '연남동 골목 산책',
          places: withVisit('day-2', [
            { id: 'demo-snack', name: '골목 분식집', address: '서울 마포구 동교로 36', categoryLabel: '맛집', emoji: '🍜', tint: '#FDE4DB', visitTime: '12:30' },
            { id: 'demo-river', name: '한강 노을 벤치', address: '서울 마포구 한강난지로 162', categoryLabel: '산책', emoji: '🌅', tint: '#FFECCB' },
          ]),
        },
        { id: 'day-3', date: '2026-10-19', dayNumber: 3, places: [] },
      ],
    },
    {
      // 하루짜리 일정: 날짜가 하나뿐이라 DAY 탭·DAY 배지 없이 그날의 장소만 보인다.
      id: OD,
      tripId: DEMO_TRIP_ID,
      name: '성수 당일치기',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      days: [
        {
          id: 'day-1',
          date: '2026-10-24',
          dayNumber: 1,
          title: '빵 먹고 전시 보고 저녁까지',
          places: withVisit(
            'day-1',
            [
              { id: 'demo-od-bakery', name: '아침 빵집', address: '서울 성동구 아차산로 7길 5', categoryLabel: '카페', emoji: '🥐', tint: '#FFEBD2', visitTime: '10:30' },
              { id: 'demo-od-gallery', name: '작은 전시관', address: '서울 성동구 성수이로 20', categoryLabel: '문화', emoji: '🖼️', tint: '#E8E2F4', visitTime: '13:00' },
              { id: 'demo-od-dinner', name: '골목 저녁 식당', address: '서울 성동구 성수일로 8길 3', categoryLabel: '맛집', emoji: '🍽️', tint: '#FDE4DB' },
            ],
            OD,
          ),
        },
      ],
    },
  ];
}

const photo = (id: string, imageUrl: number, caption?: string) => ({ id, kind: 'photo' as const, imageUrl, caption });

/**
 * 방문(visitKey) → 스팟원별 기록. 기록이 없는 방문은 키 자체가 없다.
 * 사진은 앱에 포함된 예시 일러스트, 동영상은 앱에 포함된 짧은 예시 영상(재생 가능)이다.
 */
export const DEMO_RECORDS: Record<string, PlaceRecord[]> = {
  [visitKey(IT, 'day-1', 'demo-cafe')]: [
    {
      id: 'r-cafe-suah',
      memberId: 'm-suah',
      time: '10.17 14:12',
      items: [
        photo('r-cafe-suah-1', DEMO_IMAGES.cafe1, '창가 자리 찾았어요'),
        photo('r-cafe-suah-2', DEMO_IMAGES.cafe2, '라떼 아트가 예뻐요'),
        photo('r-cafe-suah-3', DEMO_IMAGES.cafe3),
      ],
    },
    {
      id: 'r-cafe-doyun',
      memberId: 'm-doyun',
      time: '10.17 14:25',
      items: [
        {
          id: 'r-cafe-doyun-1',
          kind: 'video',
          imageUrl: DEMO_IMAGES.videoCafePoster,
          videoSource: DEMO_VIDEOS.cafe.source,
          durationLabel: `0:0${DEMO_VIDEOS.cafe.seconds}`,
          caption: '김이 모락모락',
        },
        photo('r-cafe-doyun-2', DEMO_IMAGES.cafe4, '디저트도 하나'),
      ],
    },
  ],
  [visitKey(IT, 'day-1', 'demo-forest')]: [
    {
      id: 'r-forest-jiho',
      memberId: 'm-jiho',
      time: '10.17 15:32',
      items: [photo('r-forest-jiho-1', DEMO_IMAGES.forest1, '단풍이 막 들기 시작했어요'), photo('r-forest-jiho-2', DEMO_IMAGES.forest2)],
    },
    {
      id: 'r-forest-doyun',
      memberId: 'm-doyun',
      time: '10.17 15:41',
      items: [
        {
          id: 'r-forest-doyun-1',
          kind: 'video',
          imageUrl: DEMO_IMAGES.videoForestPoster,
          videoSource: DEMO_VIDEOS.forest.source,
          durationLabel: `0:0${DEMO_VIDEOS.forest.seconds}`,
          caption: '산책길 한 바퀴',
        },
      ],
    },
    { id: 'r-forest-me', memberId: 'me', time: '10.17 15:50', items: [photo('r-forest-me-1', DEMO_IMAGES.forest3, '나도 한 장')] },
  ],
  [visitKey(OD, 'day-1', 'demo-od-bakery')]: [
    {
      id: 'r-od-bakery-suah',
      memberId: 'm-suah',
      time: '10.24 10:41',
      items: [photo('r-od-bakery-1', DEMO_IMAGES.cafe2, '갓 구운 크루아상'), photo('r-od-bakery-2', DEMO_IMAGES.cafe4)],
    },
  ],
  [visitKey(OD, 'day-1', 'demo-od-dinner')]: [
    {
      id: 'r-od-dinner-doyun',
      memberId: 'm-doyun',
      time: '10.24 19:05',
      items: [photo('r-od-dinner-1', DEMO_IMAGES.food2, '오늘의 마무리')],
    },
  ],
  [visitKey(IT, 'day-2', 'demo-snack')]: [
    {
      id: 'r-snack-haeun',
      memberId: 'm-haeun',
      time: '10.18 12:40',
      items: [photo('r-snack-haeun-1', DEMO_IMAGES.food1, '떡볶이 성공'), photo('r-snack-haeun-2', DEMO_IMAGES.food2, '순대는 필수')],
    },
    { id: 'r-snack-suah', memberId: 'm-suah', time: '10.18 12:55', items: [photo('r-snack-suah-1', DEMO_IMAGES.food3)] },
  ],
};

// ---------- 오프라인 예시 검색용 장소 ----------

type SampleSeed = Pick<Place, 'id' | 'name' | 'address' | 'category' | 'lat' | 'lng'>;

/**
 * 인터넷·지도 키 없이 검색을 체험하기 위한 예시 장소(실제 영업 정보가 아님).
 * category 는 카카오 카테고리 문자열 형식을 따라 기존 분류 규칙(src/prototype/map/placeStyle.ts)을 그대로 쓴다.
 * 좌표는 대략적인 위치이며 정확하지 않다.
 */
const SAMPLE_SEEDS: SampleSeed[] = [
  { id: 'demo-s-gyeongbok', name: '경복궁', address: '서울 종로구 사직로 161', category: '여행 > 관광,명소 > 고궁', lat: 37.5796, lng: 126.977 },
  { id: 'demo-s-bukchon', name: '북촌한옥마을', address: '서울 종로구 계동길 37', category: '여행 > 관광,명소 > 한옥마을', lat: 37.5826, lng: 126.983 },
  { id: 'demo-s-namsan', name: '남산 전망대', address: '서울 용산구 남산공원길 105', category: '여행 > 관광,명소 > 전망대', lat: 37.5512, lng: 126.9882 },
  { id: 'demo-s-museum', name: '삼청 현대미술관', address: '서울 종로구 삼청로 30', category: '문화,예술 > 미술관', lat: 37.5786, lng: 126.9801 },
  { id: 'demo-s-seoulforest', name: '서울숲 공원', address: '서울 성동구 뚝섬로 273', category: '여행 > 관광,명소 > 공원', lat: 37.5444, lng: 127.0374 },
  { id: 'demo-s-hangang', name: '여의도 한강공원', address: '서울 영등포구 여의동로 330', category: '여행 > 관광,명소 > 공원', lat: 37.5284, lng: 126.9326 },
  { id: 'demo-s-gyeongui', name: '경의선숲길 연남', address: '서울 마포구 연남동 239', category: '여행 > 관광,명소 > 공원', lat: 37.5612, lng: 126.925 },
  { id: 'demo-s-cafe-seongsu', name: '성수 로스터리 카페', address: '서울 성동구 연무장길 33', category: '음식점 > 카페 > 커피전문점', lat: 37.5446, lng: 127.056 },
  { id: 'demo-s-cafe-hannam', name: '한남 브런치 카페', address: '서울 용산구 이태원로 245', category: '음식점 > 카페 > 커피전문점', lat: 37.5342, lng: 127.0003 },
  { id: 'demo-s-cafe-ikseon', name: '익선동 한옥 카페', address: '서울 종로구 수표로28길 17', category: '음식점 > 카페 > 커피전문점', lat: 37.5742, lng: 126.9895 },
  { id: 'demo-s-cafe-hapjeong', name: '합정 디저트 카페', address: '서울 마포구 양화로 45', category: '음식점 > 카페 > 디저트카페', lat: 37.5496, lng: 126.9139 },
  { id: 'demo-s-market-gwangjang', name: '광장시장 먹거리', address: '서울 종로구 창경궁로 88', category: '음식점 > 한식', lat: 37.5701, lng: 126.9996 },
  { id: 'demo-s-market-mangwon', name: '망원시장 분식', address: '서울 마포구 포은로6길 27', category: '음식점 > 분식', lat: 37.556, lng: 126.9058 },
  { id: 'demo-s-food-euljiro', name: '을지로 골목 맥주집', address: '서울 중구 을지로12길 12', category: '음식점 > 술집', lat: 37.5662, lng: 126.9919 },
  { id: 'demo-s-food-itaewon', name: '이태원 파스타집', address: '서울 용산구 이태원로 190', category: '음식점 > 양식 > 이탈리안', lat: 37.5347, lng: 126.9946 },
  { id: 'demo-s-food-jongno', name: '종로 설렁탕집', address: '서울 종로구 종로 87', category: '음식점 > 한식 > 설렁탕', lat: 37.5704, lng: 126.9843 },
  { id: 'demo-s-stay-myeongdong', name: '명동 게스트 호텔', address: '서울 중구 명동길 14', category: '숙박 > 호텔', lat: 37.5636, lng: 126.9857 },
  { id: 'demo-s-stay-seoulst', name: '서울역 인근 호텔', address: '서울 중구 한강대로 405', category: '숙박 > 호텔', lat: 37.5547, lng: 126.9707 },
  { id: 'demo-s-stay-hongdae', name: '홍대 게스트하우스', address: '서울 마포구 와우산로 29', category: '숙박 > 게스트하우스', lat: 37.5563, lng: 126.9236 },
];

/** 예시 검색 결과임을 표시(sample)한 장소 목록. 화면은 이 표시를 보고 "예시" 안내를 붙인다. */
export const DEMO_SAMPLE_PLACES: Place[] = SAMPLE_SEEDS.map((s) => ({
  ...s,
  roadAddress: s.address,
  phone: '',
  sample: true,
}));
