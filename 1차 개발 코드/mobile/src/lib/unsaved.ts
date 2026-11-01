import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const navigation = useNavigation();
  const [allowed, setAllowed] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  function leave(action: () => void) {
    pending.current = action;
    setAllowed(true);
  }
  useEffect(() => {
    if (allowed && pending.current) {
      const action = pending.current;
      pending.current = null;
      action();
    }
  }, [allowed]);
  usePreventRemove(dirty && !allowed, ({ data }) => {
    Alert.alert('변경한 내용이 있습니다', '저장하고 나가거나 변경을 버릴 수 있습니다.', [
      { text: '계속 편집', style: 'cancel' },
      {
        text: '버리기',
        style: 'destructive',
        onPress: () => leave(() => navigation.dispatch(data.action)),
      },
      {
        text: '저장하고 나가기',
        onPress: async () => {
          if (await save()) leave(() => navigation.dispatch(data.action));
        },
      },
    ]);
  });
  return leave;
}

export function useFormExit(dirty: boolean, discard: () => Promise<void>, submitted = false) {
  const navigation = useNavigation();
  const [allowed, setAllowed] = useState(false);
  const action = useRef<(() => void) | null>(null);
  const leave = (next: () => void) => {
    action.current = next;
    setAllowed(true);
  };
  useEffect(() => {
    if (allowed && action.current) {
      const next = action.current;
      action.current = null;
      next();
    }
  }, [allowed]);
  usePreventRemove(dirty && !allowed, ({ data }) => {
    Alert.alert(
      submitted ? '처리 결과를 아직 확인하지 못했어요' : '작성하던 화면을 나갈까요?',
      submitted
        ? '이미 접수된 작업은 계속됩니다. 입력과 요청을 보관하므로 다시 열어 결과를 확인할 수 있어요.'
        : '나가면 작성한 내용을 지웁니다.',
      [
        { text: '계속 작성', style: 'cancel' },
        {
          text: submitted ? '나중에 확인' : '내용 버리고 나가기',
          onPress: async () => {
            if (!submitted) await discard();
            leave(() => navigation.dispatch(data.action));
          },
        },
      ],
    );
  });
  return leave;
}
