import type { MediaKind } from '../mock/tripData';

/**
 * 화면 이동 경로. 라이브러리 없이 App.tsx 의 스택 배열로 관리한다.
 * 내 모임 → 여행 일정 → 여행 장소 검색 → 사진·동영상 설정 → 이미지 업로드
 */
export type Route =
  | { name: 'trips' }
  | { name: 'itinerary'; tripId: string }
  | { name: 'placeSearch'; tripId: string; dayIndex: number }
  | { name: 'mediaSettings'; placeName?: string }
  | { name: 'imageUpload'; cuts: number; templateId: string; kind: MediaKind };

export interface Nav {
  push: (route: Route) => void;
  back: () => void;
}
