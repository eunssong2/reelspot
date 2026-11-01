import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { api, API, currentSession } from '../lib/api';
import { todayInSeoul } from '../lib/preferences';
import { Screen, Button, Card, H, P, colors, useAction } from '../components/ui';
export default function Home() {
  const { session, profile, ready } = useAccount(),
    [groups, setGroups] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null);
  const a = useAction();
  useFocusLoad(() => {
    if (ready && !session) {
      router.replace('/login');
      return;
    }
    if (profile?.status === 'onboarding') {
      router.replace('/onboarding');
      return;
    }
    let live = true;
    if (session)
      void a.run(async () => {
        const r = await api('/groups');
        if (live) {
          setGroups(r.items);
          setNext(r.nextCursor);
        }
      });
    return () => {
      live = false;
    };
  }, [ready, session?.userId, profile?.status]);
  if (!ready || !session)
    return (
      <Screen title="At that place" back={false}>
        <ActivityIndicator color={colors.accent} />
        <P>로그인 상태를 확인하고 있어요.</P>
      </Screen>
    );
  return (
    <Screen
      compact
      title="함께하는 모임"
      back={false}
      tabs
      subtitle="최근 공동 활동순"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button secondary onPress={() => router.push('/invite')}>
              초대 코드로 참여
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={() => router.push('/group/new')}>＋ 모임 만들기</Button>
          </View>
        </View>
      }
    >
      {groups.map((g) => {
        const x = g.scheduleSummary,
          summary = x
            ? `${x.startDate <= todayInSeoul() && x.endDate >= todayInSeoul() ? '진행 중' : x.startDate > todayInSeoul() ? '다음 일정' : '최근 일정'}: ${x.title}`
            : '아직 일정이 없어요';
        return (
          <Card
            key={g.id}
            onPress={() => router.push(`/group/${g.id}`)}
            style={{ backgroundColor: '#F2F4F6', borderWidth: 0, padding: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {g.coverAssetId ? (
                <Image
                  accessibilityLabel={`${g.name} 대표 사진`}
                  style={{ width: 64, height: 64, borderRadius: 14 }}
                  source={{
                    uri: `${API}/v1/groups/${g.id}/cover`,
                    headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    backgroundColor: colors.sage,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.accent, fontSize: 28 }}>{g.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <H>{g.name}</H>
                <P>
                  {g.activeCount}/10명 · {summary}
                </P>
              </View>
              <Text style={{ fontSize: 24, color: colors.muted }}>›</Text>
            </View>
            {g.retentionWarnings?.map((w: any) => (
              <P key={w.scheduleId}>
                {w.urgency === 'last_day' ? '보관 기한 하루 이내' : '보관 기한 7일 이내'} ·{' '}
                {w.title} · {w.lastDate}까지
              </P>
            ))}
          </Card>
        );
      })}
      {next && (
        <Button
          secondary
          disabled={a.busy}
          onPress={() =>
            a.run(async () => {
              const r = await api(`/groups?cursor=${encodeURIComponent(next)}`);
              setGroups((old) => [...new Map([...old, ...r.items].map((g) => [g.id, g])).values()]);
              setNext(r.nextCursor);
            })
          }
        >
          모임 더 보기
        </Button>
      )}
      {a.hasRun && !a.busy && !a.error && !groups.length && (
        <Card>
          <H>아직 함께하는 모임이 없어요</H>
          <P>모임을 만들거나 받은 초대 코드로 참여해 보세요.</P>
        </Card>
      )}
      {a.errorView}
    </Screen>
  );
}
