import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useGroupCalendar } from '../../lib/group-calendar';
import { useAccount } from '../../lib/state';
import { usePreference, todayInSeoul } from '../../lib/preferences';
import { moveMonth } from '../../lib/calendar';
import { dateHeading, dayLabel, groupDays, shortDate, type GroupDay } from '../../lib/day-labels';
import { MonthHeader } from '../../components/period-picker';
import { Avatar } from '../../components/profile-ui';
import { Screen, Button, Card, P, Sheet, colors, TextButton, resetTo } from '../../components/ui';
export default function Group() {
  const { id, focusDate } = useLocalSearchParams<{ id: string; focusDate?: string }>(),
    { session } = useAccount();
  const [menuDay, setMenuDay] = useState<GroupDay | null>(null);
  const [calendar, setCalendar, ready] = usePreference(`calendar:${id}`, {
    month: todayInSeoul().slice(0, 7),
    selected: todayInSeoul(),
  });
  const focused = useRef('');
  useEffect(() => {
    if (ready && focusDate && focused.current !== `${id}:${focusDate}`) {
      focused.current = `${id}:${focusDate}`;
      setCalendar((old) => ({ ...old, month: focusDate.slice(0, 7), selected: focusDate }));
    }
  }, [ready, focusDate, id, setCalendar]);
  const { month, selected } = calendar;
  const state = useGroupCalendar(session?.userId, id, month, ready);
  const { group, schedules, members, plans } = state;
  if (state.denied) return (
    <Screen compact title="모임 일정" back={false} footer={<Button onPress={() => resetTo('/')}>내 모임으로</Button>}>
      <P>이 모임을 확인할 수 없어요.</P>
    </Screen>
  );
  const owner = group?.ownerUserId === session?.userId;
  const ownerMember = members.find((m) => m.isOwner);
  const days = groupDays(schedules);
  const visible = days.filter((d) => d.date.startsWith(month));
  function dayCard(d: GroupDay) {
    const plan = plans[d.scheduleId]?.find((p) => p.date === d.date),
      count = plan?.visitCount ?? d.visitCount,
      first = plan?.visits?.[0]?.name,
      cancelled = d.status === 'cancelled';
    return (
      <Card
        key={`${d.scheduleId}:${d.date}`}
        onPress={() =>
          router.push({ pathname: '/schedule/[id]', params: { id: d.scheduleId, date: d.date } })
        }
        style={{ backgroundColor: colors.surface, borderWidth: 0, borderRadius: 22, padding: 18 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 17,
                fontWeight: '800',
                color: cancelled ? colors.muted : colors.ink,
                textDecorationLine: cancelled ? 'line-through' : 'none',
              }}
            >
              {dayLabel(d)}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
              {shortDate(d.date)}
              {count ? ` · 장소 ${count}곳` : ''}
              {cancelled ? ' · 취소된 일정' : ''}
            </Text>
            {!cancelled && d.date >= todayInSeoul() && <P>{d.date === todayInSeoul() ? '진행 중' : '진행 예정'}</P>}
            {!!first && (
              <Text
                numberOfLines={1}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.sub,
                  backgroundColor: 'white',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {first}
                {count > 1 ? ` 외 ${count - 1}` : ''}
              </Text>
            )}
          </View>
          {owner && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(d)} 메뉴`}
              onPress={() => setMenuDay(d)}
              style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22, color: colors.sub }}>⋯</Text>
            </Pressable>
          )}
        </View>
      </Card>
    );
  }
  return (
    <Screen
      compact
      title={group?.name ?? '모임 달력'}
      footer={
        <>
        <Button secondary disabled={state.busy || !group} onPress={() => router.push({ pathname: '/vlog', params: { groupId: id } })}>브이로그 만들기</Button>
        {owner ? (
          <Button
            disabled={state.busy}
            onPress={() =>
              router.push({
                pathname: '/schedule/edit',
                params: { groupId: id, date: selected || `${month}-01` },
              })
            }
          >
            ＋ 일정 추가
          </Button>
        ) : null}
        </>
      }
    >
      {state.busy && !state.loaded && <View accessibilityRole="progressbar" accessibilityLabel="일정을 불러오는 중">
        <ActivityIndicator color={colors.accent} /><P>일정을 불러오는 중</P>
      </View>}
      {state.failed && <View accessibilityRole="alert" style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 12, gap: 8 }}>
        <P>{state.loaded ? '최신 정보를 불러오지 못했어요' : '일정을 불러오지 못했어요'}</P>
        <TextButton onPress={state.retry}>다시 시도</TextButton>
      </View>}
      <Sheet
        visible={!!menuDay}
        title={menuDay ? dayLabel(menuDay) : ''}
        onClose={() => setMenuDay(null)}
      >
        {menuDay && <P>{shortDate(menuDay.date)}</P>}
        <Button
          onPress={() => {
            const d = menuDay!;
            setMenuDay(null);
            router.push({
              pathname: '/schedule/day',
              params: { scheduleId: d.scheduleId, date: d.date },
            });
          }}
        >
          일정 변경
        </Button>
        <Button secondary onPress={() => setMenuDay(null)}>
          닫기
        </Button>
      </Sheet>
      {group && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`함께하는 친구 ${group.activeCount}명 보기`}
          onPress={() => router.push(`/group/manage?id=${id}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            minHeight: 48,
            borderRadius: 16,
            marginBottom: 12,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={{ color: colors.accent, fontSize: 12 }}>●</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>
            {group.activeCount === 1 ? '혼자 기록 중 · 친구를 초대해 보세요' : `${group.activeCount}명 함께 기록 중`}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 12,
              fontWeight: '700',
              color: colors.accent,
              backgroundColor: colors.sage,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            방장{ownerMember ? ` ${ownerMember.displayName}` : ''}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row' }}>
            {members.slice(0, 2).map((m, i) => (
              <View key={m.id} style={{ marginLeft: i ? -6 : 0 }}>
                <Avatar
                  initial
                  name={m.displayName}
                  size={26}
                  userId={m.userId}
                  avatarVersion={m.avatarVersion}
                />
              </View>
            ))}
            {members.length > 2 && (
              <View
                style={{
                  marginLeft: -6,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>
                  +{members.length - 2}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MonthHeader
          month={month}
          onMove={(n) =>
            setCalendar({
              ...calendar,
              month: moveMonth(month, n),
              selected: `${moveMonth(month, n)}-01`,
            })
          }
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        <TextButton color={colors.sub} onPress={() => router.push(`/group/invites?id=${id}`)}>
          초대·관리 ›
        </TextButton>
      </View>
      {[...new Set(visible.map((d) => d.date))].map((date) => (
            <View key={date}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginTop: 14 }}>
                {dateHeading(date)}
              </Text>
              {visible.filter((d) => d.date === date).map(dayCard)}
            </View>
          ))}
      {state.loaded && !visible.length && (
        <P>이 달에 등록된 일정이 없어요.</P>
      )}

    </Screen>
  );
}
