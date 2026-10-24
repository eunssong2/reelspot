import { clearVideoCacheAsync } from 'expo-video';
import { clearLocalAccount } from '../lib/uploads';
import { useInitialize } from '../lib/effects';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { api, setSession } from '../lib/api';
import { reauth } from '../lib/social';
import { useAccount } from '../lib/state';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, Card, H, P, useAction, confirm } from '../components/ui';
export default function DeleteAccount() {
  const [groups, setGroups] = useState<any[]>([]);
  const { session } = useAccount(),
    a = useAction();
  async function load() {
    setGroups((await api('/me/deletion-preconditions')).ownedGroups);
  }
  useInitialize(() => {
    a.run(load);
  }, []);
  return (
    <Screen title="계정을 삭제하기 전에" subtitle="방장인 모임을 먼저 정리해 주세요.">
      {groups.map((g) => (
        <Card key={g.groupId}>
          <H>{g.name}</H>
          <P>{g.activeCount}명 참여 중</P>
          {g.allowedAction === 'close' ? (
            <Button
              secondary
              onPress={() =>
                confirm(
                  '모임을 종료할까요?',
                  '본인 서버 기록을 삭제하며 타인 파일은 보관 기한까지 유지합니다.',
                  () =>
                    a.run(async () => {
                      await api(`/groups/${g.groupId}/closure`, {
                        purpose: 'account_deletion',
                        reauthProof: await reauth(),
                        confirmOwnMediaDeletion: true,
                        expectedVersion: g.groupVersion,
                      });
                      await load();
                    }),
                )
              }
            >
              마지막 방장 나가기·종료
            </Button>
          ) : (
            g.candidates.map((m: any) => (
              <Button
                secondary
                key={m.membershipId}
                onPress={() =>
                  confirm('방장을 이전할까요?', `${m.displayName}님에게 즉시 이전합니다.`, () =>
                    a.run(async () => {
                      await api(`/groups/${g.groupId}/owner-transfers`, {
                        purpose: 'account_deletion',
                        reauthProof: await reauth(),
                        targetMembershipId: m.membershipId,
                        expectedVersion: g.groupVersion,
                      });
                      await load();
                    }),
                  )
                }
              >
                {m.displayName}님에게 방장 이전
              </Button>
            ))
          )}
        </Card>
      ))}
      <P>
        참여 중이거나 이미 나간 모든 모임의 본인 서버 파일을 삭제합니다. 타인 파일과 기기 원본은
        유지되며 삭제한 기록은 복구할 수 없습니다.
      </P>
      <Button
        disabled={groups.length > 0 || a.busy}
        onPress={() =>
          confirm('계정을 삭제할까요?', '모든 본인 서버 기록과 계정 접근을 삭제합니다.', () =>
            a.run(async () => {
              await api('/me/deletion', {
                reauthProof: await reauth(),
                confirmAllOwnMediaDeletion: true,
              });
              if (session) { await Transfer?.clearAccount(session.userId); await clearVideoCacheAsync(); await clearLocalAccount(session.userId); }
              await setSession(null);
              router.replace('/login');
            }),
          )
        }
      >
        본인 확인 후 계정 삭제
      </Button>
      {a.errorView}
    </Screen>
  );
}
