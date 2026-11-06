import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { notifyUploadQueue } from '../../src/lib/upload-events';
import { UploadProgress } from '../../src/components/upload-progress';
const { readQueue } = vi.hoisted(() => ({ readQueue: vi.fn() }));
vi.mock('../../src/lib/uploads', () => ({ queue: readQueue }));
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });
test('progress is scoped to the visit and waits for server completion even after all bytes transfer', async () => {
  vi.useFakeTimers();
  readQueue.mockResolvedValue({
    a: { task: { targetType: 'record', submissionId: 'submission' }, file: { scheduleId: 's', visitId: 'v', recordDate: '2026-11-06', declaredBytes: 100 } },
    other: { task: { targetType: 'record' }, file: { scheduleId: 's', visitId: 'other', recordDate: '2026-11-06', declaredBytes: 100 } },
  });
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'verifying', transferredBytes: 100 }] });
  const complete = vi.fn();
  await act(async () => { tree = create(<UploadProgress scheduleId="s" visitId="v" recordDate="2026-11-06" onComplete={complete} />); });
  expect(fixtures.api).toHaveBeenCalledWith('/me/upload-tasks?ids=a');
  expect(JSON.stringify(tree.toJSON())).toContain('전송·확인 중 1개 · 전송 100% · 완료 0개');
  expect(complete).not.toHaveBeenCalled();
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'complete', transferredBytes: 100 }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(complete).toHaveBeenCalledTimes(1);
  expect(tree.toJSON()).toBeNull();
  const completedCalls = fixtures.api.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(fixtures.api).toHaveBeenCalledTimes(completedCalls);
  fixtures.api.mockResolvedValue({ tasks: [{ id: 'a', state: 'failed' }] });
  await act(async () => notifyUploadQueue());
  expect(JSON.stringify(tree.toJSON())).toContain('실패 1개');
  fixtures.api.mockRejectedValue(new Error('offline'));
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(JSON.stringify(tree.toJSON())).toContain('전송 결과를 확인하지 못했어요');
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
