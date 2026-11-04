import { useFocusLoad } from '../../lib/effects';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup } from '../../lib/api';
import { useAccount } from '../../lib/state';
import { usePreference, todayInSeoul } from '../../lib/preferences';
import { monthDays, moveMonth } from '../../lib/calendar';
import { dateHeading, dayLabel, groupDays, shortDate, type GroupDay } from '../../lib/day-labels';
import { MonthGrid, MonthHeader, type DayChip } from '../../components/period-picker';
import { Avatar } from '../../components/profile-ui';
import { Screen, Button, Card, P, Sheet, useAction, colors, TextButton } from '../../components/ui';
export default function Group() {
  const { id, focusDate } = useLocalSearchParams<{ id: string; focusDate?: string }>(),
    { session } = useAccount();
  const [group, setGroup] = useState<any>(null),
    [schedules, setSchedules] = useState<any[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [plans, setPlans] = useState<Record<string, any[]>>({}),
    [menuDay, setMenuDay] = useState<GroupDay | null>(null);
  const [calendar, setCalendar, ready] = usePreference(`calendar:${id}`, {
    month: todayInSeoul().slice(0, 7),
    selected: todayInSeoul(),
    list: false,
  });
  const focused = useRef('');
  useEffect(() => {
    if (ready && focusDate && focused.current !== `${id}:${focusDate}`) {
      focused.current = `${id}:${focusDate}`;
      setCalendar((old) => ({ ...old, month: focusDate.slice(0, 7), selected: focusDate }));
    }
  }, [ready, focusDate, id, setCalendar]);
  const { month, selected, list } = calendar,
    a = useAction();
  useFocusLoad(() => {
    if (!ready) return;
    let live = true;
    setSchedules([]);
    void a.run(async () => {
      try {
        const days = monthDays(month);
        const [g, r] = await Promise.all([
          getGroup(id),
          api(`/groups/${id}/calendar?from=${days[0]}&to=${days[41]}`),
        ]);
        if (!live) return;
        setGroup(g);
        setSchedules(r.schedules);
        api(`/groups/${id}/members`)
          .then((m) => live && setMembers(m.members))
          .catch(() => {});
        // Day cards show the first place of each date, which only the schedule detail has.
        const details = await Promise.allSettled(
          r.schedules
            .filter((x: any) => x.status !== 'deleted')
            .slice(0, 20)
            .map((x: any) => api(`/schedules/${x.id}`)),
        );
        if (live)
          setPlans(
            Object.fromEntries(
              details
                .filter((d) => d.status === 'fulfilled')
                .map((d: any) => [d.value.schedule.id, d.value.plan]),
            ),
          );
      } catch (e) {
        if (live) throw e;
      }
    });
    return () => {
      live = false;
    };
  }, [id, month, ready]);
  const owner = group?.ownerUserId === session?.userId;
  const ownerMember = members.find((m) => m.isOwner);
  const days = groupDays(schedules);
  const labels: Record<string, DayChip> = {};
  for (const d of days)
    if (!labels[d.date] || (labels[d.date].cancelled && d.status === 'active'))
      labels[d.date] = { text: dayLabel(d), cancelled: d.status === 'cancelled' };
  const visible = list
    ? days.filter((d) => d.date.startsWith(month))
    : days.filter((d) => d.date === selected);
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
              numberOfLines={1}
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
          {owner && !cancelled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(d)} 메뉴`}
              onPress={() => setMenuDay(d)}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
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
        <Button secondary disabled={a.busy || !group} onPress={() => router.push({ pathname: '/vlog', params: { groupId: id } })}>브이로그 만들기</Button>
        {owner ? (
          <Button
            disabled={a.busy}
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
            {group.activeCount}/10명
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
        <Button
          secondary
          small
          style={{ borderRadius: 20, minHeight: 40, paddingHorizontal: 16 }}
          onPress={() =>
            setCalendar({
              ...calendar,
              month: todayInSeoul().slice(0, 7),
              selected: todayInSeoul(),
            })
          }
        >
          오늘
        </Button>
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
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 14,
          }}
        >
          {(
            [
              [false, '달력'],
              [true, '일정 목록'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: list === value }}
              onPress={() => setCalendar({ ...calendar, list: value })}
              style={{
                paddingHorizontal: 14,
                minHeight: 36,
                justifyContent: 'center',
                backgroundColor: list === value ? '#FFFFFF' : colors.surface,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontWeight: list === value ? '800' : '500',
                  color: list === value ? colors.ink : colors.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextButton color={colors.sub} onPress={() => router.push(`/group/invites?id=${id}`)}>
          초대·관리 ›
        </TextButton>
      </View>
      {!list && (
        <Card style={{ padding: 4, backgroundColor: colors.surface, borderWidth: 0, borderRadius: 22 }}>
          <MonthGrid
            month={month}
            selected={selected}
            labels={labels}
            onSelect={(date) =>
              setCalendar({ ...calendar, month: date.slice(0, 7), selected: date })
            }
          />
        </Card>
      )}
      {list
        ? [...new Set(visible.map((d) => d.date))].map((date) => (
            <View key={date}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginTop: 14 }}>
                {dateHeading(date)}
              </Text>
              {visible.filter((d) => d.date === date).map(dayCard)}
            </View>
          ))
        : visible.map(dayCard)}
      {a.hasRun && !a.busy && !a.error && !visible.length && (
        <P>{list ? '이 달에 등록된 일정이 없어요.' : `${dateHeading(selected)}에는 일정이 없어요.`}</P>
      )}
      {a.errorView}
    </Screen>
  );
}
