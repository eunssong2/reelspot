import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeImage } from './ui/SafeImage';
import { useNaturalSize } from './imageSize';
import { MIN_CROP, aspectOf, type AspectId, type CropRect } from './model';

interface Props {
  visible: boolean;
  /** 자를 사진·동영상(커버 이미지) */
  clip: { itemId: string; kind: 'photo' | 'video'; image: string | number } | null;
  aspect: AspectId;
  /** 지금 저장된 자른 영역 */
  crop?: CropRect;
  /** crop 이 undefined 면 자르지 않은 것(사진 전체) */
  onApply: (crop: CropRect | undefined) => void;
  onClose: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const HANDLE = 28;
/** 화면에서 자를 영역의 최소 크기(px) */
const MIN_PX = 40;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 자르기. 크게 보기 화면에서 "자르기·크기 조절"을 누르면 열린다.
 * 사진 전체 위에 자를 영역(코랄 테두리)이 얹히고, 영역을 끌어 옮기거나 네 모서리를 끌어 자유롭게 크기를 바꾼다.
 * 영역 밖은 어둡게 보이며 영상에는 영역 안쪽만 쓰인다. "화면 비율 고정"을 켜면 영상 화면 모양을 유지한다.
 * 원본은 바뀌지 않는다.
 */
export function CropModal(props: Props) {
  const nat = useNaturalSize(props.clip?.image);
  const { width, height } = useWindowDimensions();
  if (!props.visible) return null;
  return <CropEditor key={`${props.clip?.itemId}:${nat.w}:${nat.h}:${width}:${height}`} {...props} nat={nat} />;
}
function CropEditor({ visible, clip, aspect, crop, onApply, onClose, nat }: Props & { nat: { w: number; h: number } }) {
  const { width, height } = useWindowDimensions();
  const ratio = aspectOf(aspect).ratio;
  const stageW = Math.min(width, 430) - 24;
  const stageH = height * 0.6;
  // 손잡이가 잘리거나 Android 가장자리 뒤로가기 제스처와 겹치지 않게
  // 사진 주위에 조작 여백을 둔다. 저장 좌표는 여전히 원본 사진 기준이다.
  const fit = Math.min((stageW - HANDLE * 2) / nat.w, (stageH - HANDLE * 2) / nat.h);
  const dispW = nat.w * fit;
  const dispH = nat.h * fit;
  const offX = (stageW - dispW) / 2;
  const offY = (stageH - dispH) / 2;

  const [box, setBox] = useState<Box>(() => crop ? { x: crop.x * dispW, y: crop.y * dispH, w: crop.w * dispW, h: crop.h * dispH } : { x: 0, y: 0, w: dispW, h: dispH });
  const [locked, setLocked] = useState(false);
  /** 화면 비율 고정을 켜면 지금 영역을 영상 화면 모양으로 맞춘다(가운데 기준으로 줄인다). */
  const lockToRatio = () => {
    const b = box;
    let w = b.w;
    let h = w / ratio;
    if (h > b.h) {
      h = b.h;
      w = h * ratio;
    }
    setBox({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h });
    setLocked(true);
  };

  const start = useRef<Box>(box);
  const current = useRef({ box, dispW, dispH, ratio, locked });
  current.current = { box, dispW, dispH, ratio, locked };

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = current.current.box;
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          const d = current.current;
          setBox({ ...s, x: clamp(s.x + g.dx, 0, d.dispW - s.w), y: clamp(s.y + g.dy, 0, d.dispH - s.h) });
        },
      }),
    [],
  );

  const cornerResponders = useMemo(() => {
    const make = (corner: Corner) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = current.current.box;
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          const d = current.current;
          const left = corner === 'tl' || corner === 'bl';
          const top = corner === 'tl' || corner === 'tr';
          // 움직이는 두 변의 새 위치(반대쪽 변은 그대로)
          let x1 = left ? clamp(s.x + g.dx, 0, s.x + s.w - MIN_PX) : s.x;
          let x2 = left ? s.x + s.w : clamp(s.x + s.w + g.dx, s.x + MIN_PX, d.dispW);
          let y1 = top ? clamp(s.y + g.dy, 0, s.y + s.h - MIN_PX) : s.y;
          let y2 = top ? s.y + s.h : clamp(s.y + s.h + g.dy, s.y + MIN_PX, d.dispH);
          if (d.locked) {
            // 영상 화면 비율을 지키며 크기만 바꾼다: 가로 변화를 기준으로 세로를 맞추고, 사진 밖으로 나가면 줄인다.
            let w = x2 - x1;
            let h = w / d.ratio;
            const room = top ? y2 : d.dispH - y1;
            if (h > room) {
              h = room;
              w = h * d.ratio;
            }
            if (h < MIN_PX) {
              h = MIN_PX;
              w = h * d.ratio;
            }
            if (left) x1 = x2 - w;
            else x2 = x1 + w;
            if (top) y1 = y2 - h;
            else y2 = y1 + h;
          }
          setBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
        },
      });
    return { tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') };
  }, []);

  const full = box.x <= 0.5 && box.y <= 0.5 && box.w >= dispW - 1 && box.h >= dispH - 1;
  const apply = () => {
    if (full) return onApply(undefined);
    onApply({
      x: clamp(box.x / dispW, 0, 1),
      y: clamp(box.y / dispH, 0, 1),
      w: clamp(box.w / dispW, MIN_CROP, 1),
      h: clamp(box.h / dispH, MIN_CROP, 1),
    });
  };

  const bx = offX + box.x;
  const by = offY + box.y;
  const handles: [Corner, number, number][] = [
    ['tl', bx, by],
    ['tr', bx + box.w, by],
    ['bl', bx, by + box.h],
    ['br', bx + box.w, by + box.h],
  ];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.title}>자르기</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={[styles.stage, { width: stageW, height: stageH }]}>
            {clip ? (
              <View style={{ position: 'absolute', left: offX, top: offY, width: dispW, height: dispH }}>
                <SafeImage source={clip.image} resizeMode="stretch" style={StyleSheet.absoluteFill} compact />
              </View>
            ) : null}
            {/* 자를 영역 밖은 어둡게 덮는다(영상에 쓰이지 않는 부분). */}
            <View pointerEvents="none" style={[styles.dim, { left: 0, right: 0, top: 0, height: by }]} />
            <View pointerEvents="none" style={[styles.dim, { left: 0, right: 0, top: by + box.h, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.dim, { left: 0, width: bx, top: by, height: box.h }]} />
            <View pointerEvents="none" style={[styles.dim, { left: bx + box.w, right: 0, top: by, height: box.h }]} />
            <View
              {...moveResponder.panHandlers}
              accessibilityLabel="자를 영역. 끌어서 옮겨요"
              style={[styles.box, { left: bx, top: by, width: box.w, height: box.h }]}
            />
            {handles.map(([corner, hx, hy]) => (
              <View
                key={corner}
                {...cornerResponders[corner].panHandlers}
                accessibilityLabel="자를 영역 크기 조절"
                style={[styles.handle, { left: hx - HANDLE / 2, top: hy - HANDLE / 2 }]}
              >
                <View style={styles.handleDot} />
              </View>
            ))}
          </View>
          <Text style={styles.hint}>영역을 끌어 옮기고, 모서리를 끌어 크기를 바꿔요.</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setLocked(false)} accessibilityRole="radio" accessibilityState={{ selected: !locked }} style={[styles.chip, !locked && styles.chipOn]}>
              <Text style={[styles.chipText, !locked && styles.chipTextOn]}>자유롭게</Text>
            </Pressable>
            <Pressable onPress={lockToRatio} accessibilityRole="radio" accessibilityState={{ selected: locked }} style={[styles.chip, locked && styles.chipOn]}>
              <Text style={[styles.chipText, locked && styles.chipTextOn]}>화면 비율 고정 ({aspect === 'portrait' ? '9:16' : '16:9'})</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              setBox({ x: 0, y: 0, w: dispW, h: dispH });
              setLocked(false);
            }}
            disabled={full}
            accessibilityRole="button"
            style={[styles.secondary, full && styles.off]}
          >
            <Text style={styles.secondaryText}>처음대로</Text>
          </Pressable>
          <Pressable onPress={apply} accessibilityRole="button" style={styles.primary}>
            <Text style={styles.primaryText}>적용</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(10,10,12,0.96)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stage: { overflow: 'hidden', backgroundColor: '#000', borderRadius: 8 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#F3706B' },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F3706B', borderWidth: 2, borderColor: '#fff' },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#F3706B' },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  secondary: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  primary: { flex: 2, minHeight: 52, borderRadius: 14, backgroundColor: '#F3706B', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  off: { opacity: 0.35 },
});
