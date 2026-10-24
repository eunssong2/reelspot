import { useInitialize } from '../../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { formatMoment } from '../../lib/preferences';
import { inputText } from '../../lib/validation';
import { Share, View } from 'react-native';
import { api, awaitOperation, getGroup } from '../../lib/api';
import { useAccount } from '../../lib/state';
import {
  Screen,
  Field,
  Button,
  Card,
  H,
  P,
  Badge,
  confirm,
  useAction,
  s,
} from '../../components/ui';
export default function Manage() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAccount(),
    [group, setGroup] = useState<any>(null),
    [members, setMembers] = useState<any[]>([]),
    [blocks, setBlocks] = useState<any[]>([]),
    [invites, setInvites] = useState<any[]>([]),
    [name, setName] = useState(''), [copied, setCopied] = useState('');
  const a = useAction();
  async function refresh() {
    const g = await getGroup(id);
    setGroup(g);
    setName(g.name);
    const m = await api(`/groups/${id}/members`);
    setMembers(m.members);
    setBlocks(m.reentryBlocks);
    if (g.ownerUserId === session?.userId) setInvites((await api(`/groups/${id}/invites`)).invites);
  }
  useInitialize(() => {
    a.run(refresh);
  }, [id]);
  const owner = group?.ownerUserId === session?.userId;
  return (
    <Screen title="모임 관리" subtitle={group?.name}>
      {owner && (
        <Card>
          <Field label="모임 이름" value={name} onChangeText={setName} />
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
          <Button
            secondary
            onPress={() => router.push({ pathname: '/upload', params: { coverGroupId: id } })}
          >
            대표 사진 변경
          </Button>
          <Button
            secondary
            onPress={() =>
              a.run(async () => {
                await api(
                  `/groups/${id}`,
                  { restoreDefault: true, expectedVersion: group.version },
                  'PATCH',
                );
                await refresh();
              })
            }
          >
            대표 사진 기본 이미지로 복원
          </Button>
        </Card>
      )}
      {group?.coverAssetId && <Button secondary onPress={() => router.push({ pathname: '/report', params: { targetType: 'cover', targetId: group.coverAssetId } })}>모임 대표 사진 신고</Button>}
      <Button secondary onPress={() => router.push('/storage')}>모임 저장 공간 확인</Button>
      <H>함께하는 사람들 · {members.length}/10명</H>
      {members.map((m) => (
        <Card key={m.id}>
          <H>
            {m.displayName}
            {m.isOwner ? ' · 방장' : ''}
          </H>
          {m.userId !== session?.userId && (
            <View style={s.row}>
              <Button
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/report',
                    params: { targetType: 'member', targetId: m.id, userId: m.userId },
                  })
                }
              >
                신고·개인 차단
              </Button>
              {owner && (
                <>
                  <Button
                    secondary
                    onPress={() =>
                      confirm(
                        '방장을 이전할까요?',
                        `${m.displayName}님이 즉시 새 방장이 됩니다.`,
                        () =>
                          a.run(async () => {
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
                  <Button
                    secondary
                    onPress={() =>
                      confirm(
                        '참여자를 퇴장시킬까요?',
                        '새 참여가 차단되며 기존 기록은 보관 기한까지 유지됩니다.',
                        () =>
                          a.run(async () => {
                            await api(`/groups/${id}/member-removals`, {
                              targetMembershipId: m.id,
                              expectedVersion: group.version,
                            });
                            await refresh();
                          }),
                      )
                    }
                  >
                    퇴장
                  </Button>
                </>
              )}
            </View>
          )}
        </Card>
      ))}
      {owner && (
        <>
          <H>초대 관리</H>
          <P>
            각 초대는 발급 후 7일, 확인 50회까지 유효해요. 새 초대를 만들어도 이전 초대는
            유지됩니다.
          </P>
          <Button
            onPress={() =>
              a.run(async () => {
                await api(`/groups/${id}/invites`, {});
                await refresh();
              })
            }
          >
            새 초대 발급
          </Button>
          {invites.map((i) => (
            <Card key={i.id}>
              <Badge>
                {{ active: '사용 가능', exhausted: '소진', expired: '만료', revoked: '취소' }[i.state as string] ?? i.state} · {i.useCount}/50회
              </Badge>
              <H>{i.code}</H>
              <P>발급 {formatMoment(i.issuedAt)}</P><P>만료 {formatMoment(i.expiresAt)}</P>
              <P>{i.link}</P>
              <Button secondary onPress={() => a.run(async () => { await Clipboard.setStringAsync(`${group.name}에 초대합니다.\n${i.link}\n초대 코드 ${i.code}`); setCopied(i.id); })}>{copied === i.id ? '복사됨' : '초대 링크·코드 복사'}</Button>
              <Button
                secondary
                onPress={() =>
                  a.run(async () => { await Share.share({
                    message: `${group.name}에 초대합니다.\n${i.link}\n초대 코드 ${i.code}\n받은 초대는 재전달할 수 있습니다.`,
                  }); })
                }
              >
                초대 공유
              </Button>
              {i.state === 'active' && (
                <Button
                  secondary
                  onPress={() =>
                    confirm(
                      '이 초대를 취소할까요?',
                      '기존 참여자와 다른 초대에는 영향을 주지 않습니다.',
                      () =>
                        a.run(async () => {
                          await api(`/invites/${i.id}/revocation`, { expectedVersion: i.version });
                          await refresh();
                        }),
                    )
                  }
                >
                  이 초대 취소
                </Button>
              )}
            </Card>
          ))}
          <H>재참여 차단 목록</H>
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
      <Button
        secondary
        onPress={() => router.push({ pathname: '/recovery', params: { groupId: id } })}
      >
        방장 부재 복구 문의
      </Button>
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
                router.replace('/');
              }),
          )
        }
      >
        {owner && members.length === 1 ? '마지막 방장 나가기·모임 종료' : '모임 나가기'}
      </Button>
      {a.errorCode === 'VERSION_CONFLICT' && <Button secondary onPress={() => a.run(async () => { const latest = await getGroup(id); setGroup(latest); setCopied(`latest:${latest.name}`); })}>최신 모임 상태 확인 · 입력 유지</Button>}
      {copied.startsWith('latest:') && <P>최신 모임 이름: {copied.slice(7)} · 현재 입력을 확인하고 저장해 주세요.</P>}
      {a.errorView}
    </Screen>
  );
}
