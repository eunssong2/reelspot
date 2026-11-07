import { afterEach, expect, test, vi } from 'vitest';
import { fixtures } from './setup';
const native = vi.hoisted(() => ({ download: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: native.download, deleteAsync: native.remove }));
vi.mock('../../modules/atp-transfer', () => ({ Transfer: { saveToAlbum: native.save } }));
import { connectServerRenderer } from '../../src/vlog/server-render';
import { renderVlog, saveToGallery, isRenderConnected } from '../../src/vlog/vlogBridge';
let disconnect: (() => void) | undefined;
afterEach(() => { disconnect?.(); disconnect = undefined; vi.useRealTimers(); });
const request = () => ({ title: '우리 영상', timeline: {} as any, onProgress: vi.fn(), isCancelled: () => false });
test('server completion downloads authenticated MP4 and revalidates before saving to the gallery', async () => {
  fixtures.api.mockResolvedValue({ id: 'job', state: 'complete', durationSec: 3 });
  native.download.mockResolvedValue({ status: 200 }); native.remove.mockResolvedValue(undefined); native.save.mockResolvedValue('saved');
  disconnect = connectServerRenderer('group', 'user');
  const r = await renderVlog(request());
  expect(r).toMatchObject({ status: 'done', durationSec: 3 });
  if (r.status !== 'done') throw Error('not completed');
  expect(native.download).toHaveBeenCalledWith('https://example.invalid/v1/vlogs/job/content', r.uri, { headers: { Authorization: 'Bearer test' } });
  expect(await saveToGallery(r.uri)).toBe('saved');
  expect(fixtures.api).toHaveBeenLastCalledWith('/vlogs/job');
  expect(native.save).toHaveBeenCalledWith(r.uri, 'video/mp4', 'at-that-place-vlog-job.mp4');
  disconnect(); disconnect = undefined;
  expect(native.remove).toHaveBeenCalledWith(r.uri, { idempotent: true });
  expect(isRenderConnected()).toBe(false);
});
test('already cancelled request does not create or download a server job', async () => {
  fixtures.api.mockResolvedValue({ id: 'job', state: 'queued' });
  disconnect = connectServerRenderer('group', 'user');
  expect(await renderVlog({ ...request(), isCancelled: () => true })).toEqual({ status: 'cancelled' });
  expect(fixtures.api).not.toHaveBeenCalled();
  expect(native.download).not.toHaveBeenCalled();
});
test('switching accounts while downloading discards the result without using the new account to cancel', async () => {
  fixtures.api.mockResolvedValue({ id: 'job', state: 'complete' });
  native.download.mockImplementation(async () => { fixtures.userId = 'other'; return { status: 200 }; });
  disconnect = connectServerRenderer('group', 'user');
  expect(await renderVlog(request())).toEqual({ status: 'cancelled' });
  expect(native.remove).toHaveBeenCalledWith(native.download.mock.calls[0][1], { idempotent: true });
  expect(await saveToGallery('file:///cache/vlog-user-job.mp4')).toBe('failed');
  expect(native.save).not.toHaveBeenCalled();
});
test('failed render and revoked source access cannot report gallery success', async () => {
  fixtures.api.mockResolvedValueOnce({ id: 'job', state: 'failed' });
  disconnect = connectServerRenderer('group', 'user');
  expect(await renderVlog(request())).toMatchObject({ status: 'failed' });
  fixtures.api.mockResolvedValueOnce({ id: 'job', state: 'complete' });
  native.download.mockResolvedValue({ status: 200 });
  const r=await renderVlog(request());
  if(r.status!=='done')throw Error('not completed');
  fixtures.api.mockRejectedValueOnce(new Error('Source deleted'));
  expect(await saveToGallery(r.uri)).toBe('failed');
  expect(native.save).not.toHaveBeenCalled();
});

test('polling failure resumes the same job on retry without consuming another render slot', async () => {
  vi.useFakeTimers(); native.download.mockResolvedValue({ status: 200 }); native.remove.mockResolvedValue(undefined);
  fixtures.api.mockResolvedValueOnce({ id: 'job', state: 'queued', progress: 0 })
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValueOnce({ id: 'job', state: 'complete', durationSec: 3 });
  disconnect = connectServerRenderer('group', 'user');
  const first = renderVlog(request());
  await vi.advanceTimersByTimeAsync(1000);
  expect(await first).toMatchObject({ status: 'failed' });
  expect(await renderVlog(request())).toMatchObject({ status: 'done' });
  expect(fixtures.api.mock.calls.map(([p]) => p)).toEqual(['/groups/group/vlogs', '/vlogs/job', '/vlogs/job']);
});
test('download failure retries the completed job rather than creating a replacement', async () => {
  fixtures.api.mockResolvedValue({ id: 'job', state: 'complete', durationSec: 3 });
  native.download.mockRejectedValueOnce(new Error('download interrupted')).mockResolvedValueOnce({ status: 200 });
  native.remove.mockResolvedValue(undefined);
  disconnect = connectServerRenderer('group', 'user');
  expect(await renderVlog(request())).toMatchObject({ status: 'failed' });
  expect(await renderVlog(request())).toMatchObject({ status: 'done' });
  expect(fixtures.api.mock.calls.map(([p]) => p)).toEqual(['/groups/group/vlogs', '/vlogs/job']);
});
test('changing an edit cancels its abandoned job; leaving the editor cancels the replacement', async () => {
  vi.useFakeTimers();
  fixtures.api.mockResolvedValueOnce({ id: 'old', state: 'queued', progress: 0 }).mockRejectedValueOnce(new Error('offline'));
  disconnect = connectServerRenderer('group', 'user');
  const first = renderVlog(request()); await vi.advanceTimersByTimeAsync(1000); await first;
  fixtures.api.mockResolvedValueOnce({}).mockResolvedValueOnce({ id: 'new', state: 'queued', progress: 0 }).mockRejectedValueOnce(new Error('offline'));
  const second = renderVlog({ ...request(), title: '다른 제목' }); await vi.advanceTimersByTimeAsync(1000); await second;
  expect(fixtures.api.mock.calls.map(([p]) => p)).toEqual(['/groups/group/vlogs', '/vlogs/old', '/vlogs/old/cancellation', '/groups/group/vlogs', '/vlogs/new']);
  fixtures.api.mockResolvedValue({}); disconnect(); disconnect = undefined;
  expect(fixtures.api).toHaveBeenLastCalledWith('/vlogs/new/cancellation', {});
});

test('cancelling after creation cancels the server job and never downloads it', async () => {
  let cancelled=false;
  fixtures.api.mockImplementation(async(path)=>{
    if(path==='/groups/group/vlogs') { cancelled=true; return {id:'job',state:'queued'}; }
    return {};
  });
  disconnect=connectServerRenderer('group','user');
  expect(await renderVlog({...request(),isCancelled:()=>cancelled})).toEqual({status:'cancelled'});
  expect(fixtures.api).toHaveBeenLastCalledWith('/vlogs/job/cancellation',{});
  expect(native.download).not.toHaveBeenCalled();
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
test('stop and regenerate while a status request is delayed transfers ownership without cancelling the reused job', async () => {
  vi.useFakeTimers();
  const oldStatus = deferred<any>(), newStatus = deferred<any>();
  let reads = 0, cancelled = false, serverCancelled = false;
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/groups/group/vlogs') return { id: 'job', state: 'queued', progress: 0 };
    if (path.endsWith('/cancellation')) { serverCancelled = true; return {}; }
    return ++reads === 1 ? oldStatus.promise : newStatus.promise;
  });
  native.download.mockResolvedValue({ status: 200 }); native.remove.mockResolvedValue(undefined);
  disconnect = connectServerRenderer('group', 'user');
  const oldRun = renderVlog({ ...request(), isCancelled: () => cancelled });
  await vi.advanceTimersByTimeAsync(1000);
  cancelled = true;
  const newRun = renderVlog(request());
  await vi.advanceTimersByTimeAsync(0);
  oldStatus.resolve({ id: 'job', state: 'complete', durationSec: 3 });
  expect(await oldRun).toEqual({ status: 'cancelled' });
  newStatus.resolve({ id: 'job', state: serverCancelled ? 'cancelled' : 'complete', durationSec: 3 });
  expect(await newRun).toMatchObject({ status: 'done' });
  expect(fixtures.api.mock.calls.filter(([p]) => p.endsWith('/cancellation'))).toHaveLength(0);
  expect(fixtures.api.mock.calls.filter(([p]) => p === '/groups/group/vlogs')).toHaveLength(1);
});
test('stop and regenerate during download uses different files and late cleanup preserves the new result', async () => {
  const oldDownload = deferred<any>(); let cancelled = false;
  const disk = new Set<string>();
  fixtures.api.mockResolvedValue({ id: 'job', state: 'complete', durationSec: 3 });
  native.remove.mockImplementation(async (uri) => { disk.delete(uri); });
  native.download.mockImplementationOnce(async (_url, uri) => { await oldDownload.promise; disk.add(uri); return { status: 200 }; })
    .mockImplementationOnce(async (_url, uri) => { disk.add(uri); return { status: 200 }; });
  disconnect = connectServerRenderer('group', 'user');
  const oldRun = renderVlog({ ...request(), isCancelled: () => cancelled });
  await vi.waitFor(() => expect(native.download).toHaveBeenCalledTimes(1));
  cancelled = true;
  const result = await renderVlog(request());
  expect(result.status).toBe('done'); if (result.status !== 'done') throw Error('missing result');
  oldDownload.resolve({ status: 200 }); expect(await oldRun).toEqual({ status: 'cancelled' });
  expect(native.download.mock.calls[0][1]).not.toBe(result.uri);
  expect(disk.has(result.uri)).toBe(true);
  expect(native.remove).not.toHaveBeenCalledWith(result.uri, { idempotent: true });
  expect(fixtures.api.mock.calls.filter(([p]) => p.endsWith('/cancellation'))).toHaveLength(0);
  expect(await saveToGallery(result.uri)).toBe('saved');
});

test('restart before creation returns shares that pending creation without cancelling it', async () => {
  const creation = deferred<any>(); let cancelled = false;
  fixtures.api.mockImplementation(async (path) => path === '/groups/group/vlogs' ? creation.promise : { id: 'job', state: 'complete', durationSec: 3 });
  native.download.mockResolvedValue({ status: 200 }); native.remove.mockResolvedValue(undefined);
  disconnect = connectServerRenderer('group', 'user');
  const oldRun = renderVlog({ ...request(), isCancelled: () => cancelled });
  cancelled = true;
  const nextRun = renderVlog(request());
  creation.resolve({ id: 'job', state: 'queued' });
  expect(await oldRun).toEqual({ status: 'cancelled' });
  expect(await nextRun).toMatchObject({ status: 'done' });
  expect(fixtures.api.mock.calls.filter(([p]) => p === '/groups/group/vlogs')).toHaveLength(1);
  expect(fixtures.api.mock.calls.filter(([p]) => p.endsWith('/cancellation'))).toHaveLength(0);
});
test('stopping a delayed status request without a successor still cancels the server job', async () => {
  vi.useFakeTimers(); const status = deferred<any>(); let cancelled = false;
  fixtures.api.mockImplementation(async (path) => path === '/groups/group/vlogs' ? { id: 'job', state: 'queued' } : path.endsWith('/cancellation') ? {} : status.promise);
  disconnect = connectServerRenderer('group', 'user');
  const run = renderVlog({ ...request(), isCancelled: () => cancelled });
  await vi.advanceTimersByTimeAsync(1000); cancelled = true;
  status.resolve({ id: 'job', state: 'complete' });
  expect(await run).toEqual({ status: 'cancelled' });
  expect(fixtures.api.mock.calls.filter(([p]) => p.endsWith('/cancellation'))).toHaveLength(1);
  expect(native.download).not.toHaveBeenCalled();
});
