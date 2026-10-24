import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { api, API, currentSession } from '../lib/api';
import { Screen, Button, Card, H, P, Badge, useAction } from '../components/ui';
export default function Home() {
  const { session, profile, ready } = useAccount(),
    [groups, setGroups] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null);
  const a = useAction();
  useFocusLoad(() => {
    if (ready && !session) router.replace('/login');
    else if (profile?.status === 'onboarding') router.replace('/onboarding');
    else if (session)
      a.run(async () => {
        const r = await api('/groups');
        setGroups(r.items);
        setNext(r.nextCursor);
      });
  }, [ready, session?.userId, profile?.status]);
  if (!ready) return <ActivityIndicator />;
  return (
    <Screen title="함께한 순간들" subtitle="모임의 일정마다, 우리의 기록을 모아요." back={false}>
      <Button onPress={() => router.push('/group/new')}>새 모임 만들기</Button>
      <Button secondary onPress={() => router.push('/invite')}>
        초대 코드로 참여
      </Button>
      {groups.map((g) => (
        <Card key={g.id} onPress={() => router.push(`/group/${g.id}`)}>
          <Badge>{g.activeCount} / 10명</Badge>
          {g.coverAssetId && (
            <Image
              accessibilityLabel={`${g.name} 대표 사진`}
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginVertical: 8 }}
              source={[{
                uri: `${API}/v1/groups/${g.id}/cover`,
                headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
              }]}
            />
          )}
          <H>{g.name}</H>
          <P>
            {g.scheduleSummary
              ? `${g.scheduleSummary.title} · ${g.scheduleSummary.startDate}`
              : '등록된 일정이 없어요.'}
          </P>
        </Card>
      ))}
      {next && (
        <Button
          secondary
          onPress={() =>
            a.run(async () => {
              const r = await api(`/groups?cursor=${encodeURIComponent(next)}`);
              setGroups((old) => [...old, ...r.items]);
              setNext(r.nextCursor);
            })
          }
        >
          모임 더 보기
        </Button>
      )}
      {a.hasRun && !a.busy && !a.error && !groups.length && (
        <Card>
          <H>첫 모임을 시작해 보세요</H>
          <P>모임을 만들거나 받은 초대로 참여하면 함께 찍은 사진과 영상을 모을 수 있어요.</P>
        </Card>
      )}
      {a.errorView}
      <Button secondary onPress={() => router.push('/settings')}>
        설정 · 내가 올린 기록
      </Button>
    </Screen>
  );
}
