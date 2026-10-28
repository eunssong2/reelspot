/**
 * 사진·동영상 다운로드(기기에 저장) 연결 지점.
 *
 * 기기 갤러리에 저장하려면 저장소 권한과 파일 저장 모듈이 필요해 아직 붙이지 않았다.
 * 준비되면 앱 시작 시 setDownloadHandler() 로 처리 함수를 등록하면 장소 기록 화면의
 * "사진 다운받기"가 그 함수를 호출한다. 등록 전에는 handled=false 가 돌아가고 화면은 안내만 보여준다
 * (저장된 것처럼 꾸미지 않는다).
 */
export interface DownloadItem {
  id: string;
  kind: 'photo' | 'video';
  /** 원본 주소(URL) 또는 앱에 포함된 파일 번호 */
  source: string | number;
}

/** 다운로드를 처리했으면 { handled: true }. 처리하지 않았으면 { handled: false }. */
export type DownloadHandler = (items: DownloadItem[]) => Promise<{ handled: boolean }> | { handled: boolean };

let handler: DownloadHandler | null = null;

export const setDownloadHandler = (next: DownloadHandler | null) => {
  handler = next;
};

export const DOWNLOAD_NOT_CONNECTED_MESSAGE = '기기에 저장하는 기능은 아직 연결되지 않았어요';

export async function requestDownload(items: DownloadItem[]): Promise<{ handled: boolean }> {
  if (!handler) return { handled: false };
  return handler(items);
}
