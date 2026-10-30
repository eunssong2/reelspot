import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, currentSession, restoreSession, sessionEvents, type Session } from './api';
const State = createContext<{
  session: Session | null;
  profile: any;
  ready: boolean;
  refresh: () => Promise<void>;
}>({ session: null, profile: null, ready: false, refresh: async () => {} });
export function Provider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<any>(null),
    [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (currentSession()) setProfile(await api('/me/profile'));
  }, []);
  useEffect(() => {
    const listener = (s: Session | null) => {
      setSession(s);
      if (!s) setProfile(null);
      else refresh().catch(() => {});
    };
    sessionEvents.add(listener);
    restoreSession()
      .then((s) => {
        setSession(s);
        return s ? refresh() : null;
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh().catch(() => {});
    });
    return () => {
      sessionEvents.delete(listener);
      sub.remove();
    };
  }, [refresh]);
  return <State.Provider value={{ session, profile, ready, refresh }}>{children}</State.Provider>;
}
export const useAccount = () => useContext(State);
export function useDraft(key: string, initial: Record<string, string>) {
  const { session } = useAccount(),
    [value, setValue] = useState(initial), [ready, setReady] = useState(false), [hasDraft, setHasDraft] = useState(false);
  const storage = `atp.draft:${session?.userId ?? 'guest'}:${key}`;
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storage).then((v) => { if (v && live) { setValue(JSON.parse(v)); setHasDraft(true); } }).catch(() => {}).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [storage]);
  return [
    value,
    (field: string, text: string) =>
      setValue((old) => {
        const next = { ...old, [field]: text };
        AsyncStorage.setItem(storage, JSON.stringify(next));
        return next;
      }),
    () => AsyncStorage.removeItem(storage),
    { ready, hasDraft },
  ] as const;
}
