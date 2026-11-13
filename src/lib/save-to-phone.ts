import * as FS from 'expo-file-system/legacy';
import { API, api, currentSession } from './api';
import { Transfer } from '../../modules/atp-transfer';

export type SaveResult = { mediaId: string; kind: 'photo' | 'video'; saved: boolean; reason?: string };
export type SaveStage = { step: 'preparing' | 'downloading' | 'writing'; index: number; total: number };
/**
 * Saves records to the phone album: prepare location-free copies, download them, write them
 * to the shared album. A file counts as saved only after the album write returned.
 */
export async function saveToPhone(ids: string[], onStage: (stage: SaveStage) => void): Promise<SaveResult[]> {
  if (!Transfer) throw new Error('Android 빌드에서 저장할 수 있습니다.');
  onStage({ step: 'preparing', index: 0, total: ids.length });
  const r = await api('/exports', { mediaIds: ids, purpose: 'save' });
  const output: SaveResult[] = [];
  const headers = () => ({ Authorization: `Bearer ${currentSession()?.accessToken}` });
  for (const [index, item] of r.results.entries()) {
    // The kind of a file that never arrived is unknown; it is only reported as not saved.
    if (item.state !== 'ready') {
      output.push({ mediaId: item.mediaId, kind: 'photo', saved: false, reason: '참여 권한·보관 기한·파일 상태가 바뀌어 저장할 수 없어요.' });
      continue;
    }
    const local = `${FS.cacheDirectory}save-${item.mediaId}`,
      url = `${API}/v1/exports/${r.exportId}/files/${item.mediaId}`;
    let kind: 'photo' | 'video' = 'photo';
    try {
      onStage({ step: 'downloading', index: index + 1, total: r.results.length });
      let d = await FS.downloadAsync(url, local, { headers: headers() });
      if (d.status === 401) {
        // Any API call refreshes an expired session; then the file is requested once more.
        await api(`/exports/${r.exportId}`);
        d = await FS.downloadAsync(url, local, { headers: headers() });
      }
      if (d.status !== 200)
        throw new Error([403, 410].includes(d.status) ? '참여 권한·보관 기한·파일 상태가 바뀌어 저장할 수 없어요.' : '파일을 내려받지 못했어요. 네트워크를 확인해 주세요.');
      const mime = d.headers['content-type'] ?? d.headers['Content-Type'] ?? 'image/jpeg',
        ext = mime.includes('video') ? 'mp4' : mime.includes('png') ? 'png' : 'jpg';
      kind = mime.includes('video') ? 'video' : 'photo';
      onStage({ step: 'writing', index: index + 1, total: r.results.length });
      await Transfer.saveToAlbum(local, mime, `at-that-place-${item.mediaId}.${ext}`);
      output.push({ mediaId: item.mediaId, kind, saved: true });
    } catch (e) {
      const message = (e as Error).message ?? '';
      output.push({
        mediaId: item.mediaId,
        kind,
        saved: false,
        reason: /space|ENOSPC/i.test(message)
          ? '휴대폰의 남은 저장 공간을 확인해 주세요.'
          : /권한|네트워크/.test(message)
            ? message
            : '내려받기 또는 앨범 저장에 실패했어요. 네트워크·저장 공간을 확인해 주세요.',
      });
    } finally {
      await FS.deleteAsync(local, { idempotent: true }).catch(() => {});
    }
  }
  // Files the server did not answer for are failures too, never silently dropped.
  for (const id of ids)
    if (!output.some((o) => o.mediaId === id))
      output.push({ mediaId: id, kind: 'photo', saved: false, reason: '저장 결과를 확인하지 못했어요.' });
  return output;
}
