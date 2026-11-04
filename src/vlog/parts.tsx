import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeImage } from './ui/SafeImage';
import { useNaturalSize } from './imageSize';
import { AppHeader } from './ui/AppHeader';
import { ActionButton } from './ui/FormParts';
import { ScreenFrame } from './ui/ScreenFrame';
import { Toast } from './ui/Toast';
import type { Rect } from './types';
import { colors, GUTTER, radius } from './tokens';
import { ASPECTS, aspectOf, filterOf, fontOf, type TimelineClip, type TimelineScene, type AspectId, type TransitionId } from './model';



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
}

export const StepNoticeContext = createContext<ReactNode>(null);
export function RecoveryNotice({ message, label, onPress }: { message: string; label: string; onPress: () => void }) {
  return <View style={{ padding: 12, gap: 8, marginBottom: 12, borderRadius: 12, backgroundColor: colors.surface }}>
    <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: 48, padding: 12, justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
      <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  </View>;
}

/** 브이로그 제작 화면 공통 틀: 뒤로가기·제목·닫기 + 단계 표시 + 본문 + 하단 버튼. */
export function StepFrame({ title, step, stepLabel, context, onBack, onClose, children, footer, toast, scroll = true }: FrameProps) {
  const notices = useContext(StepNoticeContext);
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
      <View style={styles.progressWrap}>
        <Text style={styles.stepText}>
          {step} / 5 {stepLabel}
          {context ? ` · ${context}` : ''}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(step / 5) * 100}%` }]} />
        </View>
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notices}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill1]}>{notices}{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  /** 분할 장면에서 고른 칸(편집 화면). 테두리로 표시한다. */
  selectedCell?: number;
  /** 분할 장면의 칸을 눌렀을 때(편집 화면) */
  onSelectCell?: (index: number) => void;
}

/**
 * 한 칸(또는 이어 재생 장면)의 사진·동영상 커버를 화면 틀에 놓는다: 직접 자른 영역, 채우기/맞춤, 여백, 색감 효과.
 * 장면 미리보기와 편집 화면이 같은 그림을 쓴다.
 */
export function ClipLayer({ clip, width, height }: { clip: TimelineClip; width: number; height: number }) {
  const f = clip.frame;
  const css = filterOf(clip.filter).css;
  const contain = f.fit === 'contain';
  const nat = useNaturalSize(f.crop ? clip.image : undefined);
  let photo;
  if (f.crop && nat.known) {
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
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, contain && { backgroundColor: f.bg === 'white' ? '#FFFFFF' : '#000000' }]}>
      {contain && f.bg === 'blur' ? (
        <View style={[StyleSheet.absoluteFill, { filter: 'blur(14px) brightness(0.8)', transform: [{ scale: 1.2 }] }]}>
          <SafeImage source={clip.image} style={StyleSheet.absoluteFill} compact />
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, css ? { filter: css } : undefined]}>{photo}</View>
    </View>
  );
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
 * 한 장면을 세로 9:16 화면으로 그린다. 미리보기·장면 편집·완성본 카드가 같은 그림을 쓴다.
 * 동영상은 커버 프레임으로 보여 준다(실제 재생은 최종 렌더링의 몫).
 */
export function SceneCanvas({ scene, width, localSec = 0, clipIndex, selectedCell, onSelectCell }: CanvasProps) {
  const height = width / aspectOf(scene.aspect).ratio;
  if (scene.kind === 'title') {
    return (
      <View style={[styles.canvas, styles.titleCanvas, { width, height }]}>
        <Text style={styles.titleDate}>{scene.titleDate}</Text>
        <Text style={styles.titleName} numberOfLines={3}>
          {scene.titleText}
        </Text>
      </View>
    );
  }
  const index = clipIndex ?? sceneClipAt(scene, localSec);
  const clip: TimelineClip | undefined = scene.clips[index];
  const caption = scene.mode === 'split' ? scene.caption : (clip?.caption ?? '');
  const font = fontOf(scene.fontId).style;
  const line = [scene.dateText, scene.placeText].filter(Boolean).join(' · ');
  return (
    <View style={[styles.canvas, { width, height }]}>
      {scene.mode === 'split' && scene.template ? (
        scene.template.rects.map((r: Rect, i) => {
          const c = scene.clips[i];
          const cellW = width * r[2];
          const cellH = height * r[3];
          const selected = selectedCell === i;
          const cellStyle = { position: 'absolute' as const, left: `${r[0] * 100}%` as const, top: `${r[1] * 100}%` as const, width: `${r[2] * 100}%` as const, height: `${r[3] * 100}%` as const, padding: 1 };
          const cellBody = (
            <>
              <View style={[StyleSheet.absoluteFill, { margin: 1, overflow: 'hidden' }, selected && styles.cellSelected]}>
                {c ? <ClipLayer clip={c} width={cellW - 2} height={cellH - 2} /> : null}
              </View>
              {c?.kind === 'video' ? <Text style={styles.videoMark}>▶</Text> : null}
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
          <ClipLayer clip={clip} width={width} height={height} />
          {clip.kind === 'video' ? <Text style={styles.videoMark}>▶</Text> : null}
        </>
      ) : null}
      {line || caption ? (
        <View style={styles.overlay}>
          {line ? <Text style={[styles.overlayLine, font]}>{line}</Text> : null}
          {caption ? <Text style={[styles.overlayCaption, font]}>{caption}</Text> : null}
        </View>
      ) : null}
    </View>
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
}

/**
 * 미리보기 무대: 장면을 그리고, 장면이 바뀌는 순간에는 전환 효과를 보여 준다.
 * 들어오는 장면이 앞 장면 위에 얹히며 페이드(투명도)·슬라이드(옆에서 밀기)·확대(커지며 나타남)로 바뀐다.
 */
export function TransitionStage({ scene, prev, width, localSec, transition, progress }: StageProps) {
  const height = width / aspectOf(scene.aspect).ratio;
  // prev 가 없으면(첫 장면 예시) 어두운 바탕 위로 장면이 들어온다.
  const active = transition !== 'none' && progress !== undefined && progress < 1;
  if (!active || progress === undefined) return <SceneCanvas scene={scene} width={width} localSec={localSec} />;
  const p = progress;
  const incoming =
    transition === 'fade'
      ? { opacity: p }
      : transition === 'slide'
        ? { transform: [{ translateX: (1 - p) * width }] }
        : { opacity: p, transform: [{ scale: 0.7 + 0.3 * p }] };
  const outgoing = transition === 'slide' ? { transform: [{ translateX: -p * width * 0.3 }] } : undefined;
  return (
    <View style={{ width, height, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.ink }}>
      {prev ? (
        <View style={[StyleSheet.absoluteFill, outgoing]}>
          <SceneCanvas scene={prev} width={width} localSec={prev.seconds} />
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, incoming]}>
        <SceneCanvas scene={scene} width={width} localSec={localSec} />
      </View>
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
export function LayoutThumb({ rects, images, width, ratio = 9 / 16 }: { rects: Rect[]; images: (string | number)[]; width: number; ratio?: number }) {
  const height = width / ratio;
  return (
    <View style={[styles.canvas, { width, height }]}>
      {rects.map((r, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%`, padding: 1 }}
        >
          {images[i] !== undefined ? <SafeImage source={images[i]} style={StyleSheet.absoluteFill} compact /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleCanvas: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
  titleDate: { fontSize: 14, fontWeight: '800', color: colors.primary },
  titleName: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  videoMark: { position: 'absolute', right: 6, top: 6, fontSize: 10, color: colors.onPrimary, backgroundColor: 'rgba(25,31,40,0.55)', paddingHorizontal: 5, borderRadius: 8, overflow: 'hidden' },
  overlay: { position: 'absolute', left: 8, right: 8, bottom: 10, backgroundColor: 'rgba(25,31,40,0.75)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  overlayLine: { fontSize: 9, color: colors.onPrimary, opacity: 0.85 },
  overlayCaption: { fontSize: 12, color: colors.onPrimary, textAlign: 'center' },
});
