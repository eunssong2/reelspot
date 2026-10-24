import { useEffect, useEffectEvent, useRef, useLayoutEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
type Effect = () => void | (() => void);
// Route keys trigger loading; current form values are read without resetting the form on edits.
export function useInitialize(effect: Effect, keys: readonly unknown[] = []) {
  const current = useEffectEvent(effect),
    key = JSON.stringify(keys);
  useEffect(() => current(), [key]);
}
export function useFocusLoad(effect: Effect, keys: readonly unknown[] = []) {
  const current = useRef(effect),
    key = JSON.stringify(keys);
  useLayoutEffect(() => {
    current.current = effect;
  });
  useFocusEffect(
    useCallback(() => {
      void key;
      let cleanup = current.current();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          if (typeof cleanup === 'function') cleanup();
          cleanup = current.current();
        }
      });
      return () => {
        sub.remove();
        if (typeof cleanup === 'function') cleanup();
      };
    }, [key]),
  );
}
