/**
 * 화면 이동 경로. 라이브러리 없이 App.tsx 의 스택 배열로 관리한다.
 * 내 스팟 모임 → 일정 요약 → 날짜별 장소 구성 → (새 스팟 검색 | 장소 사진) → 순서 편집 / 사진·동영상 올리기
 *
 * tripId(모임)와 itineraryId(일정)는 서로 다른 개념이다 — 한 모임 안에 여러 일정이 있을 수 있으므로
 * 화면 간 이동에서 둘을 같은 값으로 섞어 쓰지 않는다.
 */
import type { ClipSeconds } from '../mock/tripData';

export type Route =
  | { name: 'trips' }
  | { name: 'itinerarySummary'; tripId: string; itineraryId: string }
  | { name: 'itineraryDay'; tripId: string; itineraryId: string; dayId: string }
  | { name: 'placeOrderEdit'; tripId: string; itineraryId: string; dayId: string }
  | { name: 'placeSearch'; tripId: string; itineraryId: string; dayId: string }
  | { name: 'placeRecords'; tripId: string; itineraryId: string; dayId: string; placeId: string }
  // clipSeconds 를 모르는 진입 경로(장소 검색에서 바로 올리기)는 화면에서 기본값을 쓴다.
  | { name: 'mediaUpload'; placeName?: string; clipSeconds?: ClipSeconds }
  // 동영상 여러 개 이어 붙이기 실험 화면(웹 전용)
  | { name: 'videoMerge' }
  // 마이페이지: 프로필 사진·닉네임 변경, 참여한 모임 수
  | { name: 'myPage' }
  // 설정(프로필 및 계정·초대코드·약관·로그아웃)과 프로필 및 계정 상세
  | { name: 'members'; tripId: string; itineraryId: string }
  | { name: 'settings' }
  | { name: 'account' };

export interface Nav {
  push: (route: Route) => void;
  back: () => void;
}
