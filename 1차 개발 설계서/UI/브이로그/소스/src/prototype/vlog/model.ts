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
export const PHOTO_SPLIT_SEC = 5;
/** 사진만 있는 장면에서 직접 고를 수 있는 길이(초) 범위 */
export const MIN_PHOTO_SEC = 1;
export const MAX_PHOTO_SEC = 10;
/** 날짜가 바뀔 때 넣는 제목 화면 길이(초) */
export const TITLE_CARD_SEC = 2;
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

export type TransitionId = 'none' | 'fade' | 'slide' | 'zoom';

export interface TransitionPreset {
  id: TransitionId;
  label: string;
  desc: string;
}

/** 장면과 장면 사이에 들어가는 전환 효과. 프로젝트 전체에 하나를 적용한다(제안 목록). */
export const TRANSITIONS: TransitionPreset[] = [
  { id: 'none', label: '없음', desc: '바로 다음 장면으로' },
  { id: 'fade', label: '페이드', desc: '서서히 겹치며 바뀜' },
  { id: 'slide', label: '슬라이드', desc: '옆으로 밀며 바뀜' },
  { id: 'zoom', label: '확대', desc: '커지며 나타남' },
];
/** 전환이 진행되는 시간(초). 다음 장면의 처음 구간 안에서 일어나며 전체 길이는 늘지 않는다. */
export const TRANSITION_SEC = 0.5;

// ---------- 색감 효과 ----------

export type FilterId = 'none' | 'bright' | 'dark' | 'gray';

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

export type FontId = 'gothic' | 'round' | 'hand';

export interface FontPreset {
  id: FontId;
  label: string;
  style: TextStyle;
}

/**
 * 글씨체 종류·명칭은 프리셋 제안이다. 앱에 글꼴 파일을 넣기 전까지는 기기 기본 글꼴 계열로 보여 준다
 * (최종 렌더링 연결 시 같은 id 를 실제 글꼴 파일에 매핑한다).
 */
export const FONTS: FontPreset[] = [
  { id: 'gothic', label: '기본 고딕', style: { fontWeight: '800' } },
  {
    id: 'round',
    label: '둥근체',
    style: {
      fontWeight: '700',
      fontFamily: Platform.select({ ios: 'Arial Rounded MT Bold', android: 'sans-serif-rounded', default: '"Nunito", "Arial Rounded MT Bold", sans-serif' }),
    },
  },
  {
    id: 'hand',
    label: '손글씨체',
    style: {
      fontWeight: '600',
      fontFamily: Platform.select({ ios: 'Noteworthy', android: 'cursive', default: '"Comic Sans MS", cursive' }),
    },
  },
];
export const fontOf = (id: FontId): FontPreset => FONTS.find((f) => f.id === id) ?? FONTS[0];
export const FONT_SAMPLE = '오늘도 함께한 순간';

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
  fontId: FontId;
  /** 자막. 이어 재생은 기록 id, 분할은 'all' 이 키다. */
  captions: Record<string, string>;
  /** 분할 장면의 공통 길이를 직접 줄였을 때(초). 없으면 자동 맞춤 */
  lengthSec?: number;
  /** 사진만 고른 이어 재생에서 사진 한 장을 보여 주는 시간(초). 없으면 기본값 */
  photoSec?: number;
  /** 이어 재생에서 동영상별로 직접 정한 사용 길이(초). 기록 id → 길이. 없으면 원본 길이(최대 5초) */
  videoLen?: Record<string, number>;
  /** 이 장면이 시작될 때의 전환 효과. 없으면 프로젝트 기본 전환을 따른다. */
  transition?: TransitionId;
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
  fontId: 'gothic',
  captions: {},
  videoStart: {},
  done: false,
});

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
const LANDSCAPE_WORDS: [string, string][] = [['세로', '가로'], ['좌우', '상하'], ['좌측', '상단'], ['상단', '좌측']];
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
  return Math.max(1, Math.min(auto, setting.lengthSec ?? auto));
}

/** 이어 재생에서 동영상이 쓰는 길이: 직접 정한 값(원본 길이 이하) 또는 기본(원본, 최대 5초) */
export function videoLength(m: VlogMedia, setting: PlaceSetting): number {
  const orig = m.seconds || VIDEO_SEQUENCE_MAX_SEC;
  const custom = setting.videoLen?.[m.item.id];
  if (custom !== undefined) return Math.max(1, Math.min(orig, Math.round(custom)));
  return Math.max(1, Math.min(orig, VIDEO_SEQUENCE_MAX_SEC));
}

export const clampPhotoSec = (v: number): number => Math.max(MIN_PHOTO_SEC, Math.min(MAX_PHOTO_SEC, Math.round(v)));

/** 사진만 고른 장면인가(이때만 사진 길이를 직접 고를 수 있다) */
export const isPhotoOnly = (media: VlogMedia[]): boolean => media.length > 0 && media.every((m) => m.item.kind === 'photo');

export const clipSeconds = (m: VlogMedia, setting: PlaceSetting, photoOnly: boolean): number =>
  m.item.kind === 'video'
    ? videoLength(m, setting)
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
  seconds: number;
  caption: string;
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
  /** 분할 장면 전체에 붙는 자막 */
  caption: string;
  dateText?: string;
  placeText?: string;
  fontId: FontId;
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
          caption: setting.captions[m.item.id] ?? '',
          filter: setting.filters?.[mode === 'split' ? 'all' : m.item.id] ?? 'none',
          frame: clampFrame({ ...defaultFrame(), ...(setting.frames?.[m.item.id] ?? {}) }),
        })),
        caption: setting.captions.all ?? '',
        dateText: setting.showDate ? day.date.replace(/-/g, '.') : undefined,
        placeText: setting.showPlace ? place.place.name : undefined,
        fontId: setting.fontId,
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
        caption: '',
        fontId: 'gothic',
      });
      t += TITLE_CARD_SEC;
    }
    for (const s of placeScenes) {
      scenes.push({ ...s, startSec: t });
      t += s.seconds;
    }
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

/** 편집 내용이 바뀌었는지 비교하는 서명(제목·선택·장면 구성). 진행 상태(done 등)는 넣지 않는다. */
export function draftSignature(draft: VlogDraft, timeline: Timeline): string {
  return JSON.stringify({
    t: draft.title,
    a: timeline.aspect,
    x: timeline.transition,
    s: timeline.scenes.map((s) => [s.id, s.titleText, s.seconds, s.mode, s.template?.id, s.transition, s.dateText, s.placeText, s.caption, s.fontId, s.clips.map((c) => [c.itemId, c.startSec, c.seconds, c.caption, c.filter, c.frame])]),
  });
}

/** "0:08" 같은 길이 표시 */
export const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
/** "00:03" 같은 재생 시간 표시 */
export const mmss2 = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export const defaultTitle = (group: Group): string => `${group.name} 브이로그`;
