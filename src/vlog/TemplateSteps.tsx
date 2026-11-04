import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { resizeSplit } from './edits';
import { SafeImage } from './ui/SafeImage';
import { CheckCircle } from './ui/FormParts';
import { colors, GUTTER, radius } from './tokens';
import { shortDotDateLabel } from './date';
import { locate, type StepCtx } from './ctx';
import {
  PHOTO_SPLIT_SEC,
  aspectOf,
  fitWidth,
  commonLength,
  defaultSetting,
  effectiveMode,
  mmss,
  mmss2,
  resolveMedia,
  splitLength,
  videoLength,
  splitTemplatesFor,
  type PlaceSetting,
} from './model';
import { FooterButtons, Heading, LayoutThumb, SceneCanvas, StateCard, StepFrame } from './parts';

/** 지금 장소의 설정을 고쳐 저장한다(고치면 "이 장소 완료"는 풀린다). */
const patchSetting = (ctx: StepCtx, placeKey: string, patch: Partial<PlaceSetting>) =>
  ctx.update((d) => ({
    ...d,
    settings: { ...d.settings, [placeKey]: { ...(d.settings[placeKey] ?? defaultSetting()), ...patch, done: false } },
  }));

/** 분할 장면에서 길이 맞춤 화면이 필요한가: 길이가 서로 다른 동영상이 둘 이상 */
export function needsLengthStep(lengths: number[]): boolean {
  const videos = lengths.filter((s) => s > 0);
  return videos.length >= 2 && new Set(videos).size > 1;
}

/** 4단계: 고른 개수에 맞는 재생 방식(이어 재생 또는 같은 개수의 분할)을 고른다. */
export function TemplateStep({ ctx, placeKey }: { ctx: StepCtx; placeKey?: string }) {
  const { width } = useWindowDimensions();
  const found = locate(ctx.days, placeKey);
  const setting = (placeKey ? ctx.draft.settings[placeKey] : undefined) ?? defaultSetting();
  const media = found ? resolveMedia(ctx.draft, found.place).media : [];
  const n = media.length;
  const aspect = aspectOf(ctx.draft.aspect);
  const templates = splitTemplatesFor(n, aspect.id);
  const current = effectiveMode(setting, n) === 'split' ? (setting.templateId ?? 'seq') : 'seq';
  const [choice, setChoice] = useState<string>(current);

  if (!found || n === 0) {
    return (
      <StepFrame title="템플릿 선택" step={4} stepLabel="템플릿" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="고른 기록이 없어요" body="이전 단계에서 사진이나 동영상을 골라 주세요." />
      </StepFrame>
    );
  }

  const photos = media.filter((m) => m.item.kind === 'photo').length;
  const card = Math.floor((Math.min(width, 430) - GUTTER * 2 - 12) / 2);
  const thumbW = fitWidth(aspect.id, Math.min(76, card - 32), card - 32);
  const images = media.map((m) => m.item.imageUrl);

  const apply = () => {
    const split = choice !== 'seq';
    patchSetting(ctx, found.place.key, split ? { mode: 'split', templateId: choice } : { mode: 'sequence', templateId: undefined, lengthSec: undefined, photoSec: undefined });
    if (split && needsLengthStep(media.filter((m) => m.item.kind === 'video').map((m) => m.seconds ?? 0))) {
      ctx.go({ step: 'length', placeKey: found.place.key });
    } else {
      ctx.go({ step: 'edit', placeKey: found.place.key });
    }
  };

  return (
    <StepFrame
      title="템플릿 선택"
      step={4}
      stepLabel="템플릿"
      context={`${shortDotDateLabel(found.day.date)} · ${found.place.place.name}`}
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={<FooterButtons label="선택한 방식으로 다음" onPress={apply} />}
    >
      <Heading title={`${n}개를 어떻게 보여줄까요?`} />
      <Pressable onPress={() => ctx.replace({ step: 'media', placeKey: found.place.key })} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.sub}>
          {[photos ? `사진 ${photos}` : '', n - photos ? `동영상 ${n - photos}` : ''].filter(Boolean).join(' · ')} 선택 · 변경 ›
        </Text>
      </Pressable>
      <Text style={styles.sub}>이어 재생 또는 {n}분할 중 선택하세요.</Text>

      <View style={styles.grid}>
        <Option
          width={card}
          selected={choice === 'seq'}
          label="한 장씩 이어 재생"
          desc="순서대로 한 개씩"
          onPress={() => setChoice('seq')}
          preview={
            <View>
              <LayoutThumb rects={[[0, 0, 1, 1]]} images={images} width={thumbW} ratio={aspect.ratio} />
              <Text style={styles.counter}>1 / {n}</Text>
            </View>
          }
        />
        {templates.map((t) => (
          <Option
            key={t.id}
            width={card}
            selected={choice === t.id}
            label={`${n}분할 · ${t.label}`}
            desc="같은 화면에서 동시 재생"
            onPress={() => setChoice(t.id)}
            preview={<LayoutThumb rects={t.rects} images={images} width={thumbW} ratio={aspect.ratio} />}
          />
        ))}
      </View>
    </StepFrame>
  );
}

function Option({
  width,
  selected,
  label,
  desc,
  onPress,
  preview,
}: {
  width: number;
  selected: boolean;
  label: string;
  desc: string;
  onPress: () => void;
  preview: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, { width }, selected && styles.optionOn]}
    >
      {selected ? (
        <View style={styles.check}>
          <CheckCircle checked size={20} />
        </View>
      ) : null}
      {preview}
      <Text style={[styles.optionLabel, selected && styles.optionLabelOn]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.optionDesc}>{desc}</Text>
    </Pressable>
  );
}

/** 분할 장면의 공통 길이: 모든 칸이 같이 시작해 가장 짧은 동영상에 맞춰 같이 끝난다. */
export function LengthStep({ ctx, placeKey }: { ctx: StepCtx; placeKey?: string }) {
  const { width } = useWindowDimensions();
  const found = locate(ctx.days, placeKey);
  const setting = (placeKey ? ctx.draft.settings[placeKey] : undefined) ?? defaultSetting();
  const media = found ? resolveMedia(ctx.draft, found.place).media : [];
  const scene = ctx.timeline.scenes.find((s) => s.placeKey === placeKey);

  if (!found || !scene || scene.mode !== 'split') {
    return (
      <StepFrame title="장면 길이 맞춤" step={4} stepLabel="템플릿" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="분할 장면이 아니에요" body="분할 템플릿을 고르면 길이를 맞출 수 있어요." />
      </StepFrame>
    );
  }

  const auto = commonLength(media);
  const len = splitLength(media, setting);
  const max = auto ?? PHOTO_SPLIT_SEC;
  const videos = media.filter((m) => m.item.kind === 'video');
  const setLen = (v: number) => {
    patchSetting(ctx, found.place.key, resizeSplit(setting, media, v, max));
  };

  return (
    <StepFrame
      title="장면 길이 맞춤"
      step={4}
      stepLabel="템플릿"
      context={`${shortDotDateLabel(found.day.date)} · ${found.place.place.name}`}
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={<FooterButtons label="구간 확인" onPress={() => ctx.go({ step: 'edit', placeKey: found.place.key })} />}
    >
      <Heading title={`${media.length}분할 · 사진 ${media.length - videos.length} / 동영상 ${videos.length}`} />
      <View style={styles.center}>
        <SceneCanvas scene={scene} width={fitWidth(scene.aspect, Math.min(150, (Math.min(width, 430) - GUTTER * 2) * 0.45), Math.min(width, 430) - GUTTER * 2)} />
      </View>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>장면 길이 {len}초 · {setting.lengthSec ? '직접 조절' : '자동 맞춤'}</Text>
        <Text style={styles.bannerSub}>가장 짧은 동영상에 맞췄어요. 사진도 같은 {len}초 동안 보여요.</Text>
      </View>

      {videos.map((m, i) => {
        const start = setting.videoStart[m.item.id] ?? 0;
        const orig = m.seconds ?? 0;
        return (
          <View key={m.item.id} style={styles.clipRow}>
            <Text style={styles.clipText}>
              영상 {String.fromCharCode(65 + i)}  원본 {orig}초   사용 {mmss(start)}~{mmss(start + len)}
            </Text>
            {orig > len ? (
              <Pressable onPress={() => ctx.go({ step: 'trim', placeKey: found.place.key, clipId: m.item.id })} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>구간 이동 ›</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <View style={styles.stepper}>
        <Text style={styles.clipText}>길이 줄이기 (공통 길이 이하만 가능)</Text>
        <View style={styles.stepBtns}>
          <Pressable onPress={() => setLen(len - 1)} disabled={len <= 1} accessibilityRole="button" accessibilityLabel="1초 줄이기" style={[styles.stepBtn, len <= 1 && styles.off]}>
            <Text style={styles.stepGlyph}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{len}초</Text>
          <Pressable onPress={() => setLen(len + 1)} disabled={len >= max} accessibilityRole="button" accessibilityLabel="1초 늘리기" style={[styles.stepBtn, len >= max && styles.off]}>
            <Text style={styles.stepGlyph}>+</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>반복·정지 화면·속도 조절로 늘리기는 후속 기능입니다.</Text>
    </StepFrame>
  );
}

/** 긴 동영상에서 공통 길이만큼의 연속 구간을 고른다. */
export function TrimStep({ ctx, placeKey, clipId }: { ctx: StepCtx; placeKey?: string; clipId?: string }) {
  const found = locate(ctx.days, placeKey);
  const setting = (placeKey ? ctx.draft.settings[placeKey] : undefined) ?? defaultSetting();
  const media = found ? resolveMedia(ctx.draft, found.place).media : [];
  const clip = media.find((m) => m.item.id === clipId);
  const [trackW, setTrackW] = useState(0);
  const [start, setStart] = useState(setting.videoStart[clipId ?? ''] ?? 0);

  if (!found || !clip || !clip.seconds) {
    return (
      <StepFrame title="동영상 구간" step={4} stepLabel="템플릿" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="동영상을 찾을 수 없어요" body="삭제되었거나 길이를 알 수 없는 동영상이에요." />
      </StepFrame>
    );
  }

  const total = clip.seconds;
  // 분할 장면은 공통 길이, 이어 재생은 이 동영상에 직접 정한 길이를 쓴다.
  const len = Math.min(effectiveMode(setting, media.length) === 'split' ? splitLength(media, setting) : videoLength(clip, setting), total);
  const maxStart = Math.max(0, total - len);
  const clamp = (v: number) => Math.max(0, Math.min(maxStart, Math.round(v)));
  const onTrack = (x: number) => trackW > 0 && setStart(clamp((x / trackW) * total - len / 2));

  return (
    <StepFrame
      title="동영상 구간"
      step={4}
      stepLabel="템플릿"
      context={`영상 원본 ${total}초`}
      onBack={ctx.back}
      onClose={ctx.close}
      footer={
        <FooterButtons
          label={`${len}초 구간 적용`}
          onPress={() => {
            patchSetting(ctx, found.place.key, { videoStart: { ...setting.videoStart, [clip.item.id]: start } });
            ctx.back();
          }}
        />
      }
    >
      <View style={styles.cover}>
        <SafeImage source={clip.item.imageUrl} style={StyleSheet.absoluteFill} compact />
      </View>
      <Text style={styles.bannerTitle}>{effectiveMode(setting, media.length) === 'split' ? '공통 길이' : '사용 길이'} {len}초</Text>
      <Pressable
        onPress={(e) => onTrack(e.nativeEvent.locationX)}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={`사용 구간 시작 ${start}초`}
        style={styles.track}
      >
        {trackW > 0 ? <View style={[styles.window, { left: (start / total) * trackW, width: (len / total) * trackW }]} /> : null}
      </Pressable>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{mmss2(0)}</Text>
        <Text style={styles.axisText}>{mmss2(total)}</Text>
      </View>
      <View style={styles.stepper}>
        <Text style={styles.clipText}>
          시작 {mmss2(start)}   종료 {mmss2(start + len)}
        </Text>
        <View style={styles.stepBtns}>
          <Pressable onPress={() => setStart(clamp(start - 1))} disabled={start <= 0} accessibilityRole="button" accessibilityLabel="1초 앞으로" style={[styles.stepBtn, start <= 0 && styles.off]}>
            <Text style={styles.stepGlyph}>◀</Text>
          </Pressable>
          <Pressable onPress={() => setStart(clamp(start + 1))} disabled={start >= maxStart} accessibilityRole="button" accessibilityLabel="1초 뒤로" style={[styles.stepBtn, start >= maxStart && styles.off]}>
            <Text style={styles.stepGlyph}>▶</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>{len}초 길이를 유지하며 구간을 이동해요.</Text>
    </StepFrame>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13, color: colors.textSub },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { backgroundColor: colors.surface, borderRadius: radius.item, borderWidth: 1.5, borderColor: 'transparent', padding: 14, alignItems: 'center', gap: 6 },
  optionOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  check: { position: 'absolute', right: 8, top: 8, zIndex: 2 },
  optionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 4 },
  optionLabelOn: { color: colors.primary },
  optionDesc: { fontSize: 11, color: colors.textMuted },
  counter: { position: 'absolute', alignSelf: 'center', bottom: 6, fontSize: 10, fontWeight: '800', color: colors.text, backgroundColor: colors.bg, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  center: { alignItems: 'center' },
  banner: { backgroundColor: colors.primarySoft, borderRadius: radius.item, padding: 14, gap: 4 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  bannerSub: { fontSize: 12, color: colors.textSub },
  clipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  clipText: { flex: 1, fontSize: 13, color: colors.text },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 16, fontWeight: '800', color: colors.text },
  stepValue: { minWidth: 36, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.text },
  off: { opacity: 0.35 },
  hint: { fontSize: 12, color: colors.textMuted },
  cover: { width: '100%', aspectRatio: 1, borderRadius: radius.item, overflow: 'hidden', backgroundColor: colors.surface },
  track: { height: 44, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center' },
  window: { position: 'absolute', top: 0, bottom: 0, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 11, color: colors.textMuted },
});
