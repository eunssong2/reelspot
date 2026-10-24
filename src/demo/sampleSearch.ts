/**
 * 오프라인 예시 검색: 인터넷·지도 키가 없어도 검색·카테고리 필터를 체험하게 하는 데모 대체 동작.
 * 결과는 DEMO_SAMPLE_PLACES(예시)에서만 나오며 실제 검색 결과가 아니다.
 */
import { styleForCategory } from '../prototype/map/placeStyle';
import type { CategoryKey, Place } from '../prototype/map/types';

/** 카테고리 버튼 → placeStyle 이 붙이는 분류 이름 */
const CATEGORY_LABEL: Record<CategoryKey, string> = {
  attraction: '관광지',
  food: '맛집',
  cafe: '카페',
  stay: '숙소',
};

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '');

/** 검색어를 공백으로 나눈 모든 조각이 이름·주소·분류에 들어 있는 장소를 돌려준다(이름에 맞을수록 앞). */
export function searchSamplePlaces(places: Place[], keyword: string): Place[] {
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: { place: Place; score: number }[] = [];
  for (const place of places) {
    const name = normalize(place.name);
    const haystack = normalize(`${place.name}${place.roadAddress || place.address}${place.category}${styleForCategory(place.category).label}`);
    if (!tokens.every((t) => haystack.includes(normalize(t)))) continue;
    scored.push({ place, score: tokens.filter((t) => name.includes(normalize(t))).length });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.place);
}

export const searchSampleByCategory = (places: Place[], key: CategoryKey): Place[] =>
  places.filter((p) => styleForCategory(p.category).label === CATEGORY_LABEL[key]);
