import { Avatar, MenuRow } from '../../components/profile-ui';
import { useFocusLoad } from '../../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { inputText } from '../../lib/validation';
import { Alert, View, Text, Pressable, Image, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, awaitOperation, getGroup, coverSource } from '../../lib/api';
import { useAccount } from '../../lib/state';
import {
  Screen,
  Field,
  Button,
  Card,
  H,
  P,
  confirm,
  useAction,
  Sheet,
  Info,
  Badge,
  colors,
  resetTo,
} from '../../components/ui';
export default function Manage() {
  const { id, mode = 'members' } = useLocalSearchParams<{ id: string; mode?: string }>(),
    { session } = useAccount(),
    [group, setGroup] = useState<any>(null),
    [members, setMembers] = useState<any[]>([]),
    [blocks, setBlocks] = useState<any[]>([]),
    [name, setName] = useState(''),
    [latestName, setLatestName] = useState<string | null>(null);
  const [selected, setSelected] = useState(''),
    [menu, setMenu] = useState(false);
  const a = useAction();
  async function refresh() {
    const g = await getGroup(id);
    setGroup(g);
    setName(g.name);
    const m = await api(`/groups/${id}/members`);
    setMembers(m.members);
    setBlocks(m.reentryBlocks);
  }
  useFocusLoad(() => {
    a.run(refresh);
  }, [id]);
  const owner = group?.ownerUserId === session?.userId;
  const [copied, setCopied] = useState('');
  /** Share or copy the newest active invite link, issuing one when none is active. */
  async function shareInvite(action: 'share' | 'copy') {
    await a.run(async () => {
      const latest = async () =>
        ((await api(`/groups/${id}/invites`)).invites as any[])
          .filter((x) => x.state === 'active')
          .sort((x, y) => y.issuedAt.localeCompare(x.issuedAt))[0];
      let invite = await latest();
      if (!invite) {
        const created = await api(`/groups/${id}/invites`, {});
        invite = created?.link ? created : await latest();
      }
      if (!invite) throw new Error('초대를 만들지 못했어요. 초대·관리에서 다시 시도해 주세요.');
      if (action === 'share')
        await Share.share({
          message: `${group.name}에 초대합니다.\n${invite.link}\n초대 코드 ${invite.code}`,
        });
      else {
        await Clipboard.setStringAsync(invite.link);
        setCopied('초대 링크를 복사했어요.');
      }
    });
  }
  return (
    <Screen
      compact
      heading={mode === 'members'}
      title={
        mode === 'info'
          ? '모임 정보 변경'
          : mode === 'leave'
            ? '모임 나가기와 종료'
            : mode === 'access'
              ? '참여 관리'
              : (group?.name ?? '함께하는 친구')
      }
      subtitle={mode === 'members' ? undefined : group?.name}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="모임 메뉴"
          style={{ padding: 12 }}
          onPress={() => setMenu(true)}
        >
          <Text style={{ fontSize: 24 }}>⋯</Text>
        </Pressable>
      }
    >
      <Sheet visible={menu} title="모임 관리" onClose={() => setMenu(false)}>
        {owner && (
          <MenuRow
            label="모임 정보 변경"
            onPress={() => {
              setMenu(false);
              router.push(`/group/manage?id=${id}&mode=info`);
            }}
          />
        )}
        {owner && (
          <MenuRow
            label="참여 관리"
            onPress={() => {
              setMenu(false);
              router.push(`/group/manage?id=${id}&mode=access`);
            }}
          />
        )}
        <MenuRow
          label="모임 나가기"
          onPress={() => {
            setMenu(false);
            router.push(`/group/manage?id=${id}&mode=leave`);
          }}
        />
        <MenuRow
          label="저장 공간"
          onPress={() => {
            setMenu(false);
            router.push('/storage');
          }}
        />
        {!owner && (
          <MenuRow
            label="방장 부재 복구 문의"
            onPress={() => {
              setMenu(false);
              router.push(`/recovery?groupId=${id}`);
            }}
          />
        )}
      </Sheet>
      {mode === 'members' && (
        <>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 8 }}>
            함께하는 친구 <Text style={{ color: '#3182F6' }}>{members.length}</Text>
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8 }}>
            함께할 친구나 가족을 초대해보세요.{'\n'}일정을 함께 기록할 수 있습니다. (최대 10명)
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button
              tone="kakao"
              style={{ flex: 1, borderRadius: 28 }}
              disabled={a.busy}
              onPress={() => shareInvite('share')}
            >
              💬 카카오톡 초대
            </Button>
            <Button
              style={{ flex: 1, borderRadius: 28 }}
              disabled={a.busy}
              onPress={() => shareInvite('copy')}
            >
              🔗 초대링크 복사
            </Button>
          </View>
          {!!copied && (
            <Text accessibilityRole="alert" style={{ color: colors.accent, marginTop: 4 }}>
              {copied}
            </Text>
          )}
          <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: -20, marginVertical: 20 }} />
          {members.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                minHeight: 64,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Avatar initial name={m.displayName} size={40} userId={m.userId} avatarVersion={m.avatarVersion} />
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.ink, flexShrink: 1 }}>
                {m.displayName}
              </Text>
              {m.isOwner && <Badge style={{ marginBottom: 0, alignSelf: 'center' }}>방장</Badge>}
              {m.userId === session?.userId && <Badge style={{ marginBottom: 0, alignSelf: 'center' }}>나</Badge>}
              <View style={{ flex: 1 }} />
              {m.userId !== session?.userId && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${m.displayName} 메뉴`}
                  onPress={() => setSelected(m.id)}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 20, color: colors.muted }}>⋯</Text>
                </Pressable>
              )}
            </View>
          ))}
          {members
            .filter((m) => m.id === selected)
            .map((m) => (
              <Sheet key={m.id} visible title={m.displayName} onClose={() => setSelected('')}>
                {owner && (
                  <>
                    <Button
                      tone="danger"
                      onPress={() =>
                        Alert.alert(
                          '모임에서 내보낼까요?',
                          '내보낸 사람은 같은 초대로 다시 참여할 수 없어요.',
                          [
                            { text: '취소', style: 'cancel' },
                            {
                              text: '내보내기',
                              style: 'destructive',
                              onPress: () =>
                                a.run(async () => {
                                  setSelected('');
                                  await api(`/groups/${id}/member-removals`, {
                                    targetMembershipId: m.id,
                                    expectedVersion: group.version,
                                  });
                                  await refresh();
                                }),
                            },
                          ],
                        )
                      }
                    >
                      내보내기
                    </Button>
                    <Button
                      secondary
                      onPress={() =>
                        confirm('방장을 이전할까요?', `${m.displayName}님이 즉시 새 방장이 됩니다.`, () =>
                          a.run(async () => {
                            setSelected('');
                            await api(`/groups/${id}/owner-transfers`, {
                              targetMembershipId: m.id,
                              expectedVersion: group.version,
                            });
                            await refresh();
                          }),
                        )
                      }
                    >
                      방장 이전
                    </Button>
                  </>
                )}
                <Button
                  secondary
                  onPress={() => {
                    setSelected('');
                    router.push({
                      pathname: '/report',
                      params: { targetType: 'member', targetId: m.id, userId: m.userId },
                    });
                  }}
                >
                  신고·개인 차단
                </Button>
                <Button secondary onPress={() => setSelected('')}>
                  닫기
                </Button>
              </Sheet>
            ))}
        </>
      )}
      {mode === 'info' && owner && (
        <Card style={{ borderWidth: 0, padding: 0 }}>
          {group.coverAssetId ? (
            <Image
              source={coverSource(id, group.version)}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, marginBottom: 20 }}
            />
          ) : (
            <View
              style={{
                aspectRatio: 4 / 3,
                borderRadius: 16,
                backgroundColor: colors.sage,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 40 }}>🏞️</Text>
            </View>
          )}
          <Field label="모임 이름" required limit={50} value={name} onChangeText={setName} />
          <Button
            disabled={a.busy}
            onPress={() =>
              a.run(async () => {
                inputText(name, '모임 이름', 50);
                await awaitOperation(
                  await api(`/groups/${id}`, { name, expectedVersion: group.version }, 'PATCH'),
                );
                await refresh();
              })
            }
          >
            이름 저장
          </Button>
        </Card>
      )}
      {/* Owners manage the cover in the invitation screen; other members can report it here. */}
      {mode === 'info' && group?.coverAssetId && !owner && (
        <Button
          secondary
          onPress={() =>
            router.push({
              pathname: '/report',
              params: { targetType: 'cover', targetId: group.coverAssetId },
            })
          }
        >
          모임 대표 사진 신고
        </Button>
      )}
      {mode === 'access' && owner && (
        <>
          <H>재참여 차단 목록</H>
          {!blocks.length && (
            <Info>
              재참여가 차단된 사람이 없습니다. 역할 변경은 친구 목록에서 해당 사람을 선택해 주세요.
            </Info>
          )}
          {blocks.map((b) => (
            <Card key={b.userId}>
              <P>{b.displayName}</P>
              <Button
                secondary
                onPress={() =>
                  a.run(async () => {
                    await api(
                      `/groups/${id}/reentry-blocks/${b.userId}`,
                      { expectedVersion: b.version },
                      'DELETE',
                    );
                    await refresh();
                  })
                }
              >
                재참여 차단 해제
              </Button>
            </Card>
          ))}
        </>
      )}
      {mode === 'leave' && (
        <>
          <H>모임을 나가시겠어요?</H>
          <Info>
            올린 기록은 표시된 기한까지 유지돼요. 본인 기록은 나간 뒤에도 조회·삭제할 수 있어요.
          </Info>
          {owner && members.length > 1 && (
            <Button secondary onPress={() => router.push(`/group/manage?id=${id}`)}>
              후임 방장 선택
            </Button>
          )}
          <P>
            {owner && members.length === 1
              ? '혼자 남은 방장은 모임을 종료합니다. 본인 서버 기록 삭제를 확인해 주세요.'
              : '나간 뒤 새 저장과 정보 수정은 불가해요.'}
          </P>
          <Button
            secondary
            onPress={() =>
              confirm(
                owner && members.length === 1 ? '모임을 종료할까요?' : '모임에서 나갈까요?',
                owner && members.length === 1
                  ? '모임을 종료하고 본인 서버 파일을 삭제합니다. 다른 작성자의 파일은 보관 기한까지 유지됩니다.'
                  : '나간 뒤 본인 기록의 열람·삭제는 가능하며 새 저장은 불가합니다. 방장은 먼저 역할을 이전해야 합니다.',
                () =>
                  a.run(async () => {
                    if (owner && members.length === 1)
                      await api(`/groups/${id}/closure`, {
                        confirmOwnMediaDeletion: true,
                        expectedVersion: group.version,
                      });
                    else {
                      const me = members.find((m) => m.userId === session?.userId);
                      await api(`/groups/${id}/leaving`, {
                        membershipId: me.id,
                        expectedVersion: me.version,
                      });
                    }
                    resetTo('/');
                  }),
              )
            }
          >
            {owner && members.length === 1 ? '마지막 방장 나가기·모임 종료' : '모임 나가기'}
          </Button>
        </>
      )}
      {a.errorCode === 'VERSION_CONFLICT' && (
        <Button
          secondary
          onPress={() =>
            a.run(async () => {
              const latest = await getGroup(id);
              setGroup(latest);
              setLatestName(latest.name);
            })
          }
        >
          최신 모임 상태 확인 · 입력 유지
        </Button>
      )}
      {latestName !== null && (
        <P>최신 모임 이름: {latestName} · 현재 입력을 확인하고 저장해 주세요.</P>
      )}
      {a.errorView}
    </Screen>
  );
}
