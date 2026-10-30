import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { DayEditScreen } from '@/prototype/screens/DayEditScreen';
import { ScheduleEditScreen } from '@/prototype/screens/ScheduleEditScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';
import { dayEntriesOf } from '@/prototype/utils/dayEntries';

export default function PrototypeScheduleEditRoute() {
  const { groupId, scheduleId, date, dayId } = useLocalSearchParams<{ groupId?: string; scheduleId?: string; date?: string; dayId?: string }>();
  const { groups, schedule } = useGroups();
  const { itineraries } = usePrototype();
  const nav = usePrototypeNav();
  const group = groups.find((g) => g.id === groupId);
  const target = scheduleId ? schedule(scheduleId) : undefined;
  // 일정 추가·변경은 방장만. 취소된 일정은 바꿀 수 없다.
  if (!group || group.myRole !== 'owner') return <NotFound nav={nav} message="방장만 일정을 바꿀 수 있어요." />;
  if (scheduleId && (!target || target.status === 'cancelled'))
    return <NotFound nav={nav} message="취소된 일정은 바꿀 수 없어요." />;

  // 모임 달력에서 하루 일정을 눌러 들어온 경우: 그날의 제목·날짜만 고친다.
  if (target && dayId) {
    const itinerary = target.itineraryId ? itineraries.find((it) => it.id === target.itineraryId) : undefined;
    const entry = dayEntriesOf(target, itinerary).find((en) => en.dayId === dayId);
    if (!entry) return <NotFound nav={nav} message="이 일정을 찾을 수 없어요." />;
    if (entry.cancelled) return <NotFound nav={nav} message="취소된 일정은 바꿀 수 없어요." />;
    // 다른 일정(과 같은 일정의 다른 날)이 이미 쓰는 날짜: 날짜를 옮길 때 고를 수 없다.
    const takenDates = new Set<string>();
    for (const sc of useGroupsSchedules(group.id)) {
      if (sc.status !== 'active') continue;
      const it = sc.itineraryId ? itineraries.find((i) => i.id === sc.itineraryId) : undefined;
      for (const en of dayEntriesOf(sc, it)) if (!en.cancelled && !(sc.id === target.id && en.dayId === dayId)) takenDates.add(en.date);
    }
    return (
      <DayEditScreen
        key={`${scheduleId}/${dayId}`}
        nav={nav}
        group={group}
        schedule={target}
        dayId={dayId}
        initialTitle={entry.title}
        initialDate={entry.date}
        places={entry.places}
        takenDates={[...takenDates]}
      />
    );
  }

  // key: 같은 경로로 다른 일정을 열면 입력 상태를 새로 시작한다.
  return (
    <ScheduleEditScreen key={scheduleId || 'new'} nav={nav} group={group} schedule={target} defaultDate={date || undefined} />
  );
}

function useGroupsSchedules(groupId: string) {
  return useGroups().schedulesOf(groupId);
}
