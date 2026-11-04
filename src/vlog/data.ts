import { API, api, ApiError, getGroup, currentSession } from '../lib/api';
import { dayLabel, formatDuration } from '../lib/day-labels';
import type { VlogDay } from './model';
/** Server-controlled sources, with fresh access checks for each schedule and media page. */
export async function loadVlog(groupId: string) {
  const group = await getGroup(groupId);
  const { scheduleIds } = await api(`/groups/${groupId}/vlog-sources`);
  const days: VlogDay[] = [];
  for (const id of scheduleIds) {
    const detail = await api(`/schedules/${id}`);
    if (Date.parse(detail.retention.expiresAt) <= Date.now()) continue;
    const media: any[] = [];
    let cursor: string | null = null;
    do {
      try {
        const r: any = await api(`/schedules/${id}/media?view=by_photo&order=asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        media.push(...r.items); cursor = r.nextCursor;
      } catch (e) {
        if (e instanceof ApiError && ['EXPIRED', 'DELETED'].includes(e.code)) { media.length = 0; break; }
        throw e;
      }
    } while (cursor);
    for (const d of detail.days) {
      const visits = detail.plan.find((p: any) => p.date === d.date)?.visits ?? [];
      const places = visits.map((v: any) => ({
        key: v.id, place: { id: v.id, name: v.name, address: v.address, visitId: v.id, visitTime: v.plannedTime },
        media: media.filter((m) => m.visitId === v.id).map((m) => ({
          item: { id: m.id, kind: m.kind, imageUrl: `${API}/v1/media/${m.id}/content?context=shared&variant=thumbnail&cacheScope=${encodeURIComponent(currentSession()?.userId ?? '')}&cacheVersion=${m.version}`,
            ...(m.kind === 'video' ? { videoSource: `${API}/v1/media/${m.id}/content?context=shared&variant=view`, durationLabel: formatDuration(m.durationMs) } : {}), caption: m.description },
          memberId: m.authorUserId, authorName: m.displayName, time: m.sortAt,
          seconds: m.kind === 'video' ? m.durationMs / 1000 : undefined,
        })),
      }));
      days.push({ key: `${id}/${d.date}`, itineraryId: id, dayId: d.date, date: d.date,
        title: dayLabel({ ...d, scheduleTitle: detail.schedule.title, single: detail.days.length === 1 }),
        cancelled: d.status === 'cancelled' || detail.schedule.status === 'cancelled', places,
        mediaCount: places.reduce((n: number, p: any) => n + p.media.length, 0) });
    }
  }
  return { group, days: days.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)) };
}
