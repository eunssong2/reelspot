/** 첫 테스트 지역: 서울. 지도 이동은 막지 않고, 검색 결과만 서울특별시로 제한한다. */

/** 지도 초기 중심: 서울시청 */
export const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

/**
 * 초기 확대 수준(카카오 레벨: 숫자가 클수록 넓게 보임).
 * 7 = 서울 도심(종로·중구·용산·마포 일대)을 한눈에 둘러보기 좋은 정도.
 */
export const SEOUL_INITIAL_LEVEL = 7;

/**
 * 서울특별시를 넉넉히 감싸는 사각형. 카카오 검색 요청 단계에서 서울 밖 결과를 대부분 줄이는 용도이고,
 * (경기도 일부가 걸칠 수 있어) 최종 판정은 아래 주소 검사로 한다.
 */
export const SEOUL_SEARCH_BOUNDS = {
  sw: { lat: 37.41, lng: 126.75 },
  ne: { lat: 37.72, lng: 127.2 },
};

/** 카카오 주소는 "서울 종로구 ..." 형태로 온다. (특별시 표기가 붙는 경우도 허용) */
export const SEOUL_ADDRESS_PATTERN = '^서울(특별시)?(\\s|$)';

const SEOUL_ADDRESS_RE = new RegExp(SEOUL_ADDRESS_PATTERN);

/** 지번 주소 또는 도로명 주소 중 하나라도 서울특별시면 서울 장소로 본다. */
export function isSeoulPlace(place: { address: string; roadAddress: string }): boolean {
  return SEOUL_ADDRESS_RE.test(place.roadAddress) || SEOUL_ADDRESS_RE.test(place.address);
}
