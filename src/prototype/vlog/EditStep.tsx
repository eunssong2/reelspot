import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewProps } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import { ActionButton } from '../components/FormParts';
import { Toggle } from '../components/Toggle';
import { MIN_TOUCH, colors, GUTTER, radius, shadow } from '../styles/tokens';
import { shortDotDateLabel } from '../utils/date';
import { ro } from '../utils/korean';
import { locate, selectedPlaces, type StepCtx } from './ctx';
import {
  ANIMS,
  BG_OPTIONS,
  CAPTION_BGS,
  CAPTION_COLORS,
  CAPTION_POSITIONS,
  CAPTION_PX_MAX,
  CAPTION_PX_MIN,
  CAPTION_PX_STEP,
  captionPx,
  nearestCaptionSize,
  FILTERS,
  clampCaptionXY,
  clampFrame,
  FONTS,
  FONT_GROUPS,
  MOTIONS,
  PLACE_LABEL_POSITIONS,
  fitWidth,
  FONT_SAMPLE,
  TRANSITIONS,
  type TransitionId,
  MAX_PHOTO_SEC,
  MIN_PHOTO_SEC,
  PHOTO_SEQUENCE_SEC,
  PHOTO_SPLIT_SEC,
  MAX_CAPTION_LINES,
  MAX_STICKERS,
  SPEEDS,
  STICKERS,
  STICKER_SIZES,
  aspectOf,
  captionLinesOf,
  captionStyleOf,
  captionWarning,
  clampPhotoSec,
  defaultSetting,
  fontOf,
  fontStyleOf,
  isPhotoOnly,
  motionOf,
  nearestCaptionPos,
  placeLabelOf,
  videoLength,
  videoScreenSeconds,
  videoSpeed,
  moveItem,
  resolveMedia,
  splitTemplatesFor,
  type CaptionLine,
  type CaptionStyle,
  type FilterId,
  type FontGroup,
  type FontId,
  type MotionId,
  type PlaceLabel,
  type Sticker,
  type StickerSize,
  type StickerSpot,
  nearestStickerSpot,
  STICKER_SCALE_MAX,
  STICKER_SCALE_MIN,
  type PlaceSetting,
} from './model';
import { SceneCanvas, StateCard, StepFrame, TransitionStage } from './parts';

/** 스티커를 새로 붙일 때 자리를 고르는 차례. 서로 멀리 떨어진 모서리부터 쓴다. */
const STICKER_SPOT_ORDER: StickerSpot[] = ['tr', 'bl', 'tl', 'br', 'tc', 'bc', 'mr', 'ml', 'mc'];

/** 한 장소의 설정을 고친다. 고치면 "이 장소 완료"는 풀린다. */
const patch = (ctx: StepCtx, placeKey: string, change: Partial<PlaceSetting>) =>
  ctx.update((d) => ({
    ...d,
    settings: { ...d.settings, [placeKey]: { ...(d.settings[placeKey] ?? defaultSetting()), ...change, done: false } },
  }));

/** 4단계: 장면 순서·자막·날짜/장소명 표시·글씨체를 정하고 장소를 완료한다. */
export function EditStep({ ctx, placeKey }: { ctx: StepCtx; placeKey?: string }) {
  // 이 화면에 들어온 뒤의 변경만 되돌리게 한다(이전 단계의 선택까지 되돌려지지 않게).
  useEffect(() => {
    ctx.clearHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { width, height } = useWindowDimensions();
  // 자막을 적을 때 키보드가 입력칸을 가리지 않게 한다. 키보드가 올라오면 미리보기를 줄이고
  // 자막 입력칸이 보이도록 설정 목록을 스크롤한다.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const settingsScroll = useRef<ScrollView>(null);
  const captionY = useRef(0);
  const captionBodyY = useRef(0);
  const captionFocused = useRef(false);
  const revealCaption = () => {
    if (captionFocused.current) settingsScroll.current?.scrollTo({ y: captionY.current + captionBodyY.current, animated: true });
  };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [clipIndex, setClipIndex] = useState(0);
  // 분할 장면에서 고른 칸(0부터)
  const [cell, setCell] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  // 자막을 손으로 끌어 옮기는 중인지. 켜면 미리보기 위의 손짓을 자막 자리로 받는다.
  const [dragMode, setDragMode] = useState(false);
  // 스티커 고르는 창
  const [stickerOpen, setStickerOpen] = useState(false);
  // "모든 장면에 같은 움직임 적용" 전의 값(취소용)
  const [motionBackup, setMotionBackup] = useState<{ base: MotionId | undefined; perKey: Record<string, MotionId | undefined> } | null>(null);
  // "뒤 장면에도 넣기"를 누르기 전의 뒤 장면 자막(취소용). 다른 장면으로 가면 지운다.
  const [copyState, setCopyState] = useState<{ at: number; items: (readonly [string, CaptionLine[] | undefined])[] } | null>(null);
  // 스티커를 손으로 끌어 옮기는 중인 스티커 번호. null 이면 아님(자막 끌기와 함께 쓰지 않는다).
  const [dragSticker, setDragSticker] = useState<number | null>(null);
  const dragStickerRef = useRef<number | null>(null);
  dragStickerRef.current = dragSticker;
  // 움직임·등장을 보여 주는 동안 흐른 시간(초). null 이면 멈춘 그림이다.
  const [animSec, setAnimSec] = useState<number | null>(null);
  const animTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // 아코디언: 한 번에 하나만 펼친다(null 이면 모두 접힘).
  const [openSec, setOpenSec] = useState<string | null>(null);
  const toggleSec = (id: string) => setOpenSec((cur) => (cur === id ? null : id));
  // 전환 효과를 골랐을 때 이 미리보기에서 예시로 한 번 보여 주기 위한 진행도(0~1, 재생 중이 아니면 null)
  const [demo, setDemo] = useState<{ id: TransitionId; p: number } | null>(null);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopDemo = () => {
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = null;
  };
  const stopAnim = () => {
    if (animTimer.current) clearInterval(animTimer.current);
    animTimer.current = null;
  };
  useEffect(() => {
    return () => {
      stopDemo();
      stopAnim();
    };
  }, []);
  const playDemo = (id: TransitionId) => {
    stopDemo();
    if (id === 'none') return setDemo(null);
    let p = 0;
    setDemo({ id, p });
    demoTimer.current = setInterval(() => {
      p += 0.05;
      if (p >= 1) {
        stopDemo();
        setDemo(null);
      } else setDemo({ id, p });
    }, 40);
  };
  const found = locate(ctx.days, placeKey);
  const scene = ctx.timeline.scenes.find((s) => s.placeKey === placeKey);

  /** 이 장면을 처음부터 짧게 재생해 사진 움직임·자막 등장·장소 라벨을 보여 준다. */
  const playAnim = (sceneSec: number) => {
    stopAnim();
    const end = Math.max(1.2, Math.min(6, sceneSec));
    let sec = 0;
    setAnimSec(0);
    animTimer.current = setInterval(() => {
      sec += 0.05;
      if (sec >= end) {
        stopAnim();
        setAnimSec(null);
      } else setAnimSec(sec);
    }, 50);
  };

  if (!found || !scene) {
    return (
      <StepFrame title="장면 순서·자막" step={4} stepLabel="편집" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="편집할 장면이 없어요" body="이 장소에서 사진이나 동영상을 한 개 이상 골라 주세요." />
      </StepFrame>
    );
  }

  const key = found.place.key;
  const setting = ctx.draft.settings[key] ?? defaultSetting();
  const split = scene.mode === 'split';
  const media = resolveMedia(ctx.draft, found.place).media;
  const idx = Math.min(clipIndex, scene.clips.length - 1);
  const captionKey = split ? 'all' : (scene.clips[idx]?.itemId ?? 'all');

  const filterKey = split ? 'all' : (scene.clips[idx]?.itemId ?? 'all');
  const setFilter = (id: FilterId) => patch(ctx, key, { filters: { ...(setting.filters ?? {}), [filterKey]: id } });
  // 화면 맞춤·자르기는 사진·동영상 한 장씩 정한다(분할은 미리보기에서 칸을 눌러 고른다).
  const curClip = split ? scene.clips[Math.min(cell, scene.clips.length - 1)] : scene.clips[idx];
  const setFrame = (change: Partial<NonNullable<typeof curClip>['frame']>) => {
    if (!curClip) return;
    patch(ctx, key, { frames: { ...(setting.frames ?? {}), [curClip.itemId]: clampFrame({ ...curClip.frame, ...change }) } });
  };
  /** 지금 보고 있는 사진·장면이 화면에 머무는 시간(초). 자막 구간의 끝이 된다. */
  const clipSec = split ? (scene?.seconds ?? 0) : (scene?.clips[idx]?.seconds ?? 0);
  /**
   * 고치는 동안에는 글자가 빈 줄도 남겨 둬야 하므로 저장된 값을 그대로 읽는다.
   * (captionLinesOf 는 빈 줄을 걸러 내므로 미리보기·타임라인에서만 쓴다.)
   */
  const lines: CaptionLine[] =
    setting.captionLines?.[captionKey] ??
    (setting.captions[captionKey]?.trim() ? [{ text: setting.captions[captionKey], from: 0, to: clipSec }] : []);
  const setLines = (next: CaptionLine[]) => patch(ctx, key, { captionLines: { ...(setting.captionLines ?? {}), [captionKey]: next } });
  const editLine = (i: number, change: Partial<CaptionLine>) =>
    lines.length === 0 ? setLines([{ text: '', from: 0, to: clipSec, ...change }]) : setLines(lines.map((l, j) => (j === i ? { ...l, ...change } : l)));
  const addLine = () => {
    if (lines.length >= MAX_CAPTION_LINES) return ctx.toast(`자막은 ${MAX_CAPTION_LINES}줄까지 넣을 수 있어요.`);
    // 구간은 따로 정하지 않는다. 줄이 여럿이면 순서대로 장면 시간에 나눠 보여 준다(captionLinesOf).
    // 아직 줄이 없을 때 보이는 빈 입력도 한 줄로 치고 새 줄을 더한다.
    setLines(lines.length === 0 ? [{ text: '', from: 0, to: clipSec }, { text: '', from: 0, to: clipSec }] : [...lines, { text: '', from: 0, to: clipSec }]);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));
  /** 이 자막을 뒤쪽 장면에도 그대로 넣는다. 장면마다 길이가 달라 끝 시각은 그 장면에 맞춰 줄인다. */
  const copyToRest = () => {
    const rest = scene ? scene.clips.slice(idx + 1) : [];
    if (!rest.length) return ctx.toast('뒤에 넣을 장면이 없어요.');
    // 잘못 눌렀을 때 되돌릴 수 있게, 바꾸기 전 자막을 뒤 장면 것만 따로 담아 둔다.
    setCopyState({ at: idx, items: rest.map((c) => [c.itemId, setting.captionLines?.[c.itemId]] as const) });
    const next = { ...(setting.captionLines ?? {}) };
    for (const c of rest) {
      next[c.itemId] = lines.filter((l) => l.text.trim()).map((l) => ({ text: l.text, from: 0, to: c.seconds }));
    }
    patch(ctx, key, { captionLines: next });
    ctx.toast(`뒤 장면 ${rest.length}개에 같은 자막을 넣었어요.`);
  };
  /** 뒤 장면에 넣은 것을 취소한다. 뒤 장면의 자막만 원래대로 돌리고 이 장면에서 고친 것은 그대로 둔다. */
  const cancelCopy = () => {
    if (!copyState) return;
    const next = { ...(setting.captionLines ?? {}) };
    for (const [id, prev] of copyState.items) {
      if (prev === undefined) delete next[id];
      else next[id] = prev;
    }
    patch(ctx, key, { captionLines: next });
    setCopyState(null);
    ctx.toast('뒤 장면에 넣은 자막을 취소했어요.');
  };

  // 자막 모양은 장면별이 아니라 영상 전체에 하나다(한 영상에 글씨체가 섞이지 않게).
  const cap = captionStyleOf(ctx.draft.captionStyle);
  const applyCap = (next: CaptionStyle) => ctx.update((d) => ({ ...d, captionStyle: next }));
  const setCap = (change: Partial<CaptionStyle>) => applyCap({ ...cap, ...change });
  // 사진 움직임: 이 장면 설정이 없으면 영상 기본값을 따른다.
  const motion = setting.motion ?? ctx.draft.motion ?? 'none';
  const hasPhoto = scene?.clips.some((c) => c.kind === 'photo') ?? false;
  const setMotion = (id: MotionId) => {
    setMotionBackup(null); // 새로 고르면 이전 "모든 장면 적용"은 되돌릴 수 없다
    patch(ctx, key, { motion: id });
    if (scene) playAnim(scene.seconds);
  };
  /** 모든 장면에 같은 움직임을 쓰고, 장면별로 따로 정해 둔 값은 지운다. */
  const motionForAll = () => {
    // 잘못 눌렀을 때 되돌릴 수 있게, 바꾸기 전 영상 기본값과 장면별 값을 담아 둔다.
    setMotionBackup({
      base: ctx.draft.motion,
      perKey: Object.fromEntries(Object.entries(ctx.draft.settings).map(([k, v]) => [k, v.motion])),
    });
    ctx.update((d) => {
      const settings = { ...d.settings };
      for (const k of Object.keys(settings)) {
        const { motion: _drop, ...rest } = settings[k];
        settings[k] = rest;
      }
      return { ...d, motion, settings };
    });
    ctx.toast('모든 장면에 같은 움직임을 적용했어요.');
  };
  /** 모든 장면에 적용한 것을 취소하고 누르기 전 값으로 되돌린다. */
  const cancelMotionForAll = () => {
    if (!motionBackup) return;
    ctx.update((d) => {
      const settings = { ...d.settings };
      for (const k of Object.keys(settings)) {
        const { motion: _drop, ...rest } = settings[k];
        const prev = motionBackup.perKey[k];
        settings[k] = prev === undefined ? rest : { ...rest, motion: prev };
      }
      return { ...d, motion: motionBackup.base, settings };
    });
    setMotionBackup(null);
    ctx.toast('모든 장면 적용을 취소했어요.');
  };

  // 장소 라벨 모양은 영상 전체에 하나다(켜고 끄기는 장면별).
  const plabel = placeLabelOf(ctx.draft.placeLabel);
  const setLabel = (change: Partial<PlaceLabel>) => {
    ctx.update((d) => ({ ...d, placeLabel: { ...placeLabelOf(d.placeLabel), ...change } }));
    if (scene) playAnim(scene.seconds);
  };

  // 스티커: 이어 재생은 지금 보고 있는 사진에, 분할은 장면 전체에 붙는다.
  const stickerKey = split ? 'all' : (scene?.clips[idx]?.itemId ?? 'all');
  const stickers = setting.stickers?.[stickerKey] ?? [];
  const setStickers = (next: Sticker[]) => patch(ctx, key, { stickers: { ...(setting.stickers ?? {}), [stickerKey]: next } });
  const addSticker = (emoji: string) => {
    if (stickers.length >= MAX_STICKERS) return ctx.toast(`스티커는 ${MAX_STICKERS}개까지 붙일 수 있어요.`);
    // 이미 쓰고 있는 자리를 피해 붙인다. 같은 자리에 겹쳐 놓으면 가려서 안 보인다.
    const spot = STICKER_SPOT_ORDER.find((x) => !stickers.some((st) => st.spot === x)) ?? 'tr';
    setStickers([...stickers, { emoji, spot, size: 'md' }]);
    // 붙이자마자 미리보기에서 끌어 놓을 수 있게 한다.
    setDragMode(false);
    setDragSticker(stickers.length);
  };
  const editSticker = (i: number, change: Partial<Sticker>) => setStickers(stickers.map((s, j) => (j === i ? { ...s, ...change } : s)));
  const removeSticker = (i: number) => {
    setDragSticker(null);
    setStickers(stickers.filter((_, j) => j !== i));
  };
  // PanResponder 는 한 번만 만들어서, 늘 최신 editSticker 를 부르도록 ref 에 담는다.
  const editStickerRef = useRef(editSticker);
  editStickerRef.current = editSticker;
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;
  // 두 손가락으로 늘리고 줄이는 중: 처음 두 손가락 사이 거리와 그때의 배율
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  /**
   * 미리보기 위에서 손이 닿은 자리를 자막 자리로 삼는다.
   * PanResponder 는 한 번만 만들어 두므로, 늘 최신 값을 쓰도록 함수를 ref 에 담아 둔다.
   */
  const placeCaption = useRef<(x: number, y: number) => void>(() => {});
  placeCaption.current = (x, y) => {
    const si = dragStickerRef.current;
    if (si !== null) {
      // 스티커를 끄는 중이면 손이 닿은 자리에 그 스티커를 놓는다(가장자리에서 잘리지 않게 조금 안쪽까지만).
      const sx = Math.min(0.94, Math.max(0.06, x));
      const sy = Math.min(0.94, Math.max(0.06, y));
      editStickerRef.current(si, { xy: { x: sx, y: sy }, spot: nearestStickerSpot(sx, sy) });
      return;
    }
    const xy = clampCaptionXY(x, y);
    // 서버가 아직 세 자리만 알아서, 가장 가까운 자리도 함께 적어 둔다.
    setCap({ xy, pos: nearestCaptionPos(xy.y) });
  };
  const canvasSize = useRef({ w: 0, h: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { w, h } = canvasSize.current;
        if (w && h) placeCaption.current(e.nativeEvent.locationX / w, e.nativeEvent.locationY / h);
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        const si = dragStickerRef.current;
        if (si !== null && touches && touches.length >= 2) {
          // 두 손가락: 위치는 두고 크기만 바꾼다.
          const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          if (!pinch.current) pinch.current = { dist: Math.max(1, dist), scale: stickersRef.current[si]?.scale ?? 1 };
          const next = pinch.current.scale * (dist / pinch.current.dist);
          editStickerRef.current(si, { scale: Math.min(STICKER_SCALE_MAX, Math.max(STICKER_SCALE_MIN, next)) });
          return;
        }
        pinch.current = null;
        const { w, h } = canvasSize.current;
        if (w && h) placeCaption.current(e.nativeEvent.locationX / w, e.nativeEvent.locationY / h);
      },
      onPanResponderRelease: () => {
        pinch.current = null;
      },
    }),
  ).current;

  const capWarning = captionWarning(cap);
  const posLabel = cap.xy ? '직접 옮김' : (CAPTION_POSITIONS.find((x) => x.id === cap.pos)?.label ?? '');
  const capSummary = `${fontOf(cap.fontId).label} · ${posLabel} · ${captionPx(cap)}pt · 배경 ${CAPTION_BGS.find((x) => x.id === cap.bg)?.label}`;

  // 사진만 고른 장면에서만 초를 직접 고른다. 분할은 장면 전체 길이, 이어 재생은 사진 한 장의 길이다.
  const photoSec = split ? clampPhotoSec(setting.lengthSec ?? PHOTO_SPLIT_SEC) : clampPhotoSec(setting.photoSec ?? PHOTO_SEQUENCE_SEC);
  const setPhotoSec = (v: number) => patch(ctx, key, split ? { lengthSec: clampPhotoSec(v) } : { photoSec: clampPhotoSec(v) });

  // 이어 재생 중인 동영상 한 개의 사용 길이·구간(단일 동영상 포함). 분할 장면은 공통 길이 화면에서 맞춘다.
  const curMedia = !split ? media[idx] : undefined;
  const curVideo = curMedia && curMedia.item.kind === 'video' && (curMedia.seconds ?? 0) > 0 ? curMedia : undefined;
  const curLen = curVideo ? videoLength(curVideo, setting) : 0;
  // 재생 속도는 이어 재생 장면에서만 고른다(분할은 칸이 동시에 재생돼 길이가 엇갈린다).
  const curSpeed = curVideo ? videoSpeed(curVideo, setting) : 1;
  const curScreenSec = curVideo ? videoScreenSeconds(curVideo, setting) : 0;
  const setSpeed = (v: number) => {
    if (!curVideo) return;
    patch(ctx, key, { speed: { ...(setting.speed ?? {}), [curVideo.item.id]: v } });
  };
  const setVideoLen = (v: number) => {
    if (!curVideo) return;
    const orig = curVideo.seconds ?? 0;
    const len = Math.max(1, Math.min(orig, v));
    const id = curVideo.item.id;
    // 길이를 줄이면 사용 구간이 원본 밖으로 나가지 않게 시작 위치도 맞춘다.
    patch(ctx, key, {
      videoLen: { ...(setting.videoLen ?? {}), [id]: len },
      videoStart: { ...setting.videoStart, [id]: Math.min(setting.videoStart[id] ?? 0, Math.max(0, orig - len)) },
    });
  };

  const reorder = (from: number, to: number) => {
    const ids = moveItem(media.map((m) => m.item.id), from, to);
    ctx.update((d) => ({
      ...d,
      mediaIds: { ...d.mediaIds, [key]: ids },
      settings: { ...d.settings, [key]: { ...(d.settings[key] ?? defaultSetting()), done: false } },
    }));
  };

  const complete = () => {
    ctx.update((d) => ({ ...d, settings: { ...d.settings, [key]: { ...(d.settings[key] ?? defaultSetting()), done: true } } }));
    // 아직 끝내지 않은 다음 장소가 있으면 그 장소의 사진·동영상 선택으로, 없으면 전체 구성으로 간다.
    const all = selectedPlaces(ctx.draft, ctx.days);
    const at = all.findIndex((x) => x.place.key === key);
    const rest = [...all.slice(at + 1), ...all.slice(0, at)];
    const nextPlace = rest.find((x) => !(ctx.draft.settings[x.place.key]?.done));
    if (nextPlace) ctx.replace({ step: 'media', placeKey: nextPlace.place.key });
    else ctx.replace({ step: 'compose' });
  };

  const maxW = Math.min(width, 430) - GUTTER * 2;
  const previewW = fitWidth(scene.aspect, Math.min(keyboardOpen ? 40 : height < 700 ? 90 : 140, maxW * 0.5), maxW);
  // 전후 비교는 한 줄에 두 장을 나란히 놓는다.
  const modeLabel = split ? `${scene.clips.length}분할 · 칸 배치 편집 ›` : '이어 재생 · 순서 편집 ›';
  const dateStr = found.day.date.replace(/-/g, '.');

  return (
    <StepFrame
      title="장면 순서·자막"
      step={4}
      stepLabel="편집"
      context={`${shortDotDateLabel(found.day.date)} · ${found.place.place.name}`}
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      // 미리보기는 위에 고정하고 설정만 스크롤한다(아래 설정을 바꾸면서 효과를 바로 보려고).
      scroll={false}
      compact={keyboardOpen}
      footer={
        !split && scene.clips.length > 1 && idx < scene.clips.length - 1 ? (
          // 장면이 더 남았으면 큰 버튼이 "다음 장면"이라, 하나 고치고 다음으로 넘어가는 걸 잊지 않는다.
          // 두 버튼을 한 줄에 놓아 자리를 적게 차지한다.
          <View style={styles.footRow}>
            <Pressable onPress={complete} accessibilityRole="button" accessibilityLabel="여기서 이 장소 완료" style={[styles.footBtn, styles.footGhost]}>
              <Text style={styles.footGhostText}>완료</Text>
            </Pressable>
            <Pressable onPress={() => setClipIndex(idx + 1)} accessibilityRole="button" style={[styles.footBtn, styles.footMain]}>
              <Text style={styles.footMainText}>다음 장면 ({idx + 2}/{scene.clips.length})</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footRow}>
            <Pressable onPress={complete} accessibilityRole="button" style={[styles.footBtn, styles.footMain]}>
              <Text style={styles.footMainText}>이 장소 완료</Text>
            </Pressable>
          </View>
        )
      }
    >
      <View style={styles.sceneHead}>
        <Pressable onPress={() => setOrderOpen(true)} accessibilityRole="button" hitSlop={10} disabled={media.length < 2} style={styles.sceneLabelBtn}>
          <Text style={styles.sceneLabel}>{media.length < 2 ? '단일 재생' : modeLabel}</Text>
        </Pressable>
        {media.length >= 2 && splitTemplatesFor(media.length).length > 0 ? (
          <Pressable
            onPress={() => ctx.go({ step: 'template', placeKey: key, returnTo: 'edit' })}
            accessibilityRole="button"
            accessibilityLabel="템플릿 바꾸기"
            hitSlop={10}
            style={styles.templateBtn}
          >
            <Text style={styles.templateBtnText}>▦ 템플릿 바꾸기</Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={styles.center}
        onLayout={() => {
          canvasSize.current = { w: previewW, h: previewW / aspectOf(scene.aspect).ratio };
        }}
      >
        {demo ? (
          // 전환 예시: 앞 장면(첫 장면이면 어두운 바탕)에서 이 장면으로 넘어오는 모습
          <TransitionStage
            scene={scene}
            prev={ctx.timeline.scenes[ctx.timeline.scenes.indexOf(scene) - 1]}
            width={previewW}
            localSec={split ? 0 : scene.clips.slice(0, idx).reduce((s, c) => s + c.seconds, 0)}
            transition={demo.id}
            progress={demo.p}
          />
        ) : animSec !== null ? (
          // 움직임 보기: 장면을 처음부터 짧게 재생한다(사진 움직임·자막 등장·장소 라벨).
          <SceneCanvas scene={scene} width={previewW} localSec={animSec} animate />
        ) : dragMode || dragSticker !== null ? (
          // 끌어 옮기는 동안에는 칸 고르기를 끄고 손짓을 자막(또는 스티커) 자리로만 받는다.
          <View {...pan.panHandlers}>
            <SceneCanvas scene={scene} width={previewW} />
          </View>
        ) : (
          <SceneCanvas scene={scene} width={previewW} clipIndex={split ? undefined : idx} selectedCell={split ? cell : undefined} onSelectCell={split ? setCell : undefined} />
        )}
        {/* 되돌리기·다시 적용: 눈에 띄지 않게 오른쪽 아래에 작게 둔다 */}
        <View style={styles.undoBox}>
          <Pressable onPress={ctx.undo} disabled={!ctx.canUndo} accessibilityRole="button" accessibilityLabel="한 단계 되돌리기" hitSlop={8} style={[styles.undoBtn, !ctx.canUndo && styles.undoOff]}>
            <Text style={styles.undoGlyph}>↶</Text>
          </Pressable>
          <Pressable onPress={ctx.redo} disabled={!ctx.canRedo} accessibilityRole="button" accessibilityLabel="되돌린 것 다시 적용" hitSlop={8} style={[styles.undoBtn, !ctx.canRedo && styles.undoOff]}>
            <Text style={styles.undoGlyph}>↷</Text>
          </Pressable>
        </View>
      </View>

      {split ? (
        <View style={styles.navRow}>
          <Text style={styles.navText}>장면 1 / 1  {scene.seconds}초</Text>
          {media.some((m) => m.item.kind === 'video') ? (
            <Pressable onPress={() => ctx.go({ step: 'length', placeKey: key })} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}> · 길이 변경 ›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        // 장면(사진·동영상)마다 작은 그림을 늘어놓아 지금 몇 번째인지 보이고, 누르면 그 장면으로 간다.
        <View style={styles.filmRow}>
          {scene.clips.map((c, i) => (
            <Pressable
              key={`${c.itemId}-${i}`}
              onPress={() => setClipIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={`장면 ${i + 1} 편집`}
              accessibilityState={{ selected: i === idx }}
              style={[styles.filmThumb, i === idx && styles.filmThumbOn]}
            >
              <SafeImage source={c.image} style={StyleSheet.absoluteFill} compact />
              {i !== idx ? <View style={styles.filmDim} /> : null}
              <Text style={styles.filmNo}>{i + 1}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        ref={settingsScroll}
        onLayout={revealCaption}
        keyboardShouldPersistTaps="handled"
        style={styles.settings}
        contentContainerStyle={styles.settingsContent}
      >
      <Accordion
        id="caption"
        open={openSec === 'caption'}
        onToggle={toggleSec}
        onLayout={(event) => {
          captionY.current = event.nativeEvent.layout.y;
        }}
        onBodyLayout={(event) => {
          captionBodyY.current = event.nativeEvent.layout.y;
          revealCaption();
        }}
        title={split ? '자막 (선택) · 분할 화면 전체에 1개' : '자막 (선택)'}
        summary={lines.filter((l) => l.text.trim()).map((l) => l.text).join(' · ') || '없음'}
      >
      {(lines.length ? lines : [{ text: '', from: 0, to: clipSec }]).map((line, i) => (
        <View key={i} style={styles.lineInputRow}>
          <TextInput
            value={line.text}
            onChangeText={(text) => editLine(i, { text })}
            placeholder={`자막 ${i + 1}`}
            placeholderTextColor={colors.textMuted}
            maxLength={40}
            style={[styles.input, styles.lineInput]}
            accessibilityLabel={`자막 ${i + 1}`}
            onFocus={() => {
              captionFocused.current = true;
              revealCaption();
            }}
            onBlur={() => {
              captionFocused.current = false;
            }}
          />
          {lines.length > 0 ? (
            <Pressable onPress={() => removeLine(i)} accessibilityRole="button" accessibilityLabel={`자막 ${i + 1} 지우기`} hitSlop={6} style={styles.lineRemove}>
              <Text style={styles.lineRemoveText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={styles.spanRow}>
        <Pressable onPress={addLine} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>+ 줄 추가 ({Math.max(lines.length, 1)}/{MAX_CAPTION_LINES})</Text>
        </Pressable>
        {!split && lines.some((l) => l.text.trim()) && scene && idx < scene.clips.length - 1 ? (
          // 자주 쓰지 않아 눈에 덜 띄게 연한 작은 글씨로 둔다. 누른 뒤에는 취소로 바뀐다.
          // 취소는 넣은 그 장면에서만 보인다(다른 장면으로 가면 사라진다).
          <Pressable onPress={copyState?.at === idx ? cancelCopy : copyToRest} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.quietLink}>{copyState?.at === idx ? '↩ 넣은 것 취소' : '뒤 장면에도 넣기'}</Text>
          </Pressable>
        ) : null}
        {lines.length > 1 ? <Text style={styles.value}>순서대로 나눠서 보여요</Text> : null}
      </View>
      </Accordion>

      <Accordion
        id="capStyle"
        open={openSec === 'capStyle'}
        onToggle={toggleSec}
        title="자막 모양"
        sub="영상 전체에 적용돼요"
        summary={capSummary}
      >
        {/* 글씨체: 한 줄. 아래 위치·크기는 나중에 손으로 정할 수 있으면 없앨 예정이라 작게 둔다. */}
        <Pressable onPress={() => setFontOpen(true)} accessibilityRole="button" style={styles.fontRowTight}>
          <Text style={styles.chipLabelInline}>글씨체</Text>
          <Text style={[styles.link, fontStyleOf(cap.fontId)]}>{fontOf(cap.fontId).label} ›</Text>
        </Pressable>
        <ChipRow
          inline
          label="위치"
          options={CAPTION_POSITIONS}
          current={cap.xy ? ('' as never) : cap.pos}
          onPick={(pos) => {
            // 칸을 고르면 직접 옮긴 자리는 지운다(둘 중 하나만 쓴다).
            setCap({ pos, xy: undefined });
            setDragMode(false);
          }}
          extra={{
            label: dragMode ? '✓ 끝내기' : '✥ 직접',
            on: dragMode || Boolean(cap.xy),
            onPress: () => {
              setDragSticker(null);
              setDragMode((v) => !v);
            },
          }}
        />
        {/* 크기: 숫자로 2pt씩 조절(손으로 정할 수 있게 되면 없앨 예정) */}
        <View style={styles.chipRowInline}>
          <Text style={styles.chipLabelInline}>크기</Text>
          <View style={styles.sizeStep}>
            <Pressable
              onPress={() => setCap({ px: captionPx(cap) - CAPTION_PX_STEP, size: nearestCaptionSize(captionPx(cap) - CAPTION_PX_STEP) })}
              disabled={captionPx(cap) - CAPTION_PX_STEP < CAPTION_PX_MIN}
              accessibilityRole="button"
              accessibilityLabel="글자 작게"
              style={[styles.sizeBtn, captionPx(cap) - CAPTION_PX_STEP < CAPTION_PX_MIN && styles.off]}
            >
              <Text style={styles.sizeBtnText}>−</Text>
            </Pressable>
            <Text style={styles.sizeValue}>{captionPx(cap)}pt</Text>
            <Pressable
              onPress={() => setCap({ px: captionPx(cap) + CAPTION_PX_STEP, size: nearestCaptionSize(captionPx(cap) + CAPTION_PX_STEP) })}
              disabled={captionPx(cap) + CAPTION_PX_STEP > CAPTION_PX_MAX}
              accessibilityRole="button"
              accessibilityLabel="글자 크게"
              style={[styles.sizeBtn, captionPx(cap) + CAPTION_PX_STEP > CAPTION_PX_MAX && styles.off]}
            >
              <Text style={styles.sizeBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
        <ChipRow inline label="배경" options={CAPTION_BGS} current={cap.bg} onPick={(bg) => setCap({ bg })} />
        <ColorStrip inline label="글자색" options={CAPTION_COLORS} current={cap.color} onPick={(color) => setCap({ color })} />
        <ChipRow
          inline
          label="등장"
          options={ANIMS}
          current={cap.anim}
          onPick={(anim) => {
            setCap({ anim });
            if (scene) playAnim(scene.seconds);
          }}
        />
        {capWarning ? <Text style={styles.warn}>{capWarning}</Text> : null}
      </Accordion>

      {curVideo ? (
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.label}>동영상 길이</Text>
            <Text style={styles.value}>
              원본 {curVideo.seconds}초 중 {curLen}초 사용
              {(setting.videoStart[curVideo.item.id] ?? 0) > 0 ? ` · ${setting.videoStart[curVideo.item.id]}초부터` : ''}
              {curSpeed !== 1 ? ` · 화면에선 ${Math.round(curScreenSec * 10) / 10}초` : ''}
            </Text>
            {(curVideo.seconds ?? 0) > curLen ? (
              <Pressable onPress={() => ctx.go({ step: 'trim', placeKey: key, clipId: curVideo.item.id })} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>구간 이동 ›</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.stepBtns}>
            <Pressable onPress={() => setVideoLen(curLen - 1)} disabled={curLen <= 1} accessibilityRole="button" accessibilityLabel="1초 줄이기" style={[styles.mini, curLen <= 1 && styles.off]}>
              <Text style={styles.miniText}>−</Text>
            </Pressable>
            <Text style={styles.secValue}>{curLen}초</Text>
            <Pressable onPress={() => setVideoLen(curLen + 1)} disabled={curLen >= (curVideo.seconds ?? 0)} accessibilityRole="button" accessibilityLabel="1초 늘리기" style={[styles.mini, curLen >= (curVideo.seconds ?? 0) && styles.off]}>
              <Text style={styles.miniText}>+</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {curVideo && !split ? (
        <View style={styles.speedBox}>
          <ChipRow
            label="재생 속도"
            options={SPEEDS.map((x) => ({ id: String(x.id), label: x.label }))}
            current={String(curSpeed)}
            onPick={(v) => setSpeed(Number(v))}
          />
          <Text style={styles.value}>
            {curSpeed === 1
              ? '원래 속도로 재생해요.'
              : curSpeed < 1
                ? `느리게 재생해 ${curLen}초가 화면에서 ${Math.round(curScreenSec * 10) / 10}초로 늘어나요.`
                : `빠르게 재생해 ${curLen}초가 화면에서 ${Math.round(curScreenSec * 10) / 10}초로 줄어들어요.`}
          </Text>
        </View>
      ) : null}

      {isPhotoOnly(media) && media.length > 0 ? (
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.label}>사진 길이</Text>
            <Text style={styles.value}>{split ? '분할 화면이 함께 보이는 시간' : '사진 한 장을 보여 주는 시간'} · 장면 {scene.seconds}초</Text>
          </View>
          <View style={styles.stepBtns}>
            <Pressable onPress={() => setPhotoSec(photoSec - 1)} disabled={photoSec <= MIN_PHOTO_SEC} accessibilityRole="button" accessibilityLabel="1초 줄이기" style={[styles.mini, photoSec <= MIN_PHOTO_SEC && styles.off]}>
              <Text style={styles.miniText}>−</Text>
            </Pressable>
            <Text style={styles.secValue}>{photoSec}초</Text>
            <Pressable onPress={() => setPhotoSec(photoSec + 1)} disabled={photoSec >= MAX_PHOTO_SEC} accessibilityRole="button" accessibilityLabel="1초 늘리기" style={[styles.mini, photoSec >= MAX_PHOTO_SEC && styles.off]}>
              <Text style={styles.miniText}>+</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Accordion
        id="filter"
        open={openSec === 'filter'}
        onToggle={toggleSec}
        title={`색감 효과 ${split ? '(분할 장면 전체)' : '(지금 보는 장면)'}`}
        summary={FILTERS.find((f) => f.id === (setting.filters?.[filterKey] ?? 'none'))?.label ?? ''}
      >
        <OptionStrip
          label="색감 효과"
          value={setting.filters?.[filterKey] ?? 'none'}
          onPick={(id) => setFilter(id as FilterId)}
          items={FILTERS.map((f) => ({
            id: f.id,
            label: f.label,
            // 지금 보는 사진에 효과를 입힌 작은 그림으로 미리 보여 준다(동영상은 표지 한 장).
            thumb: curClip ? (
              <View style={[StyleSheet.absoluteFill, f.css ? { filter: f.css } : undefined]}>
                <SafeImage source={curClip.image} style={StyleSheet.absoluteFill} compact />
              </View>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceStrong }]} />
            ),
          }))}
        />
        <Text style={styles.value}>원본 파일은 바뀌지 않고, 영상으로 만들 때만 적용돼요.</Text>
      </Accordion>

      {curClip ? (
        <Accordion
          id="fit"
          open={openSec === 'fit'}
          onToggle={toggleSec}
          title={`화면 맞춤 ${split ? `(${Math.min(cell, scene.clips.length - 1) + 1}번 칸)` : '(지금 보는 장면)'}`}
          summary={curClip.frame.fit === 'fill' ? '채우기' : '맞춤'}
        >
          {split ? <Text style={styles.value}>위 미리보기에서 칸을 눌러 고른 뒤 조절하세요.</Text> : null}
          <View style={styles.transRow}>
            {([['fill', '채우기'], ['contain', '맞춤']] as const).map(([id, label]) => {
              const on = curClip.frame.fit === id;
              return (
                <Pressable key={id} onPress={() => setFrame({ fit: id })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.transChip, on && styles.transChipOn]}>
                  <Text style={[styles.transLabel, on && styles.transLabelOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {curClip.frame.fit === 'contain' ? (
            <>
              <Text style={styles.value}>여백 모양</Text>
              <View style={styles.transRow}>
                {BG_OPTIONS.map((b) => {
                  const on = curClip.frame.bg === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => setFrame({ bg: b.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.transChip, on && styles.transChipOn]}>
                      <Text style={[styles.transLabel, on && styles.transLabelOn]}>{b.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Accordion>
      ) : null}

      <Accordion
        id="sticker"
        open={openSec === 'sticker'}
        onToggle={toggleSec}
        title="스티커"
        sub={split ? '분할 화면 전체에 붙어요.' : '이 장면에 붙어요'}
        summary={stickers.length ? stickers.map((s) => s.emoji).join(' ') : '없음'}
      >
        {/* 스티커는 창에서 골라 붙인다. 붙인 것은 한 줄씩: 그림 · 옮기기 · 크기 · 떼기 */}
        <View style={styles.stickerBar}>
          <Text style={styles.value}>
            {stickers.length}/{MAX_STICKERS}개
          </Text>
          <Pressable
            onPress={() => (stickers.length >= MAX_STICKERS ? ctx.toast(`스티커는 ${MAX_STICKERS}개까지 붙일 수 있어요.`) : setStickerOpen(true))}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.stickerAdd}
          >
            <Text style={styles.stickerAddText}>＋ 스티커 추가</Text>
          </Pressable>
        </View>

        {stickers.map((st, i) => (
          <View key={`${st.emoji}-${i}`} style={styles.stickerLine}>
            <Text style={styles.stickerEmoji}>{st.emoji}</Text>
            <Pressable
              onPress={() => {
                setDragMode(false);
                setDragSticker((cur) => (cur === i ? null : i));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${st.emoji} 옮기기`}
              hitSlop={6}
              style={[styles.stickerMove, dragSticker === i && styles.pillOn]}
            >
              <Text style={[styles.stickerMoveText, dragSticker === i && styles.pillTextOn]}>{dragSticker === i ? '✓ 끝내기' : '✥ 옮기기'}</Text>
            </Pressable>
            <View style={styles.flex1}>
              <ChipRow
                inline
                label=""
                options={STICKER_SIZES}
                current={st.scale ? ('' as StickerSize) : st.size}
                onPick={(size: StickerSize) => editSticker(i, { size, scale: undefined })}
              />
            </View>
            <Pressable onPress={() => removeSticker(i)} accessibilityRole="button" accessibilityLabel={`${st.emoji} 떼기`} hitSlop={6} style={styles.stickerRemove}>
              <Text style={styles.stickerRemoveText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Accordion>

      <Accordion
        id="motion"
        open={openSec === 'motion'}
        onToggle={toggleSec}
        title="사진 움직임"
        sub={hasPhoto ? '사진이 천천히 움직여요' : '사진이 없어 움직임이 없어요'}
        summary={motionOf(motion).label}
      >
        <OptionStrip
          label="사진 움직임"
          value={motion}
          onPick={(id) => setMotion(id as MotionId)}
          items={MOTIONS.map((m) => ({ id: m.id, label: m.label }))}
        />
        <Text style={styles.value}>{motionOf(motion).desc}</Text>
        <Pressable onPress={() => playAnim(scene.seconds)} disabled={!hasPhoto} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, !hasPhoto && styles.off]}>▶ 움직이는 모습 보기</Text>
        </Pressable>
        {/* 자주 쓰지 않아 눈에 덜 띄게 둔다. 누른 뒤에는 취소로 바뀐다. */}
        <Pressable onPress={motionBackup ? cancelMotionForAll : motionForAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.quietLink}>{motionBackup ? '↩ 모든 장면 적용 취소' : '모든 장면에 같은 움직임 적용'}</Text>
        </Pressable>
      </Accordion>

      <Accordion
        id="show"
        open={openSec === 'show'}
        onToggle={toggleSec}
        title="장소·날짜 라벨"
        sub="모양은 영상 전체에 적용돼요"
        summary={`${setting.showPlace ? '장소명 켬' : '장소명 끔'} · ${setting.showDate ? '날짜 켬' : '날짜 끔'} · ${PLACE_LABEL_POSITIONS.find((x) => x.id === plabel.pos)?.label}`}
      >
      <Row label="장소명 표시" value={found.place.place.name}>
        <Toggle value={setting.showPlace} onValueChange={(v) => patch(ctx, key, { showPlace: v })} accessibilityLabel="장소명 표시" />
      </Row>
      <Row label="날짜 표시" value={dateStr}>
        <Toggle value={setting.showDate} onValueChange={(v) => patch(ctx, key, { showDate: v })} accessibilityLabel="날짜 표시" />
      </Row>
      <Row label="핀 붙이기" value={plabel.pin ? '📍 장소명' : '장소명만'}>
        <Toggle value={plabel.pin} onValueChange={(v) => setLabel({ pin: v })} accessibilityLabel="핀 붙이기" />
      </Row>
      <Row label="잠깐만 보이기" value={plabel.onlyAtStart ? '장면 시작에 2.5초' : '장면 내내'}>
        <Toggle value={plabel.onlyAtStart} onValueChange={(v) => setLabel({ onlyAtStart: v })} accessibilityLabel="잠깐만 보이기" />
      </Row>
      <ChipRow label="위치" options={PLACE_LABEL_POSITIONS} current={plabel.pos} onPick={(pos) => setLabel({ pos })} />
      <ChipRow label="배경" options={CAPTION_BGS} current={plabel.bg} onPick={(bg) => setLabel({ bg })} />
      <ChipRow label="등장" options={ANIMS} current={plabel.anim} onPick={(anim) => setLabel({ anim })} />
      <Pressable onPress={() => playAnim(scene.seconds)} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>▶ 라벨이 나타나는 모습 보기</Text>
      </Pressable>
      {plabel.pos === cap.pos ? (
        <Text style={styles.value}>자막과 같은 쪽에 있어 라벨이 자막 아래에 붙어요.</Text>
      ) : null}
      </Accordion>

      <Accordion
        id="transition"
        open={openSec === 'transition'}
        onToggle={toggleSec}
        title="장면 전환 (이 장면이 시작될 때)"
        summary={TRANSITIONS.find((x) => x.id === (setting.transition ?? 'none'))?.label ?? ''}
      >
        <OptionStrip
          label="장면 전환"
          value={setting.transition ?? 'none'}
          onPick={(id) => {
            patch(ctx, key, { transition: id as TransitionId });
            playDemo(id as TransitionId);
          }}
          items={TRANSITIONS.map((tr) => ({
            id: tr.id,
            label: tr.label,
          }))}
        />
        <Pressable onPress={() => playDemo(setting.transition ?? 'none')} disabled={(setting.transition ?? 'none') === 'none'} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, (setting.transition ?? 'none') === 'none' && styles.off]}>▶ 전환 미리보기 다시 보기</Text>
        </Pressable>
        <Text style={styles.value}>
          {TRANSITIONS.find((x) => x.id === (setting.transition ?? 'none'))?.desc}
          {ctx.timeline.scenes[0]?.placeKey === key ? ' · 첫 장면은 앞 장면이 없어 전환이 보이지 않아요.' : ''}
        </Text>
      </Accordion>

      </ScrollView>

      <StickerSheet
        visible={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onPick={(e) => {
          setStickerOpen(false);
          addSticker(e);
        }}
      />
      <OrderSheet
        visible={orderOpen}
        onClose={() => setOrderOpen(false)}
        items={media.map((m) => ({ id: m.item.id, image: m.item.imageUrl, kind: m.item.kind }))}
        onMove={reorder}
      />
      <FontSheet
        visible={fontOpen}
        current={cap.fontId}
        sceneText={setting.captions[captionKey] || FONT_SAMPLE}
        onClose={() => setFontOpen(false)}
        onApply={(fontId) => {
          setFontOpen(false);
          setCap({ fontId });
        }}
      />
    </StepFrame>
  );
}

/** 접고 펼치는 설정 묶음. 접힌 상태에서도 지금 고른 값을 요약으로 보여 준다. */
const STRIP_CARD = 68;
const STRIP_GAP = 10;

/**
 * 옆으로 넘기며 고르는 카드 줄(캡컷 방식). 카드마다 그림과 이름이 있고, 고른 카드는 테두리로 표시한다.
 * 열리면 고른 카드가 보이는 자리까지 미리 넘겨 둔다.
 */
function OptionStrip({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  /** thumb 이 없으면 글씨만 있는 알약 모양으로 보여 준다. */
  items: { id: string; label: string; thumb?: React.ReactNode }[];
  value: string;
  onPick: (id: string) => void;
}) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const i = Math.max(0, items.findIndex((it) => it.id === value));
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, i * (STRIP_CARD + STRIP_GAP) - 60), animated: false }), 0);
    return () => clearTimeout(t);
    // 열릴 때 한 번만 맞춘다(고를 때마다 움직이면 어지럽다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((it) => {
        const on = it.id === value;
        if (!it.thumb) {
          return (
            <Pressable
              key={it.id}
              onPress={() => onPick(it.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${it.label}`}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{it.label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={it.id}
            onPress={() => onPick(it.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label} ${it.label}`}
            style={styles.stripItem}
          >
            <View style={[styles.stripThumb, on && styles.stripThumbOn]}>{it.thumb}</View>
            <Text style={[styles.stripLabel, on && styles.stripLabelOn]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Accordion({
  id,
  title,
  sub,
  summary,
  open,
  onToggle,
  children,
  onLayout,
  onBodyLayout,
}: {
  id: string;
  title: string;
  /** 펼쳤을 때만 보여 주는 한 줄 설명 */
  sub?: string;
  summary: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  /** 설정 목록 안에서의 위치. 키보드가 가릴 때 이만큼 스크롤한다. */
  onLayout?: ViewProps['onLayout'];
  onBodyLayout?: ViewProps['onLayout'];
}) {
  return (
    <View style={styles.acc} onLayout={onLayout}>
      <Pressable onPress={() => onToggle(id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.accHead}>
        <View style={styles.accTitleBox}>
          <Text style={styles.label}>{title}</Text>
          {open && !sub ? null : (
            <Text style={styles.value} numberOfLines={open ? 2 : 1}>
              {open ? sub : summary}
            </Text>
          )}
        </View>
        <Text style={styles.link}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.accBody} onLayout={onBodyLayout}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 한 줄에 나란히 놓는 선택 칩. 고른 값 하나만 코랄로 켜진다.
 * dots 를 주면 칩에 색 동그라미를 함께 보여 준다(글자색 고르기).
 * label 을 비우면 제목 없이 칩만 놓는다(여러 줄로 이어 붙일 때).
 */
function ChipRow<T extends string>({
  label,
  options,
  current,
  onPick,
  dots,
  inline,
  extra,
}: {
  label: string;
  options: readonly { id: T; label: string; hex?: string }[];
  current: T;
  onPick: (id: T) => void;
  dots?: boolean;
  /** 라벨을 왼쪽에 두고 작은 칩을 한 줄로 놓아 세로 자리를 줄인다 */
  inline?: boolean;
  /** 칩 줄 맨 끝에 붙이는 추가 칩(예: 위치의 "직접") */
  extra?: { label: string; on: boolean; onPress: () => void };
}) {
  return (
    <View style={inline ? styles.chipRowInline : styles.chipRow}>
      {label ? <Text style={inline ? styles.chipLabelInline : styles.chipLabel}>{label}</Text> : null}
      <View style={[styles.chips, inline && styles.chipsInline]}>
        {options.map((o) => {
          const on = o.id === current;
          return (
            <Pressable
              key={o.id}
              onPress={() => onPick(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${o.label}`}
              style={[styles.chip, inline && styles.chipSmall, on && styles.chipOn]}
            >
              {dots && o.hex ? <View style={[styles.dot, { backgroundColor: o.hex }]} /> : null}
              <Text style={[styles.chipText, inline && styles.chipTextSmall, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
        {extra ? (
          <Pressable
            onPress={extra.onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected: extra.on }}
            accessibilityLabel={`${label} ${extra.label}`}
            style={[styles.chip, inline && styles.chipSmall, extra.on && styles.chipOn]}
          >
            <Text style={[styles.chipText, inline && styles.chipTextSmall, extra.on && styles.chipTextOn]}>{extra.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * 옆으로 넘기며 고르는 색 동그라미 줄. 이름은 줄 위에 고른 색의 것만 보여 준다.
 * 색이 많아도 자리를 적게 차지한다.
 */
function ColorStrip<T extends string>({
  label,
  options,
  current,
  onPick,
  inline,
}: {
  label: string;
  options: readonly { id: T; label: string; hex: string }[];
  current: T;
  onPick: (id: T) => void;
  /** 라벨을 왼쪽에 두고 한 줄로 놓는다(이름 표시는 뺀다) */
  inline?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const i = Math.max(0, options.findIndex((o) => o.id === current));
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, i * 46 - 80), animated: false }), 0);
    return () => clearTimeout(t);
    // 열릴 때 한 번만 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={inline ? styles.chipRowInline : styles.chipRow}>
      <Text style={inline ? styles.chipLabelInline : styles.chipLabel}>{inline ? label : `${label} · ${options.find((o) => o.id === current)?.label}`}</Text>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={inline ? styles.flex1 : undefined} contentContainerStyle={styles.swatchRow}>
        {options.map((o) => {
          const on = o.id === current;
          return (
            <Pressable
              key={o.id}
              onPress={() => onPick(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${o.label}`}
              style={[styles.swatchRing, on && styles.swatchRingOn]}
            >
              <View style={[styles.swatch, { backgroundColor: o.hex }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** 칸 배치·재생 순서를 위아래로 바꾸는 하단 시트. 원본 기록 순서는 바뀌지 않는다. */
/** 스티커 고르는 창: 그림을 누르면 붙이고 닫힌다(붙인 뒤 바로 미리보기에서 끌어 놓을 수 있다). */
function StickerSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (emoji: string) => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>스티커 고르기</Text>
          <View style={styles.emojiGrid}>
            {STICKERS.map((e) => (
              <Pressable key={e} onPress={() => onPick(e)} accessibilityRole="button" accessibilityLabel={`${e} 붙이기`} style={styles.emojiBtn}>
                <Text style={styles.emoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OrderSheet({
  visible,
  onClose,
  items,
  onMove,
}: {
  visible: boolean;
  onClose: () => void;
  items: { id: string; image: string | number; kind: 'photo' | 'video' }[];
  onMove: (from: number, to: number) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>순서 바꾸기</Text>
          <Text style={styles.value}>이어 재생은 재생 순서, 분할은 칸 위치(왼쪽 위부터)가 바뀌어요.</Text>
          {items.map((it, i) => (
            <View key={it.id} style={styles.orderRow}>
              <Text style={styles.orderNo}>{i + 1}</Text>
              <View style={styles.orderThumb}>
                <SafeImage source={it.image} style={StyleSheet.absoluteFill} compact />
              </View>
              <Text style={styles.orderKind}>{it.kind === 'video' ? '동영상' : '사진'}</Text>
              <Pressable onPress={() => onMove(i, i - 1)} disabled={i === 0} accessibilityRole="button" accessibilityLabel="위로" style={[styles.mini, i === 0 && styles.off]}>
                <Text style={styles.miniText}>↑</Text>
              </Pressable>
              <Pressable onPress={() => onMove(i, i + 1)} disabled={i === items.length - 1} accessibilityRole="button" accessibilityLabel="아래로" style={[styles.mini, i === items.length - 1 && styles.off]}>
                <Text style={styles.miniText}>↓</Text>
              </Pressable>
            </View>
          ))}
          <ActionButton label="완료" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 글씨체를 미리 보고 고르는 하단 시트. 영상 전체 자막에 적용된다.
 * 고르면 '지금'과 '바꾼 뒤'를 나란히 보여 주어, 적용 전에 바뀌는 모습을 비교할 수 있다.
 */
function FontSheet({
  visible,
  current,
  sceneText,
  onClose,
  onApply,
}: {
  visible: boolean;
  current: FontId;
  sceneText: string;
  onClose: () => void;
  onApply: (font: FontId) => void;
}) {
  const [picked, setPicked] = useState<FontId>(current);
  // 지금 쓰는 글씨체가 든 묶음부터 보여 준다.
  const [group, setGroup] = useState<FontGroup>(fontOf(current).group);
  const changed = picked !== current;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => {
        setPicked(current);
        setGroup(fontOf(current).group);
      }}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>자막 글씨체</Text>
          <Text style={styles.value}>
            글씨체 {FONTS.length}종 · 영상 전체 자막에 적용돼요. 바뀌는 모습을 먼저 비교해 보세요.
          </Text>

          <View style={styles.sampleRow}>
            <View style={styles.sampleCol}>
              <Text style={styles.compareTag}>지금 · {fontOf(current).label}</Text>
              <View style={styles.sample}>
                <Text style={[styles.sampleText, fontStyleOf(current)]} numberOfLines={2}>
                  {sceneText}
                </Text>
              </View>
            </View>
            {changed ? (
              <View style={styles.sampleCol}>
                <Text style={[styles.compareTag, styles.compareTagNow]}>바꾼 뒤 · {fontOf(picked).label}</Text>
                <View style={[styles.sample, styles.sampleOn]}>
                  <Text style={[styles.sampleText, fontStyleOf(picked)]} numberOfLines={2}>
                    {sceneText}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.groupRow}>
            {FONT_GROUPS.map((g) => {
              const on = g === group;
              const n = FONTS.filter((f) => f.group === g).length;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGroup(g)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${g} ${n}종`}
                  style={[styles.groupTab, on && styles.groupTabOn]}
                >
                  <Text style={[styles.groupText, on && styles.groupTextOn]}>
                    {g} {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={styles.fontList} contentContainerStyle={styles.fontListBody} showsVerticalScrollIndicator={false}>
            {FONTS.filter((f) => f.group === group).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setPicked(f.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: picked === f.id }}
                accessibilityLabel={`${f.label} ${f.desc}`}
                style={[styles.fontOption, picked === f.id && styles.fontOptionOn]}
              >
                <View style={styles.fontOptionBody}>
                  <Text style={[styles.fontOptionSample, fontStyleOf(f.id)]} numberOfLines={1}>
                    {FONT_SAMPLE}
                  </Text>
                  <Text style={[styles.fontOptionName, picked === f.id && { color: colors.primary }]} numberOfLines={1}>
                    {f.label} · {f.desc}
                  </Text>
                </View>
                <Text style={styles.fontMark}>{picked === f.id ? '✓' : '○'}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ActionButton label={changed ? `${ro(fontOf(picked).label)} 바꾸기` : '닫기'} onPress={() => (changed ? onApply(picked) : onClose())} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 손가락으로 누르는 자리는 최소 크기를 보장한다.
  undoBox: { position: 'absolute', right: 0, bottom: 0, flexDirection: 'row' },
  undoBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  undoOff: { opacity: 0.25 },
  undoGlyph: { fontSize: 16, color: colors.textMuted },
  // 제목은 작은 글씨로 두어 사진이 화면의 주인공이 되게 한다.
  // 제목 줄이 터치 최소 높이(44)만큼 차지하지 않게 줄이고, 누르는 범위는 hitSlop 으로 넓힌다.
  sceneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateBtn: { minHeight: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  templateBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  sceneLabelBtn: { minHeight: 20, justifyContent: 'center', marginBottom: -4 },
  sceneLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  footRow: { flexDirection: 'row', gap: 8 },
  footBtn: { minHeight: 46, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  footGhost: { flex: 1, backgroundColor: colors.surface },
  footMain: { flex: 2.4, backgroundColor: colors.primary },
  footGhostText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
  footMainText: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
  quietLink: { fontSize: 11, color: colors.textMuted },
  touch: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center' },
  center: { alignItems: 'center' },
  settings: { flex: 1 },
  settingsContent: { gap: 4, paddingBottom: 24 },
  filmRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  filmThumb: { width: 34, height: 48, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  filmThumbOn: { borderColor: colors.primary },
  filmDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.45)' },
  filmNo: { position: 'absolute', left: 3, bottom: 2, fontSize: 10, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 2 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  off: { opacity: 0.35 },
  transBox: { gap: 8 },
  // 카드 대신 가로로 꽉 찬 구분선만 둔다.
  acc: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 },
  accTitleBox: { flex: 1, gap: 2 },
  accBody: { gap: 8, paddingBottom: 14 },
  strip: { gap: STRIP_GAP, paddingVertical: 4, paddingRight: 8 },
  stripItem: { width: STRIP_CARD, alignItems: 'center', gap: 6 },
  stripThumb: { width: STRIP_CARD, height: STRIP_CARD, borderRadius: 12, overflow: 'hidden', borderWidth: 2.5, borderColor: 'transparent', backgroundColor: colors.surface },
  stripThumbOn: { borderColor: colors.primary },
  swatchRow: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  swatchRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatchRingOn: { borderColor: colors.primary },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillText: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  pillTextOn: { color: colors.primary },
  stripLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  stripLabelOn: { fontWeight: '800', color: colors.primary },
  transRow: { flexDirection: 'row', gap: 6 },
  transChip: { flex: 1, minHeight: 44, borderRadius: radius.item, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  transChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  transLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  transLabelOn: { color: colors.primary },
  stepBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secValue: { minWidth: 36, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  toggleText: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: '800', color: colors.text },
  value: { fontSize: 12, color: colors.textSub },
  input: { backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 16, minHeight: 52, fontSize: 15, color: colors.text },
  fontRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  // 자막 모양 고르기
  speedBox: { gap: 6, paddingBottom: 6 },
  lineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineInput: { flex: 1, minHeight: 44 },
  lineRemove: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  lineRemoveText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  lineRow: { paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.surface },
  spanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 6 },
  spanBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spanLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  spanBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  spanValue: { minWidth: 34, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.text },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: { width: 48, height: 48, borderRadius: radius.item, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  stickerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickerAdd: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stickerAddText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  stickerLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  stickerEmoji: { fontSize: 24, lineHeight: 30, width: 32, textAlign: 'center' },
  stickerMove: { minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  stickerMoveText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  stickerRemove: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  stickerRemoveText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  stickerRow: { gap: 4, paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.surface },
  stickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  sizeStep: { flex: 1, flexDirection: 'row', alignItems: 'stretch', height: 34, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden' },
  sizeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sizeBtnText: { fontSize: 20, fontWeight: '600', color: colors.primary, lineHeight: 22 },
  sizeValue: { flex: 1.6, textAlign: 'center', textAlignVertical: 'center', fontSize: 14, fontWeight: '800', color: colors.text, backgroundColor: colors.bg, borderRadius: 8, marginVertical: 3, lineHeight: 28 },
  chipRowInline: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  chipLabelInline: { width: 44, fontSize: 12, fontWeight: '700', color: colors.textSub },
  chipsInline: { flex: 1, gap: 4 },
  chipSmall: { minHeight: 34, borderRadius: 10 },
  chipTextSmall: { fontSize: 12 },
  fontRowTight: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  flex1: { flex: 1 },
  chipRow: { gap: 6, paddingTop: 4 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, borderRadius: radius.item, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  chipTextOn: { color: colors.primary },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.line },
  warn: { fontSize: 12, fontWeight: '700', color: colors.primary },
  // 바꾸기 전 / 바꾼 뒤 비교
  compareTag: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  compareTagNow: { color: colors.primary },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 430, backgroundColor: colors.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: 20, gap: 10, boxShadow: shadow.float },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sampleRow: { flexDirection: 'row', gap: 8 },
  sampleCol: { flex: 1, gap: 4 },
  sample: { backgroundColor: colors.ink, borderRadius: radius.item, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minHeight: 62 },
  sampleOn: { borderWidth: 1.5, borderColor: colors.primary },
  sampleText: { fontSize: 15, lineHeight: 21, color: colors.onPrimary, textAlign: 'center' },
  groupRow: { flexDirection: 'row', gap: 6 },
  groupTab: { flex: 1, minHeight: 40, borderRadius: radius.item, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  groupTabOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  groupText: { fontSize: 12, fontWeight: '800', color: colors.textSub },
  groupTextOn: { color: colors.primary },
  fontList: { maxHeight: 268 },
  fontListBody: { gap: 6 },
  fontOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.surface, borderRadius: radius.item, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, paddingVertical: 8, minHeight: 56 },
  fontOptionOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  fontOptionBody: { flex: 1, gap: 1 },
  fontOptionSample: { fontSize: 16, color: colors.text },
  fontOptionName: { fontSize: 11, color: colors.textSub },
  fontMark: { fontSize: 15, color: colors.primary },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderNo: { width: 20, fontSize: 14, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  orderThumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  orderKind: { flex: 1, fontSize: 13, color: colors.textSub },
  mini: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  miniText: { fontSize: 16, fontWeight: '800', color: colors.text },
});
