import { selectedPlaces, type StepCtx } from './ctx';
import {
  MAX_ITEMS,
  MAX_ITEMS_PER_PLACE,
  MAX_TOTAL_SEC,
  PHOTO_SEQUENCE_SEC,
  VIDEO_SEQUENCE_MAX_SEC,
  defaultSetting,
  draftProblem,
  resolveMedia,
  type VlogDay,
  type VlogDraft,
  type VlogMedia,
} from './model';

/**
 * "기본 설정으로 바로 만들기" 의 기본값.
 * 장소·사진 선택만 하고 나머지를 개별로 정하지 않아도 영상이 나오도록, 아직 정하지 않은 항목만 이 값으로 채운다.
 * (이미 직접 정한 값은 바꾸지 않는다.)
 */
export const QUICK_DEFAULTS = {
  /** 아직 기록을 고르지 않은 장소에서 자동으로 담을 개수 */
  perPlace: 5,
  transition: 'fade' as const,
  motion: 'zoomIn' as const,
  /** 날짜마다 제목 화면을 넣을지 */
  dayTitleCard: true,
  endCard: true,
};

/** 화면에 머무는 시간 추정(초): 사진은 이어 재생 기본 길이, 동영상은 최대 구간 */
const secOf = (m: VlogMedia): number => (m.item.kind === 'video' ? Math.min(m.seconds || VIDEO_SEQUENCE_MAX_SEC, VIDEO_SEQUENCE_MAX_SEC) : PHOTO_SEQUENCE_SEC);

export interface QuickResult {
  draft: VlogDraft;
  /** 한도(개수·시간) 때문에 담지 못한 기록 수 */
  skipped: number;
}

/**
 * 고른 날짜·장소를 기본 설정으로 채워 바로 만들 수 있는 초안으로 바꾼다.
 * - 기록을 고르지 않은 장소는 앞에서부터 perPlace 개를 담는다(이미 고른 장소는 그대로).
 * - 장소 설정은 이어 재생 기본값으로 두고 "완료" 처리한다(이미 정한 템플릿·효과는 유지).
 * - 영상 전체 설정 중 비어 있는 것(전환·사진 움직임·날짜 제목 화면·끝 화면)만 기본값을 넣는다.
 * 전체 길이(3분)와 개수(50개) 한도 안에서만 담는다.
 */
export function quickBuild(draft: VlogDraft, days: VlogDay[]): QuickResult {
  let itemCount = 0;
  let sec = 0;
  let skipped = 0;
  const mediaIds = { ...draft.mediaIds };
  const settings = { ...draft.settings };

  // 먼저 이미 고른 기록을 한도에 계산해 두고, 그다음 비어 있는 장소를 채운다.
  const places = selectedPlaces(draft, days);
  for (const { place } of places) {
    for (const m of resolveMedia(draft, place).media) {
      itemCount += 1;
      sec += secOf(m);
    }
  }
  for (const { place } of places) {
    if (resolveMedia(draft, place).media.length === 0) {
      const ids: string[] = [];
      for (const m of place.media) {
        if (ids.length >= Math.min(QUICK_DEFAULTS.perPlace, MAX_ITEMS_PER_PLACE)) break;
        if (itemCount >= MAX_ITEMS || sec + secOf(m) > MAX_TOTAL_SEC) {
          skipped += 1;
          continue;
        }
        ids.push(m.item.id);
        itemCount += 1;
        sec += secOf(m);
      }
      mediaIds[place.key] = ids;
    }
    // 기록이 하나도 담기지 않은 장소는 영상에 넣지 않는다(아래에서 걸러진다).
    settings[place.key] = { ...(settings[place.key] ?? defaultSetting()), done: true };
  }

  // 기록이 없는 장소는 선택에서 뺀다.
  const placeKeys: Record<string, string[]> = {};
  for (const dayKey of draft.dayKeys) {
    placeKeys[dayKey] = (draft.placeKeys[dayKey] ?? []).filter((k) => (mediaIds[k] ?? []).length > 0);
  }
  const dayKeys = draft.dayKeys.filter((k) => placeKeys[k].length > 0);

  const dayTitleCard = { ...(draft.dayTitleCard ?? {}) };
  for (const k of dayKeys) if (dayTitleCard[k] === undefined) dayTitleCard[k] = QUICK_DEFAULTS.dayTitleCard;

  return {
    skipped,
    draft: {
      ...draft,
      dayKeys,
      placeKeys,
      mediaIds,
      settings,
      dayTitleCard,
      transition: draft.transition ?? QUICK_DEFAULTS.transition,
      motion: draft.motion ?? QUICK_DEFAULTS.motion,
      endCard: draft.endCard ?? QUICK_DEFAULTS.endCard,
      updatedAt: Date.now(),
    },
  };
}

/**
 * 지금 고른 날짜·장소(와 사진·동영상)를 기본 설정으로 채워 곧바로 전체 미리보기로 간다.
 * 만들 수 없는 상태면 이유를 알리고 그대로 둔다.
 */
export function runQuickBuild(ctx: StepCtx): void {
  const result = quickBuild(ctx.draft, ctx.days);
  if (result.draft.dayKeys.length === 0) return ctx.toast('담을 수 있는 사진·동영상이 없어요');
  const problem = draftProblem(result.draft, ctx.days);
  if (problem) return ctx.toast(problem);
  ctx.update(() => result.draft);
  if (result.skipped > 0) ctx.toast(`길이·개수 한도 때문에 ${result.skipped}개는 담지 못했어요`);
  ctx.go({ step: 'preview' });
}
