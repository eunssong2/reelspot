import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Button, colors } from './ui';
import { weekday, type GroupDay } from '../lib/day-labels';
/** Horizontal tabs with every active day of the group (all schedules). */
export function DateTabs({
  days,
  date,
  onSelect,
}: {
  days: Pick<GroupDay, 'date' | 'scheduleId'>[];
  date: string;
  onSelect: (day: Pick<GroupDay, 'date' | 'scheduleId'>) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(344);
  const tabWidth = (width - 24) / 4;
  const index = days.findIndex((d) => d.date === date);
  useEffect(() => { ref.current?.scrollTo({ x: Math.max(0, index) * (tabWidth + 8), animated: true }); }, [index, tabWidth]);
  if (days.length <= 1) return null;
  return (
    <ScrollView
      ref={ref}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      snapToInterval={tabWidth + 8}
      decelerationRate="fast"
      horizontal
      style={{ flexGrow: 0, marginBottom: 12 }}
      contentContainerStyle={{ gap: 8 }}
      showsHorizontalScrollIndicator={false}
    >
      {days.map((d) => {
        const on = d.date === date;
        return (
          <Pressable
            key={`${d.scheduleId}:${d.date}`}
            accessibilityRole="tab"
            accessibilityLabel={`${d.date} 장소`}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(d)}
            style={{
              width: tabWidth,
              minHeight: 52,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.accent : colors.surface,
              borderRadius: 16,
            }}
          >
            <Text style={{ color: on ? 'white' : colors.sub, fontWeight: '800', fontSize: 13 }}>
              {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8))}일
            </Text>
            <Text style={{ color: on ? 'white' : colors.muted, fontSize: 12, marginTop: 2 }}>
              {weekday(d.date, true)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
/** One day's places as a numbered timeline (screen 14). */
export function DayTimeline({
  date,
  title,
  visits,
  visitCounts,
  loading,
  editable,
  canAdd,
  highlightedVisits = [],
  onEdit,
  onVisit,
  onAdd,
}: {
  date: string;
  title: string;
  visits: any[];
  visitCounts: any[] | null;
  loading: boolean;
  editable: boolean;
  canAdd: boolean;
  highlightedVisits?: string[];
  onEdit: (visitId?: string) => void;
  onVisit: (visit: any) => void;
  onAdd: () => void;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink }}>
          {Number(date.slice(5, 7))}월 {Number(date.slice(8))}일{' '}
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.muted }}>
            {weekday(date, true)}
          </Text>
        </Text>
        {editable && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${date} 순서 편집`}
            onPress={() => onEdit()}
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' }}
          >
            <Text style={{ color: colors.sub, fontWeight: '700', fontSize: 15 }}>편집</Text>
          </Pressable>
        )}
      </View>
      {!!title && (
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub, marginTop: 6, marginBottom: 14 }}>
          {title}
        </Text>
      )}
      {!visits.length && (
        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 20, marginVertical: 8 }}>
          {/* A cancelled or expired day is read-only: do not invite the user to add places. */}
          <Text style={{ color: colors.muted, fontSize: 13 }}>{canAdd ? '가고 싶은 곳을 담아 하루를 채워보세요.' : '이 날에 담은 장소가 없어요.'}</Text>
        </View>
      )}
      {visits.map((v: any, i: number) => {
        const stat = visitCounts?.find((c) => c.visitId === v.id),
          photos = stat?.photos ?? 0,
          videos = stat?.videos ?? 0;
        return (
          <View key={v.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
            <View style={{ width: 52, alignItems: 'center', paddingTop: 4 }}>
              <View
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 14,
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: v.plannedTime ? colors.sub : colors.muted, fontSize: 12, fontWeight: '700', marginTop: 6 }}>
                {v.plannedTime ?? '시간 미정'}
              </Text>
              {editable && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${v.name} 방문 시간 수정`}
                  onPress={() => onEdit(v.id)}
                  style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.accent, fontSize: 11 }}>수정</Text>
                </Pressable>
              )}
              {i < visits.length - 1 && (
                <View style={{ flex: 1, width: 2, backgroundColor: '#F9C9C6', marginVertical: 4 }} />
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${v.name} 기록 보기`}
              onPress={() => onVisit(v)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: highlightedVisits.includes(v.id) ? colors.sage : 'white',
                borderRadius: 20,
                padding: 18,
                marginBottom: 14,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{v.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '700',
                    color: photos + videos ? colors.accent : colors.muted,
                  }}
                >
                  {loading
                    ? '집계 확인 중'
                    : !visitCounts
                      ? '기록 보기'
                      : photos + videos
                        ? `사진 ${photos} · 동영상 ${videos}`
                        : '아직 기록 없음'}
                </Text>
                <Text style={{ fontSize: 18, color: photos + videos ? colors.accent : colors.muted }}>›</Text>
              </View>
            </Pressable>
          </View>
        );
      })}
      {canAdd && (
        <Button
          secondary
          style={{ backgroundColor: 'white', borderWidth: 1, borderColor: colors.line }}
          disabled={visits.length >= 15}
          onPress={onAdd}
        >
          {visits.length >= 15 ? '장소 15개까지 등록할 수 있어요' : '장소 추가'}
        </Button>
      )}
    </View>
  );
}
