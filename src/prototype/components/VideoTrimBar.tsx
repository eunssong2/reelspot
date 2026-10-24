import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, radius } from '../styles/tokens';

interface Props {
  /** 원본 동영상 전체 길이(ms). */
  durationMs: number;
  /** 방에서 정한 고정 길이(ms) — 이 구간만큼만 잘라 올린다. */
  clipMs: number;
  /** 현재 선택된 구간의 시작 지점(ms). */
  startMs: number;
  onChangeStart: (nextStartMs: number) => void;
}

const NUDGE_MS = 1000;

function formatClock(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 앨범에서 고른 동영상이 방 길이보다 길 때, 그중 어디서부터 쓸지 고르는 막대.
 * 창(하이라이트)의 길이는 항상 clipMs 로 고정되고, 좌우로만 움직인다.
 * 드래그(모바일)와 ◀▶ 1초 이동 버튼(마우스·정밀 조정)을 함께 둔다.
 */
export function VideoTrimBar({ durationMs, clipMs, startMs, onChangeStart }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const dragBaseStart = useRef(startMs);
  const maxStart = Math.max(0, durationMs - clipMs);

  const clamp = (value: number) => Math.min(Math.max(value, 0), maxStart);

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2,
        onPanResponderGrant: () => {
          dragBaseStart.current = startMs;
        },
        onPanResponderMove: (_, gesture) => {
          if (trackWidth <= 0) return;
          const msPerPx = durationMs / trackWidth;
          onChangeStart(clamp(dragBaseStart.current + gesture.dx * msPerPx));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gesture 콜백은 최신 startMs 를 grant 시점에만 필요로 한다.
    [trackWidth, durationMs, clipMs],
  );

  const windowLeft = trackWidth > 0 ? (startMs / durationMs) * trackWidth : 0;
  const windowWidth = trackWidth > 0 ? (clipMs / durationMs) * trackWidth : 0;
  const nudge = (deltaMs: number) => onChangeStart(clamp(startMs + deltaMs));

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={onLayout}>
        {trackWidth > 0 && (
          <View
            {...panResponder.panHandlers}
            style={[styles.window, { left: windowLeft, width: windowWidth }]}
          >
            <View style={styles.grip} />
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="1초 앞으로"
          onPress={() => nudge(-NUDGE_MS)}
          disabled={startMs <= 0}
          style={({ pressed }) => [styles.nudge, pressed && styles.nudgePressed]}
        >
          <Text style={styles.nudgeText}>◀ 1초</Text>
        </Pressable>

        <Text style={styles.rangeText}>
          {formatClock(startMs)} – {formatClock(startMs + clipMs)} 사용 · 전체 {formatClock(durationMs)}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="1초 뒤로"
          onPress={() => nudge(NUDGE_MS)}
          disabled={startMs >= maxStart}
          style={({ pressed }) => [styles.nudge, pressed && styles.nudgePressed]}
        >
          <Text style={styles.nudgeText}>1초 ▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  track: {
    height: 48,
    borderRadius: radius.item,
    backgroundColor: colors.surfaceStrong,
    justifyContent: 'center',
  },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.item,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 28, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nudge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  nudgePressed: { backgroundColor: colors.surfaceStrong },
  nudgeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  rangeText: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.textSub },
});
