import { Avatar, MenuRow } from '../../components/profile-ui';
import { useFocusLoad } from '../../lib/effects';
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { inputText } from '../../lib/validation';
import { View, Text, Pressable, Image } from 'react-native';
import { api, API, currentSession, awaitOperation, getGroup } from '../../lib/api';
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
  colors,
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
  return (
    <Screen
      compact
      title={
        mode === 'info'
          ? '모임 정보 변경'
          : mode === 'leave'
            ? '모임 나가기와 종료'
            : mode === 'access'
              ? '참여 관리'
              : '함께하는 친구'
      }
      subtitle={group?.name}
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
        <MenuRow
          label="방장 부재 복구 문의"
          onPress={() => {
            setMenu(false);
            router.push(`/recovery?groupId=${id}`);
          }}
        />
      </Sheet>
      {mode === 'members' && (
        <>
          <H>
            함께하는 친구 <Text style={{ color: colors.accent }}>{members.length}</Text>
          </H>
          <P>함께할 친구에게 초대를 보내보세요. 초대를 함께 전달할 수 있습니다. (최대 10명)</P>
          <Button onPress={() => router.push(`/group/invites?id=${id}`)}>초대·공유하기</Button>
          {members.map((m) => (
            <Card
              key={m.id}
              style={{ borderWidth: 0, paddingVertical: 10, paddingHorizontal: 0 }}
              onPress={() => setSelected(m.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={m.displayName} size={48} />
                <H>
                  {m.displayName}
                  {m.isOwner ? ' · 방장' : ''}
                  {m.userId === session?.userId ? ' · 나' : ''}
                </H>
              </View>
              {m.userId !== session?.userId && (
                <Sheet
                  visible={selected === m.id}
                  title={m.displayName}
                  onClose={() => setSelected('')}
                >
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
                </Sheet>
              )}
            </Card>
          ))}
        </>
      )}
      {mode === 'info' && owner && (
        <Card style={{ borderWidth: 0, padding: 0 }}>
          {group.coverAssetId ? (
            <Image
              source={{
                uri: `${API}/v1/groups/${id}/cover`,
                headers: { Authorization: `Bearer ${currentSession()?.accessToken}` },
              }}
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, marginBottom: 20 }}
            />
          ) : (
            <View
              style={{
                aspectRatio: 16 / 9,
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
      {mode === 'info' && group?.coverAssetId && (
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
                    router.replace('/');
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
