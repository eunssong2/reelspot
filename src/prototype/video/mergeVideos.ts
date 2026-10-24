/**
 * 동영상 이어 붙이기의 공통 타입과 네이티브용 구현.
 *
 * 실제 구현은 브라우저 전용(mergeVideos.web.ts)이다. 앱(iOS/Android)에서 하려면
 * ffmpeg 같은 네이티브 모듈이 필요하고 Expo Go 로는 돌릴 수 없어서, 여기서는 "미지원"만 알린다.
 */
export interface MergeClip {
  uri: string;
  name: string;
}

export interface MergeProgress {
  /** 지금 녹화 중인 클립 순번(0부터) */
  index: number;
  total: number;
  /** 지금 클립 안에서 진행한 비율(0~1) */
  clipRatio: number;
}

export interface MergeOptions {
  /** 결과 영상 크기(px). 기본 720×1280(세로 릴스 비율) */
  width?: number;
  height?: number;
  fps?: number;
  /** 영상 전체에 걸쳐 위쪽 가운데에 얹을 글씨(예: 장소 이름). 비우면 넣지 않는다. */
  overlayText?: string;
  onProgress?: (progress: MergeProgress) => void;
}

export interface MergeResult {
  /** 재생·다운로드용 주소(웹: blob URL) */
  uri: string;
  mimeType: string;
  sizeBytes: number;
  /** 실제로 녹화된 길이(ms) */
  durationMs: number;
  /** 합치는 데 걸린 시간(ms) */
  elapsedMs: number;
  /** 자동재생 제한 때문에 소리 없이 합쳐졌는지 */
  muted: boolean;
}

export const MERGE_SUPPORTED = false;

export async function mergeVideos(_clips: MergeClip[], _options?: MergeOptions): Promise<MergeResult> {
  throw new Error('동영상 합치기는 지금은 웹에서만 확인할 수 있어요');
}
