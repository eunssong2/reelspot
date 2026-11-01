import React, { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { api, getGroup } from '../../lib/api';
import { useFocusLoad } from '../../lib/effects';
import { formatMoment } from '../../lib/preferences';
import { Screen, Button, Card, H, P, Badge, confirm, useAction, colors } from '../../components/ui';
export default function Invites() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    [group, setGroup] = useState<any>(null),
    [items, setItems] = useState<any[]>([]),
    [message, setMessage] = useState('');
  const a = useAction();
  async function load() {
    const [g, r] = await Promise.all([getGroup(id), api(`/groups/${id}/invites`)]);
    setGroup(g);
    setItems(
      r.invites.sort(
        (x: any, y: any) => y.issuedAt.localeCompare(x.issuedAt) || y.id.localeCompare(x.id),
      ),
    );
  }
  useFocusLoad(() => {
    void a.run(load);
  }, [id]);
  async function live(inviteId: string) {
    const r = await api(`/groups/${id}/invites`);
    setItems(r.invites);
    const item = r.invites.find((x: any) => x.id === inviteId && x.state === 'active');
    if (!item) throw new Error('현재 사용할 수 없는 초대입니다. 새 초대를 발급해 주세요.');
    return item;
  }
  async function send(item: any, action: 'link' | 'code' | 'share') {
    await a.run(async () => {
      const fresh = await live(item.id);
      if (action === 'share')
        await Share.share({
          message: `${group.name}에 초대합니다.\n${group.scheduleSummary?.title ?? '함께할 일정을 만들어요.'}\n${fresh.link}\n초대 코드 ${fresh.code}\n받은 초대는 재전달할 수 있어요.`,
        });
      else {
        await Clipboard.setStringAsync(action === 'link' ? fresh.link : fresh.code);
        setMessage(action === 'link' ? '초대 링크를 복사했어요.' : '초대 코드를 복사했어요.');
      }
    });
  }
  function card(item: any) {
    return (
      <Card key={item.id} style={{ backgroundColor: '#F7F8FA', borderWidth: 0 }}>
        <Badge>
          {{ active: '사용 가능', exhausted: '소진', expired: '만료', revoked: '취소' }[
            item.state as string
          ] ?? item.state}
        </Badge>
        <Text
          selectable
          style={{
            fontSize: 26,
            letterSpacing: 3,
            fontWeight: '800',
            textAlign: 'center',
            marginVertical: 14,
            color: colors.ink,
          }}
        >
          {item.code}
        </Text>
        <P>발급 {formatMoment(item.issuedAt)}</P>
        <P>
          만료 {formatMoment(item.expiresAt)} · 확인 {item.useCount}/50회
        </P>
        {item.state === 'active' && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button secondary disabled={a.busy} onPress={() => send(item, 'link')}>
                  링크 복사
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button disabled={a.busy} onPress={() => send(item, 'share')}>
                  공유하기
                </Button>
              </View>
            </View>
            <Button secondary disabled={a.busy} onPress={() => send(item, 'code')}>
              코드 복사
            </Button>
            <Button
              secondary
              disabled={a.busy}
              onPress={() =>
                confirm(
                  '이 초대를 취소할까요?',
                  '기존 참여자와 다른 초대에는 영향을 주지 않아요.',
                  () =>
                    a.run(async () => {
                      await api(`/invites/${item.id}/revocation`, {
                        expectedVersion: item.version,
                      });
                      await load();
                    }),
                )
              }
            >
              이 초대 취소
            </Button>
          </>
        )}
      </Card>
    );
  }
  return (
    <Screen
      compact
      title="모임에 초대하기"
      subtitle={group?.name}
      footer={
        <>
          <Button
            disabled={a.busy || !group}
            onPress={() =>
              a.run(async () => {
                await api(`/groups/${id}/invites`, {});
                await load();
              })
            }
          >
            ＋ 새 초대 발급하기
          </Button>
          <P>새 코드를 만들어도 기존 초대는 유지돼요.</P>
        </>
      }
    >
      <P>모든 현재 참여자가 초대를 관리할 수 있어요. 발급 후 7일 · 초대 확인 50회까지</P>
      {!!message && (
        <Text accessibilityRole="alert" style={{ color: colors.accent }}>
          {message}
        </Text>
      )}
      <H>사용 가능한 초대</H>
      {items.filter((x) => x.state === 'active').map(card)}
      {a.hasRun && !a.busy && !a.error && !items.some((x) => x.state === 'active') && (
        <P>지금 사용할 수 있는 초대가 없어요. 새 초대를 발급해 주세요.</P>
      )}
      <Card>
        <P>받은 사람이 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.</P>
      </Card>
      <H>이전 초대</H>
      {items.filter((x) => x.state !== 'active').map(card)}
      {a.errorView}
    </Screen>
  );
}
