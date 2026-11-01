export const addDays = (value: string, count: number) =>
  new Date(Date.parse(value + 'T00:00:00Z') + count * 86400000).toISOString().slice(0, 10);
export function moveMonth(month: string, count: number) {
  const date = new Date(month + '-15T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 7);
}
export function monthDays(month: string) {
  const first = month + '-01',
    offset = (new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
}
export function inMonth(item: { startDate: string; endDate: string }, month: string) {
  return item.startDate < moveMonth(month, 1) + '-01' && item.endDate >= month + '-01';
}
export function rangeTap(start: string, end: string, date: string) {
  if (!start || end || date < start) return { start: date, end: '', error: '' };
  if ((Date.parse(date) - Date.parse(start)) / 86400000 > 365)
    return { start, end, error: '일정은 시작일과 종료일을 포함해 366일까지 선택할 수 있어요.' };
  return { start, end: date, error: '' };
}
