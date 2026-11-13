import React, { useState } from 'react';
import { Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { monthDays, moveMonth, rangeTap } from '../lib/calendar';
import { todayInSeoul } from '../lib/preferences';
import { datesBetween, periodBadge, periodLength } from '../lib/day-labels';
import { Button, H, P, colors, s } from './ui';
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export type DayChip = { text: string; cancelled: boolean };
export function MonthGrid({
  month,
  selected,
  start,
  end,
  onSelect,
  labels,
  disabledDates,
  fadedAfter,
}: {
  month: string;
  selected?: string;
  start?: string;
  end?: string;
  onSelect: (date: string) => void;
  /** One label per date (the group calendar shows a single day title per date). */
  labels?: Record<string, DayChip>;
  /** Dates that cannot be picked (held by another schedule); shown faded. */
  disabledDates?: Set<string>;
  /** Dates after this one are shown faded but stay tappable so the limit can be explained. */
  fadedAfter?: string;
}) {
  const today = todayInSeoul();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
        <Text
          key={d}
          style={{
            width: '14.2857%',
            textAlign: 'center',
            paddingVertical: 10,
            color: colors.muted,
          }}
        >
          {d}
        </Text>
      ))}
      {monthDays(month).map((date) => {
        const chip = labels?.[date],
          off = disabledDates?.has(date) ?? false,
          inside = date.startsWith(month) && !(fadedAfter && date > fadedAfter);
        const chosen = date === selected || date === start || date === end,
          between = !!start && !!end && date > start && date < end;
        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={`${date}${chip ? ` ${chip.cancelled ? '취소된 일정 ' : ''}${chip.text}` : ''}${off ? ' 다른 일정이 있는 날짜' : ''}`}
            accessibilityState={{ selected: chosen, disabled: off }}
            disabled={off}
            onPress={() => onSelect(date)}
            style={{
              width: '14.2857%',
              minHeight: labels ? 76 : 48,
              paddingVertical: 3,
              paddingHorizontal: 2,
              backgroundColor: between ? colors.sage : 'transparent',
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                alignSelf: 'center',
                textAlign: 'center',
                minWidth: 34,
                lineHeight: 26,
                paddingVertical: 2,
                borderRadius: 17,
                overflow: 'hidden',
                fontWeight: chosen ? '800' : '500',
                borderWidth: !chosen && date === today ? 1.5 : 0,
                borderColor: colors.accent,
                backgroundColor: chosen ? colors.accent : off ? colors.sage : 'transparent',
                color: chosen
                  ? 'white'
                  : off
                    ? '#F5A9A5'
                    : date === today
                      ? colors.accent
                      : inside
                        ? colors.ink
                        : '#B0B8C1',
              }}
            >
              {Number(date.slice(-2))}
            </Text>
            {chip && (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: '700',
                  paddingHorizontal: 3,
                  paddingVertical: 2,
                  borderRadius: 5,
                  overflow: 'hidden',
                  color: chip.cancelled ? colors.muted : colors.accent,
                  backgroundColor: chip.cancelled ? '#E5E8EB' : colors.sage,
                  textDecorationLine: chip.cancelled ? 'line-through' : 'none',
                  opacity: inside ? 1 : 0.5,
                }}
              >
                {chip.text}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
export function MonthHeader({
  month,
  onMove,
  spread = false,
}: {
  month: string;
  onMove: (n: number) => void;
  spread?: boolean;
}) {
  const arrow = (n: number, label: string, glyph: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onMove(n)}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20, color: colors.sub }}>{glyph}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        justifyContent: spread ? 'space-between' : 'flex-start',
      }}
    >
      {arrow(-1, '이전 달', '‹')}
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>
        {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
      </Text>
      {arrow(1, '다음 달', '›')}
    </View>
  );
}
export function PeriodPicker({
  start,
  end,
  onChange,
  disabled,
  disabledDates,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  disabled?: boolean;
  /** Dates already used by other schedules; a period may not include them. */
  disabledDates?: Set<string>;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(todayInSeoul().slice(0, 7)),
    [range, setRange] = useState({ start: '', end: '', error: '' });
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Text style={s.label}>
          일정 기간 <Text style={{ color: colors.accent }}>*</Text>
        </Text>
        {!!start && !!end && end >= start && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: colors.accent,
              backgroundColor: colors.sage,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            📅 {periodBadge(start, end)}
          </Text>
        )}
      </View>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="일정 기간 선택"
        onPress={() => {
          setRange({ start, end, error: '' });
          setMonth((start || todayInSeoul()).slice(0, 7));
          setOpen(true);
        }}
        style={{ marginBottom: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {[
            ['시작 날짜', start],
            ['종료 날짜', end],
          ].map(([label, value], i) => (
            <React.Fragment key={label}>
              {i === 1 && <Text style={{ color: colors.muted }}>—</Text>}
              <View
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}
              >
                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>{label}</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: value ? '600' : '400',
                      color: value ? colors.ink : colors.muted,
                    }}
                  >
                    {value ? value.replaceAll('-', '.') : '날짜 선택'}
                  </Text>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            accessibilityLabel="기간 선택 닫기"
            onPress={() => setOpen(false)}
          />
          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <H>일정 기간</H>
              <P>
                {range.end
                  ? range.end === range.start
                    ? `${range.start.replaceAll('-', '.')} · 당일`
                    : `${range.start.replaceAll('-', '.')} – ${range.end.replaceAll('-', '.')} · ${periodLength(range.start, range.end)}일`
                  : range.start
                    ? '종료 날짜를 눌러 주세요. 당일이면 같은 날을 한 번 더 눌러요.'
                    : '시작 날짜를 눌러 주세요.'}
              </P>
              <MonthHeader spread month={month} onMove={(n) => setMonth(moveMonth(month, n))} />
              <MonthGrid
                month={month}
                start={range.start}
                end={range.end}
                disabledDates={disabledDates}
                fadedAfter={range.start && !range.end ? addDays(range.start, 365) : undefined}
                onSelect={(date) => {
                  const next = rangeTap(range.start, range.end, date);
                  if (
                    next.end &&
                    disabledDates &&
                    datesBetween(next.start, next.end).some((d) => disabledDates.has(d))
                  )
                    setRange({
                      start: date,
                      end: '',
                      error: '이미 일정이 있는 날짜가 들어 있어요. 하루에는 일정을 하나만 만들 수 있어요.',
                    });
                  else setRange(next);
                }}
              />
              {!!range.error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {range.error}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button style={{ flex: 1 }} secondary onPress={() => setOpen(false)}>
                  취소
                </Button>
                <Button
                  style={{ flex: 1 }}
                  disabled={!range.start || !range.end}
                  onPress={() => {
                    onChange(range.start, range.end);
                    setOpen(false);
                  }}
                >
                  선택 완료
                </Button>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
