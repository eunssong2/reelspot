import { useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/prototype/components/NotFound';
import { membersFor, TRIPS } from '@/prototype/mock/tripData';
import { MembersScreen, type MemberRow } from '@/prototype/screens/MembersScreen';
import { useGroups } from '@/prototype/state/GroupsProvider';
import { usePrototype, usePrototypeNav } from '@/prototype/state/PrototypeProvider';

/**
 * 함께하는 친구. 모임 달력 상단의 인원 표시(groupId)나 일정 요약의 프로필 묶음(tripId·itineraryId)에서 열린다.
 */
export default function PrototypeMembersRoute() {
  const { groupId, tripId, itineraryId } = useLocalSearchParams<{ groupId?: string; tripId?: string; itineraryId?: string }>();
  const { itineraries, profile } = usePrototype();
  const { groups, session, removeMember } = useGroups();
  const nav = usePrototypeNav();

  if (groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return <NotFound nav={nav} message="이 모임을 확인할 수 없어요." />;
    const me = session?.displayName;
    const rows: MemberRow[] = group.members.map((name, i) => ({ id: `${name}-${i}`, name, isOwner: i === 0, isMe: name === me }));
    // 방장일 때만 참여자를 내보낼 수 있다.
    const onRemove =
      group.myRole === 'owner'
        ? async (m: MemberRow) => (await removeMember(group.id, m.name)).ok
        : undefined;
    return <MembersScreen nav={nav} title={group.name} members={rows} onRemove={onRemove} />;
  }

  const itinerary = itineraries.find((it) => it.id === itineraryId && it.tripId === tripId);
  if (!tripId || !itinerary) return <NotFound nav={nav} message="일정을 찾을 수 없어요." />;
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const rows: MemberRow[] = membersFor(trip).map((m) => ({
    id: m.id,
    name: m.isMe ? profile.nickname : m.name,
    avatarUrl: m.isMe && profile.avatarUri ? profile.avatarUri : m.avatarUrl,
    isMe: m.isMe,
  }));
  return <MembersScreen nav={nav} title={itinerary.name} members={rows} />;
}
