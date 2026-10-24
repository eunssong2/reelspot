import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../styles/tokens';

interface Props {
  visible: boolean;
  /** 장소 이름(제목에 보여준다) */
  placeName: string;
  /** 현재 방문 시간("HH:mm"). 없으면 시간 미정 */
  value?: string;
  /** 저장. undefined 이면 "시간 미정"으로 되돌린 것 */
  onSave: (time: string | undefined) => void;
  onClose: () => void;
}

const DEFAULT_TIME = '12:00';

const pad = (n: number) => String(n).padStart(2, '0');

/** 돌려서 고르는 칸의 한 줄 높이(px)와, 한 번에 보이는 줄 수(홀수: 가운데 줄이 선택). */
const ITEM = 48;
const VISIBLE = 5;

const AMPM = ['오전', '오후'];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1~12
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i)); // 00~59

/** "HH:mm"(24시간)을 오전/오후 · 1~12시 · 분 위치(index)로 바꾼다. */
function parse(value?: string): { ampm: number; hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? DEFAULT_TIME) ?? /^(12):(00)$/.exec(DEFAULT_TIME)!;
  const h24 = Number(match[1]);
  return { ampm: h24 < 12 ? 0 : 1, hour: ((h24 + 11) % 12), minute: Number(match[2]) };
}

/** 위 값을 다시 "HH:mm"(24시간)으로. hour 는 0~11 위치(= 1~12시). */
function format({ ampm, hour, minute }: { ampm: number; hour: number; minute: number }): string {
  const h12 = hour + 1; // 1~12
  const h24 = (h12 % 12) + (ampm === 1 ? 12 : 0);
  return `${pad(h24)}:${pad(minute)}`;
}

/**
 * 위아래로 돌려서 고르는 한 칸. 가운데 줄(두 선 사이)이 선택된 값이다.
 * 스크롤이 멈추면 가장 가까운 줄로 맞추고, 줄을 눌러도 그 값으로 이동한다.
 */
function Wheel({
  label,
  items,
  index,
  onChange,
  flex = 1,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  flex?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 지금 스크롤이 가리키는 줄(화면 상태와 별개로 즉시 갱신) */
  const scrolledTo = useRef(index);

  // 처음 열릴 때 현재 값 위치로 옮겨 둔다.
  useEffect(() => {
    // 예약해 둔 사이에 값이 바뀔 수 있으므로, 실행할 때의 최신 위치(scrolledTo)를 쓴다.
    const t = setTimeout(() => ref.current?.scrollTo({ y: scrolledTo.current * ITEM, animated: false }), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바깥에서 값이 바뀐 경우(창이 열리며 현재 시간이 늦게 들어오는 등)에는 그 위치로 따라간다.
  // 손으로 돌린 결과(scrolledTo 와 같은 값)는 이미 그 위치이므로 건드리지 않는다.
  useEffect(() => {
    if (index !== scrolledTo.current) {
      scrolledTo.current = index;
      ref.current?.scrollTo({ y: index * ITEM, animated: false });
    }
  }, [index]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  const goTo = (i: number, animated = true) => {
    scrolledTo.current = i;
    ref.current?.scrollTo({ y: i * ITEM, animated });
    onChange(i);
  };

  return (
    <ScrollView
      ref={ref}
      accessibilityLabel={label}
      style={[styles.wheel, { flex }]}
      contentContainerStyle={{ paddingVertical: ITEM * ((VISIBLE - 1) / 2) }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={(e) => {
        const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
        if (i !== scrolledTo.current) {
          scrolledTo.current = i;
          onChange(i);
        }
        // 손을 떼고 잠시 멈추면 정확히 그 줄에 맞춘다(웹처럼 자석 맞춤이 없는 곳 대비).
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => ref.current?.scrollTo({ y: i * ITEM, animated: true }), 140);
      }}
    >
      {items.map((text, i) => {
        const distance = Math.abs(i - index);
        return (
          <Pressable
            key={text + i}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${text}`}
            onPress={() => goTo(i)}
            style={styles.item}
          >
            <Text
              style={[
                styles.itemText,
                distance === 0 ? styles.itemTextOn : styles.itemTextOff,
                { opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : 0.28 },
              ]}
            >
              {text}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * 방문 시간을 고치는 창. 오전/오후 · 시 · 분을 위아래로 돌려서 고른다(분은 1분 단위).
 * "시간 미정"으로 되돌릴 수도 있다.
 */
export function TimeEditModal({ visible, placeName, value, onSave, onClose }: Props) {
  const [time, setTime] = useState(parse(value));

  // 창이 열릴 때마다 현재 값에서 시작한다.
  useEffect(() => {
    if (visible) setTime(parse(value));
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>방문 시간</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {placeName}
          </Text>

          <View style={styles.pickArea}>
            {/* 가운데 줄(선택 위치)을 표시하는 두 선 */}
            <View pointerEvents="none" style={styles.band} />
            <View style={styles.pickRow}>
              <Wheel label="오전오후" items={AMPM} index={time.ampm} onChange={(i) => setTime((t) => ({ ...t, ampm: i }))} />
              <Wheel label="시" items={HOURS} index={time.hour} onChange={(i) => setTime((t) => ({ ...t, hour: i }))} />
              <Text style={styles.colon}>:</Text>
              <Wheel label="분" items={MINUTES} index={time.minute} onChange={(i) => setTime((t) => ({ ...t, minute: i }))} />
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={() => onSave(undefined)} style={styles.clear}>
            <Text style={styles.clearText}>시간 미정으로 두기</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onSave(format(time))} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.bg, borderRadius: radius.card, padding: 22, gap: 12 },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSub, marginTop: -6 },
  pickArea: { height: ITEM * VISIBLE, justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM * ((VISIBLE - 1) / 2),
    height: ITEM,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.surfaceStrong,
    zIndex: 1,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', height: ITEM * VISIBLE },
  wheel: { height: ITEM * VISIBLE },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 20, color: colors.text },
  itemTextOn: { fontWeight: '800' },
  itemTextOff: { fontWeight: '500', color: colors.textSub },
  colon: { fontSize: 22, fontWeight: '800', color: colors.text, width: 14, textAlign: 'center' },
  clear: { alignItems: 'center', paddingVertical: 6 },
  clearText: { fontSize: 13, fontWeight: '600', color: colors.textSub, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.surface },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
});
