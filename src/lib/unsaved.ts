import { useEffect, useRef, useState } from 'react';
import { dialog } from '../components/confirm-host';
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
    dialog({
      title: '저장하지 않고 나갈까요?',
      body: '바꾼 내용이 사라져요.',
      buttons: [
        {
          label: '저장하고 나가기',
          onPress: async () => {
            if (await save()) leave(() => navigation.dispatch(data.action));
          },
        },
        { label: '나가기', tone: 'danger', onPress: () => leave(() => navigation.dispatch(data.action)) },
        { label: '계속 편집', tone: 'plain' },
      ],
    });
  });
  return leave;
}

export function useFormExit(
  dirty: boolean,
  discard: () => Promise<void>,
  submitted = false,
  wording?: { title: string; body?: string; cancel: string; discard: string; save?: { label: string; run: () => Promise<boolean> } },
) {
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
  const confirmExit = (next: () => void) => {
    dialog({
      title: submitted ? '처리 결과를 아직 확인하지 못했어요' : wording?.title ?? '작성하던 화면을 나갈까요?',
      body: submitted
        ? '이미 접수된 작업은 계속됩니다. 입력과 요청을 보관하므로 다시 열어 결과를 확인할 수 있어요.'
        : wording ? wording.body : '나가면 작성한 내용을 지웁니다.',
      buttons: [
        // Saving handles its own navigation when it succeeds; a failed save keeps the form.
        ...(!submitted && wording?.save ? [{ label: wording.save.label, onPress: () => void wording.save!.run() }] : []),
        {
          label: submitted ? '나중에 확인' : wording?.discard ?? '내용 버리고 나가기',
          tone: submitted ? ('primary' as const) : ('danger' as const),
          onPress: async () => {
            try {
              if (!submitted) await discard();
              leave(next);
            } catch (e) {
              dialog({ title: '나갈 수 없어요', body: e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.', buttons: [{ label: '확인', tone: 'plain' }] });
            }
          },
        },
        { label: wording?.cancel ?? '계속 작성', tone: 'plain' as const },
      ],
    });
  };
  usePreventRemove(dirty && !allowed, ({ data }) => confirmExit(() => navigation.dispatch(data.action)));
  return Object.assign(leave, { confirmExit });
}
