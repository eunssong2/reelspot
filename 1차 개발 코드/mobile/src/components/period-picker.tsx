import React, { useState } from 'react';
import { Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { monthDays, moveMonth, rangeTap } from '../lib/calendar';
import { todayInSeoul } from '../lib/preferences';
import { Button, H, P, colors, s } from './ui';
export function MonthGrid({
  month,
  selected,
  start,
  end,
  onSelect,
  schedules = [],
}: {
  month: string;
  selected?: string;
  start?: string;
  end?: string;
  onSelect: (date: string) => void;
  schedules?: any[];
}) {
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
        const events = schedules
          .filter((x) => x.startDate <= date && x.endDate >= date)
          .sort(
            (a, b) =>
              a.startDate.localeCompare(b.startDate) ||
              b.endDate.localeCompare(a.endDate) ||
              a.id.localeCompare(b.id),
          );
        const chosen = date === selected || date === start || date === end,
          between = !!start && !!end && date > start && date < end;
        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={`${date}${schedules.length ? ` 일정 ${events.length}개` : ''}`}
            accessibilityState={{ selected: chosen }}
            onPress={() => onSelect(date)}
            style={{
              width: '14.2857%',
              minHeight: schedules.length ? 84 : 48,
              padding: 3,
              backgroundColor: chosen || between ? colors.sage : 'transparent',
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                alignSelf: 'center',
                textAlign: 'center',
                minWidth: 28,
                padding: 4,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: chosen ? colors.accent : 'transparent',
                color: chosen
                  ? 'white'
                  : date === todayInSeoul()
                    ? colors.accent
                    : date.startsWith(month)
                      ? colors.ink
                      : colors.muted,
              }}
            >
              {Number(date.slice(-2))}
            </Text>
            {events.slice(0, 3).map((x) => (
              <Text
                numberOfLines={1}
                key={x.id}
                style={{
                  fontSize: 10,
                  color: x.status === 'cancelled' ? colors.muted : colors.accent,
                  textDecorationLine: x.status === 'cancelled' ? 'line-through' : 'none',
                }}
              >
                {x.status === 'cancelled' ? '취소 ' : ''}
                {x.title}
              </Text>
            ))}
            {events.length > 3 && <Text style={{ fontSize: 11 }}>+{events.length - 3}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
export function MonthHeader({ month, onMove }: { month: string; onMove: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 달"
        onPress={() => onMove(-1)}
        style={{ padding: 16 }}
      >
        <Text style={{ fontSize: 24 }}>‹</Text>
      </Pressable>
      <H>{month.replace('-', '년 ')}월</H>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        onPress={() => onMove(1)}
        style={{ padding: 16 }}
      >
        <Text style={{ fontSize: 24 }}>›</Text>
      </Pressable>
    </View>
  );
}
export function PeriodPicker({
  start,
  end,
  onChange,
  disabled,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(todayInSeoul().slice(0, 7)),
    [range, setRange] = useState({ start: '', end: '', error: '' });
  return (
    <>
      <P>일정 기간</P>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="일정 기간 선택"
        onPress={() => {
          setRange({ start, end, error: '' });
          setMonth((start || todayInSeoul()).slice(0, 7));
          setOpen(true);
        }}
        style={{ backgroundColor: '#F2F4F6', borderRadius: 16, padding: 18, marginBottom: 16 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <View>
            <P>시작 날짜</P>
            <H>{start || '날짜 선택'}</H>
          </View>
          <P>→</P>
          <View>
            <P>종료 날짜</P>
            <H>{end || '날짜 선택'}</H>
          </View>
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
                  ? `${range.start} ~ ${range.end} · ${1 + (Date.parse(range.end) - Date.parse(range.start)) / 86400000}일`
                  : range.start
                    ? '종료 날짜를 선택해 주세요. 당일이면 같은 날짜를 한 번 더 눌러요.'
                    : '시작 날짜를 선택해 주세요.'}
              </P>
              <MonthHeader month={month} onMove={(n) => setMonth(moveMonth(month, n))} />
              <MonthGrid
                month={month}
                start={range.start}
                end={range.end}
                onSelect={(date) => setRange(rangeTap(range.start, range.end, date))}
              />
              {!!range.error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {range.error}
                </Text>
              )}
              <Button
                disabled={!range.start || !range.end}
                onPress={() => {
                  onChange(range.start, range.end);
                  setOpen(false);
                }}
              >
                선택 완료
              </Button>
              <Button secondary onPress={() => setOpen(false)}>
                취소
              </Button>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
