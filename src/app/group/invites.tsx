import React, { useState } from 'react';
import { Image, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { shareGroupInvite } from '../../lib/invite-share';
import * as Clipboard from 'expo-clipboard';
import { ApiError, api, awaitOperation, coverSource, getGroup } from '../../lib/api';
import { useAppToast } from '../../components/toast-provider';
import { useFocusLoad } from '../../lib/effects';
import { useAccount } from '../../lib/state';
import { monthDayTime } from '../../lib/day-labels';
import { uploadAndApplyImage } from '../../lib/uploads';
import { Screen, Button, P, confirm, useAction, colors, TextButton, Info } from '../../components/ui';
const STATE: Record<string, string> = { active: '사용 가능', exhausted: '소진', expired: '만료', revoked: '취소' };
export default function Invites() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAccount(),
    [group, setGroup] = useState<any>(null),
    [items, setItems] = useState<any[]>([]),
    [message, setMessage] = useState('');
  const toast = useAppToast();
  const [now, setNow] = useState(Date.now());
  const a = useAction(),
    cover = useAction({ inlineRetry: false });
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
    setNow(Date.now());
    void a.run(load);
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [id]);
  async function live(inviteId: string) {
    const r = await api(`/groups/${id}/invites`);
    setItems(
      r.invites.sort(
        (x: any, y: any) => y.issuedAt.localeCompare(x.issuedAt) || y.id.localeCompare(x.id),
      ),
    );
    const item = r.invites.find((x: any) => x.id === inviteId && x.state === 'active');
    if (!item) throw new Error('현재 사용할 수 없는 초대입니다. 새 초대를 발급해 주세요.');
    return item;
  }
  async function send(item: any, action: 'link' | 'code' | 'share') {
    await a.run(async () => {
      const fresh = await live(item.id);
      if (action === 'share')
        await shareGroupInvite(group, fresh);
      else {
        await Clipboard.setStringAsync(action === 'link' ? fresh.link : fresh.code);
        toast(action === 'link' ? '링크를 복사했어요' : '코드를 복사했어요');
      }
    });
  }
  const revoke = (item: any) =>
    confirm('이 초대를 취소할까요?', `${item.code}\n이 링크와 코드로는 더 이상 참여할 수 없어요. 이미 참여한 사람은 그대로예요.`, () =>
      a.run(async () => {
        try { await api(`/invites/${item.id}/revocation`, { expectedVersion: item.version }); }
        catch (error) {
          if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') { await load(); toast('초대 상태가 바뀌어 다시 불러왔어요'); return; }
          throw error;
        }
        await load();
        toast('초대를 취소했어요');
      }),
    );
  const owner = group?.ownerUserId === session?.userId;
  const timedItems = items.map((x) => ({ ...x, state: x.state === 'active' && Date.parse(x.expiresAt) <= now ? 'expired' : x.state }));
  const current = timedItems.find((x) => x.state === 'active');
  const previous = timedItems.filter((x) => x !== current);
  return (
    <Screen
      compact
      title="모임에 초대하기"
      footer={
        <>
          <Button
            tone="dark"
            disabled={a.busy || !group}
            onPress={() =>
              a.run(async () => {
                await api(`/groups/${id}/invites`, {});
                await load();
                toast('새 초대를 만들었어요');
              })
            }
          >
            ＋ 새 초대 발급하기
          </Button>
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
            새 코드를 만들어도 기존 초대는 그대로 쓸 수 있어요
          </Text>
        </>
      }
    >
      {owner && group && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 14,
            marginBottom: 14,
          }}
        >
          {group.coverAssetId ? (
            <Image
              accessibilityLabel="모임 대표 사진"
              source={coverSource(group.id, group.version)}
              style={{ width: 56, height: 40, borderRadius: 8 }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 40,
                borderRadius: 8,
                backgroundColor: colors.sage,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{[...group.name][0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>모임 사진</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
              {cover.busy ? '사진을 올리고 있어요…' : '내 모임 목록에 보이는 대표 사진이에요'}
            </Text>
            {!!group.coverAssetId && <TextButton disabled={cover.busy} onPress={() =>
              confirm('기본 이미지로 되돌릴까요?', '모임 이름의 첫 글자로 표시합니다.', () => cover.run(async () => {
                await awaitOperation(await api(`/groups/${id}`, { restoreDefault: true, expectedVersion: group.version }, 'PATCH'));
                await load();
                setMessage('모임 사진을 기본 이미지로 되돌렸어요.');
              }))
            }>기본 이미지로 되돌리기</TextButton>}
          </View>
          <TextButton
            disabled={cover.busy}
            onPress={() =>
              cover.run(async () => {
                const done = await uploadAndApplyImage({ kind: 'cover', groupId: id });
                if (done === false)
                  setMessage('업로드가 끝나면 파일 전송 상태에서 대표 사진으로 적용할 수 있어요.');
                if (done) toast('모임 사진을 바꿨어요');
                await load();
              })
            }
          >
            변경
          </TextButton>
        </View>
      )}
      {!!group?.coverAssetId && <TextButton onPress={() => router.push({ pathname: '/report', params: { targetType: 'cover', targetId: group.coverAssetId } })}>모임 사진 신고</TextButton>}
      {group?.activeCount >= 10 && <P>지금은 정원이 다 찼어요. 자리가 나야 새로 참여할 수 있어요.</P>}
      {cover.error ? cover.errorView : null}
      {group && (
        <>
          <Text
            numberOfLines={1}
            style={{
              alignSelf: 'flex-start',
              fontSize: 13,
              fontWeight: '700',
              color: colors.sub,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            👥 {group.name}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginVertical: 10 }}>
            현재 {group.activeCount}/10명 · 초대는 7일 · 확인 50회까지
          </Text>
        </>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={{ color: colors.accent, marginBottom: 8 }}>
          {message}
        </Text>
      )}
      {current ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>초대 코드</Text>
            <StateBadge state="active" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="초대 코드 복사"
            onPress={() => send(current, 'code')}
            style={({ pressed }) => ({
              backgroundColor: 'white',
              borderRadius: 18,
              marginVertical: 14,
              paddingVertical: 18,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              selectable
              style={{ fontSize: 28, letterSpacing: 6, fontWeight: '900', color: colors.ink }}
            >
              {current.code}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 8 }}>
              👆 탭하여 코드 복사하기
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: colors.sub }}>발급 {monthDayTime(current.issuedAt)}</Text>
            <Text style={{ fontSize: 13, color: colors.sub }}>만료 {monthDayTime(current.expiresAt)}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#E5E8EB', borderRadius: 4, marginVertical: 10 }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.accent,
                width: `${Math.min(100, (current.useCount / 50) * 100)}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>👁 확인 횟수</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
              <Text style={{ color: colors.accent }}>{current.useCount}</Text> / 50회{50 - current.useCount <= 10 ? ` · ${Math.max(0, 50 - current.useCount)}회 남음` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button secondary style={{ flex: 1, backgroundColor: 'transparent' }} disabled={a.busy} onPress={() => send(current, 'link')}>
              링크 복사
            </Button>
            <Button style={{ flex: 1 }} disabled={a.busy} onPress={() => send(current, 'share')}>
              ↗ 공유하기
            </Button>
          </View>
          <View style={{ alignItems: 'center' }}>
            <TextButton color="#E5484D" disabled={a.busy} onPress={() => revoke(current)}>
              이 초대 취소하기 ›
            </TextButton>
          </View>
        </View>
      ) : (
        a.hasRun &&
        !a.busy &&
        !a.error && <P>지금 사용할 수 있는 초대가 없어요. 아래에서 새 초대를 발급해 주세요.</P>
      )}
      <Info>받은 사람이 다른 사람에게 전달하면 그 사람도 참여할 수 있어요.</Info>
      {previous.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>이전 초대</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: colors.sub,
              backgroundColor: colors.surface,
              paddingHorizontal: 9,
              paddingVertical: 3,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {previous.length}
          </Text>
        </View>
      )}
      {previous.map((item) => {
        const active = item.state === 'active';
        return (
          <View
            key={item.id}
            style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginVertical: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                selectable
                style={{
                  fontSize: 17,
                  fontWeight: '900',
                  letterSpacing: 3,
                  color: active ? colors.ink : '#8B95A1',
                  textDecorationLine: item.state === 'revoked' ? 'line-through' : 'none',
                }}
              >
                {item.code}
              </Text>
              <StateBadge state={item.state} useCount={item.useCount} />
              <View style={{ flex: 1 }} />
              {active && (
                <>
                  <Button small secondary style={{ backgroundColor: 'white' }} disabled={a.busy} onPress={() => send(item, 'share')}>
                    공유
                  </Button>
                  <Button small secondary style={{ backgroundColor: 'white' }} disabled={a.busy} onPress={() => revoke(item)}>
                    <Text style={{ color: '#E5484D' }}>취소</Text>
                  </Button>
                </>
              )}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
              {monthDayTime(item.issuedAt)} 발급 → {monthDayTime(item.expiresAt)} 만료
            </Text>
            <Text
              style={{
                fontSize: 12,
                marginTop: 4,
                fontWeight: active ? '700' : '400',
                color: active ? colors.accent : colors.muted,
              }}
            >
              확인 {item.useCount}/50회{active ? ` · ${50 - item.useCount}회 남음` : ''}
            </Text>
          </View>
        );
      })}
      <TextButton color={colors.sub} onPress={() => router.push(`/group/manage?id=${id}`)}>
        함께하는 친구 보기 ›
      </TextButton>
      {a.error && group && <P>초대 목록을 새로 불러오지 못했어요.</P>}
      {a.errorView}
    </Screen>
  );
}
function StateBadge({ state, useCount }: { state: string; useCount?: number }) {
  const active = state === 'active';
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '700',
        color: active ? colors.accent : colors.sub,
        backgroundColor: active ? colors.sage : 'transparent',
        paddingHorizontal: active ? 9 : 2,
        paddingVertical: 3,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {STATE[state] ?? state}
      {state === 'exhausted' && useCount !== undefined ? ` ${useCount}/50` : ''}
    </Text>
  );
}
