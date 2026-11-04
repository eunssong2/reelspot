import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { ActionButton } from './ui/FormParts';
import { colors, GUTTER, radius } from './tokens';
import { dayOfWeekLabel, shortDotDateLabel } from './date';
import { selectedPlaces, type StepCtx } from './ctx';
import {
  aspectOf,
  fitWidth,
  TITLE_CARD_SEC,
  TRANSITION_SEC,
  daySeconds,
  defaultTitle,
  draftSignature,
  draftProblem,
  mmss2,
  moveItem,
  placeSeconds,
  resolveMedia,
  splitTemplatesFor,
  type VlogDay,
} from './model';
import { FooterButtons, Heading, StateCard, StepFrame, TransitionStage } from './parts';
import { renderVlog, saveToGallery } from './vlogBridge';

const titleOf = (ctx: StepCtx) => ctx.draft.title.trim() || defaultTitle(ctx.group);
const weekday = (iso: string) => `${shortDotDateLabel(iso)} ${dayOfWeekLabel(iso)}요일`;

/** 4단계 마무리: 여러 날짜·장소를 하나의 영상으로 잇는 순서와 완료 상태를 확인한다. */
export function ComposeStep({ ctx }: { ctx: StepCtx }) {
  const { draft, days, timeline } = ctx;
  const picked = draft.dayKeys.map((k) => days.find((d) => d.key === k)).filter((d): d is VlogDay => Boolean(d));
  const places = selectedPlaces(draft, days);
  const undone = places.filter((x) => !draft.settings[x.place.key]?.done);

  const moveDay = (from: number, to: number) => ctx.update((d) => ({ ...d, dayKeys: moveItem(d.dayKeys, from, to) }));
  const movePlace = (dayKey: string, from: number, to: number) =>
    ctx.update((d) => ({ ...d, placeKeys: { ...d.placeKeys, [dayKey]: moveItem(d.placeKeys[dayKey] ?? [], from, to) } }));

  const next = () => {
    if (undone.length > 0) return ctx.toast(`아직 편집하지 않은 장소 ${undone.length}곳이 있어요`);
    const problem = draftProblem(draft, ctx.days);
    if (problem) return ctx.toast(problem);
    ctx.go({ step: 'preview' });
  };

  return (
    <StepFrame
      title="전체 구성"
      step={4}
      stepLabel="날짜·장소 편집 완료"
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={<FooterButtons label="전체 미리보기" onPress={next} disabled={places.length === 0} />}
    >
      <TextInput
        value={draft.title}
        onChangeText={(t) => ctx.update((d) => ({ ...d, title: t }))}
        placeholder={defaultTitle(ctx.group)}
        placeholderTextColor={colors.textMuted}
        maxLength={30}
        accessibilityLabel="브이로그 제목"
        style={styles.titleInput}
      />
      <Text style={styles.sub}>
        {picked.length}일 · {places.length}곳 · 예상 {timeline.totalSec}초
      </Text>

      {picked.map((day, di) => {
        const keys = draft.placeKeys[day.key] ?? [];
        return (
          <View key={day.key} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>
                {weekday(day.date)}  {daySeconds(draft, day)}초
              </Text>
              <Arrows onUp={di > 0 ? () => moveDay(di, di - 1) : undefined} onDown={di < picked.length - 1 ? () => moveDay(di, di + 1) : undefined} label="날짜" />
            </View>
            <View style={styles.dayTitleBox}>
              <View style={styles.dayTitleTop}>
                <Text style={styles.cardSub}>날짜 제목 화면 {TITLE_CARD_SEC}초</Text>
                <Switch
                  value={Boolean(draft.dayTitleCard?.[day.key])}
                  onValueChange={(v) => ctx.update((d) => ({ ...d, dayTitleCard: { ...(d.dayTitleCard ?? {}), [day.key]: v } }))}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel={`${weekday(day.date)} 제목 화면 넣기`}
                />
              </View>
              <TextInput
                value={draft.dayTitles?.[day.key] ?? day.title}
                onChangeText={(text) => ctx.update((d) => ({ ...d, dayTitles: { ...(d.dayTitles ?? {}), [day.key]: text } }))}
                onBlur={() => {
                  // 비워 두면 일정의 날짜 제목으로 돌아간다.
                  if (!(draft.dayTitles?.[day.key] ?? '').trim()) ctx.update((d) => ({ ...d, dayTitles: { ...(d.dayTitles ?? {}), [day.key]: '' } }));
                }}
                placeholder={day.title}
                placeholderTextColor={colors.textMuted}
                maxLength={30}
                accessibilityLabel={`${weekday(day.date)} 날짜 제목`}
                style={styles.dayTitleInput}
              />
              <Text style={styles.hint}>제목은 이 브이로그에만 적용돼요. 일정의 원래 제목은 바뀌지 않아요.</Text>
            </View>
            {keys.map((key, pi) => {
              const place = day.places.find((p) => p.key === key);
              if (!place) return null;
              const done = Boolean(draft.settings[key]?.done);
              const n = resolveMedia(draft, place).media.length;
              const setting = draft.settings[key];
              const split = setting?.mode === 'split' && splitTemplatesFor(n).some((t) => t.id === setting.templateId);
              const sec = placeSeconds(draft, place);
              const desc = !done
                ? '미완료 · 눌러서 편집'
                : split
                  ? `${n}분할 · 사진·동영상 ${n}개 · ${sec}초`
                  : n === 1
                    ? `단일 · 기록 1개 · ${sec}초`
                    : `이어 재생 · 기록 ${n}개 · ${sec}초`;
              return (
                <View key={key} style={[styles.card, !done && styles.cardWarn]}>
                  <Pressable
                    onPress={() => ctx.go({ step: n > 0 ? 'edit' : 'media', placeKey: key })}
                    accessibilityRole="button"
                    accessibilityLabel={`${place.place.name} ${done ? '완료' : '미완료'} 수정`}
                    style={styles.cardMain}
                  >
                    <Text style={styles.cardTitle}>
                      {place.place.name} {done ? '✓' : ''}
                    </Text>
                    <Text style={[styles.cardSub, !done && styles.warnText]}>{desc}{done ? '   수정' : ''}</Text>
                  </Pressable>
                  <Arrows
                    onUp={pi > 0 ? () => movePlace(day.key, pi, pi - 1) : undefined}
                    onDown={pi < keys.length - 1 ? () => movePlace(day.key, pi, pi + 1) : undefined}
                    label="장소"
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </StepFrame>
  );
}

function Arrows({ onUp, onDown, label }: { onUp?: () => void; onDown?: () => void; label: string }) {
  return (
    <View style={styles.arrows}>
      <Pressable onPress={onUp} disabled={!onUp} accessibilityRole="button" accessibilityLabel={`${label} 위로`} style={[styles.arrow, !onUp && styles.off]}>
        <Text style={styles.arrowText}>↑</Text>
      </Pressable>
      <Pressable onPress={onDown} disabled={!onDown} accessibilityRole="button" accessibilityLabel={`${label} 아래로`} style={[styles.arrow, !onDown && styles.off]}>
        <Text style={styles.arrowText}>↓</Text>
      </Pressable>
    </View>
  );
}

/**
 * 5단계: 전체 미리보기. 최종 출력과 같은 타임라인(구간·배치)을 장면 단위로 재생한다.
 * 동영상은 커버 프레임으로 보여 주며 실제 움직임·소리는 최종 렌더링에서 만들어진다.
 */
export function PreviewStep({ ctx }: { ctx: StepCtx }) {
  const { width } = useWindowDimensions();
  const { timeline, draft } = ctx;
  const total = timeline.totalSec;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const problem = draftProblem(draft, ctx.days);
  const signature = useMemo(() => draftSignature(draft, timeline), [draft, timeline]);
  const hasFinished = draft.render?.signature === signature;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((prev) => {
        const nextT = prev + 0.05;
        if (nextT >= total) {
          setPlaying(false);
          return total;
        }
        return nextT;
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing, total]);

  const scene = timeline.scenes.find((s) => t >= s.startSec && t < s.startSec + s.seconds) ?? timeline.scenes[timeline.scenes.length - 1];
  const sceneIdx = scene ? timeline.scenes.indexOf(scene) : -1;
  const prevScene = sceneIdx > 0 ? timeline.scenes[sceneIdx - 1] : undefined;
  const transProgress = scene && prevScene ? (t - scene.startSec) / TRANSITION_SEC : undefined;
  const maxW = Math.min(width, 430) - GUTTER * 2;
  const canvasW = fitWidth(timeline.aspect, Math.min(200, maxW * 0.55), maxW);

  if (!scene) {
    return (
      <StepFrame title="전체 미리보기" step={5} stepLabel="미리보기" onBack={ctx.back} onClose={ctx.close}>
        <StateCard title="미리 볼 장면이 없어요" body="날짜와 장소, 사진·동영상을 먼저 골라 주세요." />
      </StepFrame>
    );
  }

  const play = () => {
    if (t >= total) setT(0);
    setPlaying((p) => !p);
  };
  const seek = (sec: number) => setT(Math.max(0, Math.min(total, sec)));
  const marks = ctx.draft.dayKeys
    .map((k) => timeline.scenes.find((s) => s.dayKey === k))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ s, day: ctx.days.find((d) => d.key === s.dayKey) }));

  return (
    <StepFrame
      title="전체 미리보기"
      step={5}
      stepLabel="미리보기"
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={
        <FooterButtons
          label="영상 생성"
          disabled={Boolean(problem)}
          onPress={() => { const error = draftProblem(ctx.draft, ctx.days); if (error) ctx.toast(error); else ctx.go({ step: 'generate' }); }}
          secondaryLabel={hasFinished ? '만들어 둔 완성본 보기' : undefined}
          onSecondary={() => ctx.go({ step: 'result' })}
        />
      }
    >
      <Pressable onPress={ctx.back} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.previewTitle}>{titleOf(ctx)}  <Text style={styles.link}>수정</Text></Text>
      </Pressable>

      <View style={styles.center}>
        <Pressable onPress={play} accessibilityRole="button" accessibilityLabel={playing ? '일시정지' : '재생'}>
          <TransitionStage scene={scene} prev={prevScene} width={canvasW} localSec={t - scene.startSec} transition={scene.transition} progress={transProgress} />
          {!playing ? (
            <View style={styles.playWrap} pointerEvents="none">
              <View style={styles.playBtn}>
                <Text style={styles.playGlyph}>▶</Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Text style={styles.time}>
        {mmss2(t)} / {mmss2(total)}
      </Text>
      <Pressable
        onPress={(e) => trackW > 0 && seek((e.nativeEvent.locationX / trackW) * total)}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={`재생 위치 ${mmss2(t)}`}
        style={styles.bar}
      >
        <View style={[styles.barFill, { width: total > 0 ? `${(t / total) * 100}%` : '0%' }]} />
      </Pressable>
      <View style={styles.marks}>
        {marks.map(({ s, day }) => (
          <Pressable key={s.dayKey} onPress={() => seek(s.startSec)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.mark}>
              {day ? shortDotDateLabel(day.date) : ''} {mmss2(s.startSec).replace(/^00:/, '0:')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.format}>{aspectOf(timeline.aspect).output}</Text>
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <Pressable onPress={() => ctx.go({ step: 'compose' })} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.link, styles.centerText]}>자막·장면 수정</Text>
      </Pressable>
    </StepFrame>
  );
}

type RunState = 'running' | 'failed' | 'not_connected';

/** 5단계: 영상 생성. 실제 처리 상태가 있을 때만 진행률을 보여 주고, 연결 전에는 그대로 알린다. */
export function GenerateStep({ ctx }: { ctx: StepCtx }) {
  const [state, setState] = useState<RunState>('running');
  const [progress, setProgress] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const cancelled = useRef(false);
  const running = useRef(false);
  const generation = useRef(0);
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  useEffect(() => {
    // 중복 생성을 막는다: 이미 처리 중이면 새로 시작하지 않는다.
    if (running.current) return;
    running.current = true;
    const request = ++generation.current;
    const isCancelled = () => cancelled.current || generation.current !== request;
    cancelled.current = false;
    setState('running');
    setProgress(null);
    const c = ctxRef.current;
    const signature = draftSignature(c.draft, c.timeline);
    (async () => {
      try { await c.revalidate(); } catch (e) { running.current = false; if (!isCancelled()) { setState('failed'); c.toast((e as Error).message); } return; }
      if (isCancelled()) return;
      const outcome = await renderVlog({
        title: titleOf(c),
        timeline: c.timeline,
        onProgress: (r) => { if (!isCancelled()) setProgress(Math.max(0, Math.min(1, r))); },
        isCancelled,
      });
      if (isCancelled()) return;
      running.current = false;
      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'done') {
        ctxRef.current.update((d) => ({
          ...d,
          render: { signature, uri: outcome.uri, durationSec: outcome.durationSec, createdAt: Date.now(), savedToGallery: false },
        }));
        ctxRef.current.replace({ step: 'result' });
      } else setState(outcome.status === 'not_connected' ? 'not_connected' : 'failed');
    })();
    return () => {
      cancelled.current = true;
      generation.current = request + 1;
      running.current = false;
    };
  }, [runId]);

  const stop = () => {
    cancelled.current = true;
    running.current = false;
    ctx.back();
  };

  return (
    <StepFrame title="영상 생성" step={5} stepLabel="생성" onBack={stop} onClose={ctx.close} scroll={false}>
      <View style={styles.genBody}>
        {state === 'running' ? (
          <>
            <Text style={styles.genTitle}>브이로그를 만들고 있어요</Text>
            {progress === null ? (
              <ActivityIndicator color={colors.primary} accessibilityLabel="영상을 만드는 중" />
            ) : (
              <>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
              </>
            )}
            <Text style={styles.genSub}>잠시 이 화면을 유지해 주세요.{'\n'}중단해도 편집 내용은 남아 있어요.</Text>
            <ActionButton label="생성 중단" tone="secondary" onPress={stop} style={styles.genBtn} />
          </>
        ) : (
          <>
            <StateCard
              title={state === 'not_connected' ? '영상 생성 기능이 아직 연결되지 않았어요' : '영상을 만들지 못했어요'}
              body={
                state === 'not_connected'
                  ? '영상 렌더링 기능이 앱에 연결되면 만들 수 있어요. 편집 내용은 그대로 남아 있어요.'
                  : '편집 내용은 그대로 남아 있어요. 다시 생성하거나 편집으로 돌아가세요.'
              }
            />
            <ActionButton label="편집으로" tone="secondary" onPress={() => ctx.go({ step: 'compose' })} style={styles.genBtn} />
            <ActionButton label="다시 생성" onPress={() => setRunId((n) => n + 1)} style={styles.genBtn} />
          </>
        )}
      </View>
    </StepFrame>
  );
}

type SaveState = 'idle' | 'saving' | 'denied';

/** 5단계: 완성본 확인과 기기 갤러리 저장. 저장이 확인된 뒤에만 "저장 완료"를 보여 준다. */
export function ResultStep({ ctx }: { ctx: StepCtx }) {
  const { width } = useWindowDimensions();
  const render = ctx.draft.render;
  const signature = useMemo(() => draftSignature(ctx.draft, ctx.timeline), [ctx.draft, ctx.timeline]);
  const [save, setSave] = useState<SaveState>('idle');

  if (!render) {
    return (
      <StepFrame title="브이로그 완성" step={5} stepLabel="완성" onBack={ctx.back} onClose={ctx.close}>
        <StateCard
          title="완성된 영상이 없어요"
          body="영상 생성을 먼저 진행해 주세요."
          actions={<ActionButton label="편집으로" onPress={() => ctx.go({ step: 'compose' })} />}
        />
      </StepFrame>
    );
  }

  const stale = render.signature !== signature;
  const days = new Set(ctx.timeline.scenes.map((s) => s.dayKey)).size;

  const doSave = async () => {
    setSave('saving');
    try { await ctx.revalidate(); } catch (e) { setSave('idle'); ctx.toast((e as Error).message); return; }
    const outcome = await saveToGallery(render.uri);
    if (outcome === 'saved') {
      ctx.update((d) => (d.render ? { ...d, render: { ...d.render, savedToGallery: true } } : d));
      setSave('idle');
    } else if (outcome === 'denied') setSave('denied');
    else {
      setSave('idle');
      ctx.toast(outcome === 'not_connected' ? '기기에 저장하는 기능은 아직 연결되지 않았어요' : '저장하지 못했어요. 완성본은 그대로 있어요');
    }
  };

  return (
    <StepFrame
      title="브이로그 완성"
      step={5}
      stepLabel="완성"
      onBack={ctx.back}
      onClose={ctx.close}
      toast={ctx.toastMessage}
      footer={
        stale ? (
          <FooterButtons label="새 영상 생성" onPress={() => { const error = draftProblem(ctx.draft, ctx.days); if (error) ctx.toast(error); else ctx.go({ step: 'generate' }); }} secondaryLabel="편집으로" onSecondary={() => ctx.go({ step: 'compose' })} />
        ) : render.savedToGallery ? (
          <FooterButtons label="일정 목록으로" onPress={ctx.close} />
        ) : save === 'denied' ? (
          <FooterButtons label="다시 저장" onPress={doSave} secondaryLabel="설정 열기" onSecondary={() => Linking.openSettings().catch(() => ctx.toast('설정을 열 수 없어요'))} />
        ) : (
          <FooterButtons label="갤러리에 저장" onPress={doSave} loading={save === 'saving'} />
        )
      }
    >
      <Heading title={save === 'denied' ? '영상은 완성됐어요' : '영상이 완성됐어요'} />
      <Player uri={render.uri} aspect={ctx.timeline.aspect} width={fitWidth(ctx.timeline.aspect, Math.min(200, (Math.min(width, 430) - GUTTER * 2) * 0.55), Math.min(width, 430) - GUTTER * 2)} />
      <Text style={styles.previewTitle}>{titleOf(ctx)}</Text>
      <Text style={styles.format}>
        {days}일 · {Math.round(render.durationSec)}초 · 1080p · MP4
      </Text>
      {stale ? <StateCard title="편집 내용이 바뀌었어요" body="이 완성본에는 반영되지 않았어요. 바뀐 내용으로 보려면 새 영상을 생성해야 해요." /> : null}
      {save === 'denied' ? <StateCard title="갤러리 저장 권한이 필요해요" body={'설정에서 사진 저장을 허용한 후\n다시 저장해 주세요.'} /> : null}
      {render.savedToGallery ? <Text style={styles.saved}>✓ 기기 갤러리에 저장 완료</Text> : <Text style={styles.format}>이 기기의 갤러리에 저장합니다.</Text>}
    </StepFrame>
  );
}

/** 완성된 영상을 한 번 더 재생해 확인한다. */
function Player({ uri, width, aspect }: { uri: string; width: number; aspect: 'portrait' | 'landscape' }) {
  const height = width / aspectOf(aspect).ratio;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <View style={[styles.center, { height }]}>
      <VideoView player={player} style={{ width, height, borderRadius: 10 }} nativeControls contentFit="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  titleInput: { backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 16, minHeight: 56, fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSub },
  group: { gap: 8, marginTop: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.item, borderWidth: 1.5, borderColor: colors.primary, paddingRight: 6 },
  cardWarn: { backgroundColor: colors.surface, borderColor: colors.primaryBorder },
  cardMain: { flex: 1, padding: 14, gap: 3, minHeight: 64, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSub },
  warnText: { color: colors.primary, fontWeight: '700' },
  arrows: { flexDirection: 'row' },
  arrow: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  off: { opacity: 0.25 },
  dayTitleBox: { gap: 6, backgroundColor: colors.surface, borderRadius: radius.item, padding: 12 },
  dayTitleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitleInput: { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.textMuted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, marginTop: 4 },
  toggleText: { flex: 1, gap: 2 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { fontSize: 18, color: colors.primary },
  time: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden', justifyContent: 'center' },
  barFill: { height: 8, backgroundColor: colors.primary },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
  mark: { fontSize: 11, color: colors.textSub },
  format: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  problem: { fontSize: 13, fontWeight: '700', color: colors.danger, textAlign: 'center' },
  genBody: { flex: 1, justifyContent: 'center', gap: 16 },
  genTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  genSub: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  genBtn: { alignSelf: 'stretch' },
  pct: { fontSize: 18, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  saved: { fontSize: 13, fontWeight: '800', color: colors.primary, textAlign: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.item, paddingVertical: 14 },
});
