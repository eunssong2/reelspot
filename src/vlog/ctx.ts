import type { Group } from './types';
import type { Timeline, VlogDay, VlogDraft, VlogPlace } from './model';

export type StepName =
  | 'dates'
  | 'places'
  | 'media'
  | 'template'
  | 'length'
  | 'trim'
  | 'edit'
  | 'compose'
  | 'preview'
  | 'generate'
  | 'result';

/** 지금 보고 있는 단계. placeKey 는 장소별 단계에서, clipId 는 동영상 구간 단계에서 쓴다. */
export interface Cursor {
  step: StepName;
  placeKey?: string;
  clipId?: string;
}

/** 모든 단계 화면이 받는 공통 값. */
export interface StepCtx {
  group: Group;
  days: VlogDay[];
  draft: VlogDraft;
  timeline: Timeline;
  update: (fn: (draft: VlogDraft) => VlogDraft) => void;
  /** 다음 단계로(이전 단계는 뒤로가기로 돌아올 수 있다) */
  go: (cursor: Cursor) => void;
  /** 이전 단계로. 첫 단계면 제작 화면을 닫는다(초안은 남긴다). */
  back: () => void;
  /** 이전 단계 기록을 쌓지 않고 지금 단계를 바꾼다 */
  replace: (cursor: Cursor) => void;
  /** 초안을 남기고 제작 화면을 닫는다 */
  close: () => void;
  /** 기록 추가 경로(장소 기록 화면)로 나간다 */
  goAddRecords: () => void;
  toast: (message: string) => void;
  toastMessage: string | null;
  revalidate: () => Promise<void>;
}

export interface Located {
  day: VlogDay;
  place: VlogPlace;
}

export function locate(days: VlogDay[], placeKey: string | undefined): Located | undefined {
  if (!placeKey) return undefined;
  for (const day of days) {
    const place = day.places.find((p) => p.key === placeKey);
    if (place) return { day, place };
  }
  return undefined;
}

/** 선택한 장소를 장면 순서대로 펼친 목록 */
export function selectedPlaces(draft: VlogDraft, days: VlogDay[]): Located[] {
  const out: Located[] = [];
  for (const dayKey of draft.dayKeys) {
    const day = days.find((d) => d.key === dayKey);
    if (!day) continue;
    for (const key of draft.placeKeys[dayKey] ?? []) {
      const place = day.places.find((p) => p.key === key);
      if (place && place.media.length > 0) out.push({ day, place });
    }
  }
  return out;
}
