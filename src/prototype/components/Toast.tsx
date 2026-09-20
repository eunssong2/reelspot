import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shadow } from '../styles/tokens';

/** 잠깐 떴다 사라지는 안내 메시지. 아직 구현하지 않은 버튼을 눌렀을 때도 쓴다. */
export function useToast(durationMs = 1800) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, show };
}

/** bottom: 화면 아래에서 띄울 간격(하단 버튼과 겹치지 않게 화면별로 지정). */
export function Toast({ message, bottom = 100 }: { message: string | null; bottom?: number }) {
  if (!message) return null;
  return (
    <View style={[styles.wrap, { bottom }]}>
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', pointerEvents: 'none', left: 20, right: 20, alignItems: 'center', zIndex: 50 },
  pill: {
    backgroundColor: 'rgba(30,43,58,0.92)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    boxShadow: shadow.float,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
