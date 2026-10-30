import React from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Card, H, P, Button, colors } from './ui';
export function SchedulePlan({
  days,
  highlightedVisits = [],
  date,
  counts,
  visitCounts,
  loading,
  onDate,
  onVisit,
  onEdit,
  onAdd,
  active,
}: {
  days: any[];
  highlightedVisits?: string[];
  date: string;
  counts: any[] | null;
  visitCounts: any[] | null;
  loading: boolean;
  onDate: (date: string) => void;
  onVisit: (visit: any) => void;
  onEdit: (date: string) => void;
  onAdd: (date: string) => void;
  active: boolean;
}) {
  const width = (useWindowDimensions().width - 40) / 4;
  const within = days.filter((d) => !d.outsideRange);
  return (
    <>
      <Button secondary onPress={() => onDate('')}>
        전체 날짜 {date ? '보기' : '✓'}
      </Button>
      {within.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          decelerationRate="fast"
        >
          {within.map((d) => (
            <Pressable
              key={d.date}
              accessibilityRole="tab"
              accessibilityLabel={`${d.date} 장소`}
              accessibilityState={{ selected: date === d.date }}
              onPress={() => onDate(d.date)}
              style={{
                width,
                minHeight: 64,
                padding: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: date === d.date ? colors.accent : '#F2F4F6',
                borderRadius: 16,
              }}
            >
              <Text style={{ color: date === d.date ? 'white' : colors.ink, fontWeight: '700' }}>
                {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8))}일
              </Text>
              <Text style={{ color: date === d.date ? 'white' : colors.muted, fontSize: 12 }}>
                {new Date(`${d.date}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
                  weekday: 'long',
                  timeZone: 'Asia/Seoul',
                })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {days
        .filter((d) => !date || d.date === date)
        .map((d) => {
          const stats = counts?.find((c) => c.date === d.date);
          return (
            <View key={d.date} style={{ marginTop: 24 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <H>
                  {d.date}
                  {d.outsideRange ? ' · 기간 밖' : ''}
                </H>
                {!d.outsideRange && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${d.date} 계획 편집`}
                    onPress={() => onEdit(d.date)}
                    style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.accent }}>편집</Text>
                  </Pressable>
                )}
              </View>
              {d.title ? <P>{d.title}</P> : null}
              <P>
                장소 {d.visits.length}/15곳 ·{' '}
                {loading
                  ? '집계 확인 중'
                  : counts
                    ? `사진 ${stats?.photos ?? 0} · 영상 ${stats?.videos ?? 0}`
                    : '집계를 불러오지 못했어요'}
              </P>
              {!d.visits.length && (
                <Card>
                  <P>가고 싶은 곳을 담아 하루를 채워보세요.</P>
                </Card>
              )}
              {d.visits.map((v: any, i: number) => {
                const stat = visitCounts?.find((c) => c.visitId === v.id);
                return (
                  <View key={v.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
                    <View style={{ width: 58, alignItems: 'center', paddingTop: 16 }}>
                      <View
                        style={{
                          backgroundColor: colors.accent,
                          borderRadius: 16,
                          width: 30,
                          height: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: '700' }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: colors.ink, fontSize: 12, marginTop: 6 }}>
                        {v.plannedTime ?? '시간 미정'}
                      </Text>
                      {!d.outsideRange && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${v.name} 방문 시간 수정`}
                          onPress={() => onEdit(d.date)}
                          style={{ minHeight: 48, justifyContent: 'center' }}
                        >
                          <Text style={{ color: colors.accent, fontSize: 12 }}>수정</Text>
                        </Pressable>
                      )}
                    </View>
                    <Card
                      style={{
                        flex: 1,
                        backgroundColor: highlightedVisits.includes(v.id)
                          ? colors.sage
                          : colors.paper,
                      }}
                      onPress={() => onVisit({ ...v, visitDate: d.date })}
                    >
                      <H>{v.name}</H>
                      <P>
                        {loading
                          ? '집계 확인 중'
                          : visitCounts
                            ? `사진 ${stat?.photos ?? 0} · 영상 ${stat?.videos ?? 0} ›`
                            : '집계 조회 실패 · 기록 보기 ›'}
                      </P>
                    </Card>
                  </View>
                );
              })}
              {active && !d.outsideRange && (
                <Button secondary disabled={d.visits.length >= 15} onPress={() => onAdd(d.date)}>
                  {d.visits.length >= 15 ? '장소 15개까지 등록할 수 있어요' : '＋ 장소 추가'}
                </Button>
              )}
            </View>
          );
        })}
    </>
  );
}
