import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { defaultCaptionStyle, emptyDraft, type VlogDraft } from './model';

/** 저장 형식을 바꾸면 버전을 올려 이전 저장본을 무시한다. */
const STORAGE_KEY = 'reelspot.vlog.drafts.v1';
/** 되돌리기로 거슬러 갈 수 있는 변경 수 */
const HISTORY_MAX = 40;
/** 이 시간(ms) 안에 이어지는 변경(끌기·확대 등)은 한 번의 변경으로 묶는다 */
const COALESCE_MS = 500;

interface VlogState {
  hydrated: boolean;
  /** 모임별 초안(MVP: 사용자·모임 안의 브이로그 프로젝트별 저장). 없으면 빈 초안 */
  draftOf: (groupId: string) => VlogDraft;
  /** 최신 초안에 변경을 적용한다(연속 호출해도 앞 변경을 잃지 않는다). */
  update: (groupId: string, fn: (draft: VlogDraft) => VlogDraft) => void;
  /** 새로 만들기: 초안을 비운다. */
  reset: (groupId: string) => void;
  /** 바로 전 변경으로 되돌린다 / 되돌린 것을 다시 적용한다. 되돌릴 것이 없으면 아무 일도 없다. */
  undo: (groupId: string) => void;
  redo: (groupId: string) => void;
  canUndo: (groupId: string) => boolean;
  canRedo: (groupId: string) => boolean;
  /** 되돌리기 기록을 비운다(편집 화면에 들어올 때: 이전 단계의 변경까지 되돌리지 않게) */
  clearHistory: (groupId: string) => void;
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
  // 되돌리기 기록(저장하지 않는다 — 앱을 닫으면 사라진다). tick 은 화면을 다시 그리게 하는 용도.
  const past = useRef<Record<string, VlogDraft[]>>({});
  const future = useRef<Record<string, VlogDraft[]>>({});
  const lastPush = useRef<Record<string, number>>({});
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

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
            if (!d || !Array.isArray(d.dayKeys) || !d.placeKeys || !d.mediaIds || !d.settings) continue;
            // 이전 저장본은 글씨체를 장면별로 두었다. 지금은 영상 전체에 한 벌이라, 쓰던 글씨체를 끌어올린다.
            const legacyFont = !d.captionStyle ? Object.values(d.settings).find((x) => x?.fontId)?.fontId : undefined;
            clean[id] = legacyFont ? { ...d, captionStyle: { ...defaultCaptionStyle(), fontId: legacyFont } } : d;
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
    const now = Date.now();
    // 끌기처럼 짧은 간격으로 이어지는 변경은 기록을 새로 쌓지 않아 한 번에 되돌려진다.
    if (now - (lastPush.current[groupId] ?? 0) > COALESCE_MS) {
      past.current[groupId] = [...(past.current[groupId] ?? []), current].slice(-HISTORY_MAX);
    }
    lastPush.current[groupId] = now;
    future.current[groupId] = [];
    ref.current = { ...ref.current, [groupId]: next };
    setDrafts(ref.current);
    bump();
  }, []);

  const reset = useCallback((groupId: string) => {
    const { [groupId]: _removed, ...rest } = ref.current;
    ref.current = rest;
    past.current[groupId] = [];
    future.current[groupId] = [];
    setDrafts(rest);
    bump();
  }, []);

  const undo = useCallback((groupId: string) => {
    const stack = past.current[groupId] ?? [];
    const prev = stack[stack.length - 1];
    if (!prev) return;
    const current = ref.current[groupId] ?? emptyDraft(groupId);
    past.current[groupId] = stack.slice(0, -1);
    future.current[groupId] = [...(future.current[groupId] ?? []), current];
    lastPush.current[groupId] = 0;
    ref.current = { ...ref.current, [groupId]: { ...prev, updatedAt: Date.now() } };
    setDrafts(ref.current);
    bump();
  }, []);

  const redo = useCallback((groupId: string) => {
    const stack = future.current[groupId] ?? [];
    const next = stack[stack.length - 1];
    if (!next) return;
    const current = ref.current[groupId] ?? emptyDraft(groupId);
    future.current[groupId] = stack.slice(0, -1);
    past.current[groupId] = [...(past.current[groupId] ?? []), current];
    lastPush.current[groupId] = 0;
    ref.current = { ...ref.current, [groupId]: { ...next, updatedAt: Date.now() } };
    setDrafts(ref.current);
    bump();
  }, []);

  const clearHistory = useCallback((groupId: string) => {
    past.current[groupId] = [];
    future.current[groupId] = [];
    bump();
  }, []);

  const canUndo = (groupId: string) => (past.current[groupId]?.length ?? 0) > 0;
  const canRedo = (groupId: string) => (future.current[groupId]?.length ?? 0) > 0;

  // 기록은 ref 에 있으므로 값 객체는 매 렌더 새로 만든다(되돌릴 수 있는지가 바로 화면에 반영되게).
  const value = { hydrated, draftOf, update, reset, undo, redo, canUndo, canRedo, clearHistory };
  return <VlogContext.Provider value={value}>{children}</VlogContext.Provider>;
}

export function useVlog(): VlogState {
  const ctx = useContext(VlogContext);
  if (!ctx) throw new Error('useVlog 는 VlogProvider 안에서만 쓸 수 있습니다.');
  return ctx;
}
