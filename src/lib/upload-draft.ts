import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { currentSession } from './api';
import type { Candidate } from './uploads';
import { assertUploadScope, uploadDraftKey, type UploadScope } from './upload-scope';
const writes = new Map<string, Promise<void>>();
const inUse = new Set<string>();
async function serialized(userId: string, action: () => Promise<void>) {
  const next = (writes.get(userId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (currentSession()?.userId !== userId) throw new Error('로그인 상태가 바뀌었어요.');
    await action();
  });
  writes.set(userId, next);
  return next;
}
export async function writeUploadDraft(scope: UploadScope, files: Candidate[]) {
  assertUploadScope(scope, files);
  return serialized(scope.userId, async () => {
    await AsyncStorage.setItem(uploadDraftKey(scope), JSON.stringify(files));
  });
}
export interface SavedUploadDraft { key: string; snapshot: string; label: string; files: Candidate[]; unreadable: boolean }
export async function listUploadDrafts(userId: string): Promise<SavedUploadDraft[]> {
  await flushUploadDrafts(userId);
  if (currentSession()?.userId !== userId) throw new Error('로그인 상태가 바뀌었어요.');
  const prefix = `atp.upload-draft:${userId}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
  const result: SavedUploadDraft[] = [];
  for (const key of keys) {
    const snapshot = await AsyncStorage.getItem(key);
    if (!snapshot) continue;
    let files: Candidate[] = [], unreadable = false;
    try { files = JSON.parse(snapshot); if (!Array.isArray(files) || files.some((f) => !f || typeof f.uri !== 'string')) throw new Error(); }
    catch { unreadable = true; files = []; }
    if (!unreadable && !files.length) continue;
    const dates = [...new Set(files.map((f) => f.recordDate))].join(', ');
    result.push({ key, snapshot, files, unreadable, label: unreadable ? '읽을 수 없는 이전 후보' : `${dates || '날짜 미확인'} · ${files.length}개` });
  }
  return result;
}
export async function removeUploadDraft(userId: string, entry: SavedUploadDraft) {
  if (!entry.key.startsWith(`atp.upload-draft:${userId}:`)) throw new Error('다른 계정의 후보는 정리할 수 없어요.');
  return serialized(userId, async () => {
    if (inUse.has(entry.key)) throw new Error('이 후보를 촬영·접수 중이에요. 작업이 끝난 뒤 정리해 주세요.');
    if (await AsyncStorage.getItem(entry.key) !== entry.snapshot) throw new Error('후보가 바뀌었어요. 목록을 다시 확인해 주세요.');
    if (!entry.unreadable) await discardPrivateCopies(userId, entry.files, entry.key);
    await AsyncStorage.removeItem(entry.key);
  });
}
async function discardPrivateCopies(userId: string, filesToDiscard: Candidate[], excludeKey?: string) {
    if (!filesToDiscard.length) return;
    const queue = JSON.parse((await AsyncStorage.getItem(`atp.queue:${userId}`)) ?? '{}');
    const referenced = new Set(Object.values(queue).map((v: any) => v.file?.uri));
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`atp.upload-draft:${userId}:`) && k !== excludeKey);
    for (const key of keys) {
      const files = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
      if (!Array.isArray(files)) throw new Error('다른 후보 정보를 읽지 못해 파일 정리를 중단했어요.');
      for (const file of files) referenced.add(file?.uri);
    }
    const folder = `${FS.documentDirectory}uploads/${userId}/`;
    // Only private copies owned by this account; never album originals or queued/shared files.
    for (const file of filesToDiscard) {
      const name = file.uri.startsWith(folder) ? file.uri.slice(folder.length) : '';
      if (name && !name.includes('/') && name !== '..' && name !== '.' && !referenced.has(file.uri))
        await FS.deleteAsync(file.uri, { idempotent: true });
    }
}
export async function flushUploadDrafts(userId: string) { await writes.get(userId)?.catch(() => {}); }
/** New candidates live only in this record screen. Disk reads migrate earlier saved candidates. */
export function useUploadDraft(scope: UploadScope) {
  const key = uploadDraftKey(scope);
  const [files, setFiles] = useState<Candidate[]>([]);
  const current = useRef<Candidate[]>([]);
  const active = useRef(false);
  const pending = useRef(new Set<Promise<unknown>>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const workInFlight = pending.current;
    active.current = true;
    void (async () => {
      try {
        await flushUploadDrafts(scope.userId);
        const raw = await AsyncStorage.getItem(key);
        const saved = JSON.parse(raw ?? '[]');
        if (!Array.isArray(saved)) throw new Error('잘못된 저장 형식');
        assertUploadScope(scope, saved);
        if (!live) return;
        // Older persisted candidates become screen-local after a successful read.
        current.current = saved;
        if (raw) await serialized(scope.userId, () => AsyncStorage.removeItem(key));
        if (live) { setFiles(saved); setReady(true); setError(''); }
      } catch { if (live) setError('이전 후보를 읽지 못했어요. 기존 저장본은 보존됩니다. 다시 시도해 주세요.'); }
    })();
    return () => {
      live = false; active.current = false;
      // A picker/submission already in flight must finish before its copies can be cleaned.
      const work = [...workInFlight];
      void serialized(scope.userId, async () => {
        await Promise.allSettled(work);
        const discarded = current.current;
        current.current = [];
        await discardPrivateCopies(scope.userId, discarded);
      }).catch(() => {}); // Account cleanup owns the folder after logout.
    };
  // Cleanup belongs to the record screen lifetime, not focus. Child routes retain this component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  async function replace(next: Candidate[]) {
    assertUploadScope(scope, next);
    current.current = next;
    if (active.current) setFiles(next);
  }
  async function whileInUse<T>(action: () => Promise<T>) {
    inUse.add(key);
    const work = action(); pending.current.add(work);
    try { return await work; } finally { pending.current.delete(work); inUse.delete(key); }
  }
  return { files, replace, ready, error, whileInUse, retry: () => setAttempt((n) => n + 1) };
}
