import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { Records } from '../components/records';
import { Screen, Button, Card, H, P, useAction } from '../components/ui';
export default function Mine() {
  const [items, setItems] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null), [status, setStatus] = useState('');
  const a = useAction();
  async function load(cursor?: string) {
    const q = new URLSearchParams(); if (cursor) q.set('cursor', cursor); if (status) q.set('status', status);
    const r = await api(`/me/media?${q}`);
    setItems((old) => (cursor ? [...old, ...r.items] : r.items));
    setNext(r.nextCursor);
  }
  useFocusLoad(() => {
    a.run(() => load());
  }, [status]);
  return (
    <Screen
      title="내가 올린 기록"
      subtitle="모임에서 나간 뒤에도 본인 기록을 열람하고 삭제할 수 있어요."
    >
      <Button
        secondary
        onPress={() => router.push({ pathname: '/edit-records', params: { allOwn: 'true' } })}
      >
        여러 모임의 내 기록 선택·삭제
      </Button>
      {Object.entries({ '': '전체', active_membership: '참여 중', ended_membership: '참여 종료', expired: '만료됨' }).map(([value,label]) => <Button key={value} secondary={status !== value} onPress={() => setStatus(value)}>{label}</Button>)}
      {a.hasRun && !a.busy && !a.error && !items.length && <P>선택한 조건에 맞는 본인 기록이 없습니다.</P>}
      {items.map((i) => (
        <Card key={i.media.id}>
          <H>
            {i.groupName} · {i.scheduleTitle}
          </H>
          <P>
            {i.membershipState === 'active' ? '참여 중' : '참여 종료'} · {i.media.recordDate} ·{' '}
            {i.media.retentionLastDate}까지
          </P>
          <Records
            items={[i.media]}
            context="mine"
            allowSave={i.membershipState === 'active' && i.groupState === 'active' && i.media.accessState === 'available'}
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
