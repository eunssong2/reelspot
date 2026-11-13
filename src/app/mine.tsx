import { useFocusLoad } from '../lib/effects';
import React, { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useAccount } from '../lib/state';
import { retentionNotice } from '../lib/retention';
import { todayInSeoul } from '../lib/preferences';
import { Records } from '../components/records';
import { Screen, Button, Card, H, P, useAction, Chip } from '../components/ui';
export default function Mine() {
  const [items, setItems] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null),
    [status, setStatus] = useState(''),
    [groupId, setGroupId] = useState(''),
    [groups, setGroups] = useState<{ id: string; name: string }[]>([]),
    [order, setOrder] = useState('newest');
  const generation = useRef(0);
  const a = useAction();
  const { session, profile } = useAccount();
  const today = todayInSeoul();
  async function load(cursor?: string) {
    const request = ++generation.current;
    const q = new URLSearchParams({ order });
    if (groupId) q.set('groupId', groupId);
    if (cursor) q.set('cursor', cursor);
    if (status) q.set('status', status);
    const r = await api(`/me/media?${q}`).catch((error) => { if (request !== generation.current) return null; throw error; });
    if (!r || request !== generation.current) return;
    setGroups(r.groups ?? []);
    setItems((old) => (cursor ? [...old, ...r.items] : r.items));
    setNext(r.nextCursor);
  }
  useFocusLoad(() => {
    setItems([]); setNext(null);
    a.run(() => load());
    return () => { generation.current++; };
  }, [status, groupId, order]);
  return (
    <Screen
      title="내가 올린 기록"
      compact
      subtitle="모임에서 나간 뒤에도 본인 기록을 열람하고 삭제할 수 있어요."
    >
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
      >
        {Object.entries({
          '': '전체',
          active_membership: '참여 중',
          ended_membership: '참여 종료',
          expired: '만료됨',
        }).map(([value, label]) => (
          <Chip key={value} selected={status === value} onPress={() => setStatus(value)}>
            {label}
          </Chip>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        <Chip selected={!groupId} onPress={() => setGroupId('')}>모든 모임</Chip>
        {groups.map((g) => <Chip key={g.id} selected={groupId === g.id} onPress={() => setGroupId(g.id)}>{g.name}</Chip>)}
      </ScrollView>
      <Button secondary onPress={() => setOrder(order === 'newest' ? 'expires_first' : 'newest')}>
        {order === 'newest' ? '최근 기록순 ↕' : '보관 기한 임박순 ↕'}
      </Button>
      {a.hasRun && !a.busy && !a.error && !items.length && (
        <P>선택한 조건에 맞는 본인 기록이 없습니다.</P>
      )}
      {items.map((i) => (
        <Card key={i.media.id}>
          <H>
            {i.groupName} · {i.scheduleTitle}
          </H>
          <P>
            {i.membershipState === 'active' ? '참여 중' : '참여 종료'} · {i.media.recordDate} ·{' '}
            {i.media.retentionLastDate}까지
          </P>
          {!!i.media.retentionLastDate && i.media.accessState === 'available' && !!retentionNotice(i.media.retentionLastDate, today) && (
            <P>⏱ {retentionNotice(i.media.retentionLastDate, today)}</P>
          )}
          <Records
            items={[{ ...i.media, displayName: i.media.displayName ?? profile?.displayName }]}
            avatars={session ? { [session.userId]: profile?.avatarVersion ?? null } : {}}
            context="mine"
            allowSave={
              i.membershipState === 'active' &&
              i.groupState === 'active' &&
              i.media.accessState === 'available'
            }
          />
        </Card>
      ))}
      {next && (
        <Button secondary onPress={() => a.run(() => load(next))}>
          더 보기
        </Button>
      )}
      {a.errorView}
    </Screen>
  );
}
