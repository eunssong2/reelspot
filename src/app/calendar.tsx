import React, { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useFocusLoad } from '../lib/effects';
import { useAccount } from '../lib/state';
import { monthDays, moveMonth } from '../lib/calendar';
import { todayInSeoul } from '../lib/preferences';
import { groupDays, dayLabel, type GroupDay } from '../lib/day-labels';
import { MonthGrid, MonthHeader } from '../components/period-picker';
import { Screen, Card, H, P, Chip, Button, useAction } from '../components/ui';

type Entry = GroupDay & { groupId: string; groupName: string };
/** C02: only current memberships contribute; preserved personal records remain in Settings. */
export default function Calendar() {
  const { session } = useAccount();
  const [month, setMonth] = useState(todayInSeoul().slice(0, 7));
  const [selected, setSelected] = useState(todayInSeoul());
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const generation = useRef(0);
  const a = useAction();
  async function load() {
    const request = ++generation.current;
    try {
    const current: { id: string; name: string }[] = [];
    let cursor: string | null = null;
    do {
      const r: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      current.push(...r.items); cursor = r.nextCursor;
    } while (cursor);
    const range = monthDays(month);
    const next: Entry[] = [];
    // Bound concurrency for accounts with many groups, and publish the month atomically.
    for (let i = 0; i < current.length; i += 4) {
      if (generation.current !== request) return;
      await Promise.all(current.slice(i, i + 4).map(async (g) => {
        const r = await api(`/groups/${g.id}/calendar?from=${range[0]}&to=${range[41]}`);
        next.push(...groupDays(r.schedules).map((d) => ({ ...d, groupId: g.id, groupName: g.name })));
      }));
    }
    if (generation.current !== request) return;
    setGroups(current); setEntries(next.sort((a, b) => a.date.localeCompare(b.date) || a.groupName.localeCompare(b.groupName))); setLoaded(true);
    if (groupId && !current.some((g) => g.id === groupId)) setGroupId('');
    } catch (error) { if (generation.current === request) throw error; }
  }
  useFocusLoad(() => {
    setLoaded(false); setEntries([]);
    if (session) void a.run(load);
    return () => { generation.current++; };
  }, [month, session?.userId]);
  const filtered = entries.filter((d) => !groupId || d.groupId === groupId);
  const labels = Object.fromEntries([...new Set(filtered.map((d) => d.date))].map((date) => {
    const days = filtered.filter((d) => d.date === date);
    return [date, { text: days.length > 1 ? `${days.length}개 일정` : dayLabel(days[0]), cancelled: days.every((d) => d.status === 'cancelled') }];
  }));
  const shown = filtered.filter((d) => d.date === selected);
  return <Screen title="모든 모임 일정" tabs back={false}>
    <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
      <Chip selected={!groupId} onPress={() => setGroupId('')}>모든 모임</Chip>
      {groups.map((g) => <Chip key={g.id} selected={groupId === g.id} onPress={() => setGroupId(g.id)}>{g.name}</Chip>)}
    </ScrollView>
    <MonthHeader month={month} onMove={(n) => { const m = moveMonth(month, n); setMonth(m); setSelected(`${m}-01`); }} />
    <MonthGrid month={month} selected={selected} labels={labels} onSelect={(date) => { setSelected(date); setMonth(date.slice(0, 7)); }} />
    {shown.map((d) => <Card key={`${d.groupId}:${d.scheduleId}:${d.date}`} onPress={() => router.push({ pathname: '/schedule/[id]', params: { id: d.scheduleId, date: d.date } })}>
      <H>{d.groupName}</H><P>{dayLabel(d)}{d.status === 'cancelled' ? ' · 취소된 일정' : ''}</P>
    </Card>)}
    {loaded && !shown.length && <P>선택한 날짜에 일정이 없어요.</P>}
    {a.busy && <P>모임의 일정을 불러오고 있어요.</P>}
    {a.errorView}
    <Button secondary onPress={() => router.push('/mine')}>내가 올린 기록 보기</Button>
  </Screen>;
}
