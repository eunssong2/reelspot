import { Platform, type TextStyle } from 'react-native';

import { recordsForVisit, visitIdOf } from '../../demo/records';
import type { Group, Schedule } from '../mock/groupData';
import {
  templatesFor,
  type Itinerary,
  type Rect,
  type ItineraryPlace,
  type PlaceRecordItem,
  type Template,
} from '../mock/tripData';
import { defaultDayTitle } from '../utils/date';

/**
 * 브이로그 제작의 데이터 모델과 순수 계산(화면 없음).
 * 기획: AT THAT PLACE 브이로그 화면기획 v4 (날짜 다중 선택 → 장소 → 사진·동영상 → 템플릿·자막 → 미리보기·생성·저장).
 * 길이·개수 규칙은 기획서 17페이지의 "제안 기준"이며, 상수만 바꾸면 화면·계산이 함께 바뀐다.
 */

// ---------- 제안 기준(기획서 17페이지) ----------

/** 이어 재생에서 사진 한 장을 보여 주는 시간(초) */
export const PHOTO_SEQUENCE_SEC = 3;
/** 이어 재생에서 동영상 한 개가 쓰는 최대 구간(초) */
export const VIDEO_SEQUENCE_MAX_SEC = 5;
/** 분할 장면에 사진만 있을 때의 기본 길이(초) */
export const PHOTO_SPLIT_SEC = 3;
/**
 * 동영상 재생 속도. 이어 재생 장면에서만 고른다
 * (분할 장면은 칸이 동시에 재생되므로 칸마다 속도가 다르면 길이가 엇갈린다).
 */
export const SPEEDS: { id: number; label: string }[] = [
  { id: 0.5, label: '0.5배' },
  { id: 1, label: '보통' },
  { id: 1.5, label: '1.5배' },
  { id: 2, label: '2배' },
];

/** 사진만 있는 장면에서 직접 고를 수 있는 길이(초) 범위 */
export const MIN_PHOTO_SEC = 1;
export const MAX_PHOTO_SEC = 10;
/** 날짜가 바뀔 때 넣는 제목 화면 길이(초) */
export const TITLE_CARD_SEC = 2;
/** 마지막 끝 화면 길이(초) */
export const END_CARD_SEC = 2;
/** 끝 화면에 아무것도 적지 않았을 때 쓰는 문구 */
export const END_TEXT_DEFAULT = '함께한 날들';
/** 프로젝트 전체 기록 수·길이 제한 */
export const MAX_ITEMS = 50;
export const MAX_TOTAL_SEC = 180;
/** 한 장소에서 고를 수 있는 최대 개수(장소 기록 올리기 한도와 같다) */
export const MAX_ITEMS_PER_PLACE = 10;
/** 분할 템플릿이 지원하는 최대 칸 수 */
export const MAX_SPLIT = 5;

// ---------- 화면 비율 ----------

export type AspectId = 'portrait' | 'landscape';

export interface AspectPreset {
  id: AspectId;
  /** 선택 버튼 글자 */
  label: string;
  /** 가로 ÷ 세로 */
  ratio: number;
  /** 출력 크기(px) */
  width: number;
  height: number;
  /** "9:16 · 1080p · MP4" 같은 출력 표시 */
  output: string;
}

/** 출력 화면 비율. 기본은 세로 9:16(기획서 MVP 출력)이고 가로 16:9 를 고를 수 있다. */
export const ASPECTS: AspectPreset[] = [
  { id: 'portrait', label: '세로 9:16', ratio: 9 / 16, width: 1080, height: 1920, output: '9:16 · 1080p · MP4' },
  { id: 'landscape', label: '가로 16:9', ratio: 16 / 9, width: 1920, height: 1080, output: '16:9 · 1080p · MP4' },
];
export const aspectOf = (id?: AspectId): AspectPreset => ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];

/** 가로 화면은 같은 폭이면 훨씬 납작하므로, 미리보기 폭을 조금 키우되 화면 폭(maxW)은 넘지 않게 한다. */
export const fitWidth = (id: AspectId | undefined, portraitW: number, maxW: number): number =>
  id === 'landscape' ? Math.min(maxW, portraitW * 1.9) : portraitW;

// ---------- 장면 전환 ----------

export type TransitionId =
  | 'none'
  | 'fade'
  | 'slide'
  | 'slideUp'
  | 'zoom'
  | 'zoomOut'
  | 'flash'
  | 'dip'
  | 'blur'
  | 'spin'
  | 'pop'
  | 'wipe'
  | 'iris';

export interface TransitionPreset {
  id: TransitionId;
  label: string;
  desc: string;
}

/** 장면과 장면 사이에 들어가는 전환 효과. 프로젝트 전체에 하나를 적용한다(제안 목록). */
export const TRANSITIONS: TransitionPreset[] = [
  { id: 'none', label: '없음', desc: '바로 다음 장면으로' },
  { id: 'fade', label: '페이드', desc: '서서히 겹치며 바뀜' },
  { id: 'slide', label: '옆으로', desc: '옆에서 밀며 바뀜' },
  { id: 'slideUp', label: '위로', desc: '아래에서 올라오며 바뀜' },
  { id: 'zoom', label: '확대', desc: '커지며 나타남' },
  { id: 'zoomOut', label: '축소', desc: '작아지며 나타남' },
  { id: 'flash', label: '흰 번쩍', desc: '흰 화면을 거쳐 바뀜' },
  { id: 'dip', label: '검게', desc: '검은 화면을 거쳐 바뀜' },
  // 캡컷 같은 편집 앱에서 많이 쓰는 효과를 참고한 것들
  { id: 'blur', label: '블러', desc: '흐릿하다가 또렷해지며 바뀜' },
  { id: 'spin', label: '회전', desc: '돌면서 커지며 나타남' },
  { id: 'pop', label: '팝', desc: '톡 튀어 오르듯 나타남' },
  { id: 'wipe', label: '와이프', desc: '왼쪽에서 닦아 내듯 바뀜' },
  { id: 'iris', label: '원형', desc: '가운데서 동그랗게 퍼지며 바뀜' },
];
/** 전환이 진행되는 시간(초). 다음 장면의 처음 구간 안에서 일어나며 전체 길이는 늘지 않는다. */
export const TRANSITION_SEC = 0.5;

// ---------- 사진 움직임(사진이 멈춰 있지 않게) ----------

export type MotionId = 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown';

export interface MotionPreset {
  id: MotionId;
  label: string;
  desc: string;
}

/**
 * 사진이 보이는 동안 아주 천천히 움직이게 한다(정지 사진을 영상처럼 보이게 하는 연출).
 * 동영상은 이미 움직이므로 사진에만 적용한다.
 */
export const MOTIONS: MotionPreset[] = [
  { id: 'none', label: '없음', desc: '사진이 그대로 멈춰 있어요' },
  { id: 'zoomIn', label: '천천히 확대', desc: '사진이 서서히 커져요' },
  { id: 'zoomOut', label: '천천히 축소', desc: '사진이 서서히 작아져요' },
  { id: 'panLeft', label: '왼쪽으로', desc: '사진이 왼쪽으로 밀려요' },
  { id: 'panRight', label: '오른쪽으로', desc: '사진이 오른쪽으로 밀려요' },
  { id: 'panUp', label: '위로', desc: '사진이 위로 밀려요' },
  { id: 'panDown', label: '아래로', desc: '사진이 아래로 밀려요' },
];
export const motionOf = (id?: MotionId): MotionPreset => MOTIONS.find((m) => m.id === id) ?? MOTIONS[0];

/** 움직임을 넣을 때 사진을 미리 키워 두는 정도. 밀거나 작아져도 빈 곳이 보이지 않게 한다. */
export const MOTION_ZOOM = 0.14;

/** 사진을 어떻게 놓을지. tx·ty 는 화면 폭·높이에 대한 비율이라 미리보기와 출력에서 같게 보인다. */
export interface MotionFrame {
  scale: number;
  tx: number;
  ty: number;
}

/** 사진이 보이는 동안 흐른 비율(0~1)에서의 사진 크기·위치. */
export function motionAt(id: MotionId | undefined, p: number): MotionFrame {
  const t = Math.max(0, Math.min(1, p));
  const z = MOTION_ZOOM;
  // 밀기는 미리 키워 둔 만큼(양옆 z/2)을 한쪽 끝에서 다른 끝까지 지나간다.
  const half = z / 2;
  switch (id) {
    case 'zoomIn':
      return { scale: 1 + z * t, tx: 0, ty: 0 };
    case 'zoomOut':
      return { scale: 1 + z * (1 - t), tx: 0, ty: 0 };
    case 'panLeft':
      return { scale: 1 + z, tx: half * (1 - 2 * t), ty: 0 };
    case 'panRight':
      return { scale: 1 + z, tx: half * (2 * t - 1), ty: 0 };
    case 'panUp':
      return { scale: 1 + z, tx: 0, ty: half * (1 - 2 * t) };
    case 'panDown':
      return { scale: 1 + z, tx: 0, ty: half * (2 * t - 1) };
    default:
      return { scale: 1, tx: 0, ty: 0 };
  }
}

// ---------- 자막·장소 라벨 등장 ----------

export type AnimId = 'none' | 'fade' | 'up' | 'pop';

export const ANIMS: { id: AnimId; label: string; desc: string }[] = [
  { id: 'none', label: '없음', desc: '처음부터 그냥 있어요' },
  { id: 'fade', label: '서서히', desc: '서서히 나타나요' },
  { id: 'up', label: '올라오며', desc: '아래에서 살짝 올라와요' },
  { id: 'pop', label: '톡 튀며', desc: '작게 있다 톡 커져요' },
];

/** 등장에 걸리는 시간(초) */
export const ANIM_SEC = 0.4;

/** 글자 덩이를 어떻게 놓을지. ty 는 글자 크기에 대한 비율(em)이라 화면 크기와 무관하다. */
export interface AnimFrame {
  opacity: number;
  ty: number;
  scale: number;
}

/** 등장이 끝난(다 보이는) 상태. 움직임을 쓰지 않는 미리보기가 이 값을 쓴다. */
export const ANIM_DONE: AnimFrame = { opacity: 1, ty: 0, scale: 1 };

/** 등장이 시작된 뒤 흐른 비율(0~1)에서의 모습. 끝에서 천천히 멈춘다. */
export function animAt(id: AnimId | undefined, p: number): AnimFrame {
  const t = Math.max(0, Math.min(1, p));
  const e = 1 - (1 - t) * (1 - t);
  switch (id) {
    case 'fade':
      return { opacity: e, ty: 0, scale: 1 };
    case 'up':
      return { opacity: e, ty: (1 - e) * 0.6, scale: 1 };
    case 'pop':
      return { opacity: e, ty: 0, scale: 0.72 + 0.28 * e };
    default:
      return ANIM_DONE;
  }
}

// ---------- 자막 줄 ----------

/** 자막 한 줄과 그 줄이 보이는 구간(장면 안에서 흐른 초). */
export interface CaptionLine {
  text: string;
  /** 나타나는 시각(초) */
  from: number;
  /** 사라지는 시각(초) */
  to: number;
}

/** 한 사진·장면에 넣을 수 있는 자막 줄 수 */
export const MAX_CAPTION_LINES = 3;
/** 자막 한 줄의 가장 짧은 구간(초) */
export const MIN_CAPTION_SPAN = 1;

/**
 * 저장된 자막을 줄 목록으로 읽는다.
 * 줄 목록을 한 번도 손대지 않았으면 옛 저장본(한 줄짜리 captions)을 장면 전체를 채우는
 * 한 줄로 본다. 한 번 손댄 뒤에는 빈 목록도 그대로 빈 것으로 본다.
 */
export function captionLinesOf(setting: PlaceSetting, key: string, seconds: number): CaptionLine[] {
  const lines = setting.captionLines?.[key];
  if (lines !== undefined) {
    // 구간을 따로 정하지 않는다: 글자가 있는 줄을 순서대로 장면 시간에 똑같이 나눠 보여 준다(한 줄이면 장면 내내).
    const filled = lines.filter((l) => l.text.trim().length > 0);
    return filled.map((l, i) => ({ text: l.text, from: (seconds * i) / filled.length, to: (seconds * (i + 1)) / filled.length }));
  }
  const legacy = setting.captions?.[key];
  return legacy?.trim() ? [{ text: legacy, from: 0, to: seconds }] : [];
}

/** 흐른 시각에 보여야 할 자막. 없으면 빈 문자열 */
export const captionAt = (lines: CaptionLine[], sec: number): string =>
  lines.find((l) => sec >= l.from && sec < l.to)?.text ?? '';

// ---------- 스티커 ----------

/**
 * 장면 위에 얹는 그림 문자. 서버 렌더러가 글자를 그릴 때 이미 색 이모지 글꼴을
 * 함께 쓰므로(Noto Color Emoji), 이모지를 글자처럼 얹으면 그대로 나온다.
 */
export const STICKERS = ['📍', '❤️', '✨', '🌊', '🌸', '🍀', '☀️', '🌙', '🔥', '🎉', '📸', '🍜', '☕', '🍺', '🚗', '✈️', '🐾', '😊', '😂', '👍'];

/** 스티커를 놓는 자리(가로·세로 3칸). 화면 크기와 무관한 비율 좌표로 바꿔 쓴다. */
export type StickerSpot = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export const STICKER_SPOTS: { id: StickerSpot; label: string }[] = [
  { id: 'tl', label: '왼쪽 위' },
  { id: 'tc', label: '가운데 위' },
  { id: 'tr', label: '오른쪽 위' },
  { id: 'ml', label: '왼쪽' },
  { id: 'mc', label: '가운데' },
  { id: 'mr', label: '오른쪽' },
  { id: 'bl', label: '왼쪽 아래' },
  { id: 'bc', label: '가운데 아래' },
  { id: 'br', label: '오른쪽 아래' },
];

export type StickerSize = 'sm' | 'md' | 'lg';
/** 스티커 크기(출력 화면 기준 px). 자막과 같은 방식으로 줄여 그린다. */
export const STICKER_SIZES: { id: StickerSize; label: string; px: number }[] = [
  { id: 'sm', label: '작게', px: 72 },
  { id: 'md', label: '보통', px: 120 },
  { id: 'lg', label: '크게', px: 180 },
];

export interface Sticker {
  emoji: string;
  /** 가장 가까운 자리(직접 옮겼어도 함께 적어 둔다 — 자리 이름만 아는 렌더러용) */
  spot: StickerSpot;
  size: StickerSize;
  /** 손으로 끌어 놓은 자리(0~1 비율). 있으면 이 자리가 먼저다 */
  xy?: { x: number; y: number };
  /** 손가락 두 개로 늘리고 줄인 배율(크기 단계 위에 곱한다). 없으면 1 */
  scale?: number;
}

/** 스티커 배율의 한계 */
export const STICKER_SCALE_MIN = 0.4;
export const STICKER_SCALE_MAX = 3.5;

/** 한 장면에 붙일 수 있는 스티커 수 */
export const MAX_STICKERS = 3;

/** 자리 이름을 비율 좌표로 바꾼다(0~1). 가장자리는 조금 안쪽으로 들인다. */
export function stickerPosition(spot: StickerSpot): { x: number; y: number } {
  const col = { l: 0.18, c: 0.5, r: 0.82 };
  const row = { t: 0.16, m: 0.5, b: 0.84 };
  const r = spot[0] as 't' | 'm' | 'b';
  const c = spot[1] as 'l' | 'c' | 'r';
  return { x: col[c], y: row[r] };
}

/** 스티커가 놓일 비율 좌표: 직접 옮긴 자리가 있으면 그것, 없으면 자리 이름에서 얻는다. */
export const stickerXY = (st: Sticker): { x: number; y: number } => st.xy ?? stickerPosition(st.spot);

/** 비율 좌표에서 가장 가까운 3×3 자리 */
export function nearestStickerSpot(x: number, y: number): StickerSpot {
  const col = x < 1 / 3 ? 'l' : x < 2 / 3 ? 'c' : 'r';
  const row = y < 1 / 3 ? 't' : y < 2 / 3 ? 'm' : 'b';
  return `${row}${col}` as StickerSpot;
}

export const stickerPx = (size: StickerSize, scale = 1): number => (STICKER_SIZES.find((s) => s.id === size)?.px ?? 120) * scale;

// ---------- 장소 라벨 ----------

/**
 * 장면에 붙는 장소(와 날짜) 라벨. 자막과 섞이지 않게 따로 그린다.
 * 켜고 끄기는 장면별(PlaceSetting.showPlace·showDate)이고, 모양은 영상 하나에 한 벌이다.
 */
export interface PlaceLabel {
  pos: 'top' | 'bottom';
  bg: CaptionBg;
  /** 장소 이름 앞에 핀을 붙일지 */
  pin: boolean;
  anim: AnimId;
  /** 장면이 시작될 때 잠깐만 보여 줄지. 끄면 장면 내내 보인다. */
  onlyAtStart: boolean;
}

/** onlyAtStart 일 때 라벨이 보이는 시간(초) */
export const PLACE_LABEL_SEC = 2.5;
/** 라벨이 사라지는 데 걸리는 시간(초) */
export const PLACE_LABEL_FADE = 0.4;

export const PLACE_LABEL_POSITIONS: { id: PlaceLabel['pos']; label: string }[] = [
  { id: 'top', label: '위' },
  { id: 'bottom', label: '아래' },
];

export const defaultPlaceLabel = (): PlaceLabel => ({ pos: 'bottom', bg: 'dim', pin: true, anim: 'up', onlyAtStart: false });
export const placeLabelOf = (label?: Partial<PlaceLabel>): PlaceLabel => ({ ...defaultPlaceLabel(), ...label });

/** 장면 안에서 흐른 시간에 따른 라벨의 투명도. 잠깐만 보여 주는 설정이면 끝에서 사라진다. */
export function placeLabelOpacity(label: PlaceLabel, localSec: number, sceneSec: number): number {
  if (!label.onlyAtStart) return 1;
  const hold = Math.min(PLACE_LABEL_SEC, Math.max(PLACE_LABEL_FADE, sceneSec - PLACE_LABEL_FADE));
  if (localSec <= hold) return 1;
  return Math.max(0, 1 - (localSec - hold) / PLACE_LABEL_FADE);
}

// ---------- 색감 효과 ----------

export type FilterId =
  | 'none'
  | 'bright'
  | 'dark'
  | 'gray'
  | 'warm'
  | 'cool'
  | 'film'
  | 'vintage'
  | 'vivid'
  | 'fade'
  | 'cinema'
  | 'noir'
  | 'dream'
  | 'sunset';

export interface FilterPreset {
  id: FilterId;
  label: string;
  /** 미리보기에 쓰는 화면 필터(CSS filter 문법). 원본이면 없음 */
  css?: string;
}

/** 사진·동영상에 입히는 색감 효과(제안 목록). 원본 파일은 바뀌지 않고 영상으로 만들 때만 적용된다. */
export const FILTERS: FilterPreset[] = [
  { id: 'none', label: '원본' },
  { id: 'bright', label: '밝게', css: 'brightness(1.3)' },
  { id: 'dark', label: '어둡게', css: 'brightness(0.7)' },
  { id: 'gray', label: '흑백', css: 'grayscale(1)' },
  // 캡컷 같은 편집 앱의 인기 필터 느낌을 CSS 필터 조합으로 낸 것들(미리보기용)
  { id: 'warm', label: '따뜻하게', css: 'sepia(0.25) saturate(1.2) brightness(1.05)' },
  { id: 'cool', label: '차갑게', css: 'hue-rotate(185deg) saturate(0.7) brightness(1.05)' },
  { id: 'film', label: '필름', css: 'sepia(0.3) contrast(1.1) saturate(0.9) brightness(1.02)' },
  { id: 'vintage', label: '빈티지', css: 'sepia(0.55) contrast(0.9) saturate(0.8) brightness(1.05)' },
  { id: 'vivid', label: '선명하게', css: 'saturate(1.6) contrast(1.15)' },
  { id: 'fade', label: '페이드', css: 'contrast(0.82) brightness(1.12) saturate(0.85)' },
  { id: 'cinema', label: '시네마', css: 'contrast(1.2) saturate(0.85) brightness(0.92) sepia(0.12)' },
  { id: 'noir', label: '누아르', css: 'grayscale(1) contrast(1.4) brightness(0.9)' },
  { id: 'dream', label: '몽환', css: 'brightness(1.1) contrast(0.9) saturate(1.3) blur(0.6px)' },
  { id: 'sunset', label: '노을', css: 'sepia(0.4) saturate(1.5) hue-rotate(-12deg) brightness(1.02)' },
];
export const filterOf = (id?: FilterId): FilterPreset => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

// ---------- 화면 맞춤·자르기 ----------

export type FrameFit = 'fill' | 'contain';
export type FrameBg = 'black' | 'white' | 'blur';

/** 사진에서 영상에 쓸 영역. 사진 전체를 0~1 로 본 비율 좌표이며 자유로운 가로세로 비율이 가능하다. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 사진·동영상을 화면 틀에 놓는 방법. 원본은 바뀌지 않는다. */
export interface FrameAdjust {
  /** fill: 틀을 가득 채움(넘치는 부분은 잘림) / contain: 전체가 보이게 맞춤(여백 생김) */
  fit: FrameFit;
  /** contain 일 때 여백 모양 */
  bg: FrameBg;
  /** 직접 자른 영역. 없으면 사진 전체. 자른 영역을 fit 방식으로 화면 틀에 놓는다. */
  crop?: CropRect;
}

export const MIN_CROP = 0.05;
export const defaultFrame = (): FrameAdjust => ({ fit: 'fill', bg: 'black' });
export const BG_OPTIONS: { id: FrameBg; label: string }[] = [
  { id: 'black', label: '검정' },
  { id: 'white', label: '흰색' },
  { id: 'blur', label: '흐리게' },
];

/** 자른 영역이 사진 밖으로 나가지 않게 맞추고, 사실상 전체면 자르지 않은 것으로 본다. */
export function clampFrame(f: FrameAdjust): FrameAdjust {
  const c = f.crop;
  if (!c) return f;
  const w = Math.max(MIN_CROP, Math.min(1, c.w));
  const h = Math.max(MIN_CROP, Math.min(1, c.h));
  if (w > 0.995 && h > 0.995) return { ...f, crop: undefined };
  return { ...f, crop: { w, h, x: Math.max(0, Math.min(1 - w, c.x)), y: Math.max(0, Math.min(1 - h, c.y)) } };
}

export const isDefaultFrame = (f: FrameAdjust): boolean => f.fit === 'fill' && !f.crop;

// ---------- 글씨체 ----------

/** 글씨체 종류. 저장된 초안이 깨지지 않게 이전 id(gothic·bold·round·hand·pen·serif)는 그대로 둔다. */
export type FontId =
  | 'gothic'
  | 'gothicTitle'
  | 'bold'
  | 'boldFat'
  | 'gothicSharp'
  | 'gothicNeat'
  | 'gothicModern'
  | 'gothicSoft'
  | 'gothicThin'
  | 'gothicPlain'
  | 'gothicIsland'
  | 'serif'
  | 'serifSong'
  | 'serifBatang'
  | 'serifIsland'
  | 'serifClassic'
  | 'hand'
  | 'pen'
  | 'brush'
  | 'brushYeon'
  | 'brushIsland'
  | 'handRough'
  | 'handThin'
  | 'handMelody'
  | 'handKirang'
  | 'handStory'
  | 'handDay'
  | 'handFlower'
  | 'handCute'
  | 'handDongle'
  | 'round'
  | 'quirkBagel'
  | 'quirkMoirai'
  | 'quirkGugi'
  | 'quirkOrbit';

export type FontGroup = '고딕' | '명조' | '손글씨' | '개성';

/** 고를 때 보여 주는 묶음 순서 */
export const FONT_GROUPS: FontGroup[] = ['고딕', '명조', '손글씨', '개성'];

export interface FontPreset {
  id: FontId;
  label: string;
  /** 글씨체 느낌을 한 줄로 설명(고를 때 보여 준다) */
  desc: string;
  /** 고를 때 묶어 보여 주는 분류 */
  group: FontGroup;
  /**
   * 앱에 넣은 글꼴 이름(assets/fonts, fonts.ts 의 VLOG_FONT_ASSETS 키와 같다).
   * 없으면 기기 기본 글꼴을 쓴다.
   */
  family?: string;
  style: TextStyle;
  /** 글꼴마다 같은 크기에서 보이는 덩치가 달라, 자막 크기를 눈높이로 맞추는 보정값 */
  scale: number;
}

/**
 * 자막 글씨체. 기본 고딕만 기기 글꼴이고 나머지는 앱에 넣은 글꼴 파일을 쓴다
 * (모두 SIL Open Font License, 라이선스 원문은 assets/fonts 에 함께 둔다).
 * 글꼴을 더 넣을 때는 assets/fonts 에 파일을 두고 fonts.ts 의 VLOG_FONT_ASSETS 에 같은 이름으로 등록한다.
 */
export const FONTS: FontPreset[] = [
  // 고딕
  { id: 'gothic', label: '기기 기본', desc: '휴대폰에 들어 있는 기본 글씨', group: '고딕', style: { fontWeight: '800' }, scale: 1.0 },
  { id: 'gothicTitle', label: '제목 고딕', desc: '또박또박한 제목용', group: '고딕', family: 'DoHyeon', style: {}, scale: 1.11 },
  { id: 'bold', label: '임팩트', desc: '굵고 꽉 차는 제목 느낌', group: '고딕', family: 'BlackHanSans', style: {}, scale: 1.12 },
  { id: 'boldFat', label: '초굵은체', desc: '화면을 꽉 채우는 가장 굵은 글씨', group: '고딕', family: 'GasoekOne', style: {}, scale: 0.99 },
  { id: 'gothicSharp', label: '선명 고딕', desc: '각이 또렷해 잘 읽혀요', group: '고딕', family: 'GothicA1', style: {}, scale: 0.94 },
  { id: 'gothicNeat', label: '단정 고딕', desc: '군더더기 없이 단정해요', group: '고딕', family: 'GothicKR', style: {}, scale: 0.92 },
  { id: 'gothicModern', label: '모던 고딕', desc: '깔끔하고 요즘 느낌', group: '고딕', family: 'ModernKR', style: {}, scale: 0.96 },
  { id: 'gothicSoft', label: '산뜻 고딕', desc: '가볍고 산뜻해요', group: '고딕', family: 'Sunflower', style: {}, scale: 0.89 },
  { id: 'gothicThin', label: '얇은 고딕', desc: '가늘고 차분해요', group: '고딕', family: 'Stylish', style: {}, scale: 1.01 },
  { id: 'gothicPlain', label: '담백 고딕', desc: '담백하고 조용한 느낌', group: '고딕', family: 'GowunDodum', style: {}, scale: 0.98 },
  { id: 'gothicIsland', label: '섬 고딕', desc: '여행지 안내판 같은 글씨', group: '고딕', family: 'IslandGothic', style: {}, scale: 0.94 },
  // 명조
  { id: 'serif', label: '명조체', desc: '차분하고 담백한 느낌', group: '명조', family: 'MyeongjoKR', style: {}, scale: 0.92 },
  { id: 'serifSong', label: '옛 명조', desc: '옛 책에서 본 듯한 글씨', group: '명조', family: 'SongMyung', style: {}, scale: 1.02 },
  { id: 'serifBatang', label: '고운 바탕', desc: '부드럽고 단정한 바탕체', group: '명조', family: 'GowunBatang', style: {}, scale: 0.94 },
  { id: 'serifIsland', label: '섬 명조', desc: '여행 기록에 잘 맞는 바탕체', group: '명조', family: 'IslandMyeongjo', style: {}, scale: 0.98 },
  { id: 'serifClassic', label: '고전체', desc: '장식 있는 고전 느낌', group: '명조', family: 'Diphylleia', style: {}, scale: 0.95 },
  // 손글씨
  { id: 'hand', label: '손글씨', desc: '공책에 적은 듯한 손글씨', group: '손글씨', family: 'Gaegu', style: {}, scale: 0.99 },
  { id: 'pen', label: '펜글씨', desc: '사인펜으로 쓴 여행 일기', group: '손글씨', family: 'PenKR', style: {}, scale: 1.04 },
  { id: 'brush', label: '붓글씨', desc: '붓으로 쓱 쓴 느낌', group: '손글씨', family: 'BrushKR', style: {}, scale: 1.01 },
  { id: 'brushYeon', label: '먹붓체', desc: '진한 먹으로 쓴 붓글씨', group: '손글씨', family: 'YeonSung', style: {}, scale: 0.89 },
  { id: 'brushIsland', label: '섬 붓글씨', desc: '거친 붓 자국이 남는 글씨', group: '손글씨', family: 'IslandBrush', style: {}, scale: 0.96 },
  { id: 'handRough', label: '거친 손글씨', desc: '빠르게 휘갈긴 손글씨', group: '손글씨', family: 'Dokdo', style: {}, scale: 0.93 },
  { id: 'handThin', label: '가는 손글씨', desc: '얇은 펜으로 쓴 손글씨', group: '손글씨', family: 'EastSeaDokdo', style: {}, scale: 1.27 },
  { id: 'handMelody', label: '또박 손글씨', desc: '또박또박 쓴 둥근 손글씨', group: '손글씨', family: 'HiMelody', style: {}, scale: 1.04 },
  { id: 'handKirang', label: '옛 간판체', desc: '옛 간판에서 본 듯한 글씨', group: '손글씨', family: 'KirangHaerang', style: {}, scale: 1.02 },
  { id: 'handStory', label: '동화 손글씨', desc: '동화책에 적힌 듯한 글씨', group: '손글씨', family: 'PoorStory', style: {}, scale: 0.98 },
  { id: 'handDay', label: '하루 손글씨', desc: '일기장에 적은 하루', group: '손글씨', family: 'SingleDay', style: {}, scale: 0.96 },
  { id: 'handFlower', label: '꽃잎 손글씨', desc: '동글동글 귀여운 손글씨', group: '손글씨', family: 'GamjaFlower', style: {}, scale: 0.99 },
  { id: 'handCute', label: '아기 손글씨', desc: '아이가 쓴 듯 작고 귀여워요', group: '손글씨', family: 'CuteFont', style: {}, scale: 1.11 },
  { id: 'handDongle', label: '동글 손글씨', desc: '길쭉하고 동글한 손글씨', group: '손글씨', family: 'Dongle', style: {}, scale: 1.1 },
  // 개성
  { id: 'round', label: '둥근체', desc: '동글동글 가볍고 친근해요', group: '개성', family: 'Jua', style: {}, scale: 1.04 },
  { id: 'quirkBagel', label: '통통체', desc: '통통하고 장난스러워요', group: '개성', family: 'BagelFatOne', style: {}, scale: 1.01 },
  { id: 'quirkMoirai', label: '또렷체', desc: '굵은 테두리로 또렷해요', group: '개성', family: 'MoiraiOne', style: {}, scale: 0.94 },
  { id: 'quirkGugi', label: '각진체', desc: '각지고 개성 있어요', group: '개성', family: 'Gugi', style: {}, scale: 0.99 },
  { id: 'quirkOrbit', label: '미래체', desc: '선으로 그린 미래 느낌', group: '개성', family: 'Orbit', style: {}, scale: 0.97 },
];
export const fontOf = (id?: FontId): FontPreset => FONTS.find((f) => f.id === id) ?? FONTS[0];
export const FONT_SAMPLE = '오늘도 함께한 순간';

/** 글씨체를 글자에 입히는 스타일. 기기 글꼴이면 fontFamily 를 넣지 않는다. */
export const fontStyleOf = (id?: FontId): TextStyle => {
  const f = fontOf(id);
  return f.family ? { ...f.style, fontFamily: f.family } : f.style;
};

// ---------- 자막 모양 ----------

/** 서버 렌더러(server/worker/vlog-render.ts)가 쓰는 이름과 같아야 한다. 'center' 를 'middle' 로 쓰면 조용히 아래로 떨어진다. */
export type CaptionPos = 'top' | 'center' | 'bottom';
export type CaptionSize = 'sm' | 'md' | 'lg';
export type CaptionBg = 'none' | 'dim' | 'solid' | 'white';
export type CaptionColor =
  | 'white'
  | 'black'
  | 'coral'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'sky'
  | 'navy'
  | 'mint'
  | 'lime'
  | 'gold'
  | 'cream'
  | 'gray';

/**
 * 자막 모양. 장면마다 다르게 두면 한 영상에 글씨체가 섞여 어지러워지므로
 * 영상 하나에 한 벌만 두고, 자막 글자만 장면별로 적는다.
 */
export interface CaptionStyle {
  fontId: FontId;
  /**
   * 위·중앙·아래 중 어디에 두는지.
   * 직접 옮긴 자리(xy)가 있으면 그 자리가 먼저지만, 이 값도 함께 보낸다 —
   * 서버 렌더러는 아직 세 자리만 알아서, 가장 가까운 자리로라도 그려야 한다.
   */
  pos: CaptionPos;
  /** 직접 끌어 옮긴 자리(화면 폭·높이에 대한 비율, 자막 가운데 기준). 없으면 pos 를 따른다. */
  xy?: { x: number; y: number };
  size: CaptionSize;
  bg: CaptionBg;
  color: CaptionColor;
  /** 장면이 시작될 때 자막이 어떻게 나타날지 */
  anim: AnimId;
}

export const CAPTION_POSITIONS: { id: CaptionPos; label: string }[] = [
  { id: 'top', label: '위' },
  { id: 'center', label: '중앙' },
  { id: 'bottom', label: '아래' },
];

/**
 * 자막 크기는 출력 화면(세로 1080px 폭) 기준의 글자 크기다.
 * 서버 렌더러가 쓰는 숫자와 같은 값이라, 미리보기와 완성 영상의 자막 크기가 어긋나지 않는다.
 * '보통' 48 은 지금 서버가 고정으로 쓰는 값이다.
 */
export const CAPTION_SIZES: { id: CaptionSize; label: string; px: number }[] = [
  { id: 'sm', label: '작게', px: 36 },
  { id: 'md', label: '보통', px: 48 },
  { id: 'lg', label: '크게', px: 64 },
];

/** 날짜·장소 라벨의 글자 크기(출력 px). 서버 렌더러와 같은 값이다. */
export const PLACE_LABEL_PX = 32;

/**
 * 자막·라벨을 놓는 세로 위치(화면 높이에 대한 비율, 글자 윗변 기준).
 * 서버 렌더러가 쓰는 값과 같아야 미리보기에서 정한 위치가 완성 영상에서도 같다.
 */
export const CAPTION_Y: Record<CaptionPos, number | 'center'> = { top: 0.1, center: 'center', bottom: 0.86 };
export const PLACE_LABEL_Y: Record<PlaceLabel['pos'], number> = { top: 0.06, bottom: 0.78 };
/** 겹쳐 그리는 글자의 좌우 여백(화면 폭에 대한 비율). 서버는 폭의 94% 안에 글자를 넣는다. */
export const OVERLAY_SIDE = 0.03;

/**
 * 날짜 제목 화면. 서버 렌더러가 쓰는 값과 같다
 * (바탕 #FDEDEB · 날짜 48px 를 높이의 40% · 제목 56px 를 52%).
 * 제목 화면은 서버가 늘 기본 고딕으로 그리므로, 고른 글씨체를 여기에 쓰지 않는다.
 */
export const TITLE_DATE_Y = 0.4;
export const TITLE_NAME_Y = 0.52;
export const TITLE_DATE_PX = 48;
export const TITLE_NAME_PX = 56;

export const CAPTION_BGS: { id: CaptionBg; label: string; desc: string }[] = [
  { id: 'none', label: '없음', desc: '글자에 그림자만 넣어 읽히게 해요' },
  { id: 'dim', label: '반투명', desc: '사진이 비치는 어두운 띠' },
  { id: 'solid', label: '검정', desc: '꽉 찬 검정 바탕' },
  { id: 'white', label: '흰색', desc: '꽉 찬 흰 바탕' },
];

export const CAPTION_COLORS: { id: CaptionColor; label: string; hex: string }[] = [
  { id: 'white', label: '흰색', hex: '#FFFFFF' },
  { id: 'black', label: '검정', hex: '#191F28' },
  { id: 'coral', label: '코랄', hex: '#F1706B' },
  { id: 'yellow', label: '노랑', hex: '#FFE14D' },
  { id: 'orange', label: '주황', hex: '#FF9F43' },
  { id: 'red', label: '빨강', hex: '#FF4D4D' },
  { id: 'pink', label: '분홍', hex: '#FF8FB8' },
  { id: 'purple', label: '보라', hex: '#B28DFF' },
  { id: 'sky', label: '하늘', hex: '#6EC6FF' },
  { id: 'navy', label: '남색', hex: '#1E3A8A' },
  { id: 'mint', label: '민트', hex: '#7FE5C4' },
  { id: 'lime', label: '연두', hex: '#B6F04F' },
  { id: 'gold', label: '금색', hex: '#E6B84A' },
  { id: 'cream', label: '크림', hex: '#FFF3D6' },
  { id: 'gray', label: '회색', hex: '#9AA3AD' },
];

/**
 * 직접 옮긴 자리를 위·중앙·아래 중 가장 가까운 것으로 바꾼다.
 * 서버가 아직 세 자리만 알기 때문에, 옮긴 자리와 함께 이 값도 보내 둔다.
 */
export function nearestCaptionPos(y: number): CaptionPos {
  let best: CaptionPos = 'bottom';
  let gap = Infinity;
  for (const p of ['top', 'center', 'bottom'] as CaptionPos[]) {
    const at = CAPTION_Y[p] === 'center' ? 0.5 : (CAPTION_Y[p] as number);
    const d = Math.abs(at - y);
    if (d < gap) {
      gap = d;
      best = p;
    }
  }
  return best;
}

/**
 * 자막을 화면 안에 둔다. y 는 자막 윗변이라(프리셋 위치·서버와 같은 기준)
 * 아래쪽은 자막 한 줄이 들어갈 만큼 남긴다.
 */
export const clampCaptionXY = (x: number, y: number): { x: number; y: number } => ({
  x: Math.max(0, Math.min(1, x)),
  y: Math.max(0.03, Math.min(0.88, y)),
});

export const defaultCaptionStyle = (): CaptionStyle => ({ fontId: 'gothic', pos: 'bottom', size: 'md', bg: 'dim', color: 'white', anim: 'up' });

/** 저장된 초안에 자막 모양이 없을 수도 있어(이전 버전) 기본값을 깔고 읽는다. */
export const captionStyleOf = (style?: Partial<CaptionStyle>): CaptionStyle => ({ ...defaultCaptionStyle(), ...style });

/** 자막을 그리는 데 필요한 실제 값. 미리보기와 최종 출력이 같은 계산을 쓴다. */
export interface CaptionLayout {
  fontSize: number;
  lineHeight: number;
  padV: number;
  padH: number;
  radius: number;
  /** 배경이 '없음'이면 undefined */
  bgColor?: string;
  color: string;
  /** 배경이 없을 때 글자가 묻히지 않게 넣는 그림자 */
  shadow: boolean;
}

/** 자막·장소 라벨 배경색. '없음'이면 undefined */
export const captionBgColor = (bg: CaptionBg): string | undefined => CAPTION_BG_COLORS[bg];

const CAPTION_BG_COLORS: Record<CaptionBg, string | undefined> = {
  none: undefined,
  dim: 'rgba(25,31,40,0.6)',
  solid: '#191F28',
  white: '#FFFFFF',
};

/**
 * 자막 모양을 실제 글자 크기·여백으로 바꾼다.
 * width 는 지금 그리는 화면의 폭, outWidth 는 출력 화면의 폭(1080 또는 1920)이다.
 * 둘의 비율로 줄이므로, 작은 미리보기와 완성 영상이 같은 크기로 보인다.
 */
export function captionLayout(style: CaptionStyle, width: number, outWidth: number): CaptionLayout {
  const px = CAPTION_SIZES.find((s) => s.id === style.size)?.px ?? 48;
  // 하한은 글자가 사라지지 않을 만큼만 둔다. 더 올리면 작은 미리보기에서 '작게'와 '보통'이
  // 같은 크기로 보여, 미리보기와 완성 영상이 어긋나는 것을 눈치채지 못한다.
  const fontSize = Math.max(5, px * (width / outWidth) * fontOf(style.fontId).scale);
  const bgColor = CAPTION_BG_COLORS[style.bg];
  return {
    fontSize,
    lineHeight: fontSize * 1.35,
    padV: bgColor ? Math.max(2, fontSize * 0.3) : 0,
    padH: bgColor ? Math.max(4, fontSize * 0.55) : 0,
    radius: Math.max(4, fontSize * 0.35),
    bgColor,
    color: CAPTION_COLORS.find((c) => c.id === style.color)?.hex ?? '#FFFFFF',
    shadow: !bgColor,
  };
}

/** 글자색과 배경이 겹쳐 안 보이는 조합을 미리 알려 준다. 문제가 없으면 null */
export function captionWarning(style: CaptionStyle): string | null {
  if (style.bg === 'white' && style.color === 'white') return '흰 배경에 흰 글씨는 보이지 않아요. 글자색을 바꿔 주세요.';
  if ((style.bg === 'solid' || style.bg === 'dim') && (style.color === 'black' || style.color === 'navy')) return '어두운 배경에 어두운 글씨는 잘 안 보여요.';
  if (style.bg === 'white' && (style.color === 'cream' || style.color === 'yellow' || style.color === 'lime' || style.color === 'mint')) return '흰 배경에 밝은 글씨는 잘 안 보여요. 글자색을 바꿔 주세요.';
  if (style.bg === 'none' && style.color === 'black') return '배경이 없으면 검정 글씨는 어두운 사진에서 묻힐 수 있어요.';
  return null;
}

// ---------- 제작 가능한 날짜·장소·기록 ----------

export interface VlogMedia {
  item: PlaceRecordItem;
  /** 올린 사람(TripMember.id) */
  memberId: string;
  /** 올린 시각 문자열(정렬·표시용) */
  time: string;
  /** 동영상 원본 길이(초). 사진이면 없음 */
  seconds?: number;
}

export interface VlogPlace {
  /** 방문 식별자(일정·날짜·장소). 날짜가 다르면 같은 장소도 다른 키다. */
  key: string;
  place: ItineraryPlace;
  media: VlogMedia[];
}

export interface VlogDay {
  /** `${itineraryId}/${dayId}` */
  key: string;
  itineraryId: string;
  dayId: string;
  date: string;
  title: string;
  cancelled: boolean;
  /** 기록이 있든 없든 일정에 담긴 모든 장소(방문 순서) */
  places: VlogPlace[];
  mediaCount: number;
}

/** '0:08' → 8 */
export function parseDurationLabel(label?: string): number | undefined {
  if (!label) return undefined;
  const m = /^(\d+):(\d{1,2})$/.exec(label.trim());
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 모임의 일정들에서 브이로그로 담을 수 있는 날짜 목록을 만든다(최근 날짜부터).
 * 취소된 일정·날짜도 기록이 남아 있으면 포함한다. 기록이 없는 날짜도 목록에는 두되 mediaCount 가 0이다.
 */
export function buildVlogDays(group: Group, schedules: Schedule[], itineraries: Itinerary[]): VlogDay[] {
  const days: VlogDay[] = [];
  const seen = new Set<string>();
  for (const sc of schedules) {
    if (sc.groupId !== group.id || !sc.itineraryId || seen.has(sc.itineraryId)) continue;
    const itinerary = itineraries.find((it) => it.id === sc.itineraryId);
    if (!itinerary) continue;
    seen.add(itinerary.id);
    for (const day of itinerary.days) {
      const places: VlogPlace[] = day.places.map((place) => ({
        key: visitIdOf(itinerary.id, day.id, place),
        place,
        media: recordsForVisit(itinerary.id, day.id, place).flatMap((record) =>
          record.items.map((item) => ({
            item,
            memberId: record.memberId,
            time: record.time,
            seconds: item.kind === 'video' ? (parseDurationLabel(item.durationLabel) ?? 0) : undefined,
          })),
        ),
      }));
      days.push({
        key: `${itinerary.id}/${day.id}`,
        itineraryId: itinerary.id,
        dayId: day.id,
        date: day.date,
        title: day.title?.trim() || defaultDayTitle(itinerary.name || sc.title, day.dayNumber, itinerary.days.length),
        cancelled: Boolean(day.cancelled) || sc.status === 'cancelled',
        places,
        mediaCount: places.reduce((n, p) => n + p.media.length, 0),
      });
    }
  }
  return days.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

export const placesWithMedia = (day: VlogDay): VlogPlace[] => day.places.filter((p) => p.media.length > 0);

// ---------- 초안 ----------

export type PlayMode = 'sequence' | 'split';

export interface PlaceSetting {
  mode: PlayMode;
  /** mode 가 split 일 때의 템플릿 id */
  templateId?: string;
  showDate: boolean;
  showPlace: boolean;
  /**
   * (이전 버전) 장면별 글씨체. 지금은 영상 하나에 한 벌(draft.captionStyle)을 쓴다.
   * 저장된 초안을 읽을 때 글씨체를 되살리는 데만 쓴다.
   */
  fontId?: FontId;
  /** (이전 버전) 한 줄짜리 자막. 줄 목록을 손대기 전까지만 읽는다. */
  captions: Record<string, string>;
  /** 자막 줄 목록. 이어 재생은 기록 id, 분할은 'all' 이 키다. */
  captionLines?: Record<string, CaptionLine[]>;
  /** 분할 장면의 공통 길이를 직접 줄였을 때(초). 없으면 자동 맞춤 */
  lengthSec?: number;
  /** 사진만 고른 이어 재생에서 사진 한 장을 보여 주는 시간(초). 없으면 기본값 */
  photoSec?: number;
  /** 이어 재생에서 동영상별로 직접 정한 사용 길이(초). 기록 id → 길이. 없으면 원본 길이(최대 5초) */
  videoLen?: Record<string, number>;
  /** 이 장면이 시작될 때의 전환 효과. 없으면 프로젝트 기본 전환을 따른다. */
  transition?: TransitionId;
  /** 이 장면 사진의 움직임. 없으면 프로젝트 기본 움직임을 따른다. */
  motion?: MotionId;
  /** 동영상 재생 속도. 기록 id → 배속. 없으면 1배(보통) */
  speed?: Record<string, number>;
  /** 장면에 얹는 스티커. 이어 재생은 기록 id, 분할은 'all' 이 키다. */
  stickers?: Record<string, Sticker[]>;
  /** 색감 효과. 이어 재생은 기록 id, 분할은 'all' 이 키다. 없으면 원본 */
  filters?: Record<string, FilterId>;
  /** 화면 맞춤·자르기(이어 재생). 기록 id → 설정. 없으면 채우기 */
  frames?: Record<string, Partial<FrameAdjust>>;
  /** 긴 동영상에서 쓸 구간의 시작(초). 기록 id → 시작 */
  videoStart: Record<string, number>;
  /** "이 장소 완료"를 누른 장소 */
  done: boolean;
}

export const defaultSetting = (): PlaceSetting => ({
  mode: 'sequence',
  showDate: true,
  showPlace: true,
  captions: {},
  videoStart: {},
  done: false,
});

// ---------- 배경 음악 ----------

/** 'none' 이면 음악 없음, 아니면 musicTracks 의 곡 id */
export type MusicId = string;
export type MusicVolume = 'low' | 'mid' | 'high';
/** 음악 소리 크기(0~1). 원본 영상 소리 위에 깔리므로 너무 크지 않게 잡는다. */
export const MUSIC_VOLUMES: { id: MusicVolume; label: string; value: number }[] = [
  { id: 'low', label: '작게', value: 0.25 },
  { id: 'mid', label: '보통', value: 0.55 },
  { id: 'high', label: '크게', value: 0.9 },
];

export interface RenderMark {
  /** 생성 당시 초안 내용의 서명. 편집이 바뀌면 달라진다. */
  signature: string;
  uri: string;
  durationSec: number;
  createdAt: number;
  savedToGallery: boolean;
}

export interface VlogDraft {
  groupId: string;
  title: string;
  /** 선택한 날짜(VlogDay.key). 장면 순서대로 */
  dayKeys: string[];
  /** 날짜별로 선택한 장소(VlogPlace.key). 장면 순서대로 */
  placeKeys: Record<string, string[]>;
  /** 장소별로 고른 기록 id. 선택한 순서가 재생 순서다. */
  mediaIds: Record<string, string[]>;
  settings: Record<string, PlaceSetting>;
  /** (이전 버전) 전체 제목 화면 설정. 지금은 날짜별 dayTitleCard 를 쓴다. */
  titleCard: boolean;
  /** 출력 화면 비율. 없으면 세로 */
  aspect?: AspectId;
  /** 날짜별 제목 화면을 넣을지. 날짜 key → 켬/끔(없으면 끔) */
  dayTitleCard?: Record<string, boolean>;
  /** 브이로그에서만 쓰는 날짜 제목. 날짜 key → 제목(없으면 일정의 날짜 제목). 원본 일정은 바뀌지 않는다. */
  dayTitles?: Record<string, string>;
  /** 장면 전환 효과. 없으면 'none' */
  transition?: TransitionId;
  /** 마지막에 끝 화면을 넣을지. 없으면 끔 */
  endCard?: boolean;
  /** 끝 화면에 적는 문구. 비어 있으면 기본 문구를 쓴다. */
  endText?: string;
  /** 자막 모양(글씨체·위치·크기·배경·글자색·등장). 영상 전체에 하나. 없으면 기본값 */
  captionStyle?: CaptionStyle;
  /** 사진 움직임의 기본값. 장면별로 다르게 둘 수 있다. 없으면 'none' */
  motion?: MotionId;
  /** 장소 라벨 모양. 영상 전체에 하나. 없으면 기본값 */
  placeLabel?: PlaceLabel;
  /** 배경 음악. 영상 전체에 하나. 없으면 음악 없음 */
  music?: { id: MusicId; volume: MusicVolume };
  /** 동영상 원본 소리를 그대로 둘지 없앨지. 없으면 그대로 둔다 */
  originalSound?: 'keep' | 'mute';
  render?: RenderMark;
  updatedAt: number;
}

export const emptyDraft = (groupId: string): VlogDraft => ({
  groupId,
  title: '',
  dayKeys: [],
  placeKeys: {},
  mediaIds: {},
  settings: {},
  titleCard: false,
  updatedAt: 0,
});

export const hasContent = (draft: VlogDraft): boolean => draft.dayKeys.length > 0;

/** 원래 순서(order)를 지키며 key 를 목록(list)에 끼워 넣는다. */
export function insertInOrder(list: string[], key: string, order: string[]): string[] {
  const idx = order.indexOf(key);
  const at = list.findIndex((k) => order.indexOf(k) > idx);
  const next = [...list];
  if (at === -1) next.push(key);
  else next.splice(at, 0, key);
  return next;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** 초안에서 지금도 남아 있는 기록만 골라낸다. 삭제된 기록은 missing 으로 센다(다른 장소의 선택은 건드리지 않는다). */
export function resolveMedia(draft: VlogDraft, place: VlogPlace): { media: VlogMedia[]; missing: number } {
  const ids = draft.mediaIds[place.key] ?? [];
  const media: VlogMedia[] = [];
  let missing = 0;
  for (const id of ids) {
    const found = place.media.find((m) => m.item.id === id);
    if (found) media.push(found);
    else missing += 1;
  }
  return { media, missing };
}

// ---------- 템플릿·길이 ----------

/** 이 개수에서 쓸 수 있는 분할 템플릿. 없으면(1개·6개 이상) 이어 재생만 가능하다. */
/** 가로 화면용 이름: 세로 배치를 가로로 눕히면 방향 낱말이 서로 바뀐다. */
const LANDSCAPE_WORDS: [string, string][] = [['세로', '가로'], ['좌우', '상하'], ['위아래', '좌우'], ['좌측', '상단'], ['상단', '좌측'], ['우측', '하단'], ['하단', '우측']];
const landscapeLabel = (label: string): string => {
  for (const [from, to] of LANDSCAPE_WORDS) if (label.includes(from)) return label.replace(from, to);
  return label.includes('가로') ? label.replace('가로', '세로') : label;
};

/**
 * 이 개수에서 쓸 수 있는 분할 템플릿. 없으면(1개·6개 이상) 이어 재생만 가능하다.
 * 가로 화면에서는 같은 템플릿(id 동일)을 가로로 눕힌 배치([x,y,w,h] → [y,x,h,w])로 돌려준다.
 */
export const splitTemplatesFor = (count: number, aspect: AspectId = 'portrait'): Template[] => {
  if (count < 2 || count > MAX_SPLIT) return [];
  const list = templatesFor(count);
  if (aspect === 'portrait') return list;
  return list.map((t) => ({ ...t, label: landscapeLabel(t.label), rects: t.rects.map(([x, y, w, h]) => [y, x, h, w] as Rect) }));
};

/** 설정이 현재 개수와 맞지 않으면 이어 재생으로 돌려 본 "실제 재생 방식" */
export function effectiveMode(setting: PlaceSetting, count: number): PlayMode {
  if (setting.mode !== 'split') return 'sequence';
  const templates = splitTemplatesFor(count);
  return templates.some((t) => t.id === setting.templateId) ? 'split' : 'sequence';
}

/** 분할 장면의 자동 공통 길이: 가장 짧은 동영상. 동영상이 없으면 undefined. */
export function commonLength(media: VlogMedia[]): number | undefined {
  const lens = media.filter((m) => m.item.kind === 'video').map((m) => m.seconds ?? 0).filter((s) => s > 0);
  return lens.length ? Math.min(...lens) : undefined;
}

/** 분할 장면의 실제 길이(초). 직접 줄인 길이는 자동 공통 길이를 넘지 못한다. */
export function splitLength(media: VlogMedia[], setting: PlaceSetting): number {
  const auto = commonLength(media);
  if (auto === undefined) return clampPhotoSec(setting.lengthSec ?? PHOTO_SPLIT_SEC);
  // 원본이 1초보다 짧으면 1초로 올리지 않는다(없는 구간을 만들어 내게 된다).
  return Math.max(Math.min(1, auto), Math.min(auto, setting.lengthSec ?? auto));
}

/** 이어 재생에서 동영상이 쓰는 길이: 직접 정한 값(원본 길이 이하) 또는 기본(원본, 최대 5초) */
export function videoLength(m: VlogMedia, setting: PlaceSetting): number {
  const orig = m.seconds || VIDEO_SEQUENCE_MAX_SEC;
  const custom = setting.videoLen?.[m.item.id];
  if (custom !== undefined) return Math.max(Math.min(1, orig), Math.min(orig, Math.round(custom)));
  return Math.min(orig, VIDEO_SEQUENCE_MAX_SEC);
}

export const clampPhotoSec = (v: number): number => Math.max(MIN_PHOTO_SEC, Math.min(MAX_PHOTO_SEC, Math.round(v)));

/** 이 동영상의 재생 속도(배). 고른 적 없으면 1배 */
export function videoSpeed(m: VlogMedia, setting: PlaceSetting): number {
  const v = setting.speed?.[m.item.id];
  return v && SPEEDS.some((s) => s.id === v) ? v : 1;
}

/**
 * 동영상이 화면에서 차지하는 시간(초).
 * 쓰기로 한 원본 구간(videoLength)을 속도로 나눈다 — 2배속이면 절반만에 지나간다.
 */
export const videoScreenSeconds = (m: VlogMedia, setting: PlaceSetting): number =>
  videoLength(m, setting) / videoSpeed(m, setting);

/** 사진만 고른 장면인가(이때만 사진 길이를 직접 고를 수 있다) */
export const isPhotoOnly = (media: VlogMedia[]): boolean => media.length > 0 && media.every((m) => m.item.kind === 'photo');

export const clipSeconds = (m: VlogMedia, setting: PlaceSetting, photoOnly: boolean): number =>
  m.item.kind === 'video'
    ? videoScreenSeconds(m, setting)
    : photoOnly
      ? clampPhotoSec(setting.photoSec ?? PHOTO_SEQUENCE_SEC)
      : PHOTO_SEQUENCE_SEC;

export function sceneSeconds(media: VlogMedia[], setting: PlaceSetting): number {
  if (media.length === 0) return 0;
  if (effectiveMode(setting, media.length) === 'split') return splitLength(media, setting);
  const photoOnly = isPhotoOnly(media);
  return media.reduce((sum, m) => sum + clipSeconds(m, setting, photoOnly), 0);
}

// ---------- 타임라인(미리보기와 최종 출력이 같이 쓴다) ----------

export interface TimelineClip {
  itemId: string;
  kind: 'photo' | 'video';
  /** 사진 또는 동영상 커버 이미지 */
  image: string | number;
  videoSource?: number;
  /** 동영상에서 쓸 구간의 시작(초) */
  startSec: number;
  /** 화면에서 차지하는 시간(초). 속도를 반영한 값이다. */
  seconds: number;
  /** 재생 속도(배). 렌더러는 원본을 이 속도로 돌려 seconds 안에 담는다. */
  speed: number;
  /** 이 사진·동영상에 붙는 자막 줄들(구간 포함) */
  captions: CaptionLine[];
  /** 이 사진·동영상 위에 얹는 스티커 */
  stickers: Sticker[];
  filter: FilterId;
  frame: FrameAdjust;
}

export interface TimelineScene {
  id: string;
  aspect: AspectId;
  kind: 'title' | 'place';
  dayKey: string;
  placeKey?: string;
  startSec: number;
  seconds: number;
  /** 이 장면이 시작될 때(앞 장면에서 넘어올 때) 쓰는 전환 효과 */
  transition: TransitionId;
  /** title 장면: 날짜·제목 */
  titleDate?: string;
  titleText?: string;
  /** place 장면 */
  mode?: PlayMode;
  template?: Template;
  clips: TimelineClip[];
  /** 분할 장면 전체에 붙는 자막 줄들(구간 포함) */
  captions: CaptionLine[];
  dateText?: string;
  placeText?: string;
  /** 자막을 어떻게 그릴지. 영상 전체가 같은 값을 받는다(렌더러도 이 값대로 그린다). */
  captionStyle: CaptionStyle;
  /** 이 장면 사진의 움직임 */
  motion: MotionId;
  /** 지금 보이는 화면에 얹는 스티커 */
  stickers: Sticker[];
  /** 장소 라벨을 어떻게 그릴지 */
  placeLabel: PlaceLabel;
}

export interface Timeline {
  aspect: AspectId;
  transition: TransitionId;
  scenes: TimelineScene[];
  totalSec: number;
  itemCount: number;
}

export interface BuildContext {
  days: VlogDay[];
}

/** 초안을 순서대로 펼친 타임라인. 선택이 비어 있는 날짜·장소는 건너뛴다. */
export function buildTimeline(draft: VlogDraft, ctx: BuildContext): Timeline {
  const caption = captionStyleOf(draft.captionStyle);
  const label = placeLabelOf(draft.placeLabel);
  const scenes: TimelineScene[] = [];
  let t = 0;
  let itemCount = 0;
  for (const dayKey of draft.dayKeys) {
    const day = ctx.days.find((d) => d.key === dayKey);
    if (!day) continue;
    const placeScenes: Omit<TimelineScene, 'startSec'>[] = [];
    for (const placeKey of draft.placeKeys[dayKey] ?? []) {
      const place = day.places.find((p) => p.key === placeKey);
      if (!place) continue;
      const { media } = resolveMedia(draft, place);
      if (media.length === 0) continue;
      const setting = draft.settings[placeKey] ?? defaultSetting();
      const mode = effectiveMode(setting, media.length);
      const seconds = sceneSeconds(media, setting);
      const common = mode === 'split' ? seconds : 0;
      itemCount += media.length;
      placeScenes.push({
        id: `place:${placeKey}`,
        aspect: aspectOf(draft.aspect).id,
        kind: 'place',
        dayKey,
        placeKey,
        seconds,
        transition: setting.transition ?? draft.transition ?? 'none',
        mode,
        template: mode === 'split' ? splitTemplatesFor(media.length, draft.aspect).find((x) => x.id === setting.templateId) : undefined,
        clips: media.map((m) => ({
          itemId: m.item.id,
          kind: m.item.kind,
          image: m.item.imageUrl,
          videoSource: m.item.videoSource,
          startSec: m.item.kind === 'video' ? (setting.videoStart[m.item.id] ?? 0) : 0,
          seconds: mode === 'split' ? common : clipSeconds(m, setting, isPhotoOnly(media)),
          // 분할 장면은 칸이 동시에 재생되므로 속도를 쓰지 않는다.
          speed: mode === 'split' || m.item.kind !== 'video' ? 1 : videoSpeed(m, setting),
          stickers: setting.stickers?.[mode === 'split' ? 'all' : m.item.id] ?? [],
          captions: captionLinesOf(setting, m.item.id, mode === 'split' ? common : clipSeconds(m, setting, isPhotoOnly(media))),
          filter: setting.filters?.[mode === 'split' ? 'all' : m.item.id] ?? 'none',
          frame: clampFrame({ ...defaultFrame(), ...(setting.frames?.[m.item.id] ?? {}) }),
        })),
        captions: mode === 'split' ? captionLinesOf(setting, 'all', seconds) : [],
        stickers: mode === 'split' ? (setting.stickers?.all ?? []) : [],
        dateText: setting.showDate ? day.date.replace(/-/g, '.') : undefined,
        placeText: setting.showPlace ? place.place.name : undefined,
        captionStyle: caption,
        motion: setting.motion ?? draft.motion ?? 'none',
        placeLabel: label,
      });
    }
    if (placeScenes.length === 0) continue;
    if (draft.dayTitleCard?.[dayKey]) {
      scenes.push({
        id: `title:${dayKey}`,
        aspect: aspectOf(draft.aspect).id,
        kind: 'title',
        dayKey,
        startSec: t,
        seconds: TITLE_CARD_SEC,
        transition: draft.transition ?? 'none',
        titleDate: day.date.replace(/-/g, '.'),
        titleText: draft.dayTitles?.[dayKey]?.trim() || day.title,
        clips: [],
        captions: [],
        captionStyle: caption,
        motion: 'none',
        placeLabel: label,
        stickers: [],
      });
      t += TITLE_CARD_SEC;
    }
    for (const s of placeScenes) {
      scenes.push({ ...s, startSec: t });
      t += s.seconds;
    }
  }
  // 끝 화면. 날짜 제목 화면과 같은 모양(kind: 'title')으로 내보낸다.
  // 렌더러가 제목 화면을 그리는 길을 그대로 타므로, 서버를 고치지 않아도 지금 바로 나온다.
  // 날짜(titleDate)를 비우면 문구 한 줄만 그려진다.
  if (draft.endCard && scenes.length > 0) {
    scenes.push({
      id: 'end',
      aspect: aspectOf(draft.aspect).id,
      kind: 'title',
      dayKey: scenes[scenes.length - 1].dayKey,
      startSec: t,
      seconds: END_CARD_SEC,
      transition: draft.transition ?? 'none',
      titleText: draft.endText?.trim() || END_TEXT_DEFAULT,
      clips: [],
      captions: [],
      captionStyle: caption,
      motion: 'none',
      placeLabel: label,
      stickers: [],
    });
    t += END_CARD_SEC;
  }
  return { scenes, totalSec: t, itemCount, aspect: aspectOf(draft.aspect).id, transition: draft.transition ?? 'none' };
}

/** 한 장소의 장면 길이(제목 화면 제외). 화면의 "8초" 표시용 */
export function placeSeconds(draft: VlogDraft, place: VlogPlace): number {
  const { media } = resolveMedia(draft, place);
  return sceneSeconds(media, draft.settings[place.key] ?? defaultSetting());
}

/** 날짜 하나의 장면 길이 합 */
export function daySeconds(draft: VlogDraft, day: VlogDay): number {
  return (draft.placeKeys[day.key] ?? []).reduce((sum, key) => {
    const place = day.places.find((p) => p.key === key);
    return sum + (place ? placeSeconds(draft, place) : 0);
  }, 0);
}

/** 제작을 막는 문제. 없으면 null */
export function limitProblem(timeline: Timeline): string | null {
  if (timeline.itemCount > MAX_ITEMS) return `기록은 ${MAX_ITEMS}개까지 담을 수 있어요. ${timeline.itemCount - MAX_ITEMS}개를 줄여 주세요.`;
  if (timeline.totalSec > MAX_TOTAL_SEC) return `영상은 ${MAX_TOTAL_SEC / 60}분까지 만들 수 있어요. 길이를 줄여 주세요.`;
  return null;
}

/**
 * 영상을 만들기 전에 초안 전체를 확인한다. 문제가 없으면 null.
 * 길이·개수뿐 아니라 사라진 기록·중복 선택·원본을 벗어난 동영상 구간까지 본다
 * (미리보기는 건너뛰고 지나가지만, 실제로 만들 때는 그대로 깨진다).
 */
export function draftProblem(draft: VlogDraft, days: VlogDay[]): string | null {
  if (!draft.dayKeys.length) return '담을 날짜를 선택해 주세요.';
  for (const dayKey of draft.dayKeys) {
    const day = days.find((x) => x.key === dayKey);
    if (!day) return '선택한 날짜의 기록에 접근할 수 없어요. 날짜를 다시 골라 주세요.';
    if (!draft.placeKeys[dayKey]?.length) return '담을 장소를 선택해 주세요.';
    for (const key of draft.placeKeys[dayKey] ?? []) {
      const place = day.places.find((p) => p.key === key);
      const setting = draft.settings[key];
      if (!place || !setting?.done) return '아직 편집을 완료하지 않은 장소가 있어요.';
      const selected = resolveMedia(draft, place);
      if (!selected.media.length || selected.missing) return '삭제된 기록이 있어요. 장소를 다시 편집해 주세요.';
      if (new Set(draft.mediaIds[key]).size !== draft.mediaIds[key].length) return '같은 기록이 중복으로 담겼어요.';
      if (setting.mode === 'split' && effectiveMode(setting, selected.media.length) !== 'split')
        return '고른 개수에 맞는 분할 템플릿을 다시 골라 주세요.';
      if (selected.media.length > MAX_ITEMS_PER_PLACE) return `한 장소에는 ${MAX_ITEMS_PER_PLACE}개까지 담을 수 있어요.`;
      for (const m of selected.media.filter((x) => x.item.kind === 'video')) {
        const len = setting.mode === 'split' ? splitLength(selected.media, setting) : videoLength(m, setting);
        const start = setting.videoStart[m.item.id] ?? 0;
        if (!Number.isFinite(start) || !Number.isFinite(len) || start < 0 || len <= 0 || start + len - (m.seconds ?? 0) > 1e-9)
          return '동영상 사용 구간이 원본을 벗어났어요. 구간을 다시 골라 주세요.';
      }
    }
  }
  return limitProblem(buildTimeline(draft, { days }));
}

/** 편집 내용이 바뀌었는지 비교하는 서명(제목·선택·장면 구성). 진행 상태(done 등)는 넣지 않는다. */
export function draftSignature(draft: VlogDraft, timeline: Timeline): string {
  return JSON.stringify({
    t: draft.title,
    a: timeline.aspect,
    x: timeline.transition,
    c: captionStyleOf(draft.captionStyle),
    l: placeLabelOf(draft.placeLabel),
    m: draft.music ?? null,
    o: draft.originalSound ?? 'keep',
    s: timeline.scenes.map((s) => [s.id, s.titleText, s.seconds, s.mode, s.template?.id, s.transition, s.motion, s.dateText, s.placeText, s.captions, s.stickers, s.clips.map((c) => [c.itemId, c.startSec, c.seconds, c.speed, c.captions, c.filter, c.frame, c.stickers])]),
  });
}

/** "0:08" 같은 길이 표시 */
export const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
/** "00:03" 같은 재생 시간 표시 */
export const mmss2 = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export const defaultTitle = (group: Group): string => `${group.name} 브이로그`;
