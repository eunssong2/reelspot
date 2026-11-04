import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { emptyDraft, type VlogDraft } from './model';
import { draftStorageKey, writeDrafts } from './storage';
import { restoreDrafts } from './restore';

/** 저장 형식을 바꾸면 버전을 올려 이전 저장본을 무시한다. */


interface VlogState {
  hydrated: boolean;
  storageError: string;
  retryStorage: () => void;
  /** 모임별 초안(MVP: 사용자·모임 안의 브이로그 프로젝트별 저장). 없으면 빈 초안 */
  draftOf: (groupId: string) => VlogDraft;
  /** 최신 초안에 변경을 적용한다(연속 호출해도 앞 변경을 잃지 않는다). */
  update: (groupId: string, fn: (draft: VlogDraft) => VlogDraft) => void;
  /** 새로 만들기: 초안을 비운다. */
  reset: (groupId: string) => void;
}

const VlogContext = createContext<VlogState | null>(null);

/**
 * 브이로그 작성 중인 초안 저장소. 선택·템플릿·순서·자막·글씨체를 기기(AsyncStorage)에 저장해
 * 이전 단계로 돌아가거나 닫았다 다시 들어와도 잃지 않는다. 저장소를 읽지 못하면 원본을 보존하고 재시도를 안내한다.
 * 편집본만 저장하며 원본 기록(사진·동영상)과 일정 순서는 바꾸지 않는다.
 */
export function VlogProvider({ children, userId, groupId }: { children: ReactNode; userId: string; groupId: string }) {
  const STORAGE_KEY = draftStorageKey(userId, groupId);
  const [storageError, setStorageError] = useState('');
  const [readAttempt, setReadAttempt] = useState(0);
  const failure = useRef<'read' | 'write'>('read');
  const [drafts, setDrafts] = useState<Record<string, VlogDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef(drafts);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const clean = restoreDrafts(raw, groupId);
        if (!cancelled) { ref.current = clean; setDrafts(clean); setStorageError(''); }
      } catch {
        failure.current = 'read';
        if (!cancelled) setStorageError('초안을 읽지 못했어요. 저장 공간과 앱 상태를 확인한 뒤 다시 시도해 주세요. 기존 초안은 보존됩니다.');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [STORAGE_KEY, groupId, readAttempt]);

  useEffect(() => {
    if (!hydrated || storageError) return;
    void writeDrafts(userId, STORAGE_KEY, JSON.stringify(drafts)).catch(() => { failure.current = 'write'; setStorageError('초안을 저장하지 못했어요. 이 화면을 닫기 전에 저장 공간을 확인해 주세요.'); });
  }, [drafts, hydrated, STORAGE_KEY, userId, storageError]);

  const retryStorage = useCallback(() => {
    if (failure.current === 'read') setReadAttempt((n) => n + 1);
    else void writeDrafts(userId, STORAGE_KEY, JSON.stringify(ref.current)).then(() => setStorageError('')).catch(() => {});
  }, [userId, STORAGE_KEY]);

  const draftOf = useCallback((groupId: string) => drafts[groupId] ?? emptyDraft(groupId), [drafts]);

  const update = useCallback((groupId: string, fn: (draft: VlogDraft) => VlogDraft) => {
    const current = ref.current[groupId] ?? emptyDraft(groupId);
    const next = { ...fn(current), groupId, updatedAt: Date.now() };
    ref.current = { ...ref.current, [groupId]: next };
    setDrafts(ref.current);
  }, []);

  const reset = useCallback((groupId: string) => {
    const { [groupId]: _removed, ...rest } = ref.current;
    ref.current = rest;
    setDrafts(rest);
  }, []);

  const value = useMemo(() => ({ hydrated, storageError, retryStorage, draftOf, update, reset }), [hydrated, storageError, retryStorage, draftOf, update, reset]);
  return <VlogContext.Provider value={value}>{children}</VlogContext.Provider>;
}

export function useVlog(): VlogState {
  const ctx = useContext(VlogContext);
  if (!ctx) throw new Error('useVlog 는 VlogProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
