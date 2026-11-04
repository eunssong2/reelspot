import { useCallback, useRef, useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { RecoveryNotice } from '../vlog/parts';
import { Screen, Button, P } from '../components/ui';
import { useAccount } from '../lib/state';
import { currentSession, ApiError } from '../lib/api';
import { useFocusLoad } from '../lib/effects';
import { loadVlog } from '../vlog/data';
import { VlogFlowScreen } from '../vlog/VlogFlowScreen';
import { VlogProvider, useVlog } from '../vlog/VlogProvider';
import { draftProblem } from '../vlog/model';
function Editor({ groupId }: { groupId: string }) {
  const store = useVlog();
  const [source, setSource] = useState<Awaited<ReturnType<typeof loadVlog>> | null>(null);
  const [error, setError] = useState('');
  const [accessLost, setAccessLost] = useState(false);
  const request = useRef(0);
  const owner = useRef(currentSession()?.userId);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const reload = useCallback(async () => {
    const generation = ++request.current;
    try {
      const fresh = await loadVlog(groupId);
      if (live.current && generation === request.current && currentSession()?.userId === owner.current) { setSource(fresh); setError(''); setAccessLost(false); }
    } catch (e) { if (live.current && generation === request.current) { setError((e as Error).message); if (e instanceof ApiError && ['FORBIDDEN', 'GROUP_CLOSED', 'DELETED'].includes(e.code)) setAccessLost(true); } }
  }, [groupId]);
  useFocusLoad(() => { void reload(); }, [reload]);
  if (store.storageError) return <Screen title="브이로그 초안"><P>{store.storageError}</P><Button onPress={store.retryStorage}>다시 시도</Button><Button onPress={() => router.back()}>돌아가기</Button></Screen>;
  if (accessLost) return <Screen title="브이로그 만들기"><P>{error}</P><Button onPress={() => router.back()}>돌아가기</Button></Screen>;
  if (!source || !store.hydrated) return <Screen title="브이로그 만들기"><P>{error || '모임 기록을 확인하고 있어요.'}</P>{!!error && <Button onPress={reload}>다시 시도</Button>}</Screen>;
  return <VlogFlowScreen notice={error ? <RecoveryNotice message={`기록을 새로 확인하지 못했어요. ${error}`} label="다시 시도" onPress={reload} /> : null} group={source.group} days={source.days} nav={{ back: () => router.back() }} revalidate={async () => {
    const fresh = await loadVlog(groupId);
    if (currentSession()?.userId !== owner.current) throw new Error('로그인 상태가 바뀌었어요.');
    const problem = draftProblem(store.draftOf(groupId), fresh.days);
    if (problem) { setSource(fresh); throw new Error(problem); }
  }} />;
}
export default function Vlog() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useAccount();
  if (!session || !groupId) return <Screen title="브이로그 만들기"><P>로그인 후 모임에서 다시 열어 주세요.</P></Screen>;
  return <VlogProvider key={`${session.userId}:${groupId}`} userId={session.userId} groupId={groupId}><Editor groupId={groupId} /></VlogProvider>;
}
