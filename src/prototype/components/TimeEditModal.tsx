import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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

const QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00'];
const DEFAULT_TIME = '12:00';

const pad = (n: number) => String(n).padStart(2, '0');

function parse(value?: string): { h: number; m: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? DEFAULT_TIME);
  return match ? { h: Number(match[1]), m: Number(match[2]) } : { h: 12, m: 0 };
}

/**
 * 방문 시간을 손으로 고치는 창. 키보드로 입력하는 대신 시·분을 ＋/－ 버튼으로 맞추고,
 * 자주 쓰는 시각은 한 번에 고른다. "시간 미정"으로 되돌릴 수도 있다.
 */
export function TimeEditModal({ visible, placeName, value, onSave, onClose }: Props) {
  const [time, setTime] = useState(parse(value));

  // 창이 열릴 때마다 현재 값에서 시작한다.
  useEffect(() => {
    if (visible) setTime(parse(value));
  }, [visible, value]);

  const bump = (field: 'h' | 'm', delta: number) =>
    setTime((t) => {
      if (field === 'h') return { ...t, h: (t.h + delta + 24) % 24 };
      return { ...t, m: (t.m + delta + 60) % 60 };
    });

  const Stepper = ({ field, label, step }: { field: 'h' | 'm'; label: string; step: number }) => (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 늘리기`} onPress={() => bump(field, step)} style={styles.stepBtn}>
        <Text style={styles.stepGlyph}>＋</Text>
      </Pressable>
      <Text style={styles.digits}>{pad(time[field])}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 줄이기`} onPress={() => bump(field, -step)} style={styles.stepBtn}>
        <Text style={styles.stepGlyph}>－</Text>
      </Pressable>
      <Text style={styles.unit}>
        {label}
        {step > 1 ? ` (${step}분 단위)` : ''}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>방문 시간</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {placeName}
          </Text>

          <View style={styles.pickRow}>
            <Stepper field="h" label="시" step={1} />
            <Text style={styles.colon}>:</Text>
            <Stepper field="m" label="분" step={5} />
          </View>

          <View style={styles.quickRow}>
            {QUICK_TIMES.map((q) => (
              <Pressable key={q} accessibilityRole="button" onPress={() => setTime(parse(q))} style={styles.quick}>
                <Text style={styles.quickText}>{q}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable accessibilityRole="button" onPress={() => onSave(undefined)} style={styles.clear}>
            <Text style={styles.clearText}>시간 미정으로 두기</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onSave(`${pad(time.h)}:${pad(time.m)}`)} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>저장</Text>
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
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 6 },
  stepper: { alignItems: 'center', gap: 6 },
  stepBtn: { width: 56, height: 44, borderRadius: radius.button, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, fontWeight: '700', color: colors.text },
  digits: { fontSize: 38, fontWeight: '900', color: colors.text, minWidth: 64, textAlign: 'center' },
  unit: { fontSize: 11, color: colors.textMuted },
  colon: { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: -18 },
  quickRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  quick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  quickText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  clear: { alignItems: 'center', paddingVertical: 6 },
  clearText: { fontSize: 13, fontWeight: '600', color: colors.textSub, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.surface },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: colors.textSub },
});
