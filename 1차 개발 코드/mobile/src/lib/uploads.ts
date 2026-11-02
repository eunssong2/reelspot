import { randomUUID } from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { PermissionsAndroid, Platform } from 'react-native';
import { Transfer } from '../../modules/atp-transfer';
import * as ImagePicker from 'expo-image-picker';
import { API, api, awaitOperation, currentSession, getGroup } from './api';
export type Candidate = {
  uri: string;
  name: string;
  mime: string;
  kind: 'photo' | 'video';
  declaredBytes: number;
  fingerprint: string;
  clientFileId: string;
  selectionIndex: number;
  recordDate: string;
  visitId: string | null;
  description: string;
  checksum: string;
  durationMs?: number;
  sourceUri?: string;
};
export async function candidate(
  uri: string,
  name: string,
  mime: string,
  date: string,
  visitId: string | null,
  index: number,
): Promise<Candidate> {
  if (!Transfer) throw new Error('Android 개발 빌드에서 파일 전송을 사용할 수 있습니다.');
  const id = randomUUID(),
    folder = `${FileSystem.documentDirectory}uploads/${currentSession()!.userId}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const path = folder + id;
  try {
    await FileSystem.copyAsync({ from: uri, to: path });
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) throw new Error('파일에 접근할 수 없습니다.');
    if (info.size > 200000000) throw new Error('사진은 50MB, 영상은 200MB까지 선택할 수 있습니다.');
    if (!Transfer.inspect) throw new Error('파일 검증을 지원하는 최신 APK를 설치해 주세요.');
    const inspected = JSON.parse(await Transfer.inspect(path));
    mime = inspected.mime;
    if (info.size > (inspected.kind === 'video' ? 200000000 : 50000000)) throw new Error('파일 용량 한도를 초과했습니다.');
    const fingerprint = await Transfer.digest(path);
    return { uri: path, name, mime, kind: inspected.kind, declaredBytes: info.size, fingerprint, checksum: fingerprint,
      clientFileId: id, selectionIndex: index, recordDate: date, visitId, description: '', durationMs: inspected.durationMs, sourceUri: uri };
  } catch { await FileSystem.deleteAsync(path, { idempotent: true }); throw new Error('선택 파일을 사용할 수 없습니다. 사진 50MB/100메가픽셀, 영상 MP4·MOV H.264/HEVC·AAC 200MB/60초 이내인지 확인해 주세요.'); }

}
export async function enqueueTask(task: any, file: Candidate) {
  const session = currentSession()!;
  if (!Transfer) throw new Error('Android 개발 빌드가 필요합니다.');
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33)
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

  const key = `atp.queue:${session.userId}`,
    q = JSON.parse((await AsyncStorage.getItem(key)) ?? '{}');
  q[task.id] = { file, task };
  await AsyncStorage.setItem(key, JSON.stringify(q));
  await Transfer.enqueue(
    JSON.stringify({
      taskId: task.id,
      userId: session.userId,
      uri: file.uri,
      baseUrl: API,
      accessToken: session.accessToken,
      generation: task.transport.generation,
      fingerprint: file.fingerprint,
      localState: 'queued',
    }),
  );
}
export async function queue() {
  return JSON.parse(
    (await AsyncStorage.getItem(`atp.queue:${currentSession()?.userId}`)) ?? '{}',
  ) as Record<string, { file: Candidate; task: any }>;
}
export async function resumeTask(id: string) {
  const q = await queue(),
    item = q[id];
  if (!item) return;
  const current = await api(`/upload-tasks/${id}`);
  if (['complete', 'cancelled', 'verifying', 'review'].includes(current.state)) return;
  if (current.state === 'failed' || new Date(current.transport.expiresAt) < new Date()) {
    const task = await api(`/upload-tasks/${id}/retries`, {
      sameFileFingerprint: item.file.fingerprint,
    });
    await enqueueTask(task, item.file);
  } else await enqueueTask(current, item.file);
}

export function submissionFile(f: Candidate, selectionIndex: number) {
  return { name: f.name, mime: f.mime, kind: f.kind, declaredBytes: f.declaredBytes, fingerprint: f.fingerprint,
    clientFileId: f.clientFileId, selectionIndex, recordDate: f.recordDate, visitId: f.visitId, description: f.description, checksum: f.checksum };
}
export async function restorePendingTransfers() {
  const session = currentSession(); if (!session || !Transfer) return;
  const saved = await queue();
  const ids = Object.keys(saved);
  for (let i = 0; i < ids.length; i += 120) {
    try { const r = await api(`/me/upload-tasks?ids=${ids.slice(i,i+120).join(',')}`); for (const done of r.tasks) if (['complete','cancelled'].includes(done.state)) await FileSystem.deleteAsync(saved[done.id].file.uri, { idempotent: true }).catch(() => {}); for (const task of r.tasks) if (['queued','uploading'].includes(task.state)) { if (new Date(task.transport.expiresAt) < new Date()) await resumeTask(task.id); else await enqueueTask(task, saved[task.id].file); } } catch { /* Keep local files for manual retry. */ }
  }
}
export async function clearLocalAccount(userId: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k === `atp.queue:${userId}` || k.startsWith(`atp.upload-draft:${userId}:`) || k.startsWith(`atp.draft:${userId}:`));
  await AsyncStorage.multiRemove(keys);
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}uploads/${userId}/`, { idempotent: true });
}

/**
 * Pick one photo, upload it as a group cover or the user's avatar and apply it once the
 * transfer completes. Returns false when the upload is still running (the transfer status
 * screen keeps an apply button) and null when the picker was cancelled.
 */
export async function uploadAndApplyImage(
  target: { kind: 'cover'; groupId: string } | { kind: 'avatar' },
) {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const x = picked.assets[0];
  const file = await candidate(
    x.uri,
    x.fileName ?? 'photo.jpg',
    x.mimeType ?? 'image/jpeg',
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
    null,
    0,
  );
  const body = {
    file: { name: file.name, mime: file.mime, declaredBytes: file.declaredBytes, fingerprint: file.fingerprint },
  };
  const task = await api(
    target.kind === 'cover' ? `/groups/${target.groupId}/cover-uploads` : '/me/avatar-uploads',
    body,
  );
  await enqueueTask(task, file);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const current = (await api(`/me/upload-tasks?ids=${task.id}`)).tasks?.[0];
    if (!current) continue;
    if (['failed', 'cancelled'].includes(current.state))
      throw new Error('사진을 올리지 못했어요. 파일 전송 상태에서 확인해 주세요.');
    if (current.state !== 'complete') continue;
    if (target.kind === 'cover') {
      const g = await getGroup(target.groupId);
      await awaitOperation(
        await api(`/groups/${g.id}`, { coverAssetId: current.coverAssetId, expectedVersion: g.version }, 'PATCH'),
      );
    } else {
      const profile = await api('/me/profile');
      await awaitOperation(
        await api('/me/profile', { avatarAssetId: current.avatarAssetId, expectedVersion: profile.version }, 'PATCH'),
      );
    }
    return true;
  }
  return false;
}
