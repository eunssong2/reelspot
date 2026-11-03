import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { emptyDraft, type VlogDraft } from './model';

/** 저장 형식을 바꾸면 버전을 올려 이전 저장본을 무시한다. */
const STORAGE_KEY = 'reelspot.vlog.drafts.v1';

interface VlogState {
  hydrated: boolean;
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
 * 이전 단계로 돌아가거나 닫았다 다시 들어와도 잃지 않는다. 저장소를 읽지 못하면 빈 초안으로 시작한다.
 * 편집본만 저장하며 원본 기록(사진·동영상)과 일정 순서는 바꾸지 않는다.
 */
export function VlogProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, VlogDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef(drafts);
  ref.current = drafts;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!cancelled && parsed && typeof parsed === 'object') {
          const clean: Record<string, VlogDraft> = {};
          for (const [id, d] of Object.entries(parsed as Record<string, VlogDraft>)) {
            // 최소한의 모양만 확인한다. 깨진 저장본은 버린다.
            if (d && Array.isArray(d.dayKeys) && d.placeKeys && d.mediaIds && d.settings) clean[id] = d;
          }
          setDrafts(clean);
        }
      } catch {
        // 읽지 못하면 빈 초안으로 시작한다.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)).catch(() => {
      // 저장 실패는 이번 실행의 화면에는 영향이 없다. 다음 변경 때 다시 시도한다.
    });
  }, [drafts, hydrated]);

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

  const value = useMemo(() => ({ hydrated, draftOf, update, reset }), [hydrated, draftOf, update, reset]);
  return <VlogContext.Provider value={value}>{children}</VlogContext.Provider>;
}

export function useVlog(): VlogState {
  const ctx = useContext(VlogContext);
  if (!ctx) throw new Error('useVlog 는 VlogProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
