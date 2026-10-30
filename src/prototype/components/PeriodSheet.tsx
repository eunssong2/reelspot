import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, GUTTER, radius, shadow } from '../styles/tokens';
import {
  addDays,
  dotDate,
  inclusiveDays,
  MAX_SCHEDULE_DAYS,
  monthDayLabel,
  monthKey,
  monthTitle,
  shiftMonth,
  todayKst,
  weekdayLabel,
  type DateStr,
} from '../utils/calendar';
import { ActionButton } from './FormParts';
import { MonthGrid } from './MonthGrid';

interface Props {
  visible: boolean;
  start: DateStr | null;
  end: DateStr | null;
  onCancel: () => void;
  onConfirm: (start: DateStr, end: DateStr) => void;
}

/**
 * D1 기간 선택 시트. 첫 탭 = 시작, 두 번째 탭 = 종료(같은 날을 다시 누르면 당일).
 * 과거 날짜도 고를 수 있고, 시작 날짜부터 366일을 넘는 날짜는 고를 수 없다.
 */
export function PeriodSheet({ visible, start, end, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [draftStart, setDraftStart] = useState<DateStr | null>(start);
  const [draftEnd, setDraftEnd] = useState<DateStr | null>(end);
  const [month, setMonth] = useState(monthKey(start ?? todayKst()));
  const [warning, setWarning] = useState<string | null>(null);

  // 열 때마다 바깥 값으로 되돌린다(취소 후 다시 열면 이전 선택이 남지 않게).
  useEffect(() => {
    if (!visible) return;
    setDraftStart(start);
    setDraftEnd(end);
    setMonth(monthKey(start ?? todayKst()));
    setWarning(null);
  }, [visible, start, end]);

  const limit = draftStart && !draftEnd ? addDays(draftStart, MAX_SCHEDULE_DAYS - 1) : null;

  const pick = (date: DateStr) => {
    setWarning(null);
    if (!draftStart || draftEnd || date < draftStart) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    if (limit && date > limit) {
      setWarning('일정은 366일까지 만들 수 있어요');
      return;
    }
    setDraftEnd(date);
  };

  const guide = warning
    ? warning
    : draftStart && draftEnd
      ? draftStart === draftEnd
        ? `${dotDate(draftStart)} · 당일`
        : `${dotDate(draftStart)} – ${draftStart.slice(0, 4) === draftEnd.slice(0, 4) ? draftEnd.slice(5).replace('-', '.') : dotDate(draftEnd)} · ${inclusiveDays(draftStart, draftEnd)}일`
      : draftStart
        ? '종료 날짜를 눌러 주세요. 당일이면 같은 날을 한 번 더 눌러요.'
        : '시작 날짜를 눌러 주세요.';

  const today = todayKst();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="기간 선택 닫기" />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>일정 기간</Text>
        <Text style={[styles.guide, warning && styles.guideWarn]} accessibilityLiveRegion="polite">
          {guide}
        </Text>

        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="이전 달" style={styles.arrow}>
            <Text style={styles.arrowGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="다음 달" style={styles.arrow}>
            <Text style={styles.arrowGlyph}>›</Text>
          </Pressable>
        </View>

        <MonthGrid
          month={month}
          cellHeight={44}
          onPressDate={pick}
          labelFor={(d) =>
            `${monthDayLabel(d)} ${weekdayLabel(d)}요일${d === draftStart ? ', 시작 날짜' : ''}${d === draftEnd ? ', 종료 날짜' : ''}`
          }
          renderCell={(date, { inMonth }) => {
            const edge = date === draftStart || date === draftEnd;
            const inside = draftStart && draftEnd && date > draftStart && date < draftEnd;
            const tooFar = limit !== null && date > limit;
            const bandLeft = draftStart && draftEnd && draftStart !== draftEnd && date === draftEnd;
            const bandRight = draftStart && draftEnd && draftStart !== draftEnd && date === draftStart;
            return (
              <View style={styles.cellInner}>
                {inside ? <View style={[styles.band, styles.bandFull]} /> : null}
                {bandRight ? <View style={[styles.band, styles.bandRight]} /> : null}
                {bandLeft ? <View style={[styles.band, styles.bandLeft]} /> : null}
                <View style={[styles.dayCircle, edge && styles.dayEdge]}>
                  <Text
                    style={[
                      styles.dayText,
                      !inMonth && styles.dayOut,
                      date === today && !edge && styles.dayToday,
                      inside && styles.dayInside,
                      edge && styles.dayEdgeText,
                      tooFar && styles.dayOut,
                    ]}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.actions}>
          <ActionButton label="취소" tone="secondary" onPress={onCancel} style={styles.action} />
          <ActionButton
            label="선택 완료"
            onPress={() => draftStart && draftEnd && onConfirm(draftStart, draftEnd)}
            disabled={!draftStart || !draftEnd}
            style={styles.action}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,31,40,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    boxShadow: shadow.float,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.surfaceStrong, marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  guide: { fontSize: 14, color: colors.textSub, marginTop: 4, minHeight: 20 },
  guideWarn: { color: colors.danger, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontSize: 24, color: colors.textSub, marginTop: -2 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cellInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 5, bottom: 5, backgroundColor: colors.primarySoft },
  bandFull: { left: 0, right: 0 },
  bandRight: { left: '50%', right: 0 },
  bandLeft: { left: 0, right: '50%' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, fontWeight: '600', color: colors.text },
  dayOut: { color: colors.textMuted, opacity: 0.5 },
  dayToday: { color: colors.primary, fontWeight: '800' },
  dayInside: { color: colors.primary },
  dayEdgeText: { color: colors.onPrimary, fontWeight: '800', opacity: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1 },
});
