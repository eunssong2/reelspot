import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, currentSession } from '../lib/api';
import { queue } from '../lib/uploads';
import { subscribeUploadQueue } from '../lib/upload-events';
import { useFocusLoad } from '../lib/effects';
import { P, TextButton, colors } from './ui';

/** The server decides completion; transmitted bytes alone never mean publication. */
export function UploadProgress({ scheduleId, visitId, recordDate, unassigned, onComplete }: {
  scheduleId: string; visitId?: string; recordDate?: string; unassigned?: boolean; onComplete: () => void;
}) {
  const [status, setStatus] = useState<{ total: number; complete: number; pending: number; failed: number; percent: number } | null>(null);
  const [error, setError] = useState(false);
  useFocusLoad(() => {
    let live = true, running = false, requested = false, poll = false, previous: Set<string> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const account = currentSession()?.userId;
    async function refresh() {
      if (!live) return;
      if (running) { requested = true; return; }
      clearTimeout(timer);
      running = true; requested = false;
      try {
        const all = await queue();
        const ids = Object.keys(all).filter((id) => {
          const { task, file } = all[id];
          // Older queues have no scheduleId; globally unique visit IDs can still identify their scope.
          const sameSchedule = file.scheduleId === scheduleId || (!file.scheduleId && !!visitId && file.visitId === visitId);
          return sameSchedule && task.targetType !== 'cover' && task.targetType !== 'avatar' && (!visitId || file.visitId === visitId) && (!recordDate || file.recordDate === recordDate) && (!unassigned || !file.visitId);
        });
        const tasks: any[] = [];
        for (let i = 0; i < ids.length; i += 120) tasks.push(...(await api(`/me/upload-tasks?ids=${ids.slice(i, i + 120).join(',')}`)).tasks);
        if (!live || currentSession()?.userId !== account) return;
        const completed = tasks.filter((t) => t.state === 'complete').map((t) => t.id);
        if (previous !== null && completed.some((id) => !previous!.has(id))) onComplete();
        previous = new Set(completed);
        const pending = tasks.filter((t) => !['complete', 'cancelled', 'failed'].includes(t.state));
        const bytes = pending.reduce((n, t) => n + (all[t.id]?.file.declaredBytes ?? 0), 0);
        const failed = tasks.filter((t) => t.state === 'failed').length;
        poll = pending.length > 0 || failed > 0;
        setStatus(poll ? { total: ids.length, complete: tasks.filter((t) => t.state === 'complete').length,
          pending: pending.length, failed,
          percent: bytes ? Math.min(100, Math.round(pending.reduce((n, t) => n + (t.transferredBytes ?? 0), 0) / bytes * 100)) : 0 } : null);
        setError(false);
      } catch { if (live) { setError(true); poll = true; } }
      finally {
        running = false;
        if (live && (requested || poll)) timer = setTimeout(() => void refresh(), requested ? 0 : 3000);
      }
    }
    const unsubscribe = subscribeUploadQueue(() => void refresh());
    void refresh();
    return () => { live = false; clearTimeout(timer); unsubscribe(); };
  }, [scheduleId, visitId, recordDate, unassigned]);
  if (!status && !error) return null;
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 12 }}>
    <P>{error ? '전송 결과를 확인하지 못했어요. 파일 전송 상태에서 다시 확인해 주세요.' : status?.pending ? `전송·확인 중 ${status.pending}개 · 전송 ${status.percent}% · 완료 ${status.complete}개` : `완료 ${status?.complete}개${status?.failed ? ` · 실패 ${status.failed}개` : ''}`}</P>
    {!!status?.pending && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: status.percent }} style={{ height: 4, backgroundColor: colors.line }}><View style={{ width: `${status.percent}%`, height: 4, backgroundColor: colors.accent }} /></View>}
    <TextButton onPress={() => router.push('/uploads')}>파일 전송 상태 보기</TextButton>
  </View>;
}
