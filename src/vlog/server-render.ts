import type { paths } from '../../contracts/generated';
import * as FS from 'expo-file-system/legacy';
import { API, api, currentSession } from '../lib/api';
import { Transfer } from '../../modules/atp-transfer';
import { setRenderHandler, setGallerySaveHandler } from './vlogBridge';
type RenderJob = paths['/vlogs/{jobId}']['get']['responses'][200]['content']['application/json'];
type JobEntry = { ready: Promise<RenderJob>; job?: RenderJob };
let requestSequence = 0;
/** Register handlers for exactly one authenticated editor; generated local files never cross accounts. */
export function connectServerRenderer(groupId: string, userId: string) {
  let active = true, owner = 0;
  const files = new Map<string, string>();
  // A pending creation is shared too: cancelling/restarting before its response
  // arrives must not create a second server job.
  const jobs = new Map<string, JobEntry>();
  const sameAccount = () => active && currentSession()?.userId === userId;
  const cancel = async (entry: JobEntry) => {
    try {
      const job = entry.job ?? await entry.ready;
      if (currentSession()?.userId === userId) await api(`/vlogs/${job.id}/cancellation`, {});
    } catch { /* Server expires abandoned jobs after 24 hours. */ }
  };
  setRenderHandler(async (request) => {
    if (!sameAccount() || request.isCancelled()) return { status: 'cancelled' };
    const requestId = ++requestSequence;
    owner = requestId; // Transfer ownership synchronously, before any await.
    const signature = JSON.stringify([request.title, request.timeline]);
    let entry: JobEntry | undefined;
    let local: string | undefined;
    const stopped = () => owner !== requestId || !sameAccount() || request.isCancelled();
    const forget = () => {
      if (owner === requestId && jobs.get(signature) === entry) jobs.delete(signature);
    };
    const stop = async () => {
      if (owner !== requestId || !entry || jobs.get(signature) !== entry) return;
      forget(); // A later request must create a fresh job once cancellation starts.
      await cancel(entry);
    };
    const create = () => {
      const next: JobEntry = { ready: api<RenderJob>(`/groups/${groupId}/vlogs`, { title: request.title, timeline: request.timeline }) };
      jobs.set(signature, next);
      next.ready.then(job => { next.job = job; }, () => {
        if (jobs.get(signature) === next) jobs.delete(signature);
      });
      return next;
    };
    try {
      for (const [oldSignature, old] of jobs) if (oldSignature !== signature) {
        jobs.delete(oldSignature);
        await cancel(old);
        if (stopped()) return { status: 'cancelled' };
      }
      const previous = jobs.get(signature);
      entry = previous ?? create();
      let job = await entry.ready;
      if (stopped()) { await stop(); return { status: 'cancelled' }; }
      if (previous) {
        try { job = await api<RenderJob>(`/vlogs/${job.id}`); }
        catch (error) {
          if (!['EXPIRED', 'NOT_FOUND'].includes((error as { code?: string }).code ?? '')) throw error;
          job = { ...job, state: 'expired' };
        }
        if (stopped()) { await stop(); return { status: 'cancelled' }; }
        if (['failed', 'cancelled', 'expired'].includes(job.state)) {
          forget(); entry = create(); job = await entry.ready;
        }
      }
      while (true) {
        if (stopped()) { await stop(); return { status: 'cancelled' }; }
        if (job.state === 'failed' || job.state === 'expired') { forget(); return { status: 'failed', reason: '영상을 만들지 못했어요. 원본과 네트워크를 확인하고 다시 시도해 주세요.' }; }
        if (job.state === 'cancelled') { forget(); return { status: 'cancelled' }; }
        if (job.state === 'complete') break;
        request.onProgress(job.progress);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (stopped()) { await stop(); return { status: 'cancelled' }; }
        job = await api<RenderJob>(`/vlogs/${job.id}`);
      }
      // Each request owns its own output. Late download completion/cleanup can
      // never overwrite or remove a newer request's result for the same job.
      local = `${FS.cacheDirectory}vlog-${userId}-${job.id}-${requestId}.mp4`;
      const result = await FS.downloadAsync(`${API}/v1/vlogs/${job.id}/content`, local, { headers: { Authorization: `Bearer ${currentSession()?.accessToken}` } });
      if (result.status !== 200) throw new Error('영상을 내려받지 못했어요. 다시 시도해 주세요.');
      if (stopped()) { await stop(); return { status: 'cancelled' }; }
      forget(); files.set(local, job.id); request.onProgress(1);
      return { status: 'done', uri: local, durationSec: job.durationSec };
    } catch (error) {
      if (stopped()) { await stop(); return { status: 'cancelled' }; }
      throw error;
    } finally {
      if (local && !files.has(local)) await FS.deleteAsync(local, { idempotent: true });
    }
  });
  setGallerySaveHandler(async (uri) => {
    const id = files.get(uri);
    if (!sameAccount() || !id || !Transfer) return 'failed';
    await api(`/vlogs/${id}`); // Recheck current membership, blocked/deleted/expired sources before each save.
    if (!sameAccount()) return 'failed';
    await Transfer.saveToAlbum(uri, 'video/mp4', `at-that-place-vlog-${id}.mp4`);
    return 'saved';
  });
  return () => {
    active = false; setRenderHandler(null); setGallerySaveHandler(null);
    for (const entry of jobs.values()) void cancel(entry);
    jobs.clear();
    for (const uri of files.keys()) void FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
    files.clear();
  };
}
