import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentSession } from './api';
export function usePreference<T>(name: string, initial: T) {
  const key = `atp.preference:${currentSession()?.userId ?? 'guest'}:${name}`;
  const [value, setValue] = useState(initial), [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(key).then((raw) => { if (live && raw) setValue(JSON.parse(raw)); }).catch(() => {}).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [key]);
  const update = useCallback((next: T | ((old: T) => T)) => {
    setValue((old) => {
      const value = typeof next === 'function' ? (next as (old: T) => T)(old) : next;
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
      return value;
    });
  }, [key]);
  return [value, update, ready] as const;
}
export const todayInSeoul = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const formatMoment = (value?: string | null) => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '정보 없음';
