import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, currentSession } from '../lib/api';
import { forgetTasks, isFreshBatch, queue, resumeTask, takeFreshBatch } from '../lib/uploads';
import { isSettled, summarizeBatch, uploadedMessage } from '../lib/upload-summary';
import { subscribeUploadQueue } from '../lib/upload-events';
import { useFocusLoad } from '../lib/effects';
import { useAppToast } from './toast-provider';
import { P, TextButton, colors, useAction } from './ui';

export const REVIEW_POLL_MS = 30000;
type Status = { pending: number; failed: number; review: number; percent: number; failedIds: string[] };
/**
 * Follows uploads on the records screen itself (QA-02). A finished submission is announced
 * once with the number of files the server published, then leaves the local list, so earlier
 * results are neither listed again nor added to a later count. Transmitted bytes alone never
 * mean publication.
 */
export function UploadProgress({ scheduleId, visitId, recordDate, unassigned, onComplete }: {
  scheduleId: string; visitId?: string; recordDate?: string; unassigned?: boolean; onComplete: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const toast = useAppToast();
  const retry = useAction({ inlineRetry: false });
  useFocusLoad(() => {
    let live = true, running = false, requested = false, poll = false, slow = false, previous: Set<string> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const account = currentSession()?.userId;
    // Submissions seen unfinished while this screen is open are announced when they finish.
    const watched = new Set<string>();
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
        const batches = new Map<string, any[]>();
        for (const t of tasks) {
          const batch = all[t.id]?.file.batchId ?? '';
          batches.set(batch, [...(batches.get(batch) ?? []), t]);
        }
        const finished: string[] = [];
        for (const [batch, list] of batches) {
          const summary = summarizeBatch(list.map((t) => ({ state: t.state, kind: all[t.id].file.kind })));
          if (!summary.settled) { if (batch) watched.add(batch); continue; }
          // Uploads from before this screen was opened are history: dropped without a message.
          if (batch && (watched.delete(batch) || isFreshBatch(batch))) {
            takeFreshBatch(batch);
            const message = uploadedMessage(summary.photos, summary.videos);
            if (message) toast(message);
          }
          finished.push(...list.filter((t) => ['complete', 'cancelled'].includes(t.state)).map((t) => t.id));
        }
        if (finished.length) await forgetTasks(finished);
        const pending = tasks.filter((t) => !isSettled(t.state));
        const bytes = pending.reduce((n, t) => n + (all[t.id]?.file.declaredBytes ?? 0), 0);
        const failed = tasks.filter((t) => t.state === 'failed');
        const review = tasks.filter((t) => t.state === 'review').length;
        // Files under review keep being checked, more slowly: an approval must reach an open
        // screen (count, list and strip) without leaving and coming back. Review can take a day.
        poll = pending.length > 0;
        slow = !poll && review > 0;
        setStatus(pending.length || failed.length || review ? {
          pending: pending.length, failed: failed.length, review, failedIds: failed.map((t) => t.id),
          percent: bytes ? Math.min(100, Math.round(pending.reduce((n, t) => n + (t.transferredBytes ?? 0), 0) / bytes * 100)) : 0 } : null);
        setError(false);
      } catch { if (live) { setError(true); poll = true; } }
      finally {
        running = false;
        if (live && (requested || poll || slow)) timer = setTimeout(() => void refresh(), requested ? 0 : poll ? 3000 : REVIEW_POLL_MS);
      }
    }
    const unsubscribe = subscribeUploadQueue(() => void refresh());
    void refresh();
    return () => { live = false; clearTimeout(timer); unsubscribe(); };
  }, [scheduleId, visitId, recordDate, unassigned]);
  if (!status && !error) return null;
  const lines = error
    ? ['올린 결과를 확인하지 못했어요. 연결을 확인하면 다시 확인할게요.']
    : [
        !!status?.pending && `올리는 중 ${status.pending}개 · 전송 ${status.percent}%`,
        !!status?.review && `검토를 기다리는 파일 ${status.review}개`,
        !!status?.failed && `올리지 못한 파일 ${status.failed}개`,
      ].filter(Boolean);
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 12 }}>
    {lines.map((line) => <P key={String(line)}>{line}</P>)}
    {!!status?.pending && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: status.percent }} style={{ height: 4, backgroundColor: colors.line }}><View style={{ width: `${status.percent}%`, height: 4, backgroundColor: colors.accent }} /></View>}
    {retry.errorView}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {!!status?.failed && (
        <TextButton disabled={retry.busy} onPress={() => void retry.run(async () => {
          // Only the failed files are sent again; published files are left alone.
          for (const id of status.failedIds) await resumeTask(id);
        })}>실패한 파일만 다시 올리기</TextButton>
      )}
      <TextButton color={colors.sub} onPress={() => router.push('/uploads')}>자세히 보기</TextButton>
    </View>
  </View>;
}
