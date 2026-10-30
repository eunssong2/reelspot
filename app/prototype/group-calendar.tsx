import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { GroupCalendarScreen } from '@/prototype/screens/GroupCalendarScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeGroupCalendarRoute() {
  const { groupId, focusDate } = useLocalSearchParams<{ groupId?: string; focusDate?: string }>();
  const { groups } = useGroups();
  const nav = usePrototypeNav();
  // 내가 참여 중인 모임만 연다(나갔거나 없는 모임은 접근 불가 안내).
  const group = groups.find((g) => g.id === groupId);
  if (!group) return <NotFound nav={nav} message="이 모임을 확인할 수 없어요." />;
  return <GroupCalendarScreen nav={nav} group={group} focusDate={focusDate || undefined} />;
}
