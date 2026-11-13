import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import { View } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { LegacyDraftLink } from '../components/legacy-draft-link';
import { api, awaitOperation, getGroup, ApiError, currentSession } from '../lib/api';
import { forgetTasks, isFreshBatch, queue, resumeTask } from '../lib/uploads';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, Card, H, P, Badge, useAction, confirm } from '../components/ui';
export default function Uploads() {
  const [tasks, setTasks] = useState<any[]>([]),
    [refreshError, setRefreshError] = useState(''),
    [loaded, setLoaded] = useState(false);
  const a = useAction();
  async function refresh() {
    const q = await queue(),
      all = [],
      failures = [];
    const native: any[] =
      Transfer && currentSession()
        ? JSON.parse(await Transfer.statuses(currentSession()!.userId))
        : [];
    const ids = Object.keys(q),
      states = new Map<string, any>();
    for (let offset = 0; offset < ids.length; offset += 120) {
      try {
        const r = await api(`/me/upload-tasks?ids=${ids.slice(offset, offset + 120).join(',')}`);
        for (const task of r.tasks) states.set(task.id, task);
      } catch {
        failures.push(...ids.slice(offset, offset + 120));
      }
    }
    for (const [id, task] of states)
      if (['complete', 'cancelled'].includes(task.state) && q[id])
        await FS.deleteAsync(q[id].file.uri, { idempotent: true }).catch(() => {});
    for (const id of ids)
      all.push({
        ...(states.get(id) ?? { ...q[id].task, state: 'unknown' }),
        id,
        file: q[id].file,
        local: native.find((n) => n.taskId === id),
      });
    // Cover photos still need an explicit apply step, so keep them above record uploads,
    // newest first (the queue keeps enqueue order).
    const photo = (t: any) => t.coverGroupId || t.avatarUserId;
    // Published records leave this list: it shows what still needs attention, not history.
    // A submission made in this app session stays until its records screen has announced it.
    const history = all.filter((t) => !photo(t) && t.state === 'complete' && !(t.file.batchId && isFreshBatch(t.file.batchId)));
    await forgetTasks(history.map((t) => t.id));
    const shown = all.filter((t) => !history.includes(t));
    setTasks([...shown.filter(photo).reverse(), ...shown.filter((t) => !photo(t))]);
    setLoaded(true);
    setRefreshError(
      failures.length
        ? `${failures.length}개 작업의 서버 결과를 확인하지 못했습니다. 연결 후 상태를 다시 확인해 주세요.`
        : '',
    );
  }
  useFocusLoad(() => {
    let running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try {
        await refresh();
      } catch {
        setRefreshError('전송 상태를 불러오지 못했습니다. 대기 파일은 유지됩니다.');
      } finally {
        running = false;
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <Screen title="파일 전송 상태" subtitle="올리는 중이거나 확인이 필요한 파일만 보여 드려요.">
      <LegacyDraftLink />
      <H>
        {!loaded
          ? '전송 상태를 확인하고 있어요'
          : !tasks.length
            ? '모두 정리됐어요'
            : tasks.every((t) => t.state === 'complete')
              ? '기록을 모두 올렸어요'
            : tasks.some((t) => ['queued', 'uploading', 'verifying'].includes(t.state))
              ? '순간을 모으는 중이에요'
              : '파일별 결과를 확인해 주세요'}
      </H>
      {refreshError && <P>{refreshError}</P>}
      {tasks.map((t) => (
        <Card key={t.id}>
          <Badge>
            {(
              {
                queued: '전송 대기',
                uploading: '전송 중',
                verifying: '서버 확인 중',
                review: '운영 검토 대기',
                complete: '완료',
                failed: '실패',
                cancelled: '취소',
                unknown: '결과 확인 필요',
              } as Record<string, string>
            )[t.state] ?? t.state}
          </Badge>
          <H>{t.file.name}</H>
          <View
            style={{ height: 4, backgroundColor: '#E5E8EB', borderRadius: 2, marginVertical: 8 }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: '#F1706B',
                width: `${Math.min(100, Math.round(((t.transferredBytes ?? t.local?.offset ?? 0) / t.file.declaredBytes) * 100))}%`,
              }}
            />
          </View>
          <P>
            {Math.min(
              100,
              Math.round(
                ((t.transferredBytes ?? t.local?.offset ?? 0) / t.file.declaredBytes) * 100,
              ),
            )}
            %{t.reason ? ` · ${new ApiError(t.reason).message}` : ''}
          </P>
          {['waiting_network', 'paused', 'failed'].includes(t.local?.localState) &&
            !['complete', 'cancelled'].includes(t.state) && (
              <P>
                {t.local.localState === 'waiting_network'
                  ? '네트워크 연결을 기다리고 있습니다.'
                  : '기기의 전송이 중단되었습니다. 같은 파일로 이어서 시도할 수 있습니다.'}
              </P>
            )}
          {['queued', 'uploading', 'failed'].includes(t.state) && (
            <Button
              secondary
              disabled={a.busy}
              onPress={() =>
                a.run(async () => {
                  await resumeTask(t.id);
                  await refresh();
                })
              }
            >
              같은 파일 재시도
            </Button>
          )}
          {!['complete', 'cancelled', 'unknown'].includes(t.state) && (
            <Button
              secondary
              disabled={a.busy}
              onPress={() =>
                confirm(
                  '전송을 취소할까요?',
                  '기기 원본은 유지하고 미완료 서버 전송물을 정리합니다.',
                  () =>
                    a.run(async () => {
                      Transfer?.cancel(t.id);
                      await api(`/upload-tasks/${t.id}/cancellation`, {
                        expectedVersion: t.version,
                      });
                      await refresh();
                    }),
                )
              }
            >
              미완료 전송 취소
            </Button>
          )}
          {t.state === 'review' && (
            <Button
              secondary
              onPress={() =>
                router.push({
                  pathname: '/inquiry',
                  params: { referenceId: t.id, category: 'upload' },
                })
              }
            >
              검토 상태 문의
            </Button>
          )}
          {t.coverAssetId &&
            t.state === 'complete' &&
            t === tasks.find((x) => x.coverGroupId === t.coverGroupId) && (
              <Button
                onPress={() =>
                  a.run(async () => {
                    const g = await getGroup(t.coverGroupId);
                    await api(
                      `/groups/${g.id}`,
                      { coverAssetId: t.coverAssetId, expectedVersion: g.version },
                      'PATCH',
                    );
                    router.replace(`/group/${g.id}`);
                  })
                }
              >
                이 사진을 모임 대표 사진으로 적용
              </Button>
            )}
          {t.avatarAssetId &&
            t.state === 'complete' &&
            t === tasks.find((x) => x.avatarUserId) && (
              <Button
                onPress={() =>
                  a.run(async () => {
                    const profile = await api('/me/profile');
                    await awaitOperation(
                      await api(
                        '/me/profile',
                        { avatarAssetId: t.avatarAssetId, expectedVersion: profile.version },
                        'PATCH',
                      ),
                    );
                    router.replace('/my-page');
                  })
                }
              >
                이 사진을 프로필 사진으로 적용
              </Button>
            )}
        </Card>
      ))}
      {loaded && !refreshError && !tasks.length && <P>올리는 중이거나 확인이 필요한 파일이 없어요.</P>}
      <Button secondary disabled={a.busy} onPress={() => a.run(refresh)}>
        상태 새로고침
      </Button>
      {a.errorView}
    </Screen>
  );
}
