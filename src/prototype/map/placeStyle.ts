import type { ItineraryPlace } from '../mock/tripData';
import type { Place } from './types';

export interface CategoryStyle {
  label: string;
  emoji: string;
  tint: string;
}

export interface CategoryRule extends CategoryStyle {
  /** 카카오 카테고리 문자열에 대는 정규식 원문 */
  pattern: string;
}

/**
 * 카카오 카테고리 문자열(예: "음식점 > 카페 > 커피전문점", "여행 > 관광,명소 > 고궁")로
 * 이모지·색을 고르는 규칙. 위에서부터 먼저 맞는 규칙을 쓴다.
 * 웹(HTML div)과 앱(WebView) 지도 코드가 같은 규칙을 쓰도록 순수 데이터로 둔다.
 */
export const CATEGORY_RULES: CategoryRule[] = [
  { pattern: '카페', label: '카페', emoji: '☕', tint: '#E6D3BD' },
  { pattern: '숙박', label: '숙소', emoji: '🛏️', tint: '#F5D0C4' },
  { pattern: '^음식점', label: '맛집', emoji: '🍽️', tint: '#FBD9B5' },
  { pattern: '고궁|문화재|관광|명소|공원', label: '관광지', emoji: '🏯', tint: '#F6D9A8' },
  { pattern: '미술관|박물관|문화|예술', label: '관광지', emoji: '🖼️', tint: '#CFE3F8' },
];

export const FALLBACK_STYLE: CategoryStyle = { label: '장소', emoji: '📍', tint: '#D6E8F5' };

export function styleForCategory(category: string): CategoryStyle {
  const rule = CATEGORY_RULES.find((r) => new RegExp(r.pattern).test(category));
  return rule ?? FALLBACK_STYLE;
}

/** 카카오 검색 결과 → 일정에 담는 장소. 도로명 주소가 있으면 그것을 쓴다. */
export function toItineraryPlace(place: Place): ItineraryPlace {
  const style = styleForCategory(place.category);
  return {
    id: place.id,
    name: place.name,
    address: place.roadAddress || place.address,
    categoryLabel: style.label,
    emoji: style.emoji,
    tint: style.tint,
  };
}
