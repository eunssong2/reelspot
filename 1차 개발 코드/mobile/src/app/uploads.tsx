import { useFocusLoad } from '../lib/effects';
import React, { useState } from 'react';
import * as FS from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { api, getGroup, ApiError, currentSession } from '../lib/api';
import { queue, resumeTask } from '../lib/uploads';
import { Transfer } from '../../modules/atp-transfer';
import { Screen, Button, Card, H, P, Badge, useAction, confirm } from '../components/ui';
export default function Uploads() {
  const [tasks, setTasks] = useState<any[]>([]), [refreshError, setRefreshError] = useState(''), [loaded, setLoaded] = useState(false);
  const a = useAction();
  async function refresh() {
    const q = await queue(), all = [], failures = [];
    const native: any[] = Transfer && currentSession() ? JSON.parse(await Transfer.statuses(currentSession()!.userId)) : [];
    const ids = Object.keys(q), states = new Map<string, any>();
    for (let offset = 0; offset < ids.length; offset += 120) {
      try { const r = await api(`/me/upload-tasks?ids=${ids.slice(offset, offset+120).join(',')}`); for (const task of r.tasks) states.set(task.id, task); }
      catch { failures.push(...ids.slice(offset, offset+120)); }
    }
    for (const [id, task] of states) if (['complete','cancelled'].includes(task.state) && q[id]) await FS.deleteAsync(q[id].file.uri, { idempotent: true }).catch(() => {});
    for (const id of ids) all.push({ ...(states.get(id) ?? { ...q[id].task, state: 'unknown' }), id, file: q[id].file, local: native.find((n) => n.taskId === id) });
    setTasks(all); setLoaded(true); setRefreshError(failures.length ? `${failures.length}개 작업의 서버 결과를 확인하지 못했습니다. 연결 후 상태를 다시 확인해 주세요.` : '');
  }
  useFocusLoad(() => { let running = false; const poll = async () => { if (running) return; running = true; try { await refresh(); } catch { setRefreshError('전송 상태를 불러오지 못했습니다. 대기 파일은 유지됩니다.'); } finally { running = false; } }; void poll(); const id = setInterval(() => void poll(), 5000); return () => clearInterval(id); }, []);
  return <Screen title="파일 전송 상태" subtitle="전송 100% 뒤 파일 확인과 공개 전 검사가 진행됩니다.">
    {refreshError && <P>{refreshError}</P>}
    {tasks.map((t) => <Card key={t.id}>
      <Badge>{({ queued: '전송 대기', uploading: '전송 중', verifying: '서버 확인 중', review: '운영 검토 대기', complete: '완료', failed: '실패', cancelled: '취소', unknown: '결과 확인 필요' } as Record<string,string>)[t.state] ?? t.state}</Badge>
      <H>{t.file.name}</H><P>{Math.min(100, Math.round(((t.transferredBytes ?? t.local?.offset ?? 0) / t.file.declaredBytes) * 100))}%{t.reason ? ` · ${new ApiError(t.reason).message}` : ''}</P>
      {['waiting_network','paused','failed'].includes(t.local?.localState) && !['complete','cancelled'].includes(t.state) && <P>{t.local.localState === 'waiting_network' ? '네트워크 연결을 기다리고 있습니다.' : '기기의 전송이 중단되었습니다. 같은 파일로 이어서 시도할 수 있습니다.'}</P>}
      {['queued','uploading','failed'].includes(t.state) && <Button secondary disabled={a.busy} onPress={() => a.run(async () => { await resumeTask(t.id); await refresh(); })}>같은 파일 재시도</Button>}
      {!['complete','cancelled','unknown'].includes(t.state) && <Button secondary disabled={a.busy} onPress={() => confirm('전송을 취소할까요?', '기기 원본은 유지하고 미완료 서버 전송물을 정리합니다.', () => a.run(async () => { Transfer?.cancel(t.id); await api(`/upload-tasks/${t.id}/cancellation`, { expectedVersion: t.version }); await refresh(); }))}>미완료 전송 취소</Button>}
      {t.state === 'review' && <Button secondary onPress={() => router.push({ pathname: '/inquiry', params: { referenceId: t.id, category: 'upload' } })}>검토 상태 문의</Button>}
      {t.coverAssetId && t.state === 'complete' && <Button onPress={() => a.run(async () => { const g = await getGroup(t.coverGroupId); await api(`/groups/${g.id}`, { coverAssetId: t.coverAssetId, expectedVersion: g.version }, 'PATCH'); router.replace(`/group/${g.id}`); })}>검사된 사진을 모임에 적용</Button>}
    </Card>)}
    {loaded && !refreshError && !tasks.length && <P>진행 중인 전송이 없습니다.</P>}
    <Button secondary disabled={a.busy} onPress={() => a.run(refresh)}>상태 새로고침</Button>{a.errorView}
  </Screen>;
}
