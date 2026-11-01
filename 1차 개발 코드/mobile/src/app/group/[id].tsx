import { useFocusLoad } from '../../lib/effects';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup } from '../../lib/api';
import { useAccount } from '../../lib/state';
import { usePreference, todayInSeoul } from '../../lib/preferences';
import { monthDays, moveMonth, inMonth } from '../../lib/calendar';
import { MonthGrid, MonthHeader } from '../../components/period-picker';
import { Screen, Button, Card, H, P, Badge, useAction, colors } from '../../components/ui';
export default function Group() {
  const { id, focusDate } = useLocalSearchParams<{ id: string; focusDate?: string }>(),
    { session } = useAccount();
  const [group, setGroup] = useState<any>(null),
    [schedules, setSchedules] = useState<any[]>([]);
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
        if (live) {
          setGroup(g);
          setSchedules(r.schedules);
        }
      } catch (e) {
        if (live) throw e;
      }
    });
    return () => {
      live = false;
    };
  }, [id, month, ready]);
  const owner = group?.ownerUserId === session?.userId;
  const visible = schedules.filter((x) =>
    list ? inMonth(x, month) : x.startDate <= selected && x.endDate >= selected,
  );
  return (
    <Screen
      compact
      title={group?.name ?? '모임 달력'}
      footer={
        owner ? (
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
        ) : undefined
      }
    >
      {group && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Badge>
            {group.activeCount}/10명 {owner ? '· 방장' : '· 참여자'}
          </Badge>
          <Button secondary onPress={() => router.push(`/group/manage?id=${id}`)}>
            참여자 ›
          </Button>
        </View>
      )}
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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[
            [false, '달력'],
            [true, '일정 목록'],
          ].map(([value, label]) => (
            <Pressable
              key={String(label)}
              accessibilityRole="tab"
              accessibilityState={{ selected: list === value }}
              onPress={() => setCalendar({ ...calendar, list: !!value })}
              style={{
                padding: 12,
                minHeight: 48,
                backgroundColor: list === value ? colors.sage : '#F2F4F6',
                borderRadius: 10,
              }}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          secondary
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
      <Button secondary onPress={() => router.push(`/group/invites?id=${id}`)}>
        초대·관리 ›
      </Button>
      {!list && (
        <Card style={{ padding: 0, backgroundColor: '#F7F8FA', borderWidth: 0 }}>
          <MonthGrid
            month={month}
            selected={selected}
            schedules={schedules}
            onSelect={(date) =>
              setCalendar({ ...calendar, month: date.slice(0, 7), selected: date })
            }
          />
        </Card>
      )}
      <H>{list ? `${month}의 일정` : `${selected} 일정`}</H>
      {visible.map((x) => (
        <View key={x.id}>
          <Card
            onPress={() => router.push(`/schedule/${x.id}`)}
            style={{ backgroundColor: '#F2F4F6', borderWidth: 0 }}
          >
            <Badge>
              {x.status === 'cancelled' ? '취소된 일정' : `${x.startDate} ~ ${x.endDate}`}
            </Badge>
            <H>{x.title}</H>
            <P>계획과 기록 보기 ›</P>
          </Card>
          {owner && x.status === 'active' && (
            <Button
              secondary
              onPress={() =>
                router.push({ pathname: '/schedule/edit', params: { id: x.id, groupId: id } })
              }
            >
              일정 변경 · {x.title}
            </Button>
          )}
        </View>
      ))}
      {a.hasRun && !a.busy && !a.error && !visible.length && (
        <P>{list ? '이 달에 등록된 일정이 없어요.' : '이 날짜에 등록된 일정이 없어요.'}</P>
      )}
      {a.errorView}
    </Screen>
  );
}
