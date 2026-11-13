import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { notifyUploadQueue } from '../../src/lib/upload-events';
import { UploadProgress, REVIEW_POLL_MS } from '../../src/components/upload-progress';
const { readQueue, forget, fresh, toast, resume } = vi.hoisted(() => ({ readQueue: vi.fn(), forget: vi.fn(async () => {}), fresh: new Set<string>(), toast: vi.fn(), resume: vi.fn(async () => {}) }));
vi.mock('../../src/lib/uploads', () => ({
  queue: readQueue, forgetTasks: forget, resumeTask: resume,
  isFreshBatch: (id: string) => fresh.has(id), takeFreshBatch: (id: string) => fresh.delete(id),
}));
vi.mock('../../src/components/toast-provider', () => ({ useAppToast: () => toast }));
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); fresh.clear(); });
const file = (extra: object) => ({ scheduleId: 's', visitId: 'v', recordDate: '2026-11-06', declaredBytes: 100, kind: 'photo', ...extra });
test('progress is scoped to the visit and waits for server completion even after all bytes transfer', async () => {
  vi.useFakeTimers();
  readQueue.mockResolvedValue({
    a: { task: { targetType: 'record', submissionId: 'submission' }, file: file({}) },
    other: { task: { targetType: 'record' }, file: file({ visitId: 'other' }) },
  });
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'verifying', transferredBytes: 100 }] });
  const complete = vi.fn();
  await act(async () => { tree = create(<UploadProgress scheduleId="s" visitId="v" recordDate="2026-11-06" onComplete={complete} />); });
  expect(fixtures.api).toHaveBeenCalledWith('/me/upload-tasks?ids=a');
  expect(JSON.stringify(tree.toJSON())).toContain('올리는 중 1개 · 전송 100%');
  expect(complete).not.toHaveBeenCalled();
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'complete', transferredBytes: 100 }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(complete).toHaveBeenCalledTimes(1);
  expect(tree.toJSON()).toBeNull();
  // An upload from before the batch id existed is finished history: dropped without a message.
  expect(forget).toHaveBeenCalledWith(['a']);
  expect(toast).not.toHaveBeenCalled();
  const completedCalls = fixtures.api.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(fixtures.api).toHaveBeenCalledTimes(completedCalls);
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'failed' }] });
  await act(async () => notifyUploadQueue());
  expect(JSON.stringify(tree.toJSON())).toContain('올리지 못한 파일 1개');
  const retry = tree.root.findAll((n: any) => n.type === 'button' && n.children.join('') === '실패한 파일만 다시 올리기')[0];
  await act(async () => retry.props.onPress());
  expect(resume).toHaveBeenCalledWith('a');
  fixtures.api.mockRejectedValue(new Error('offline'));
  await act(async () => notifyUploadQueue());
  expect(JSON.stringify(tree.toJSON())).toContain('올린 결과를 확인하지 못했어요');
  expect(complete).toHaveBeenCalledTimes(1);
});

test('an empty queue stops polling and a newly queued upload wakes the mounted banner', async () => {
  vi.useFakeTimers(); readQueue.mockResolvedValue({});
  await act(async () => { tree = create(<UploadProgress scheduleId="s" onComplete={() => {}} />); });
  const reads = readQueue.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(readQueue).toHaveBeenCalledTimes(reads); expect(tree.toJSON()).toBeNull();
  readQueue.mockResolvedValue({ b: { task: { targetType: 'record' }, file: { scheduleId: 's', declaredBytes: 100 } } });
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'b', state: 'uploading', transferredBytes: 30 }] });
  await act(async () => notifyUploadQueue());
  expect(JSON.stringify(tree.toJSON())).toContain('전송 30%');
});

// QA-02: only this submission's published files are announced, once, without earlier history.
test('a finished submission is announced once with published counts and leaves the list', async () => {
  vi.useFakeTimers();
  fresh.add('now');
  const saved: Record<string, any> = {
    old: { task: { targetType: 'record' }, file: file({ batchId: 'earlier' }) },
    p1: { task: { targetType: 'record' }, file: file({ batchId: 'now' }) },
    p2: { task: { targetType: 'record' }, file: file({ batchId: 'now' }) },
    v1: { task: { targetType: 'record' }, file: file({ batchId: 'now', kind: 'video' }) },
    v2: { task: { targetType: 'record' }, file: file({ batchId: 'now', kind: 'video' }) },
  };
  readQueue.mockImplementation(async () => ({ ...saved }));
  forget.mockImplementation(async (...args: any[]) => { for (const id of args[0] as string[]) delete saved[id]; });
  let video = 'verifying';
  const state: Record<string, any> = { old: { state: 'complete' }, p1: { state: 'complete' }, p2: { state: 'review' }, v2: { state: 'failed' } };
  fixtures.api.mockImplementation(async (path: string) => ({
    tasks: path.split('ids=')[1].split(',').map((id) => ({ id, ...(id === 'v1' ? { state: video, transferredBytes: 100 } : state[id]) })),
  }));
  await act(async () => { tree = create(<UploadProgress scheduleId="s" visitId="v" onComplete={() => {}} />); });
  // Sent bytes and server checks are not publication: nothing is announced yet.
  expect(toast).not.toHaveBeenCalled();
  expect(forget).toHaveBeenCalledWith(['old']);
  video = 'complete';
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith('사진 1장·동영상 1개를 업로드했습니다.');
  expect(forget).toHaveBeenLastCalledWith(['p1', 'v1']);
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('검토를 기다리는 파일 1개');
  expect(output).toContain('올리지 못한 파일 1개');
  await act(async () => notifyUploadQueue());
  expect(toast).toHaveBeenCalledTimes(1);
});

// Review 2026-11-13 #3: an approval while the screen is open must refresh the strip and the list.
test('files under review keep being checked and an approval refreshes the open screen', async () => {
  vi.useFakeTimers();
  readQueue.mockResolvedValue({ a: { task: { targetType: 'record' }, file: file({ batchId: 'old' }) } });
  let state = 'review';
  fixtures.api.mockImplementation(async () => ({ tasks: [{ id: 'a', state }] }));
  const complete = vi.fn();
  await act(async () => { tree = create(<UploadProgress scheduleId="s" visitId="v" onComplete={complete} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('검토를 기다리는 파일 1개');
  const calls = fixtures.api.mock.calls.length;
  // Not every 3 seconds: review can take a day.
  await act(async () => { await vi.advanceTimersByTimeAsync(REVIEW_POLL_MS - 1000); });
  expect(fixtures.api.mock.calls.length).toBe(calls);
  state = 'complete';
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(fixtures.api.mock.calls.length).toBe(calls + 1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(tree.toJSON()).toBeNull();
  // Nothing left to check: polling stops.
  await act(async () => { await vi.advanceTimersByTimeAsync(REVIEW_POLL_MS * 3); });
  expect(fixtures.api.mock.calls.length).toBe(calls + 1);
});
