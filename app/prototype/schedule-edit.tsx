import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { ScheduleEditScreen } from '@/prototype/screens/ScheduleEditScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototypeNav } from '@/prototype/state/PrototypeProvider';

export default function PrototypeScheduleEditRoute() {
  const { groupId, scheduleId, date } = useLocalSearchParams<{ groupId?: string; scheduleId?: string; date?: string }>();
  const { groups, schedule } = useGroups();
  const nav = usePrototypeNav();
  const group = groups.find((g) => g.id === groupId);
  const target = scheduleId ? schedule(scheduleId) : undefined;
  // 일정 추가·변경은 방장만. 취소된 일정은 바꿀 수 없다.
  if (!group || group.myRole !== 'owner') return <NotFound nav={nav} message="방장만 일정을 바꿀 수 있어요." />;
  if (scheduleId && (!target || target.status === 'cancelled'))
    return <NotFound nav={nav} message="취소된 일정은 바꿀 수 없어요." />;
  // key: 같은 경로로 다른 일정을 열면 입력 상태를 새로 시작한다.
  return (
    <ScheduleEditScreen key={scheduleId || 'new'} nav={nav} group={group} schedule={target} defaultDate={date || undefined} />
  );
}
