import { useEffect, useSyncExternalStore } from 'react';
import { vi } from 'vitest';
let focused = true;
const listeners = new Set<() => void>();
export function setFocused(next: boolean) { focused = next; listeners.forEach((fn) => fn()); }
export const router = { push: vi.fn(() => setFocused(false)), back: vi.fn(), replace: vi.fn(), dismissTo: vi.fn() };
export let params: Record<string, string> = {};
export const setParams = (next: Record<string, string>) => { params = next; };
export const useLocalSearchParams = () => params;
export const useFocusEffect = (fn: () => void | (() => void)) => {
  const focus = useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => focused);
  useEffect(() => { if (focus) return fn(); }, [focus, fn]);
};
export const removal = { enabled: false, callback: (_: any) => {}, dispatch: vi.fn() };
export const useNavigation = () => ({ addListener: () => () => {}, dispatch: removal.dispatch });
export const useIsFocused = () => focused;
