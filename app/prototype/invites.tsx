import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { InviteManageScreen } from '@/prototype/screens/InviteManageScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeInvitesRoute() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { groups } = useGroups();
  const nav = usePrototypeNav();
  // 방장이든 참여자든 현재 참여자면 누구나 초대를 관리한다.
  const group = groups.find((g) => g.id === groupId);
  if (!group) return <NotFound nav={nav} message="이 모임을 확인할 수 없어요." />;
  return <InviteManageScreen nav={nav} group={group} />;
}
