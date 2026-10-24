import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const navigation = useNavigation();
  const [allowed, setAllowed] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  function leave(action: () => void) { pending.current = action; setAllowed(true); }
  useEffect(() => { if (allowed && pending.current) { const action = pending.current; pending.current = null; action(); } }, [allowed]);
  usePreventRemove(dirty && !allowed, ({ data }) => {
    Alert.alert('변경한 내용이 있습니다', '저장하고 나가거나 변경을 버릴 수 있습니다.', [
      { text: '계속 편집', style: 'cancel' },
      { text: '버리기', style: 'destructive', onPress: () => leave(() => navigation.dispatch(data.action)) },
      { text: '저장하고 나가기', onPress: async () => { if (await save()) leave(() => navigation.dispatch(data.action)); } },
    ]);
  });
  return leave;
}
