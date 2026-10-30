import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { useFocusLoad } from '../lib/effects';
import { api } from '../lib/api';
import { Avatar, MenuRow } from '../components/profile-ui';
import { Screen, Card, P, H, Button, colors, useAction } from '../components/ui';
export default function MyPage() {
  const { profile, refresh } = useAccount();
  const [count, setCount] = useState<number | null>(null);
  const a = useAction();
  useFocusLoad(() => {
    let live = true;
    setCount(null);
    void a.run(async () => {
      await refresh();
      const ids = new Set<string>();
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const r: any = await api(`/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (!live) return;
        r.items.forEach((g: any) => ids.add(g.id));
        cursor = r.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error('모임 목록을 다시 불러와 주세요.');
        if (cursor) seen.add(cursor);
      } while (cursor);
      if (live) setCount(ids.size);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <Screen title="마이페이지">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginVertical: 20 }}>
        <Avatar name={profile?.displayName ?? '나'} size={88} />
        <View style={{ flex: 1 }}>
          <H>{profile?.displayName ?? '불러오는 중'}</H>
          <P>함께한 순간을 기록하는 중</P>
        </View>
      </View>
      <Card style={{ backgroundColor: '#F2F4F6' }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <P>현재 참여 중인 모임</P>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>
            {count === null ? '—' : `${count}개`}
          </Text>
        </View>
      </Card>
      <Button secondary onPress={() => router.push('/account')}>
        닉네임 변경 · 계정
      </Button>
      <MenuRow label="내가 올린 기록" onPress={() => router.push('/mine')} />
      <MenuRow label="설정" onPress={() => router.push('/settings')} />
      <MenuRow label="고객센터" onPress={() => router.push('/inquiry')} />
      {a.errorView}
    </Screen>
  );
}
