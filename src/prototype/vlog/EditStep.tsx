import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import { ActionButton } from '../components/FormParts';
import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import { shortDotDateLabel } from '../utils/date';
import { locate, selectedPlaces, type StepCtx } from './ctx';
import {
  BG_OPTIONS,
  FILTERS,
  clampFrame,
  FONTS,
  fitWidth,
  FONT_SAMPLE,
  TRANSITIONS,
  type TransitionId,
  MAX_PHOTO_SEC,
  MIN_PHOTO_SEC,
  PHOTO_SEQUENCE_SEC,
  PHOTO_SPLIT_SEC,
  clampPhotoSec,
  defaultSetting,
  fontOf,
  isPhotoOnly,
  videoLength,
  moveItem,
  resolveMedia,
  type FilterId,
  type FontId,
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
  const { width } = useWindowDimensions();
  const [clipIndex, setClipIndex] = useState(0);
  // 분할 장면에서 고른 칸(0부터)
  const [cell, setCell] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
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
  useEffect(() => stopDemo, []);
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

  // 사진만 고른 장면에서만 초를 직접 고른다. 분할은 장면 전체 길이, 이어 재생은 사진 한 장의 길이다.
  const photoSec = split ? clampPhotoSec(setting.lengthSec ?? PHOTO_SPLIT_SEC) : clampPhotoSec(setting.photoSec ?? PHOTO_SEQUENCE_SEC);
  const setPhotoSec = (v: number) => patch(ctx, key, split ? { lengthSec: clampPhotoSec(v) } : { photoSec: clampPhotoSec(v) });

  // 이어 재생 중인 동영상 한 개의 사용 길이·구간(단일 동영상 포함). 분할 장면은 공통 길이 화면에서 맞춘다.
  const curMedia = !split ? media[idx] : undefined;
  const curVideo = curMedia && curMedia.item.kind === 'video' && (curMedia.seconds ?? 0) > 0 ? curMedia : undefined;
  const curLen = curVideo ? videoLength(curVideo, setting) : 0;
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
  const previewW = fitWidth(scene.aspect, Math.min(130, maxW * 0.5), maxW);
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
      footer={<FooterButtons label="이 장소 완료" onPress={complete} />}
    >
      <Pressable onPress={() => setOrderOpen(true)} accessibilityRole="button" hitSlop={8} disabled={media.length < 2}>
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

      <ScrollView style={styles.settings} contentContainerStyle={styles.settingsContent} showsVerticalScrollIndicator={false}>
      {curVideo ? (
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.label}>동영상 길이</Text>
            <Text style={styles.value}>
              원본 {curVideo.seconds}초 중 {curLen}초 사용
              {(setting.videoStart[curVideo.item.id] ?? 0) > 0 ? ` · ${setting.videoStart[curVideo.item.id]}초부터` : ''}
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
        id="show"
        open={openSec === 'show'}
        onToggle={toggleSec}
        title="날짜·장소명 표시"
        summary={`날짜 ${setting.showDate ? '켬' : '끔'} · 장소명 ${setting.showPlace ? '켬' : '끔'}`}
      >
      <Row label="날짜 표시" value={dateStr}>
        <Switch value={setting.showDate} onValueChange={(v) => patch(ctx, key, { showDate: v })} trackColor={{ true: colors.primary }} accessibilityLabel="날짜 표시" />
      </Row>
      <Row label="장소명 표시" value={found.place.place.name}>
        <Switch value={setting.showPlace} onValueChange={(v) => patch(ctx, key, { showPlace: v })} trackColor={{ true: colors.primary }} accessibilityLabel="장소명 표시" />
      </Row>
      </Accordion>

      <Accordion
        id="caption"
        open={openSec === 'caption'}
        onToggle={toggleSec}
        title={split ? '이 장면 자막 (선택) · 분할 화면 전체에 1개' : '이 장면 자막 (선택)'}
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
      />
      </Accordion>

      <Pressable onPress={() => setFontOpen(true)} accessibilityRole="button" style={styles.fontRow}>
        <Text style={styles.label}>글씨체</Text>
        <Text style={styles.link}>{fontOf(setting.fontId).label} ›</Text>
      </Pressable>

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
        current={setting.fontId}
        sceneText={setting.captions[captionKey] || FONT_SAMPLE}
        onClose={() => setFontOpen(false)}
        onApply={(fontId, all) => {
          setFontOpen(false);
          if (all) {
            // 프로젝트의 모든 장소에 같은 글씨체를 적용한다. 자막·표시 여부는 그대로 둔다.
            ctx.update((d) => {
              const settings = { ...d.settings };
              for (const { place } of selectedPlaces(d, ctx.days)) {
                settings[place.key] = { ...(settings[place.key] ?? defaultSetting()), fontId };
              }
              settings[key] = { ...(settings[key] ?? defaultSetting()), fontId, done: false };
              return { ...d, settings };
            });
          } else patch(ctx, key, { fontId });
        }}
      />
    </StepFrame>
  );
}

/** 접고 펼치는 설정 묶음. 접힌 상태에서도 지금 고른 값을 요약으로 보여 준다. */
function Accordion({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.acc}>
      <Pressable onPress={() => onToggle(id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.accHead}>
        <View style={styles.accTitleBox}>
          <Text style={styles.label}>{title}</Text>
          {open ? null : (
            <Text style={styles.value} numberOfLines={1}>
              {summary}
            </Text>
          )}
        </View>
        <Text style={styles.link}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={styles.accBody}>{children}</View> : null}
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

/** 글씨체를 미리 보고 고르는 하단 시트. 기본 적용 범위는 현재 장면이다. */
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
  onApply: (font: FontId, all: boolean) => void;
}) {
  const [picked, setPicked] = useState<FontId>(current);
  const [all, setAll] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setPicked(current)}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>자막 글씨체</Text>
          <Text style={styles.value}>선택한 글씨체를 영상에서 확인해 보세요.</Text>
          <View style={styles.sample}>
            <Text style={[styles.sampleText, fontOf(picked).style]}>{sceneText}</Text>
          </View>
          {FONTS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setPicked(f.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked === f.id }}
              style={[styles.fontOption, picked === f.id && styles.fontOptionOn]}
            >
              <Text style={[styles.fontOptionText, picked === f.id && { color: colors.primary }]}>
                {f.label}   <Text style={f.style}>{FONT_SAMPLE}</Text>
              </Text>
              <Text style={styles.fontMark}>{picked === f.id ? '✓' : '○'}</Text>
            </Pressable>
          ))}
          <View style={styles.toggleRow}>
            <Text style={styles.label}>모든 장면에 적용</Text>
            <Switch value={all} onValueChange={setAll} trackColor={{ true: colors.primary }} accessibilityLabel="모든 장면에 적용" />
          </View>
          <ActionButton label={all ? '모든 장면에 적용' : '현재 장면에 적용'} onPress={() => onApply(picked, all)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 430, backgroundColor: colors.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: 20, gap: 10, boxShadow: shadow.float },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sample: { backgroundColor: colors.ink, borderRadius: radius.item, padding: 16, alignItems: 'center' },
  sampleText: { fontSize: 16, color: colors.onPrimary },
  fontOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.item, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, minHeight: 48 },
  fontOptionOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  fontOptionText: { fontSize: 13, fontWeight: '700', color: colors.text },
  fontMark: { fontSize: 15, color: colors.primary },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderNo: { width: 20, fontSize: 14, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  orderThumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  orderKind: { flex: 1, fontSize: 13, color: colors.textSub },
  mini: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  miniText: { fontSize: 16, fontWeight: '800', color: colors.text },
});
