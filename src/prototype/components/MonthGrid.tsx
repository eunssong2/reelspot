import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../styles/tokens';
import { monthGrid, monthKey, type DateStr } from '../utils/calendar';

const HEAD = ['월', '화', '수', '목', '금', '토', '일'];

interface Props {
  /** 'YYYY-MM' */
  month: string;
  /** 칸 하나의 높이 */
  cellHeight: number;
  /** 날짜 칸 안쪽(숫자·띠 등)을 그린다 */
  renderCell: (date: DateStr, info: { inMonth: boolean; column: number }) => ReactNode;
  onPressDate?: (date: DateStr) => void;
  /** 누를 수 없는 날짜 */
  isDisabled?: (date: DateStr) => boolean;
  /** 접근성 이름 */
  labelFor?: (date: DateStr) => string;
}

/** 월요일 시작, 6주 고정 높이의 월 달력 격자. 모임 달력(UI05)과 기간 선택(D1)이 함께 쓴다. */
export function MonthGrid({ month, cellHeight, renderCell, onPressDate, isDisabled, labelFor }: Props) {
  const days = monthGrid(month);
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <View>
      <View style={styles.headRow}>
        {HEAD.map((d) => (
          <Text key={d} style={styles.head}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((date, column) => {
            const inMonth = monthKey(date) === month;
            const disabled = isDisabled?.(date) ?? false;
            return (
              <Pressable
                key={date}
                disabled={!onPressDate || disabled}
                onPress={() => onPressDate?.(date)}
                accessibilityRole="button"
                accessibilityLabel={labelFor?.(date) ?? date}
                accessibilityState={{ disabled }}
                style={[styles.cell, { height: cellHeight }]}
              >
                {renderCell(date, { inMonth, column })}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', marginBottom: 6 },
  // 토·일도 같은 회색으로 둔다(색만으로 구분하지 않기).
  head: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textMuted },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'stretch' },
});
