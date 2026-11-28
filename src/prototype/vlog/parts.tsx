import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeImage } from '../../demo/SafeImage';
import { useNaturalSize } from './imageSize';
import { AppHeader } from '../components/AppHeader';
import { ActionButton } from '../components/FormParts';
import { ScreenFrame } from '../components/ScreenFrame';
import { Toast } from '../components/Toast';
import type { CellLook, Rect } from '../mock/tripData';
import { colors, GUTTER, radius } from '../styles/tokens';
import {
  ANIM_DONE,
  ANIM_SEC,
  ASPECTS,
  animAt,
  aspectOf,
  CAPTION_Y,
  OVERLAY_SIDE,
  TITLE_DATE_PX,
  TITLE_DATE_Y,
  TITLE_NAME_PX,
  TITLE_NAME_Y,
  PLACE_LABEL_PX,
  PLACE_LABEL_Y,
  captionAt,
  captionBgColor,
  captionLayout,
  filterOf,
  fontStyleOf,
  motionAt,
  placeLabelOpacity,
  stickerXY,
  titleStyleOf,
  type TitleStylePreset,
  stickerPx,
  type AnimFrame,
  type CaptionStyle,
  type MotionFrame,
  type PlaceLabel,
  type Sticker,
  type TimelineClip,
  type TimelineScene,
  type AspectId,
  type TransitionId,
} from './model';



interface FrameProps {
  title: string;
  /** 5단계 중 몇 번째인지, 뒤에 붙는 설명 */
  step: number;
  stepLabel: string;
  context?: string;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
  /** 하단 고정 영역(버튼들) */
  footer?: ReactNode;
  toast?: string | null;
  scroll?: boolean;
  /** 키보드가 올라왔을 때처럼 세로가 모자랄 때, 진행 표시를 숨기고 여백을 줄인다. */
  compact?: boolean;
}

/** 브이로그 제작 화면 공통 틀: 뒤로가기·제목·닫기 + 단계 표시 + 본문 + 하단 버튼. */
export function StepFrame({ title, step, stepLabel, context, onBack, onClose, children, footer, toast, scroll = true, compact = false }: FrameProps) {
  return (
    <ScreenFrame>
      <AppHeader
        title={title}
        onBack={onBack}
        right={
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        }
      />
      {compact ? null : (
        <View style={styles.progressWrap}>
          <Text style={styles.stepText}>
            {step} / 5 {stepLabel}
            {context ? ` · ${context}` : ''}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(step / 5) * 100}%` }]} />
          </View>
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill1, compact && styles.contentTight]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, compact && styles.footerTight]}>{footer}</View> : null}
      <Toast message={toast ?? null} bottom={footer ? 110 : 40} />
    </ScreenFrame>
  );
}

/** 하단 주 버튼 + 선택적 보조 버튼 */
export function FooterButtons({
  label,
  onPress,
  disabled,
  secondaryLabel,
  onSecondary,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.footerStack}>
      {secondaryLabel && onSecondary ? <ActionButton label={secondaryLabel} tone="secondary" onPress={onSecondary} /> : null}
      <ActionButton label={label} onPress={onPress} disabled={disabled} loading={loading} />
    </View>
  );
}

export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      {sub ? <Text style={styles.headingSub}>{sub}</Text> : null}
    </View>
  );
}

/** 안내가 필요한 빈 상태·오류 상태 카드 */
export function StateCard({ title, body, actions }: { title: string; body?: string; actions?: ReactNode }) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      {body ? <Text style={styles.stateBody}>{body}</Text> : null}
      {actions ? <View style={styles.stateActions}>{actions}</View> : null}
    </View>
  );
}

// ---------- 장면 그리기 ----------

interface CanvasProps {
  scene: TimelineScene;
  width: number;
  /** 장면 안에서 흐른 시간(초). 이어 재생에서 어느 기록을 보여 줄지 정한다. */
  localSec?: number;
  /** 이어 재생에서 보여 줄 기록 번호를 직접 지정(편집 화면) */
  clipIndex?: number;
  /**
   * 사진 움직임·자막 등장을 localSec 에 맞춰 보여 줄지.
   * 끄면(기본) 멈춘 그림을 보여 준다 — 편집 화면·완성본 카드가 그렇다.
   */
  animate?: boolean;
  /** 동영상 칸을 재생할지(기본 재생). 미리보기를 멈추면 영상도 멈춘다. */
  videoPlaying?: boolean;
  /** 분할 장면에서 고른 칸(편집 화면). 테두리로 표시한다. */
  selectedCell?: number;
  /** 분할 장면의 칸을 눌렀을 때(편집 화면) */
  onSelectCell?: (index: number) => void;
}

/**
 * 한 칸(또는 이어 재생 장면)의 사진·동영상 커버를 화면 틀에 놓는다: 직접 자른 영역, 채우기/맞춤, 여백, 색감 효과.
 * 장면 미리보기와 편집 화면이 같은 그림을 쓴다.
 */
/**
 * 실제 동영상 파일이 있는 칸의 재생 화면. 소리 없이 반복해서 재생한다(미리보기).
 * 쓰는 구간의 시작 위치와 재생 속도를 따른다. playing 이 false 면 멈춘다.
 */
function ClipVideo({ clip, playing, fit }: { clip: TimelineClip; playing: boolean; fit: 'fill' | 'contain' }) {
  const player = useVideoPlayer(clip.videoSource as number, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = clip.speed || 1;
    if (clip.startSec > 0) p.currentTime = clip.startSec;
  });
  useEffect(() => {
    try {
      if (playing) player.play();
      else player.pause();
    } catch {
      // 재생기가 정리된 뒤에는 무시한다.
    }
  }, [player, playing]);
  return <VideoView player={player} nativeControls={false} contentFit={fit === 'contain' ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

export function ClipLayer({ clip, width, height, motion, videoPlaying = true }: { clip: TimelineClip; width: number; height: number; motion?: MotionFrame; videoPlaying?: boolean }) {
  const f = clip.frame;
  const css = filterOf(clip.filter).css;
  const contain = f.fit === 'contain';
  const nat = useNaturalSize(f.crop ? clip.image : undefined);
  let photo;
  if (clip.kind === 'video' && clip.videoSource !== undefined) {
    // 실제 동영상 파일이 있으면 표지 사진 대신 영상을 재생한다.
    photo = <ClipVideo clip={clip} playing={videoPlaying} fit={f.fit} />;
  } else if (f.crop && nat.known) {
    // 자른 영역(rw×rh 화소)이 틀에 채우기/맞춤으로 들어가도록 사진 전체를 키우고 영역 중심을 틀 가운데에 둔다.
    const rw = f.crop.w * nat.w;
    const rh = f.crop.h * nat.h;
    const s = contain ? Math.min(width / rw, height / rh) : Math.max(width / rw, height / rh);
    const iw = nat.w * s;
    const ih = nat.h * s;
    photo = (
      <View style={{ position: 'absolute', width: iw, height: ih, left: width / 2 - (f.crop.x + f.crop.w / 2) * iw, top: height / 2 - (f.crop.y + f.crop.h / 2) * ih }}>
        <SafeImage source={clip.image} resizeMode="stretch" style={StyleSheet.absoluteFill} compact />
      </View>
    );
  } else {
    photo = <SafeImage source={clip.image} resizeMode={contain ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} compact />;
  }
  // 움직임: 먼저 옮기고(원래 크기 기준) 그다음 키운다. 미리 키워 둔 만큼만 움직여 빈 곳이 보이지 않는다.
  const moving = motion && (motion.scale !== 1 || motion.tx !== 0 || motion.ty !== 0);
  const move = moving
    ? { transform: [{ translateX: motion.tx * width }, { translateY: motion.ty * height }, { scale: motion.scale }] }
    : undefined;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, contain && { backgroundColor: f.bg === 'white' ? '#FFFFFF' : '#000000' }]}>
      {contain && f.bg === 'blur' ? (
        <View style={[StyleSheet.absoluteFill, { filter: 'blur(14px) brightness(0.8)', transform: [{ scale: 1.2 }] }]}>
          <SafeImage source={clip.image} style={StyleSheet.absoluteFill} compact />
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, move]}>
        <View style={[StyleSheet.absoluteFill, css ? { filter: css } : undefined]}>{photo}</View>
      </View>
    </View>
  );
}

/** 이어 재생 장면에서 index 번째 사진·동영상이 시작하는 시각과 길이(초) */
export function clipSpan(scene: TimelineScene, index: number): { start: number; sec: number } {
  let start = 0;
  for (let i = 0; i < index; i += 1) start += scene.clips[i]?.seconds ?? 0;
  return { start, sec: scene.clips[index]?.seconds ?? 0 };
}

export const sceneClipAt = (scene: TimelineScene, localSec: number): number => {
  if (scene.mode !== 'sequence') return 0;
  let acc = 0;
  for (let i = 0; i < scene.clips.length; i += 1) {
    acc += scene.clips[i].seconds;
    if (localSec < acc) return i;
  }
  return Math.max(0, scene.clips.length - 1);
};

/**
 * 제목 화면(날짜 제목·끝 화면) 한 장. 모양(preset.id)마다 배치와 장식이 다르다.
 * 크기는 출력 화면(가로 1080 기준 px)으로 정한 뒤 shrink 만큼 줄여 그린다.
 * 장면 미리보기와 스타일 고르기의 작은 그림이 같은 코드를 쓴다.
 */
export function TitleCard({
  preset,
  date,
  name,
  image,
  day,
  weekday,
  width,
  height,
  shrink,
  minFont = 0,
}: {
  preset: TitleStylePreset;
  date?: string;
  name: string;
  image?: string | number;
  day?: number;
  weekday?: string;
  width: number;
  height: number;
  /** 출력 화면 대비 줄인 비율 */
  shrink: number;
  /** 작은 그림에서 글자가 사라지지 않게 하는 최소 글자 크기 */
  minFont?: number;
}) {
  const fs = (px: number) => Math.max(minFont, px * shrink);
  const { bg, accent, text, sub } = preset;
  const dayLabel = day ? `DAY ${day}` : undefined;
  const dayNo = day ? String(day).padStart(2, '0') : undefined;
  const root = [styles.canvas, { width, height, backgroundColor: bg }];
  const T = (style: object, children: ReactNode, lines = 3) => (
    <Text allowFontScaling={false} numberOfLines={lines} style={[{ position: 'absolute', left: '6%', right: '6%', textAlign: 'center' as const }, style]}>
      {children}
    </Text>
  );
  const Photo = ({ dim }: { dim?: number }) =>
    image !== undefined ? (
      <>
        <SafeImage source={image} style={StyleSheet.absoluteFill} compact />
        {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} /> : null}
      </>
    ) : null;

  switch (preset.id) {
    case 'frame':
      // 겹 테두리 액자: 위에 DAY, 가운데 제목, 아래에 날짜
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: '6%', right: '6%', top: '4.5%', bottom: '4.5%', borderWidth: Math.max(1, 5 * shrink), borderColor: accent }} />
          <View style={{ position: 'absolute', left: '8%', right: '8%', top: '6%', bottom: '6%', borderWidth: Math.max(0.5, 1.5 * shrink), borderColor: accent }} />
          {dayLabel ? T({ top: '24%', fontSize: fs(40), letterSpacing: fs(8), fontWeight: '700', color: accent }, dayLabel, 1) : null}
          {T({ top: '42%', fontSize: fs(70), fontWeight: '800', color: text, left: '12%', right: '12%' }, name)}
          {date ? (
            <>
              <View style={{ position: 'absolute', top: '68%', left: '44%', width: '12%', height: Math.max(1, 3 * shrink), backgroundColor: accent }} />
              {T({ top: '71%', fontSize: fs(38), letterSpacing: fs(4), color: sub, fontWeight: '600' }, `${date}${weekday ? ` ${weekday}` : ''}`, 1)}
            </>
          ) : null}
        </View>
      );
    case 'daynum':
      // 아주 큰 날짜 번호를 바탕 장식으로
      return (
        <View style={root}>
          {dayNo ? (
            <Text allowFontScaling={false} style={{ position: 'absolute', left: 0, right: 0, top: '12%', textAlign: 'center', fontSize: fs(560), fontWeight: '900', color: accent, opacity: 0.2, lineHeight: fs(600) }}>
              {dayNo}
            </Text>
          ) : null}
          {dayLabel ? T({ top: '46%', fontSize: fs(42), letterSpacing: fs(10), fontWeight: '800', color: accent }, dayLabel, 1) : null}
          {T({ top: '52%', fontSize: fs(72), fontWeight: '800', color: text, left: '10%', right: '10%' }, name)}
          {date ? T({ top: '70%', fontSize: fs(38), color: sub, fontWeight: '600' }, `${date}${weekday ? ` · ${weekday}` : ''}`, 1) : null}
        </View>
      );
    case 'polaroid': {
      // 어두운 바탕에 살짝 기운 폴라로이드: 그날의 사진 + 아래 흰 칸에 제목과 날짜
      const pad = width * 0.045;
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: '12%', right: '12%', top: '12%', bottom: '14%', backgroundColor: '#FFFFFF', transform: [{ rotate: '-3deg' }], boxShadow: '0 6px 16px rgba(0,0,0,0.5)' }}>
            <View style={{ position: 'absolute', left: pad, right: pad, top: pad, bottom: '26%', backgroundColor: '#D9D9D9', overflow: 'hidden' }}>
              <Photo />
            </View>
            <Text allowFontScaling={false} numberOfLines={2} style={{ position: 'absolute', left: pad, right: pad, bottom: '11%', textAlign: 'center', fontSize: fs(52), fontWeight: '800', color: text }}>
              {name}
            </Text>
            {date ? (
              <Text allowFontScaling={false} numberOfLines={1} style={{ position: 'absolute', left: pad, right: pad, bottom: '4%', textAlign: 'center', fontSize: fs(30), color: sub, fontWeight: '600' }}>
                {date}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }
    case 'ticket': {
      // 티켓 모양 카드: 위 DAY, 점선, 아래 제목·날짜, 양옆 홈
      const notch = width * 0.07;
      const top = height * 0.3;
      const h = height * 0.4;
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: '9%', right: '9%', top, height: h, backgroundColor: '#FFFFFF', borderRadius: width * 0.04, overflow: 'hidden' }}>
            {dayLabel ? (
              <Text allowFontScaling={false} style={{ position: 'absolute', left: 0, right: 0, top: '14%', textAlign: 'center', fontSize: fs(46), letterSpacing: fs(10), fontWeight: '800', color: accent }}>
                {dayLabel}
              </Text>
            ) : null}
            <View style={{ position: 'absolute', left: '6%', right: '6%', top: '40%', borderTopWidth: Math.max(1, 3 * shrink), borderStyle: 'dashed', borderColor: sub }} />
            <Text allowFontScaling={false} numberOfLines={2} style={{ position: 'absolute', left: '8%', right: '8%', top: '47%', textAlign: 'center', fontSize: fs(58), fontWeight: '800', color: text }}>
              {name}
            </Text>
            {date ? (
              <Text allowFontScaling={false} numberOfLines={1} style={{ position: 'absolute', left: 0, right: 0, bottom: '8%', textAlign: 'center', fontSize: fs(34), color: sub, fontWeight: '600' }}>
                {date}{weekday ? ` ${weekday}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ position: 'absolute', left: width * 0.09 - notch / 2, top: top + h * 0.4 - notch / 2, width: notch, height: notch, borderRadius: notch / 2, backgroundColor: bg }} />
          <View style={{ position: 'absolute', right: width * 0.09 - notch / 2, top: top + h * 0.4 - notch / 2, width: notch, height: notch, borderRadius: notch / 2, backgroundColor: bg }} />
        </View>
      );
    }
    case 'split':
      // 위쪽은 색 블록에 DAY 번호, 아래쪽에 제목과 날짜
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '46%', backgroundColor: accent }} />
          {dayLabel ? T({ top: '12%', fontSize: fs(44), letterSpacing: fs(12), fontWeight: '800', color: 'rgba(255,255,255,0.8)' }, 'DAY', 1) : null}
          {dayNo ? T({ top: '17%', fontSize: fs(230), fontWeight: '900', color: '#FFFFFF', lineHeight: fs(250) }, String(day), 1) : null}
          {T({ top: '56%', fontSize: fs(66), fontWeight: '800', color: text, left: '10%', right: '10%' }, name)}
          {date ? T({ top: '75%', fontSize: fs(38), color: sub, fontWeight: '600' }, `${date}${weekday ? ` ${weekday}` : ''}`, 1) : null}
        </View>
      );
    case 'film': {
      // 필름 띠: 양옆 구멍과 위아래 선
      const holes = 11;
      const hole = (side: 'left' | 'right', i: number) => (
        <View key={`${side}${i}`} style={{ position: 'absolute', [side]: width * 0.035, top: height * (0.06 + (i * 0.88) / holes), width: width * 0.04, height: height * 0.03, borderRadius: 2, backgroundColor: '#2A2A2A' }} />
      );
      return (
        <View style={root}>
          {Array.from({ length: holes }, (_, i) => hole('left', i))}
          {Array.from({ length: holes }, (_, i) => hole('right', i))}
          <View style={{ position: 'absolute', left: '12%', right: '12%', top: '8%', height: Math.max(1, 3 * shrink), backgroundColor: accent }} />
          <View style={{ position: 'absolute', left: '12%', right: '12%', bottom: '8%', height: Math.max(1, 3 * shrink), backgroundColor: accent }} />
          {dayLabel ? T({ top: '38%', fontSize: fs(34), letterSpacing: fs(8), color: sub, fontWeight: '700' }, dayLabel, 1) : null}
          {T({ top: '44%', fontSize: fs(62), fontWeight: '800', color: text, left: '14%', right: '14%' }, name)}
          {date ? T({ top: '62%', fontSize: fs(32), color: sub, fontWeight: '600' }, date, 1) : null}
        </View>
      );
    }
    case 'poster':
      // 사진을 깔고 왼쪽 아래에 큼직한 제목: 잡지 표지 느낌
      return (
        <View style={root}>
          <Photo />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', backgroundColor: 'rgba(0,0,0,0.38)' }} />
          {date ? T({ top: '8%', left: '8%', textAlign: 'left', fontSize: fs(34), letterSpacing: fs(6), fontWeight: '700', color: '#FFFFFF' }, `${dayLabel ? `${dayLabel}  ·  ` : ''}${date}`, 1) : null}
          <View style={{ position: 'absolute', left: '8%', bottom: '24%', width: '14%', height: Math.max(2, 6 * shrink), backgroundColor: '#FFFFFF' }} />
          {T({ bottom: '10%', left: '8%', right: '8%', textAlign: 'left', fontSize: fs(80), fontWeight: '900', color: '#FFFFFF', lineHeight: fs(92) }, name)}
        </View>
      );
    case 'neon': {
      // 어두운 보라 바탕에 빛나는 글씨와 테두리
      const glow = { textShadowColor: text, textShadowRadius: fs(24), textShadowOffset: { width: 0, height: 0 } };
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: '8%', right: '8%', top: '16%', bottom: '16%', borderWidth: Math.max(1, 5 * shrink), borderColor: accent, borderRadius: width * 0.05, boxShadow: `0 0 ${fs(30)}px ${accent}` }} />
          {dayLabel ? T({ top: '34%', fontSize: fs(40), letterSpacing: fs(10), fontWeight: '800', color: accent, textShadowColor: accent, textShadowRadius: fs(18), textShadowOffset: { width: 0, height: 0 } }, dayLabel, 1) : null}
          {T({ top: '44%', fontSize: fs(74), fontWeight: '900', color: text, left: '14%', right: '14%', ...glow }, name)}
          {date ? T({ top: '64%', fontSize: fs(34), color: sub, fontWeight: '600' }, date, 1) : null}
        </View>
      );
    }
    case 'stamp': {
      // 동그란 도장: 안에 DAY·번호·날짜, 아래에 제목
      const d = width * 0.56;
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: (width - d) / 2, top: height * 0.2, width: d, height: d, borderRadius: d / 2, borderWidth: Math.max(2, 9 * shrink), borderColor: accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
            <View style={{ position: 'absolute', left: d * 0.06, right: d * 0.06, top: d * 0.06, bottom: d * 0.06, borderRadius: d / 2, borderWidth: Math.max(1, 3 * shrink), borderColor: accent }} />
            {dayLabel ? <Text allowFontScaling={false} style={{ fontSize: fs(38), letterSpacing: fs(10), fontWeight: '800', color: accent }}>DAY</Text> : null}
            {day ? <Text allowFontScaling={false} style={{ fontSize: fs(190), fontWeight: '900', color: accent, lineHeight: fs(210) }}>{day}</Text> : null}
            {date ? <Text allowFontScaling={false} style={{ fontSize: fs(30), fontWeight: '700', color: accent }}>{date}</Text> : null}
          </View>
          {T({ top: '66%', fontSize: fs(64), fontWeight: '800', color: text, left: '10%', right: '10%' }, name)}
        </View>
      );
    }
    case 'pastel': {
      // 파스텔 바탕에 큰 동그라미 장식
      const big = width * 0.8;
      const small = width * 0.42;
      return (
        <View style={root}>
          <View style={{ position: 'absolute', right: -big * 0.28, top: -big * 0.2, width: big, height: big, borderRadius: big / 2, backgroundColor: '#FFC9DC' }} />
          <View style={{ position: 'absolute', left: -small * 0.25, bottom: height * 0.06, width: small, height: small, borderRadius: small / 2, backgroundColor: '#FFE0B8' }} />
          {dayLabel ? T({ top: '38%', fontSize: fs(40), letterSpacing: fs(10), fontWeight: '800', color: accent }, dayLabel, 1) : null}
          {T({ top: '45%', fontSize: fs(72), fontWeight: '900', color: text, left: '10%', right: '10%' }, name)}
          {date ? T({ top: '64%', fontSize: fs(36), color: sub, fontWeight: '600' }, `${date}${weekday ? ` ${weekday}` : ''}`, 1) : null}
        </View>
      );
    }
    case 'paper':
      // 왼쪽 정렬 심플: 위에 짧은 선, 제목, 날짜
      return (
        <View style={root}>
          <View style={{ position: 'absolute', left: '9%', top: '38%', width: '14%', height: Math.max(2, 6 * shrink), backgroundColor: text }} />
          {T({ top: '41%', left: '9%', right: '9%', textAlign: 'left', fontSize: fs(70), fontWeight: '900', color: text }, name)}
          {date ? T({ top: '60%', left: '9%', right: '9%', textAlign: 'left', fontSize: fs(34), color: sub, fontWeight: '600' }, `${date}${weekday ? `  ${weekday}` : ''}`, 1) : null}
        </View>
      );
    default:
      // 기본: 가운데 작은 날짜와 제목
      return (
        <View style={root}>
          {date ? T({ top: `${TITLE_DATE_Y * 100}%`, fontSize: fs(TITLE_DATE_PX), fontWeight: '800', color: accent }, date, 1) : null}
          {T({ top: `${TITLE_NAME_Y * 100}%`, fontSize: fs(TITLE_NAME_PX), fontWeight: '800', color: text, left: '5%', right: '5%' }, name)}
        </View>
      );
  }
}

/**
 * 한 장면을 세로 9:16 화면으로 그린다. 미리보기·장면 편집·완성본 카드가 같은 그림을 쓴다.
 * 동영상은 커버 프레임으로 보여 준다(실제 재생은 최종 렌더링의 몫).
 */
export function SceneCanvas({ scene, width, localSec = 0, clipIndex, animate = false, videoPlaying = true, selectedCell, onSelectCell }: CanvasProps) {
  const height = width / aspectOf(scene.aspect).ratio;
  if (scene.kind === 'title') {
    // 출력 화면을 이 크기로 줄여 그린다. 글자 크기·높이를 서버 렌더러와 같은 값으로 둔다.
    // 고른 글씨체를 쓰지 않는 것은 서버가 제목 화면을 늘 기본 고딕으로 그리기 때문이다.
    return (
      <TitleCard
        preset={titleStyleOf(scene.titleStyle)}
        date={scene.titleDate}
        name={scene.titleText ?? ''}
        image={scene.titleImage}
        day={scene.titleDay}
        weekday={scene.titleWeekday}
        width={width}
        height={height}
        shrink={width / aspectOf(scene.aspect).width}
      />
    );
  }
  const index = clipIndex ?? sceneClipAt(scene, localSec);
  const clip: TimelineClip | undefined = scene.clips[index];
  // 자막은 여러 줄이 각자 구간을 갖는다. 재생 중이면 그 시각의 줄을, 멈춘 그림에서는 첫 줄을 보여 준다.
  const captionLines = scene.mode === 'split' ? scene.captions : (clip?.captions ?? []);
  const caption = animate ? captionAt(captionLines, scene.mode === 'split' ? localSec : localSec - clipSpan(scene, index).start) : (captionLines[0]?.text ?? '');
  const cap = scene.captionStyle;
  const label = scene.placeLabel;

  // 움직임: 멈춘 그림에서는 가운데(0.5)를 보여 준다. 한쪽 끝은 사진이 치우쳐 보여 오해를 준다.
  const span = scene.mode === 'split' ? { start: 0, sec: scene.seconds } : clipSpan(scene, index);
  const clipP = animate ? (span.sec > 0 ? (localSec - span.start) / span.sec : 0) : 0.5;
  // 사진만 움직인다(동영상은 이미 움직인다).
  const motionFor = (c: TimelineClip | undefined): MotionFrame | undefined =>
    c && c.kind === 'photo' && scene.motion !== 'none' ? motionAt(scene.motion, clipP) : undefined;

  const capAnim: AnimFrame = animate ? animAt(cap.anim, localSec / ANIM_SEC) : ANIM_DONE;
  const labelAnim: AnimFrame = animate ? animAt(label.anim, localSec / ANIM_SEC) : ANIM_DONE;
  const labelFade = animate ? placeLabelOpacity(label, localSec, scene.seconds) : 1;

  // 자막과 라벨은 각자 정해진 높이에 따로 놓는다(서버 렌더러와 같은 방식·같은 값).
  // 한 칸에 쌓아 올리면 위아래 순서가 서버와 뒤바뀐다.
  const outWidth = aspectOf(scene.aspect).width;
  // 스티커: 이어 재생은 지금 보이는 사진의 것, 분할은 장면 전체의 것.
  const stickers = scene.mode === 'split' ? scene.stickers : (clip?.stickers ?? []);
  const captionBox = caption ? <CaptionBox text={caption} style={cap} width={width} outWidth={outWidth} anim={capAnim} /> : null;
  const labelBox =
    scene.placeText || scene.dateText ? (
      <PlaceLabelCard place={scene.placeText} date={scene.dateText} label={label} width={width} outWidth={outWidth} anim={labelAnim} fade={labelFade} />
    ) : null;
  return (
    <View style={[styles.canvas, { width, height }, scene.mode === 'split' && scene.template?.bg ? { backgroundColor: scene.template.bg } : null]}>
      {scene.mode === 'split' && scene.template ? (

        scene.template.rects.map((r: Rect, i) => {
          const c = scene.clips[i];
          const cellW = width * r[2];
          const cellH = height * r[3];
          const selected = selectedCell === i;
          const rot = scene.template?.rots?.[i];
          const look = scene.template?.look;
          const inset = cellInset(look, cellW);
          const cellStyle = {
            position: 'absolute' as const,
            left: `${r[0] * 100}%` as const,
            top: `${r[1] * 100}%` as const,
            width: `${r[2] * 100}%` as const,
            height: `${r[3] * 100}%` as const,
            padding: look ? 0 : 1,
            ...(rot ? { transform: [{ rotate: `${rot}deg` }] } : null),
          };
          const cellBody = (
            <>
              {look ? <View style={[StyleSheet.absoluteFill, styles.cellFrame, look === 'card' && styles.cellFrameCard]} /> : null}
              <View
                style={[
                  look ? { position: 'absolute', left: inset.l, top: inset.t, right: inset.r, bottom: inset.b } : StyleSheet.absoluteFill,
                  look ? null : { margin: 1 },
                  { overflow: 'hidden' },
                  selected && styles.cellSelected,
                ]}
              >
                {c ? <ClipLayer clip={c} width={cellW - inset.l - inset.r} height={cellH - inset.t - inset.b} motion={motionFor(c)} videoPlaying={videoPlaying} /> : null}
              </View>
            </>
          );
          // 칸 선택을 쓰지 않는 곳(미리보기)에서는 button 이 아닌 View 로 그린다.
          // 비활성 button 이 칸마다 클릭을 막고, 바깥 재생 버튼 안에 button 이 중첩되는 문제가 있었다.
          return onSelectCell ? (
            <Pressable
              key={i}
              onPress={() => onSelectCell(i)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}번 칸 선택`}
              style={cellStyle}
            >
              {cellBody}
            </Pressable>
          ) : (
            <View key={i} style={cellStyle}>
              {cellBody}
            </View>
          );
        })
      ) : clip ? (
        <>
          <ClipLayer clip={clip} width={width} height={height} motion={motionFor(clip)} videoPlaying={videoPlaying} />
        </>
      ) : null}
      {stickers.map((st, i) => (
        <StickerMark key={`${st.emoji}-${st.spot}-${i}`} sticker={st} width={width} height={height} outWidth={outWidth} />
      ))}
      {labelBox ? (
        <View style={[styles.capZone, { top: `${PLACE_LABEL_Y[label.pos] * 100}%` }]} pointerEvents="none">
          {labelBox}
        </View>
      ) : null}
      {captionBox ? (
        cap.xy ? (
          // 직접 옮긴 자리. 가로도 옮길 수 있으므로 가운데 정렬 대신 좌표로 놓는다.
          // 양옆 빈칸의 비율로 가로 자리를 잡는다. 글자 크기를 재지 않아도 되고,
          // 끝으로 밀어도 자막이 화면 밖으로 넘치지 않는다.
          <View style={[styles.capFreeRow, { top: `${cap.xy.y * 100}%` }]} pointerEvents="none">
            <View style={{ flex: Math.max(0.0001, cap.xy.x) }} />
            {captionBox}
            <View style={{ flex: Math.max(0.0001, 1 - cap.xy.x) }} />
          </View>
        ) : CAPTION_Y[cap.pos] === 'center' ? (
          <View style={[styles.capZone, styles.capCenter]} pointerEvents="none">
            {captionBox}
          </View>
        ) : (
          <View style={[styles.capZone, { top: `${(CAPTION_Y[cap.pos] as number) * 100}%` }]} pointerEvents="none">
            {captionBox}
          </View>
        )
      ) : null}
    </View>
  );
}

/**
 * 자막 한 덩이. 글자 크기는 출력 화면 폭(outWidth)에 대한 비율로 줄이므로
 * 작은 미리보기와 1080p 출력에서 같은 크기로 보인다.
 */
function CaptionBox({ text, style, width, outWidth, anim = ANIM_DONE }: { text: string; style: CaptionStyle; width: number; outWidth: number; anim?: AnimFrame }) {
  const l = captionLayout(style, width, outWidth);
  return (
    <View
      style={[
        { borderRadius: l.radius, paddingVertical: l.padV, paddingHorizontal: l.padH, maxWidth: '100%' },
        l.bgColor ? { backgroundColor: l.bgColor } : null,
        { opacity: anim.opacity, transform: [{ translateY: anim.ty * l.fontSize }, { scale: anim.scale }] },
      ]}
    >
      <Text
        numberOfLines={3}
        style={[
          { fontSize: l.fontSize, lineHeight: l.lineHeight, color: l.color, textAlign: 'center' },
          fontStyleOf(style.fontId),
          l.shadow ? styles.capShadow : null,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * 장소(와 날짜) 라벨. 자막과 섞이지 않게 따로 그리고, 핀·배경·등장을 따로 고른다.
 * 크기는 화면 짧은 쪽 기준이라 미리보기와 1080p 출력에서 같은 비율로 보인다.
 */
function PlaceLabelCard({
  place,
  date,
  label,
  width,
  outWidth,
  anim = ANIM_DONE,
  fade = 1,
}: {
  place?: string;
  date?: string;
  label: PlaceLabel;
  width: number;
  outWidth: number;
  anim?: AnimFrame;
  fade?: number;
}) {
  const fontSize = Math.max(5, PLACE_LABEL_PX * (width / outWidth));
  const bgColor = captionBgColor(label.bg);
  const dark = label.bg === 'white';
  const text = [label.pin && place ? `📍 ${place}` : place, date].filter(Boolean).join('  ');
  if (!text) return null;
  return (
    <View
      style={[
        {
          borderRadius: Math.max(4, fontSize * 0.7),
          paddingVertical: bgColor ? Math.max(2, fontSize * 0.28) : 0,
          paddingHorizontal: bgColor ? Math.max(4, fontSize * 0.6) : 0,
          maxWidth: '100%',
          opacity: anim.opacity * fade,
          transform: [{ translateY: anim.ty * fontSize }, { scale: anim.scale }],
        },
        bgColor ? { backgroundColor: bgColor } : null,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          { fontSize, lineHeight: fontSize * 1.3, fontWeight: '700', color: dark ? '#191F28' : colors.onPrimary },
          bgColor ? null : styles.capShadow,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * 장면 위에 얹는 그림 문자 하나.
 * 자리는 비율 좌표, 크기는 출력 화면 기준 px 를 줄여 쓴다(자막과 같은 방식).
 */
function StickerMark({ sticker, width, height, outWidth }: { sticker: Sticker; width: number; height: number; outWidth: number }) {
  const { x, y } = stickerXY(sticker);
  const size = Math.max(10, stickerPx(sticker.size, sticker.scale) * (width / outWidth));
  return (
    <Text
      allowFontScaling={false}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * width - size / 2,
        top: y * height - size / 2,
        width: size,
        height: size,
        fontSize: size * 0.82,
        lineHeight: size,
        textAlign: 'center',
      }}
    >
      {sticker.emoji}
    </Text>
  );
}

interface StageProps {
  scene: TimelineScene;
  /** 바로 앞 장면(전환 중일 때만 필요) */
  prev?: TimelineScene;
  width: number;
  /** 장면 안에서 흐른 시간(초) */
  localSec: number;
  transition: TransitionId;
  /** 전환 진행도 0~1. 전환 중이 아니면 undefined */
  progress?: number;
  /** 재생 중일 때만 사진 움직임·자막 등장을 보여 준다. */
  animate?: boolean;
  /** 동영상 칸을 재생할지(기본 재생) */
  videoPlaying?: boolean;
}

/**
 * 미리보기 무대: 장면을 그리고, 장면이 바뀌는 순간에는 전환 효과를 보여 준다.
 * 들어오는 장면이 앞 장면 위에 얹히며 페이드(투명도)·슬라이드(옆에서 밀기)·확대(커지며 나타남)로 바뀐다.
 */
export function TransitionStage({ scene, prev, width, localSec, transition, progress, animate = false, videoPlaying = true }: StageProps) {
  const height = width / aspectOf(scene.aspect).ratio;
  // prev 가 없으면(첫 장면 예시) 어두운 바탕 위로 장면이 들어온다.
  const active = transition !== 'none' && progress !== undefined && progress < 1;
  if (!active || progress === undefined) return <SceneCanvas scene={scene} width={width} localSec={localSec} animate={animate} videoPlaying={videoPlaying} />;
  const p = progress;
  // 와이프·원형은 다음 장면을 일부 영역만 보이게 잘라 낸다(안쪽 그림은 제자리에 고정).
  if ((transition === 'wipe' || transition === 'iris') && p > 0) {
    const d = p * Math.hypot(width, height);
    const box =
      transition === 'wipe'
        ? { left: 0, top: 0, width: p * width, height, borderRadius: 0 }
        : { left: (width - d) / 2, top: (height - d) / 2, width: d, height: d, borderRadius: d / 2 };
    return (
      <View style={{ width, height, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.ink }}>
        {prev ? (
          <View style={StyleSheet.absoluteFill}>
            <SceneCanvas scene={prev} width={width} localSec={prev.seconds} animate={animate} videoPlaying={videoPlaying} />
          </View>
        ) : null}
        <View style={[{ position: 'absolute', overflow: 'hidden' }, box]}>
          <View style={{ position: 'absolute', left: -box.left, top: -box.top, width, height }}>
            <SceneCanvas scene={scene} width={width} localSec={localSec} animate={animate} videoPlaying={videoPlaying} />
          </View>
        </View>
      </View>
    );
  }
  // 흰 번쩍·검게는 가운데에서 화면을 덮는 색이 가장 진하고, 그 순간 앞 장면에서 다음 장면으로 넘어간다.
  const veil = transition === 'flash' ? '#FFFFFF' : transition === 'dip' ? '#000000' : undefined;
  const incoming = veil
    ? { opacity: p < 0.5 ? 0 : 1 }
    : transition === 'fade'
      ? { opacity: p }
      : transition === 'slide'
        ? { transform: [{ translateX: (1 - p) * width }] }
        : transition === 'slideUp'
          ? { transform: [{ translateY: (1 - p) * height }] }
          : transition === 'zoomOut'
            ? { opacity: p, transform: [{ scale: 1.35 - 0.35 * p }] }
            : transition === 'blur'
              ? { opacity: p, filter: `blur(${Math.round((1 - p) * 18)}px)` }
              : transition === 'spin'
                ? { opacity: p, transform: [{ rotate: `${-30 * (1 - p)}deg` }, { scale: 0.5 + 0.5 * p }] }
                : transition === 'pop'
                  ? // 살짝 지나쳤다가 돌아오는 튕김(1.08배까지 커졌다 1배로)
                    { opacity: Math.min(1, p * 2), transform: [{ scale: p < 0.7 ? 0.5 + (p / 0.7) * 0.58 : 1.08 - 0.08 * ((p - 0.7) / 0.3) }] }
                  : { opacity: p, transform: [{ scale: 0.7 + 0.3 * p }] };
  const outgoing =
    transition === 'slide'
      ? { transform: [{ translateX: -p * width * 0.3 }] }
      : transition === 'slideUp'
        ? { transform: [{ translateY: -p * height * 0.3 }] }
        : undefined;
  return (
    <View style={{ width, height, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.ink }}>
      {prev ? (
        <View style={[StyleSheet.absoluteFill, outgoing]}>
          <SceneCanvas scene={prev} width={width} localSec={prev.seconds} animate={animate} videoPlaying={videoPlaying} />
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, incoming]}>
        <SceneCanvas scene={scene} width={width} localSec={localSec} animate={animate} videoPlaying={videoPlaying} />
      </View>
      {veil ? <View style={[StyleSheet.absoluteFill, { backgroundColor: veil, opacity: 1 - Math.abs(p - 0.5) * 2 }]} pointerEvents="none" /> : null}
    </View>
  );
}

/** 화면 비율(세로/가로) 선택. 템플릿 배치가 비율에 따라 달라지므로 템플릿을 고르기 전에 정한다. */
export function AspectPicker({ value, onChange, compact }: { value?: AspectId; onChange: (id: AspectId) => void; compact?: boolean }) {
  const current = aspectOf(value).id;
  return (
    <View style={styles.aspectBox}>
      {compact ? null : <Text style={styles.aspectTitle}>화면 비율</Text>}
      <View style={styles.aspectRow}>
        {ASPECTS.map((a) => {
          const on = current === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => onChange(a.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.aspectChip, compact && styles.aspectChipCompact, on && styles.aspectChipOn]}
            >
              <View style={[styles.aspectIcon, a.id === 'landscape' ? styles.aspectIconWide : styles.aspectIconTall, on && styles.aspectIconOn]} />
              <Text style={[styles.aspectLabel, on && styles.aspectLabelOn]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 템플릿 모양대로 이미지를 채워 보여 주는 작은 카드 그림(템플릿 선택 화면) */
export function LayoutThumb({
  rects,
  images,
  width,
  ratio = 9 / 16,
  rots,
  look,
  bg,
}: {
  rects: Rect[];
  images: (string | number)[];
  width: number;
  ratio?: number;
  rots?: number[];
  look?: CellLook;
  bg?: string;
}) {
  const height = width / ratio;
  return (
    <View style={[styles.canvas, { width, height }, bg ? { backgroundColor: bg } : null]}>
      {rects.map((r, i) => {
        const inset = cellInset(look, width * r[2]);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${r[0] * 100}%`,
              top: `${r[1] * 100}%`,
              width: `${r[2] * 100}%`,
              height: `${r[3] * 100}%`,
              padding: look ? 0 : 1,
              ...(rots?.[i] ? { transform: [{ rotate: `${rots[i]}deg` }] } : null),
            }}
          >
            {look ? <View style={[StyleSheet.absoluteFill, styles.cellFrame, look === 'card' && styles.cellFrameCard]} /> : null}
            <View style={look ? { position: 'absolute', left: inset.l, top: inset.t, right: inset.r, bottom: inset.b, overflow: 'hidden' } : StyleSheet.absoluteFill}>
              {images[i] !== undefined ? <SafeImage source={images[i]} style={StyleSheet.absoluteFill} compact /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** 칸 테두리 모양에 따라 사진이 놓일 안쪽 여백(px). 폴라로이드는 아래가 넓다. */
function cellInset(look: CellLook | undefined, cellW: number) {
  if (!look) return { l: 1, t: 1, r: 1, b: 1 };
  const p = Math.max(2, cellW * 0.05);
  return look === 'polaroid' ? { l: p, t: p, r: p, b: p * 3.4 } : { l: p * 0.6, t: p * 0.6, r: p * 0.6, b: p * 0.6 };
}

const styles = StyleSheet.create({
  cellFrame: { backgroundColor: '#FFFFFF', borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' },
  cellFrameCard: { borderRadius: 6 },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  closeText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  progressWrap: { paddingHorizontal: GUTTER, gap: 6, paddingBottom: 6 },
  stepText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.primary },
  fill1: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 24, gap: 12 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14 },
  footerStack: { gap: 8 },
  heading: { gap: 4, marginBottom: 2 },
  headingTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headingSub: { fontSize: 13, color: colors.textSub },
  state: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 20, gap: 8, alignItems: 'center' },
  stateTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
  stateBody: { fontSize: 13, lineHeight: 19, color: colors.textSub, textAlign: 'center' },
  stateActions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  aspectBox: { gap: 8 },
  aspectTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  aspectRow: { flexDirection: 'row', gap: 8 },
  aspectChip: { flex: 1, minHeight: 56, borderRadius: radius.item, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  aspectChipCompact: { minHeight: 44 },
  aspectChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  aspectIcon: { borderWidth: 2, borderColor: colors.textMuted, borderRadius: 3 },
  aspectIconTall: { width: 12, height: 20 },
  aspectIconWide: { width: 22, height: 13 },
  aspectIconOn: { borderColor: colors.primary },
  aspectLabel: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  aspectLabelOn: { color: colors.primary },
  cellSelected: { borderWidth: 2, borderColor: colors.primary },
  canvas: { backgroundColor: colors.surfaceStrong, borderRadius: 10, overflow: 'hidden' },
  // 바탕색은 서버가 쓰는 #FDEDEB 와 같은 값이다(colors.primarySoft).
  titleCanvas: { backgroundColor: colors.primarySoft },
  contentTight: { paddingTop: 4, paddingBottom: 4, gap: 4 },
  footerTight: { paddingTop: 4, paddingBottom: 4 },
  // 날짜·제목은 서버와 같은 높이에 놓는다(가운데 정렬로 두면 글자 수에 따라 자리가 밀린다).
  titleDate: { position: 'absolute', left: '5%', right: '5%', fontWeight: '800', color: colors.primary, textAlign: 'center' },
  titleName: { position: 'absolute', left: '5%', right: '5%', fontWeight: '800', color: '#191F28', textAlign: 'center' },
  // 자막 위치: 위 / 화면 가운데 / 아래(날짜 줄 위)
  // 자막·라벨 자리. 세로 위치는 그리는 쪽에서 비율로 넣고, 좌우 여백도 폭에 대한 비율이다.
  capZone: { position: 'absolute', left: `${OVERLAY_SIDE * 100}%`, right: `${OVERLAY_SIDE * 100}%`, alignItems: 'center' },
  capCenter: { top: 0, bottom: 0, justifyContent: 'center' },
  // 직접 옮긴 자막. top 은 자막 윗변이다(프리셋 위치·서버 렌더러와 같은 기준).
  capFreeRow: { position: 'absolute', left: `${OVERLAY_SIDE * 100}%`, right: `${OVERLAY_SIDE * 100}%`, flexDirection: 'row', alignItems: 'flex-start' },
  capShadow: { textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

});
