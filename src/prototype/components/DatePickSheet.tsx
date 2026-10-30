import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { colors, GUTTER, MIN_TOUCH, radius } from '../styles/tokens';

LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

interface Props {
  visible: boolean;
  /** 이미 일정에 있는 날짜(YYYY-MM-DD). 연하게 표시하고 누를 수 없다. */
  existingDates: string[];
  /** 더 고를 수 있는 최대 날짜 수 */
  maxPick: number;
  /** 달력이 처음 보여 줄 달을 가리키는 날짜 */
  initialDate: string;
  /** 날짜 하나만 고른다(다른 날짜를 누르면 옮겨 간다). 일정 변경에서 쓴다. */
  single?: boolean;
  /** 열 때 미리 골라 둘 날짜 */
  initialPicked?: string[];
  title?: string;
  onCancel: () => void;
  onConfirm: (dates: string[]) => void;
}

/**
 * 일정 추가용 달력. 날짜를 눌러 하나 또는 여러 개를 고르고(다시 누르면 해제) "추가"로 확정한다.
 * 이어지지 않는 날짜도 고를 수 있다.
 */
export function DatePickSheet({ visible, existingDates, maxPick, initialDate, single, initialPicked, title, onCancel, onConfirm }: Props) {
  const [picked, setPicked] = useState<string[]>([]);

  // 열 때마다 선택을 비운다 — 취소하고 다시 열면 이전 선택이 남아 있으면 안 된다.
  useEffect(() => {
    if (visible) setPicked(initialPicked ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (date: string) => {
    if (existingDates.includes(date)) return;
    setPicked((prev) => {
      if (single) return [date];
      if (prev.includes(date)) return prev.filter((d) => d !== date);
      return prev.length >= maxPick ? prev : [...prev, date];
    });
  };

  const marked: Record<string, { disableTouchEvent?: boolean; customStyles: { container: object; text: object } }> = {};
  for (const date of existingDates) {
    marked[date] = {
      disableTouchEvent: true,
      customStyles: { container: { backgroundColor: colors.primarySoft, borderRadius: 20 }, text: { color: colors.primary } },
    };
  }
  for (const date of picked) {
    marked[date] = {
      customStyles: { container: { backgroundColor: colors.primary, borderRadius: 20 }, text: { color: colors.onPrimary, fontWeight: '700' } },
    };
  }

  const guide = single
    ? picked.length === 0
      ? '날짜를 눌러 주세요.'
      : '날짜를 골랐어요.'
    : picked.length === 0
      ? '추가할 날짜를 눌러 주세요. 여러 날도 고를 수 있어요.'
      : picked.length >= maxPick
        ? `${picked.length}일 선택 (최대예요)`
        : `${picked.length}일 선택`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title ?? '일정 추가'}</Text>
        <Text style={styles.guide}>{guide}</Text>

        <Calendar
          current={initialDate}
          markingType="custom"
          markedDates={marked}
          onDayPress={(day) => toggle(day.dateString)}
          firstDay={0}
          enableSwipeMonths
          theme={calendarTheme}
        />

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.action, styles.cancel]}>
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: picked.length === 0 }}
            disabled={picked.length === 0}
            onPress={() => onConfirm([...picked].sort())}
            style={[styles.action, picked.length > 0 ? styles.confirmOn : styles.confirmOff]}
          >
            <Text style={picked.length > 0 ? styles.confirmOnText : styles.confirmOffText}>
              {picked.length > 0 ? (single ? '선택 완료' : `${picked.length}일 추가`) : '날짜를 선택하세요'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const calendarTheme = {
  calendarBackground: colors.bg,
  monthTextColor: colors.text,
  textMonthFontSize: 18,
  textMonthFontWeight: '700' as const,
  textSectionTitleColor: colors.textMuted,
  dayTextColor: colors.text,
  textDayFontSize: 17,
  textDayFontWeight: '500' as const,
  todayTextColor: colors.primary,
  arrowColor: colors.text,
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg,
    width: '100%', maxWidth: 430, alignSelf: 'center', borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 24,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  guide: { fontSize: 13, color: colors.textSub, marginTop: 4, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.surface },
  cancelText: { fontSize: 17, fontWeight: '700', color: colors.text },
  confirmOn: { backgroundColor: colors.primary },
  confirmOnText: { fontSize: 17, fontWeight: '700', color: colors.onPrimary },
  confirmOff: { backgroundColor: colors.primarySoft },
  confirmOffText: { fontSize: 17, fontWeight: '700', color: colors.primary },
});
