import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';
import { VlogFlowScreen } from '@/prototype/vlog/VlogFlowScreen';

export default function PrototypeVlogRoute() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { groups } = useGroups();
  const nav = usePrototypeNav();
  // 내가 참여 중인 모임(방장·참여자 모두)만 연다.
  const group = groups.find((g) => g.id === groupId);
  if (!group) return <NotFound nav={nav} message="이 모임을 확인할 수 없어요." />;
  return <VlogFlowScreen nav={nav} group={group} />;
}
