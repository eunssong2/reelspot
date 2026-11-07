import type { Timeline } from './model';

/** Authenticated editors register the server render and gallery-save handlers for their lifetime. */

export interface RenderRequest {
  title: string;
  /** 미리보기와 같은 타임라인. 렌더러는 timeline.aspect에 맞춰 세로/가로 구간·배치를 적용한다(Q20). */
  timeline: Timeline;
  /** 실제 처리 상태가 있을 때만 0~1 로 알린다. */
  onProgress: (ratio: number) => void;
  /** 사용자가 생성 중단을 누르면 true 가 된다. */
  isCancelled: () => boolean;
}

export type RenderOutcome =
  | { status: 'done'; uri: string; durationSec: number }
  | { status: 'failed'; reason?: string }
  | { status: 'cancelled' }
  | { status: 'not_connected' };

export type RenderHandler = (request: RenderRequest) => Promise<RenderOutcome>;

let renderHandler: RenderHandler | null = null;
export const setRenderHandler = (next: RenderHandler | null) => {
  renderHandler = next;
};
export const isRenderConnected = () => renderHandler !== null;

export async function renderVlog(request: RenderRequest): Promise<RenderOutcome> {
  if (!renderHandler) return { status: 'not_connected' };
  try {
    return await renderHandler(request);
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.message : undefined };
  }
}

/** saved: 저장 확인됨 / denied: 저장 권한 거부 / failed: 공간 부족 등 실패 */
export type GallerySaveOutcome = 'saved' | 'denied' | 'failed' | 'not_connected';
export type GallerySaveHandler = (uri: string) => Promise<GallerySaveOutcome>;

let saveHandler: GallerySaveHandler | null = null;
export const setGallerySaveHandler = (next: GallerySaveHandler | null) => {
  saveHandler = next;
};

export async function saveToGallery(uri: string): Promise<GallerySaveOutcome> {
  if (!saveHandler) return 'not_connected';
  try {
    return await saveHandler(uri);
  } catch {
    return 'failed';
  }
}
