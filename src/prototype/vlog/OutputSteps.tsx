import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { ActionButton } from '../components/FormParts';
import { Toggle } from '../components/Toggle';
import { MIN_TOUCH, colors, GUTTER, radius } from '../styles/tokens';
import { dayOfWeekLabel, shortDotDateLabel } from '../utils/date';
import { selectedPlaces, type StepCtx } from './ctx';
import {
  aspectOf,
  fitWidth,
  END_CARD_SEC,
  END_TEXT_DEFAULT,
  MUSIC_VOLUMES,
  TITLE_CARD_SEC,
  TITLE_SEC_OPTIONS,
  TITLE_STYLES,
  titleStyleOf,
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
  type MusicId,
  type VlogDay,
} from './model';
import { useBgm } from './bgm';
import { MUSIC_MOODS, MUSIC_TRACKS, musicLabel } from './musicTracks';
import { FooterButtons, Heading, StateCard, StepFrame, TitleCard, TransitionStage } from './parts';
import { renderVlog, saveToGallery } from './vlogBridge';

const titleOf = (ctx: StepCtx) => ctx.draft.title.trim() || defaultTitle(ctx.group);
const weekday = (iso: string) => `${shortDotDateLabel(iso)} ${dayOfWeekLabel(iso)}요일`;

/** 4단계 마무리: 여러 날짜·장소를 하나의 영상으로 잇는 순서와 완료 상태를 확인한다. */
export function ComposeStep({ ctx }: { ctx: StepCtx }) {
  const { draft, days, timeline } = ctx;
  const picked = draft.dayKeys.map((k) => days.find((d) => d.key === k)).filter((d): d is VlogDay => Boolean(d));
  const places = selectedPlaces(draft, days);
  const undone = places.filter((x) => !draft.settings[x.place.key]?.done);
  const [sheet, setSheet] = useState<'title' | 'sound' | null>(null);

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

      {/* 제목 화면 모양·소리·음악은 화면이 길어지지 않게 따로 열어서 정한다. */}
      <View style={styles.styleRows}>
        <SettingRow
          label="제목 화면"
          value={`${titleStyleOf(draft.titleStyle).label} · ${draft.titleCardSec ?? TITLE_CARD_SEC}초 · ${picked.filter((d) => draft.dayTitleCard?.[d.key]).length}/${picked.length}일 넣음`}
          onPress={() => setSheet('title')}
        />
        <SettingRow
          label="소리·배경 음악"
          value={`${musicLabel(draft.music?.id)} · 원본 소리 ${draft.originalSound === 'mute' ? '없앰' : '그대로'}`}
          onPress={() => setSheet('sound')}
        />
      </View>
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

      <View style={styles.card}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>끝 화면</Text>
          <Text style={styles.cardSub}>마지막에 문구 한 장을 넣어요</Text>
        </View>
        <Toggle
          value={Boolean(draft.endCard)}
          onValueChange={(v) => ctx.update((d) => ({ ...d, endCard: v }))}
          accessibilityLabel="끝 화면"
        />
      </View>
      {draft.endCard ? (
        <View style={styles.dayTitleBox}>
          <TextInput
            value={draft.endText ?? ''}
            onChangeText={(v) => ctx.update((d) => ({ ...d, endText: v }))}
            placeholder={END_TEXT_DEFAULT}
            placeholderTextColor={colors.textMuted}
            maxLength={30}
            accessibilityLabel="끝 화면 문구"
            style={styles.dayTitleInput}
          />
        </View>
      ) : null}
      <SettingSheet visible={sheet !== null} title={sheet === 'title' ? '제목 화면' : '소리·배경 음악'} onClose={() => setSheet(null)}>
        {sheet === 'title' ? <TitleSettings ctx={ctx} /> : null}
        {sheet === 'sound' ? <MusicPicker ctx={ctx} /> : null}
      </SettingSheet>
    </StepFrame>
  );
}

/**
 * 제목 화면 설정(한 곳에 모음): 날짜마다 넣을지·제목, 모양, 머무는 시간.
 * 모양과 시간은 영상 전체에 하나이고, 모양은 끝 화면에도 같이 적용된다.
 */
function TitleSettings({ ctx }: { ctx: StepCtx }) {
  const { draft, days } = ctx;
  const picked = draft.dayKeys.map((k) => days.find((d) => d.key === k)).filter((d): d is VlogDay => Boolean(d));
  const current = draft.titleStyle ?? 'soft';
  const sec = draft.titleCardSec ?? TITLE_CARD_SEC;
  // 사진을 쓰는 모양을 미리 볼 사진: 영상의 첫 사진
  const sample = ctx.timeline.scenes.find((s) => s.clips.length > 0)?.clips[0]?.image;
  const W = 52;
  const H = W / aspectOf(ctx.timeline.aspect).ratio;
  return (
    <View style={styles.titlePick}>
      {/* 날짜마다: 한 줄에 날짜·제목·켜기 */}
      {picked.map((day) => {
        const on = Boolean(draft.dayTitleCard?.[day.key]);
        return (
          <View key={day.key} style={styles.titleDayRow}>
            <Text style={styles.titleDayLabel}>{shortDotDateLabel(day.date)}</Text>
            {on ? (
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
                style={[styles.dayTitleInput, styles.titleDayInput]}
              />
            ) : (
              <Text style={[styles.cardSub, styles.titleDayInput]}>제목 화면 없음</Text>
            )}
            <Toggle
              style={styles.touch}
              value={on}
              onValueChange={(v) => ctx.update((d) => ({ ...d, dayTitleCard: { ...(d.dayTitleCard ?? {}), [day.key]: v } }))}
              accessibilityLabel={`${weekday(day.date)} 제목 화면 넣기`}
            />
          </View>
        );
      })}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleStrip}>
        {TITLE_STYLES.map((st) => {
          const sel = st.id === current;
          return (
            <Pressable
              key={st.id}
              onPress={() => ctx.update((d) => ({ ...d, titleStyle: st.id }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`제목 화면 모양 ${st.label}`}
              style={styles.titleItem}
            >
              <View style={[styles.titleThumb, sel && styles.titleThumbOn]}>
                <TitleCard preset={st} date="10.22" name="제목" image={sample} day={2} weekday="목요일" width={W} height={H} shrink={W / aspectOf(ctx.timeline.aspect).width} minFont={5} />
              </View>
              <Text style={[styles.titleLabel, sel && styles.titleLabelOn]}>{st.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.titleSecRow}>
        <Text style={styles.cardSub}>머무는 시간</Text>
        {TITLE_SEC_OPTIONS.map((n) => {
          const on = n === sec;
          return (
            <Pressable
              key={n}
              onPress={() => ctx.update((d) => ({ ...d, titleCardSec: n }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.musicVolChip, on && styles.musicVolChipOn, styles.titleSecChip]}
            >
              <Text style={[styles.musicVolText, on && styles.musicVolTextOn]}>{n}초</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * 배경 음악 고르기: 곡을 고르고, ▶ 로 들어 본다. 소리 크기는 곡을 고른 뒤에 정한다.
 * 곡은 영상 전체에 하나이며 영상보다 짧으면 반복된다. 원본 영상의 소리는 그대로 두고 그 위에 깔린다.
 */
function MusicPicker({ ctx }: { ctx: StepCtx }) {
  const music = ctx.draft.music ?? { id: 'none' as MusicId, volume: 'mid' as const };
  // 듣고 있는 곡(없으면 null). 듣는 소리 크기도 고른 크기를 따른다.
  const [listening, setListening] = useState<MusicId | null>(null);
  useBgm(listening ?? 'none', music.volume, listening !== null);
  const set = (change: Partial<typeof music>) => ctx.update((d) => ({ ...d, music: { ...music, ...change } }));
  // 분위기 탭: 고른 곡이 있으면 그 곡의 분위기부터 보여 준다.
  const [mood, setMood] = useState<string>(MUSIC_TRACKS.find((t) => t.id === music.id)?.mood ?? MUSIC_MOODS[0]);
  const none = music.id === 'none';

  return (
    <View style={styles.musicBox}>
      <Text style={styles.cardTitle}>소리</Text>
      <View style={styles.musicVol}>
        {([['keep', '원본 소리 그대로'], ['mute', '원본 소리 없애기']] as const).map(([id, label]) => {
          const on = (ctx.draft.originalSound ?? 'keep') === id;
          return (
            <Pressable
              key={id}
              onPress={() => ctx.update((d) => ({ ...d, originalSound: id }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.musicVolChip, styles.soundChip, on && styles.musicVolChipOn]}
            >
              <Text style={[styles.musicVolText, on && styles.musicVolTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.cardSub}>
        {(ctx.draft.originalSound ?? 'keep') === 'keep' ? '동영상의 원래 소리를 그대로 둬요' : '동영상의 원래 소리를 없애요'}
      </Text>
      <Text style={[styles.cardTitle, styles.musicTitle]}>배경 음악</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.musicTabs}>
        <Pressable
          onPress={() => {
            set({ id: 'none' });
            setListening(null);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: none }}
          style={[styles.musicTab, none && styles.musicTabOn]}
        >
          <Text style={[styles.musicTabText, none && styles.musicTabTextOn]}>음악 없음</Text>
        </Pressable>
        {MUSIC_MOODS.map((m) => {
          const on = !none && mood === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMood(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: mood === m }}
              style={[styles.musicTab, mood === m && styles.musicTabSoft, on && styles.musicTabOn]}
            >
              <Text style={[styles.musicTabText, on && styles.musicTabTextOn]}>
                {m} {MUSIC_TRACKS.filter((t) => t.mood === m).length}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {MUSIC_TRACKS.filter((t) => t.mood === mood).map((t) => {
        const on = music.id === t.id;
        const playing = listening === t.id;
        return (
          <View key={t.id} style={[styles.musicRow, on && styles.musicRowOn]}>
            <Pressable onPress={() => set({ id: t.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={styles.musicMain}>
              <Text style={[styles.musicName, on && styles.musicNameOn]}>{t.label}</Text>
              <Text style={styles.cardSub}>{t.desc}</Text>
            </Pressable>
            <Pressable
              onPress={() => setListening(playing ? null : t.id)}
              accessibilityRole="button"
              accessibilityLabel={playing ? `${t.label} 멈추기` : `${t.label} 들어 보기`}
              hitSlop={6}
              style={styles.musicPlay}
            >
              <Text style={styles.musicPlayText}>{playing ? '■' : '▶'}</Text>
            </Pressable>
          </View>
        );
      })}
      {music.id !== 'none' ? (
        <View style={styles.musicVol}>
          <Text style={styles.cardSub}>소리 크기</Text>
          {MUSIC_VOLUMES.map((v) => {
            const on = music.volume === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => set({ volume: v.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.musicVolChip, on && styles.musicVolChipOn]}
              >
                <Text style={[styles.musicVolText, on && styles.musicVolTextOn]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Text style={styles.hint}>시연용 예시 곡이에요</Text>
    </View>
  );
}

/** 한 줄 설정 버튼: 이름과 지금 값을 보여 주고, 누르면 따로 열어서 고른다. */
function SettingRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} 설정`} style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.settingChevron}>›</Text>
    </Pressable>
  );
}

/** 아래에서 올라오는 설정 창. 안의 내용은 열려 있을 때만 그려서(음악 미리 듣기 등) 닫으면 함께 멈춘다. */
function SettingSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { maxHeight: height * 0.85 }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>완료</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  const { width, height } = useWindowDimensions();
  const { timeline, draft } = ctx;
  const total = timeline.totalSec;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const problem = draftProblem(draft, ctx.days);
  const signature = useMemo(() => draftSignature(draft, timeline), [draft, timeline]);
  const hasFinished = draft.render?.signature === signature;
  // 배경 음악은 미리보기를 재생하는 동안 함께 나온다(소리 크기는 구성 화면에서 정한 값).
  useBgm(draft.music?.id ?? 'none', draft.music?.volume ?? 'mid', playing);

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
  // 아래가 비어 보일 만큼 자리가 남는다. 화면이 길면 미리보기를 키운다.
  // 크게 볼수록 자막 크기(작게·보통·크게) 차이도 눈에 들어온다.
  const canvasW = fitWidth(timeline.aspect, Math.min(height < 760 ? 200 : 260, maxW * 0.72), maxW);

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
  /**
   * 지금 보고 있는 장면을 고치러 간다: 그 장면의 장소 편집 화면으로.
   * 제목·끝 화면을 보고 있으면 그날(마지막 화면이면 마지막 날)의 첫 장소로 가고, 갈 곳이 없으면 전체 구성으로 간다.
   * 바로 만들기로 들어온 경우에도 뒤로 가기에 기대지 않고 직접 그 화면으로 보낸다.
   */
  const editHere = () => {
    setPlaying(false);
    const key = scene.placeKey ?? draft.placeKeys[scene.dayKey]?.[0];
    if (key) ctx.go({ step: 'edit', placeKey: key });
    else ctx.go({ step: 'compose' });
  };
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
          onPress={() => {
            // 누르는 순간 다시 확인한다(편집 뒤 기록이 지워졌을 수 있다).
            const error = draftProblem(ctx.draft, ctx.days);
            if (error) ctx.toast(error);
            else ctx.go({ step: 'generate' });
          }}
          secondaryLabel={hasFinished ? '만들어 둔 완성본 보기' : undefined}
          onSecondary={() => ctx.go({ step: 'result' })}
        />
      }
    >
      <Pressable onPress={editHere} accessibilityRole="button" hitSlop={8} style={styles.touch}>
        <Text style={styles.previewTitle}>{titleOf(ctx)}  <Text style={styles.link}>수정</Text></Text>
      </Pressable>

      <View style={styles.center}>
        <Pressable onPress={play} accessibilityRole="button" accessibilityLabel={playing ? '일시정지' : '재생'} style={styles.touch}>
          <TransitionStage
            scene={scene}
            prev={prevScene}
            width={canvasW}
            localSec={t - scene.startSec}
            transition={scene.transition}
            progress={transProgress}
            animate
            videoPlaying={playing}
          />
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
        {mmss2(t)} / {mmss2(total)}  ·  {aspectOf(timeline.aspect).output}
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
      {marks.length > 1 ? (
        <View style={styles.marks}>
          {marks.map(({ s, day }) => {
            const label = day ? shortDotDateLabel(day.date) : '';
            return (
              <Pressable
                key={s.dayKey}
                onPress={() => seek(s.startSec)}
                accessibilityRole="button"
                accessibilityLabel={`${label} 날짜로 이동`}
                hitSlop={8}
                style={styles.markChip}
              >
                <Text style={styles.mark}>
                  {label} {mmss2(s.startSec).replace(/^00:/, '0:')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <Pressable onPress={editHere} accessibilityRole="button" hitSlop={8}>
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
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    // 중복 생성을 막는다: 이미 처리 중이면 새로 시작하지 않는다.
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    setState('running');
    setProgress(null);
    const c = ctxRef.current;
    const signature = draftSignature(c.draft, c.timeline);
    (async () => {
      const outcome = await renderVlog({
        title: titleOf(c),
        timeline: c.timeline,
        originalSound: c.draft.originalSound ?? 'keep',
        music: c.draft.music && c.draft.music.id !== 'none' ? { id: c.draft.music.id, volume: MUSIC_VOLUMES.find((v) => v.id === c.draft.music?.volume)?.value ?? 0.55 } : undefined,
        onProgress: (r) => setProgress(Math.max(0, Math.min(1, r))),
        isCancelled: () => cancelled.current,
      });
      running.current = false;
      if (cancelled.current || outcome.status === 'cancelled') return;
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
          <FooterButtons label="새 영상 생성" onPress={() => ctx.go({ step: 'generate' })} secondaryLabel="편집으로" onSecondary={() => ctx.go({ step: 'compose' })} />
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
  // 손가락으로 누르는 자리는 최소 크기를 보장한다.
  touch: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: 'center' },
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
  styleRows: { gap: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.item, paddingHorizontal: 14, minHeight: 56 },
  settingText: { flex: 1, gap: 2, paddingVertical: 8 },
  settingChevron: { fontSize: 22, color: colors.textMuted, paddingLeft: 8 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 430, backgroundColor: colors.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: 16, paddingHorizontal: GUTTER },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetBody: { paddingBottom: 24, gap: 10 },
  titlePick: { gap: 8 },
  titleDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.item, paddingLeft: 12, paddingRight: 4, minHeight: 48 },
  titleDayLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub, width: 40 },
  titleDayInput: { flex: 1, minHeight: 36, paddingVertical: 4, fontSize: 14 },
  titleSecRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleSecChip: { flex: 1, paddingHorizontal: 0, minHeight: 34 },
  titleStrip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  titleItem: { alignItems: 'center', gap: 5 },
  titleThumb: { borderRadius: 12, overflow: 'hidden', borderWidth: 2.5, borderColor: 'transparent' },
  titleThumbOn: { borderColor: colors.primary },
  titleLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  titleLabelOn: { fontWeight: '800', color: colors.primary },
  musicBox: { gap: 8, marginTop: 6 },
  musicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.item, borderWidth: 1.5, borderColor: 'transparent' },
  musicRowOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  musicMain: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  musicName: { fontSize: 14, fontWeight: '700', color: colors.text },
  musicNameOn: { color: colors.primary },
  musicPlay: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  musicPlayText: { fontSize: 16, color: colors.textSub },
  musicTabs: { gap: 8, paddingVertical: 2 },
  musicTab: { minHeight: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  musicTabSoft: { borderColor: colors.surfaceStrong },
  musicTabOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  musicTabText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  musicTabTextOn: { color: colors.primary },
  soundChip: { flex: 1 },
  musicTitle: { marginTop: 8 },
  musicVol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  musicVolChip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  musicVolChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  musicVolText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  musicVolTextOn: { color: colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, marginTop: 4 },
  toggleText: { flex: 1, gap: 2 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { fontSize: 18, color: colors.primary },
  time: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden', justifyContent: 'center' },
  barFill: { height: 8, backgroundColor: colors.primary },
  // 날짜가 둘 이상일 때만 나오는 이동 버튼. 눌리는 것으로 보이게 칩으로 둔다.
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  markChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.item, backgroundColor: colors.surface },
  mark: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  format: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  problem: { fontSize: 13, fontWeight: '700', color: colors.danger, textAlign: 'center' },
  genBody: { flex: 1, justifyContent: 'center', gap: 16 },
  genTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  genSub: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  genBtn: { alignSelf: 'stretch' },
  pct: { fontSize: 18, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  saved: { fontSize: 13, fontWeight: '800', color: colors.primary, textAlign: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.item, paddingVertical: 14 },
});
