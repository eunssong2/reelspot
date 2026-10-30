import { useFocusLoad } from '../../lib/effects';
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, getGroup } from '../../lib/api';
import { useAccount } from '../../lib/state';
import { usePreference, todayInSeoul } from '../../lib/preferences';
import { Screen, Button, Card, H, P, Badge, useAction, colors, s } from '../../components/ui';
export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>(), { session } = useAccount();
  const [group, setGroup] = useState<any>(null), [schedules, setSchedules] = useState<any[]>([]);
  const [calendar, setCalendar, ready] = usePreference(`calendar:${id}`, { month: todayInSeoul().slice(0, 7), selected: '', list: false });
  const { month, selected, list } = calendar, a = useAction();
  useFocusLoad(() => {
    if (!ready) return;
    let live = true;
    a.run(async () => {
      const g = await getGroup(id);
      const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
      const r = await api(`/groups/${id}/calendar?from=${month}-01&to=${month}-${String(end).padStart(2, '0')}`);
      if (live) { setGroup(g); setSchedules(r.schedules); }
    });
    return () => { live = false; };
  }, [id, month, ready]);
  const owner = group?.ownerUserId === session?.userId,
    days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate(),
    offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  function move(delta: number) {
    const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta);
    setCalendar({ ...calendar, month: d.toISOString().slice(0, 7), selected: '' });
  }
  const visible = schedules.filter((x) => !selected || (x.startDate <= selected && x.endDate >= selected));
  return <Screen title={group?.name ?? '모임 달력'} subtitle="일정을 열어 계획과 기록을 함께 살펴보세요.">
    <View style={s.row}>
      <Button secondary onPress={() => move(-1)}>이전 달</Button><H>{month.replace('-', '년 ')}월</H>
      <Button secondary onPress={() => move(1)}>다음 달</Button>
      <Button secondary onPress={() => setCalendar({ ...calendar, month: todayInSeoul().slice(0, 7), selected: todayInSeoul() })}>오늘</Button>
      <Button secondary onPress={() => setCalendar({ ...calendar, list: !list })}>{list ? '달력' : '목록'}</Button>
      {selected && <Button secondary onPress={() => setCalendar({ ...calendar, selected: '' })}>이 달 전체 일정</Button>}
    </View>
    {!list && <Card style={{ padding: 0 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {['월', '화', '수', '목', '금', '토', '일'].map((d) => <Text key={d} style={{ width: '14.28%', textAlign: 'center', color: colors.muted, paddingVertical: 10 }}>{d}</Text>)}
      {Array.from({ length: offset }, (_, i) => <View key={`empty${i}`} style={{ width: '14.28%' }} />)}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`, events = schedules.filter((x) => x.startDate <= date && x.endDate >= date);
        return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date} 일정 ${events.length}개`} accessibilityState={{ selected: selected === date }}
          onPress={() => setCalendar({ ...calendar, selected: selected === date ? '' : date })}
          style={{ width: '14.28%', minHeight: 76, padding: 4, backgroundColor: selected === date ? colors.sage : 'transparent', borderRadius: 8 }}>
          <Text style={{ textAlign: 'center', fontWeight: date === todayInSeoul() ? 'bold' : 'normal' }}>{i + 1}</Text>
          {events.slice(0, 3).map((x) => <Text key={x.id} numberOfLines={1} style={{ fontSize: 10, color: x.status === 'cancelled' ? colors.muted : colors.accent, textDecorationLine: x.status === 'cancelled' ? 'line-through' : 'none' }}>{x.status === 'cancelled' ? '취소 ' : ''}{x.title}</Text>)}
          {events.length > 3 && <Text style={{ fontSize: 10 }}>+{events.length - 3}개</Text>}
        </Pressable>;
      })}
    </View></Card>}
    {selected && <H>{selected} 일정</H>}
    {!a.busy && visible.map((x) => <Card key={x.id} onPress={() => router.push(`/schedule/${x.id}`)}><Badge>{x.status === 'cancelled' ? '취소된 일정' : `${x.startDate} ~ ${x.endDate}`}</Badge><H>{x.title}</H><P>계획과 기록 보기 →</P></Card>)}
    {a.hasRun && !a.busy && !a.error && !visible.length && <P>{selected ? '이 날짜에 등록된 일정이 없어요.' : '이 달에 등록된 일정이 없어요.'}</P>}
    {owner && <Button onPress={() => router.push({ pathname: '/schedule/edit', params: { groupId: id } })}>일정 추가</Button>}
    <Button secondary onPress={() => router.push(`/group/manage?id=${id}`)}>참여자 · 초대 · 모임 관리</Button>
    {a.errorView}
  </Screen>;
}
