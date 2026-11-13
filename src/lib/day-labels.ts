// Pure helpers for the per-day schedule model (one schedule per date per group).
export type ScheduleDay = {
  date: string;
  dayNo: number;
  title: string | null;
  status: 'active' | 'cancelled';
  visitCount: number;
};
export type GroupDay = ScheduleDay & {
  scheduleId: string;
  scheduleTitle: string;
  scheduleStatus: string;
  /** The schedule has exactly one day: its day title is the schedule title. */
  single: boolean;
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
export const weekday = (date: string, long = false) =>
  WEEKDAYS[utc(date).getUTCDay()] + (long ? '요일' : '');
/** "10월 17일 토요일" */
export const dateHeading = (date: string) =>
  `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 ${weekday(date, true)}`;
/** "10.17" */
export const shortDate = (date: string) => `${date.slice(5, 7)}.${date.slice(8, 10)}`;
/** "2026.10.17 - 10.24" (same year), "2026.12.30 - 2027.01.02" otherwise. */
export function periodLabel(start: string, end: string) {
  const a = start.replaceAll('-', '.');
  if (!end || end === start) return a;
  return `${a} - ${end.slice(0, 4) === start.slice(0, 4) ? shortDate(end) : end.replaceAll('-', '.')}`;
}
export const periodLength = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
/** Badge for a selected period: "당일" or "n일 동안". */
export const periodBadge = (start: string, end: string) => {
  const n = periodLength(start, end);
  return n === 1 ? '당일' : `${n}일 동안`;
};
/** Day title shown in calendar cells, day cards and the date view. */
export function dayLabel(day: Pick<GroupDay, 'title' | 'dayNo' | 'scheduleTitle' | 'single'>) {
  if (day.title) return day.title;
  if (day.single) return day.scheduleTitle;
  return day.title || `${day.dayNo}일차 · ${day.scheduleTitle}`;
}
/** Days of a schedule; falls back to its period when the server has not sent `days` yet. */
export function scheduleDayList(schedule: any): ScheduleDay[] {
  if (Array.isArray(schedule?.days))
    return [...schedule.days].sort((a, b) => a.date.localeCompare(b.date));
  const out: ScheduleDay[] = [];
  if (!schedule?.startDate || !schedule?.endDate) return out;
  for (let t = Date.parse(schedule.startDate), i = 1; t <= Date.parse(schedule.endDate); t += 86400000, i++)
    out.push({
      date: new Date(t).toISOString().slice(0, 10),
      dayNo: i,
      title: null,
      status: schedule.status === 'cancelled' ? 'cancelled' : 'active',
      visitCount: 0,
    });
  return out;
}
/** Flatten a group's schedules into date-ordered day entries. */
export function groupDays(schedules: any[]): GroupDay[] {
  return schedules
    .filter((s) => s.status !== 'deleted')
    .flatMap((s) => {
      const days = scheduleDayList(s);
      return days.map((d) => ({
        ...d,
        status: s.status === 'cancelled' ? ('cancelled' as const) : d.status,
        scheduleId: s.id,
        scheduleTitle: s.title,
        scheduleStatus: s.status,
        single: days.length === 1,
      }));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.status.localeCompare(b.status));
}
/** Dates held by active days of schedules other than `exceptScheduleId`. */
export function takenDates(days: GroupDay[], exceptScheduleId?: string) {
  return new Set(
    days.filter((d) => d.status === 'active' && d.scheduleId !== exceptScheduleId).map((d) => d.date),
  );
}
export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** "방금 전", "12분 전", "3시간 전", "2일 전", then "10.17". */
export function relativeTime(value: string | null | undefined, now = Date.now()) {
  if (!value) return '';
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return '';
  const minutes = Math.floor((now - t) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 1440)}일 전`;
  return shortDate(new Date(t + 9 * 3600000).toISOString().slice(0, 10));
}
/** Video length badge "0:08", "1:05". */
export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
/** "D-61", "진행 중" (from the first day on), "지난 일정" relative to `today` (YYYY-MM-DD). */
export function dDay(start: string, end: string, today: string) {
  if (today < start) return `D-${Math.round((Date.parse(start) - Date.parse(today)) / 86400000)}`;
  if (!end || today <= end) return '진행 중';
  return '지난 일정';
}
/** "10.29 23:31" in Korea time. */
export function monthDayTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const k = new Date(Date.parse(value) + 9 * 3600000).toISOString();
  return `${k.slice(5, 7)}.${k.slice(8, 10)} ${k.slice(11, 16)}`;
}
