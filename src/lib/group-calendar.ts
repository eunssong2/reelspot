import { useRef, useState } from 'react';
import { api, ApiError, getGroup } from './api';
import { monthDays } from './calendar';
import { useFocusLoad } from './effects';

type MonthData = { group: any; schedules: any[]; members: any[]; plans: Record<string, any[]> };
type Phase = 'loading' | 'ready' | 'error' | 'denied';
const local = { handleAccessLossLocally: true };
const read = (path: string) => api(path, undefined, 'GET', undefined, {}, local);
const accessDenied = (e: unknown) => e instanceof ApiError && (e.httpStatus === 403 || ['FORBIDDEN', 'ACCESS_REVOKED', 'GROUP_CLOSED'].includes(e.code));

/** In-memory results belong to one account, group and requested month, including empty months. */
export function useGroupCalendar(userId: string | undefined, id: string, month: string, ready: boolean) {
  const scope = `${userId ?? 'guest'}:${id}:`;
  const key = scope + month;
  const [cache, setCache] = useState<Record<string, MonthData>>({});
  const [status, setStatus] = useState<{ key: string; phase: Phase }>({ key: '', phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useFocusLoad(() => {
    if (!ready) return;
    const request = ++generation.current;
    let live = true;
    const current = () => live && request === generation.current;
    const deny = () => {
      if (!current()) return;
      setCache((old) => Object.fromEntries(Object.entries(old).filter(([k]) => !k.startsWith(scope))));
      setStatus({ key, phase: 'denied' });
    };
    setStatus({ key, phase: 'loading' });
    void (async () => {
      try {
        const days = monthDays(month);
        const [group, calendar] = await Promise.all([
          getGroup(id, local),
          read(`/groups/${id}/calendar?from=${days[0]}&to=${days[41]}`),
        ]);
        if (!current()) return;
        setCache((old) => ({ ...old, [key]: {
          group, schedules: calendar.schedules,
          members: old[key]?.members ?? [], plans: old[key]?.plans ?? {},
        } }));
        const [members, ...details] = await Promise.allSettled([
          read(`/groups/${id}/members`),
          ...calendar.schedules.filter((s: any) => s.status !== 'deleted').slice(0, 20)
            .map((s: any) => read(`/schedules/${s.id}`)),
        ]);
        if (!current()) return;
        if ([members, ...details].some((r) => r.status === 'rejected' && accessDenied(r.reason))) {
          deny(); return;
        }
        setCache((old) => ({ ...old, [key]: { ...old[key],
          members: members.status === 'fulfilled' ? members.value.members : old[key].members,
          plans: { ...old[key].plans, ...Object.fromEntries(details
            .filter((r) => r.status === 'fulfilled')
            .map((r: any) => [r.value.schedule.id, r.value.plan])) },
        } }));
        setStatus({ key, phase: 'ready' });
      } catch (e) {
        if (!current()) return;
        if (accessDenied(e)) deny();
        else setStatus({ key, phase: 'error' });
      }
    })();
    return () => { live = false; };
  }, [key, ready, attempt]);
  const phase = status.key === key ? status.phase : 'loading';
  const data = phase === 'denied' ? undefined : cache[key];
  const group = phase === 'denied' ? null : data?.group ?? Object.entries(cache).find(([k]) => k.startsWith(scope))?.[1].group ?? null;
  return {
    group, schedules: data?.schedules ?? [], members: data?.members ?? [], plans: data?.plans ?? {},
    loaded: data !== undefined, busy: phase === 'loading', failed: phase === 'error', denied: phase === 'denied',
    retry: () => setAttempt((n) => n + 1),
  };
}
