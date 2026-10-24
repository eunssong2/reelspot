/**
 * 사진·동영상 업로드 연결 지점(팀원 기능과 붙이는 자리).
 *
 * 촬영·선택·업로드는 다른 팀원 담당이라 여기서 구현하지 않는다. 팀원 기능이 준비되면
 * 앱 시작 시 setUploadHandler() 로 처리 함수를 등록하면 장소 기록 화면의 "사진·동영상 올리기" 버튼이
 * 그 함수를 호출한다. 등록 전에는 handled=false 가 돌아가고 화면은 "팀원 구현 영역" 안내만 보여준다
 * (업로드가 된 것처럼 꾸미지 않는다).
 */
export interface UploadRequest {
  tripId: string;
  itineraryId: string;
  dayId: string;
  /** 방문 식별자(일정·날짜·장소). 업로드 결과는 이 값에 연결해야 날짜별 기록이 섞이지 않는다. */
  visitId: string;
  placeId: string;
  placeName: string;
}

/** 업로드를 처리했으면 { handled: true }. 처리하지 않았으면 { handled: false }. */
export type UploadHandler = (request: UploadRequest) => Promise<{ handled: boolean }> | { handled: boolean };

let handler: UploadHandler | null = null;

export const setUploadHandler = (next: UploadHandler | null) => {
  handler = next;
};

export const UPLOAD_NOT_CONNECTED_MESSAGE = '업로드 기능은 팀원 구현 영역입니다';

export async function requestUpload(request: UploadRequest): Promise<{ handled: boolean }> {
  if (!handler) return { handled: false };
  return handler(request);
}
