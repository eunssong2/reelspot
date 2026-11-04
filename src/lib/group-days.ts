import { api } from './api';
import type { GroupDay } from './day-labels';
export async function loadGroupDays(groupId: string): Promise<GroupDay[]> {
  const days = new Map<string, GroupDay>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const r: any = await api(`/groups/${groupId}/days${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    for (const item of r.items) days.set(`${item.scheduleId}:${item.day.date}`, {
      ...item.day, scheduleId: item.scheduleId, scheduleTitle: item.scheduleTitle,
      scheduleStatus: 'active', single: false,
    });
    cursor = r.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error('날짜 목록을 다시 불러와 주세요.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.scheduleId.localeCompare(b.scheduleId));
}
