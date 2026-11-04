import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Sheet, P, Button } from './ui';

/** Pushes (photo detail/save/transfers) retain the record screen. Pops and local record exits ask first. */
export function useCandidateExit({ count, busy }: { count: number; busy: boolean }) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<{ run: () => void; removesRoute: boolean } | null>(null);
  const [allowed, setAllowed] = useState(false);
  const accepted = useRef<(() => void) | null>(null);
  usePreventRemove((count > 0 || busy) && !allowed, ({ data }) => {
    setPending({ run: () => navigation.dispatch(data.action), removesRoute: true });
  });
  useEffect(() => {
    if (allowed && accepted.current) { const action = accepted.current; accepted.current = null; action(); }
  }, [allowed]);
  function requestExit(run: () => void) {
    if (count || busy) setPending({ run, removesRoute: false });
    else run();
  }
  return {
    requestExit,
    dialog: <Sheet visible={!!pending} title="담아 둔 파일을 비우고 나갈까요?" onClose={() => setPending(null)}>
      <P>아직 올리지 않은 파일은 지워집니다. 이 앱에서 촬영한 사진·동영상은 앨범에 저장되지 않았으며 다시 가져올 수 없어요.</P>
      {busy && <P>촬영·접수 중이에요. 작업이 끝난 뒤 나갈 수 있어요.</P>}
      <Button disabled={busy} onPress={() => {
        if (!pending) return;
        if (pending.removesRoute) { accepted.current = pending.run; setPending(null); setAllowed(true); }
        else { const action = pending.run; setPending(null); action(); }
      }}>비우고 나가기</Button>
      <Button secondary onPress={() => setPending(null)}>계속 담기</Button>
    </Sheet>,
  };
}
