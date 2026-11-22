import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewProps } from 'react-native';

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
  CAPTION_SIZES,
  FILTERS,
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
  SPEEDS,
  captionStyleOf,
  captionWarning,
  clampPhotoSec,
  defaultSetting,
  fontOf,
  fontStyleOf,
  isPhotoOnly,
  motionOf,
  placeLabelOf,
  videoLength,
  videoScreenSeconds,
  videoSpeed,
  moveItem,
  resolveMedia,
  type CaptionStyle,
  type FilterId,
  type FontGroup,
  type FontId,
  type MotionId,
  type PlaceLabel,
  type PlaceSetting,
} from './model';
import { FooterButtons, Heading, SceneCanvas, StateCard, StepFrame, TransitionStage } from './parts';

/** 한 장소의 설정을 고친다. 고치면 "이 장소 완료"는 풀린다. */
const patch = (ctx: StepCtx, placeKey: string, change: Partial<PlaceSetting>) =>
  ctx.update((d) => ({
    ...d,
    settings: { ...d.settings, [placeKey]: { ...(d.settings[placeKey] ?? defaultSetting()), ...change, done: false } },
  }));

/** 4단계: 장면 순서·자막·날짜/장소명 표시·글씨체를 정하고 장소를 완료한다. */
export function EditStep({ ctx, placeKey }: { ctx: StepCtx; placeKey?: string }) {
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
  // 자막 모양을 처음 바꾸기 직전의 모습. 전후 비교와 되돌리기에 쓴다(화면을 나가면 잊는다).
  const [beforeCap, setBeforeCap] = useState<CaptionStyle | null>(null);
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
  const setCaption = (text: string) => patch(ctx, key, { captions: { ...setting.captions, [captionKey]: text } });

  // 자막 모양은 장면별이 아니라 영상 전체에 하나다(한 영상에 글씨체가 섞이지 않게).
  const cap = captionStyleOf(ctx.draft.captionStyle);
  const applyCap = (next: CaptionStyle) => ctx.update((d) => ({ ...d, captionStyle: next }));
  const setCap = (change: Partial<CaptionStyle>) => {
    // 처음 손대는 순간의 모양을 '바꾸기 전'으로 붙잡아 둔다.
    setBeforeCap((b) => b ?? cap);
    applyCap({ ...cap, ...change });
  };
  const undoCap = () => {
    if (beforeCap) applyCap(beforeCap);
    setBeforeCap(null);
  };
  // 사진 움직임: 이 장면 설정이 없으면 영상 기본값을 따른다.
  const motion = setting.motion ?? ctx.draft.motion ?? 'none';
  const hasPhoto = scene?.clips.some((c) => c.kind === 'photo') ?? false;
  const setMotion = (id: MotionId) => {
    patch(ctx, key, { motion: id });
    if (scene) playAnim(scene.seconds);
  };
  /** 모든 장면에 같은 움직임을 쓰고, 장면별로 따로 정해 둔 값은 지운다. */
  const motionForAll = () => {
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

  // 장소 라벨 모양은 영상 전체에 하나다(켜고 끄기는 장면별).
  const plabel = placeLabelOf(ctx.draft.placeLabel);
  const setLabel = (change: Partial<PlaceLabel>) => {
    ctx.update((d) => ({ ...d, placeLabel: { ...placeLabelOf(d.placeLabel), ...change } }));
    if (scene) playAnim(scene.seconds);
  };

  const capChanged = beforeCap !== null && JSON.stringify(beforeCap) !== JSON.stringify(cap);
  const capWarning = captionWarning(cap);
  const capSummary = `${fontOf(cap.fontId).label} · ${CAPTION_POSITIONS.find((x) => x.id === cap.pos)?.label} · ${CAPTION_SIZES.find((x) => x.id === cap.size)?.label} · 배경 ${CAPTION_BGS.find((x) => x.id === cap.bg)?.label}`;

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
  const previewW = fitWidth(scene.aspect, Math.min(keyboardOpen ? 40 : height < 700 ? 85 : 130, maxW * 0.5), maxW);
  // 전후 비교는 한 줄에 두 장을 나란히 놓는다.
  const compareW = fitWidth(scene.aspect, Math.min(112, (maxW - 10) / 2), (maxW - 10) / 2);
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
      footer={<FooterButtons label="이 장소 완료" onPress={complete} />}
    >
      <Pressable onPress={() => setOrderOpen(true)} accessibilityRole="button" hitSlop={8} disabled={media.length < 2} style={styles.touch}>
        <Heading title={media.length < 2 ? '단일 재생' : modeLabel} />
      </Pressable>

      <View style={styles.center}>
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
        ) : (
          <SceneCanvas scene={scene} width={previewW} clipIndex={split ? undefined : idx} selectedCell={split ? cell : undefined} onSelectCell={split ? setCell : undefined} />
        )}
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
        <View style={styles.navRow}>
          <Pressable onPress={() => setClipIndex(Math.max(0, idx - 1))} disabled={idx === 0} accessibilityRole="button" hitSlop={8} style={idx === 0 && styles.off}>
            <Text style={styles.link}>‹ 이전</Text>
          </Pressable>
          <Text style={styles.navText}>  장면 {idx + 1} / {scene.clips.length}  </Text>
          <Pressable
            onPress={() => setClipIndex(Math.min(scene.clips.length - 1, idx + 1))}
            disabled={idx >= scene.clips.length - 1}
            accessibilityRole="button"
            hitSlop={8}
            style={idx >= scene.clips.length - 1 && styles.off}
          >
            <Text style={styles.link}>다음 ›</Text>
          </Pressable>
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
        summary={setting.captions[captionKey] || '없음'}
      >
      <TextInput
        value={setting.captions[captionKey] ?? ''}
        onChangeText={setCaption}
        placeholder="자막을 입력하세요"
        placeholderTextColor={colors.textMuted}
        maxLength={40}
        style={styles.input}
        accessibilityLabel="이 장면 자막"
        onFocus={() => {
          captionFocused.current = true;
          revealCaption();
        }}
        onBlur={() => {
          captionFocused.current = false;
        }}
      />
      </Accordion>

      <Accordion
        id="capStyle"
        open={openSec === 'capStyle'}
        onToggle={toggleSec}
        title="자막 모양"
        sub="글씨체·위치·크기·배경은 영상 전체에 함께 적용돼요."
        summary={capSummary}
      >
        <Pressable onPress={() => setFontOpen(true)} accessibilityRole="button" style={styles.fontRow}>
          <Text style={styles.label}>글씨체</Text>
          <Text style={[styles.link, fontStyleOf(cap.fontId)]}>{fontOf(cap.fontId).label} ›</Text>
        </Pressable>

        <ChipRow label="위치" options={CAPTION_POSITIONS} current={cap.pos} onPick={(pos) => setCap({ pos })} />
        <ChipRow label="크기" options={CAPTION_SIZES} current={cap.size} onPick={(size) => setCap({ size })} />
        <ChipRow label="배경" options={CAPTION_BGS} current={cap.bg} onPick={(bg) => setCap({ bg })} />
        <ChipRow label="글자색" options={CAPTION_COLORS} current={cap.color} onPick={(color) => setCap({ color })} dots />
        <ChipRow
          label="등장"
          options={ANIMS}
          current={cap.anim}
          onPick={(anim) => {
            setCap({ anim });
            if (scene) playAnim(scene.seconds);
          }}
        />
        <Pressable onPress={() => playAnim(scene.seconds)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>▶ 자막이 나타나는 모습 보기</Text>
        </Pressable>

        {capWarning ? <Text style={styles.warn}>{capWarning}</Text> : null}
        {!setting.captions[captionKey] ? (
          <Text style={styles.value}>자막을 적으면 위 미리보기에서 바로 확인할 수 있어요.</Text>
        ) : null}

        {capChanged && beforeCap ? (
          <View style={styles.compareBox}>
            <Text style={styles.label}>바꾸기 전과 비교</Text>
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareTag}>바꾸기 전</Text>
                <SceneCanvas scene={{ ...scene, captionStyle: beforeCap }} width={compareW} clipIndex={split ? undefined : idx} />
                <Text style={styles.compareNote} numberOfLines={2}>
                  {fontOf(beforeCap.fontId).label} · {CAPTION_POSITIONS.find((x) => x.id === beforeCap.pos)?.label} · {CAPTION_SIZES.find((x) => x.id === beforeCap.size)?.label}
                </Text>
              </View>
              <View style={styles.compareCol}>
                <Text style={[styles.compareTag, styles.compareTagNow]}>바꾼 뒤</Text>
                <SceneCanvas scene={scene} width={compareW} clipIndex={split ? undefined : idx} />
                <Text style={[styles.compareNote, styles.compareNoteNow]} numberOfLines={2}>
                  {fontOf(cap.fontId).label} · {CAPTION_POSITIONS.find((x) => x.id === cap.pos)?.label} · {CAPTION_SIZES.find((x) => x.id === cap.size)?.label}
                </Text>
              </View>
            </View>
            <Pressable onPress={undoCap} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>↩ 바꾸기 전으로 되돌리기</Text>
            </Pressable>
          </View>
        ) : null}
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
        <View style={styles.transRow}>
          {FILTERS.map((f) => {
            const on = (setting.filters?.[filterKey] ?? 'none') === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.transChip, on && styles.transChipOn]}
              >
                <Text style={[styles.transLabel, on && styles.transLabelOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
        id="motion"
        open={openSec === 'motion'}
        onToggle={toggleSec}
        title="사진 움직임"
        sub={hasPhoto ? '사진이 보이는 동안 아주 천천히 움직여요. 동영상은 그대로예요.' : '이 장면에는 사진이 없어 움직임이 보이지 않아요.'}
        summary={motionOf(motion).label}
      >
        <ChipRow label="" options={MOTIONS.slice(0, 3)} current={motion} onPick={setMotion} />
        <ChipRow label="" options={MOTIONS.slice(3)} current={motion} onPick={setMotion} />
        <Text style={styles.value}>{motionOf(motion).desc}</Text>
        <Pressable onPress={() => playAnim(scene.seconds)} disabled={!hasPhoto} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, !hasPhoto && styles.off]}>▶ 움직이는 모습 보기</Text>
        </Pressable>
        <Pressable onPress={motionForAll} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>모든 장면에 같은 움직임 적용</Text>
        </Pressable>
      </Accordion>

      <Accordion
        id="show"
        open={openSec === 'show'}
        onToggle={toggleSec}
        title="장소·날짜 라벨"
        sub="켜고 끄기는 장면마다, 라벨 모양은 영상 전체에 함께 적용돼요."
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
        <View style={styles.transRow}>
          {TRANSITIONS.map((tr) => {
            const on = (setting.transition ?? 'none') === tr.id;
            return (
              <Pressable
                key={tr.id}
                onPress={() => {
                  patch(ctx, key, { transition: tr.id });
                  playDemo(tr.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${tr.label} ${tr.desc}`}
                style={[styles.transChip, on && styles.transChipOn]}
              >
                <Text style={[styles.transLabel, on && styles.transLabelOn]}>{tr.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => playDemo(setting.transition ?? 'none')} disabled={(setting.transition ?? 'none') === 'none'} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, (setting.transition ?? 'none') === 'none' && styles.off]}>▶ 전환 미리보기 다시 보기</Text>
        </Pressable>
        <Text style={styles.value}>
          {TRANSITIONS.find((x) => x.id === (setting.transition ?? 'none'))?.desc}
          {ctx.timeline.scenes[0]?.placeKey === key ? ' · 첫 장면은 앞 장면이 없어 전환이 보이지 않아요.' : ''}
        </Text>
      </Accordion>

      </ScrollView>

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
}: {
  label: string;
  options: readonly { id: T; label: string; hex?: string }[];
  current: T;
  onPick: (id: T) => void;
  dots?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {label ? <Text style={styles.chipLabel}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.id === current;
          return (
            <Pressable
              key={o.id}
              onPress={() => onPick(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${o.label}`}
              style={[styles.chip, on && styles.chipOn]}
            >
              {dots && o.hex ? <View style={[styles.dot, { backgroundColor: o.hex }]} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
  touch: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center' },
  center: { alignItems: 'center' },
  settings: { flex: 1 },
  settingsContent: { gap: 4, paddingBottom: 24 },
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
  compareBox: { gap: 8, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.surface },
  compareRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  compareCol: { alignItems: 'center', gap: 4 },
  compareTag: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  compareTagNow: { color: colors.primary },
  compareNote: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  compareNoteNow: { color: colors.textSub },
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
