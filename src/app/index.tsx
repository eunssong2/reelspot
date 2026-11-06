import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { claimInviteRestore } from '../lib/invite-restore';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '../lib/state';
import { api, coverSource } from '../lib/api';
import { todayInSeoul } from '../lib/preferences';
import { Screen, Button, Card, H, P, TextButton, colors, useAction } from '../components/ui';
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
        const me = profile ?? await api('/me/profile');
        if (!live) return;
        if (me?.status === 'onboarding') { router.replace('/onboarding'); return; }
        const pending = await AsyncStorage.getItem('atp.pending-invite');
        if (!live) return;
        if (claimInviteRestore(session.userId) && pending) { router.replace('/invite'); return; }
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
      title=""
      back={false}
      tabs
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button secondary onPress={() => router.push('/invite')}>
              🔑 초대 코드로 참여
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={() => router.push('/group/new')}>＋ 모임 만들기</Button>
          </View>
        </View>
      }
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 8 }}>내 모임</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {a.hasRun && !a.error
            ? `총 ${groups.length}${next ? '+' : ''}개의 모임에 참여하고 있어요`
            : '모임을 불러오고 있어요'}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.sub,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          최근 공동 활동순
        </Text>
      </View>
      {groups.map((g) => {
        const x = g.scheduleSummary,
          today = todayInSeoul(),
          owner = g.ownerUserId === session.userId,
          summary = x
            ? `${x.startDate <= today && x.endDate >= today ? '진행 중' : x.startDate > today ? '다음 일정' : '최근 일정'}: ${x.title}`
            : '아직 일정이 없어요';
        return (
          <Card
            key={g.id}
            onPress={() => router.push(`/group/${g.id}`)}
            style={{ backgroundColor: colors.surface, borderWidth: 0, padding: 16, borderRadius: 22 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {g.coverAssetId ? (
                <Image
                  accessibilityLabel={`${g.name} 대표 사진`}
                  style={{ width: 64, height: 64, borderRadius: 14 }}
                  source={coverSource(g.id, g.version)}
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
                  <Text style={{ color: colors.accent, fontSize: 26, fontWeight: '800' }}>
                    {[...g.name][0]}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: owner ? colors.accent : colors.sub,
                      backgroundColor: owner ? colors.sage : 'transparent',
                      paddingHorizontal: owner ? 8 : 0,
                      paddingVertical: 3,
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {owner ? '방장' : '참여자'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 16, fontWeight: '800', color: colors.ink, flex: 1 }}
                  >
                    {g.name}
                  </Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{g.activeCount}/10명</Text>
                  {' · '}
                  {summary}
                </Text>
              </View>
              <Text style={{ fontSize: 22, color: colors.muted }}>›</Text>
            </View>
            {g.retentionWarnings?.map((w: any) => (
              <View
                key={w.scheduleId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.sage,
                  borderRadius: 14,
                  paddingLeft: 12,
                  marginTop: 12,
                }}
              >
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#E5534B' }}>
                  ⏱ 보관 안내 · 만료 {w.urgency === 'last_day' ? '하루' : '7일'} 전 기록이 있어요
                </Text>
                <TextButton
                  color="#E5534B"
                  onPress={() => router.push(`/schedule/${w.scheduleId}`)}
                >
                  확인
                </TextButton>
              </View>
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
