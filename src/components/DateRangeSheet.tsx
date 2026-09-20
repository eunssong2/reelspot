import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  datesBetween,
  formatRange,
  todayString,
  type DateString,
} from '@/features/trips/dates';
import { GUTTER, colors, palette, radius, spacing, type } from '@/theme/theme';

import { Button } from './Button';

LocaleConfig.locales.ko = {
  monthNames: [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
  ],
  monthNamesShort: [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
  ],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

type Props = {
  visible: boolean;
  start: DateString | null;
  end: DateString | null;
  onCancel: () => void;
  onConfirm: (start: DateString, end: DateString) => void;
};

export function DateRangeSheet({ visible, start, end, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [draftStart, setDraftStart] = useState<DateString | null>(start);
  const [draftEnd, setDraftEnd] = useState<DateString | null>(end);

  // 열 때마다 바깥 값으로 되돌린다 — 취소하고 다시 열면 이전 선택이 남아 있으면 안 된다.
  useEffect(() => {
    if (visible) {
      setDraftStart(start);
      setDraftEnd(end);
    }
  }, [visible, start, end]);

  const pick = (day: DateString) => {
    // 시작일만 찍힌 상태에서 그보다 앞을 누르면 시작일을 옮긴다.
    if (!draftStart || draftEnd || day < draftStart) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(day);
  };

  const marked = buildMarks(draftStart, draftEnd);
  const ready = Boolean(draftStart && draftEnd);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <View style={[styles.sheet, { paddingBottom: spacing(4) + insets.bottom }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>여행 기간</Text>
        <Text style={styles.guide}>
          {draftStart && draftEnd
            ? formatRange(draftStart, draftEnd)
            : draftStart
              ? '돌아오는 날을 눌러 주세요.'
              : '떠나는 날을 눌러 주세요.'}
        </Text>

        <Calendar
          minDate={todayString()}
          markingType="period"
          markedDates={marked}
          onDayPress={(day) => pick(day.dateString)}
          firstDay={0}
          enableSwipeMonths
          theme={calendarTheme}
        />

        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={onCancel} style={styles.action} />
          <Button
            label="선택 완료"
            onPress={() => draftStart && draftEnd && onConfirm(draftStart, draftEnd)}
            disabled={!ready}
            style={styles.action}
          />
        </View>
      </View>
    </Modal>
  );
}

type Mark = {
  startingDay?: boolean;
  endingDay?: boolean;
  color: string;
  textColor: string;
};

function buildMarks(start: DateString | null, end: DateString | null): Record<string, Mark> {
  if (!start) return {};

  if (!end) {
    return {
      [start]: { startingDay: true, endingDay: true, color: colors.accent, textColor: colors.onAccent },
    };
  }

  const marks: Record<string, Mark> = {};
  const days = datesBetween(start, end);

  days.forEach((day, index) => {
    const edge = index === 0 || index === days.length - 1;
    marks[day] = {
      startingDay: index === 0,
      endingDay: index === days.length - 1,
      color: edge ? colors.accent : colors.accentSoft,
      textColor: edge ? colors.onAccent : colors.accent,
    };
  });

  return marks;
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
  textDisabledColor: palette.gray300,
  todayTextColor: colors.accent,
  arrowColor: colors.text,
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: GUTTER,
    paddingTop: spacing(3),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.gray300,
    marginBottom: spacing(4),
  },
  title: { ...type.heading, color: colors.text },
  guide: { ...type.label, color: colors.textBody, marginTop: spacing(1), marginBottom: spacing(2) },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  action: { flex: 1 },
});
