import { demand } from './errors.js';
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export function text(value: unknown, max: number, required = true, multiline = false): string {
  demand(typeof value === 'string', 'VALIDATION_ERROR');
  const v = value.normalize('NFC').trim();
  demand(
    (!required || v.length > 0) &&
      [...segmenter.segment(v)].length <= max &&
      (multiline || !/[\r\n]/.test(v)),
    'VALIDATION_ERROR',
  );
  return v;
}
export function date(value: string) {
  demand(
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'VALIDATION_ERROR',
  );
  return value;
}
export function period(start: string, end: string) {
  date(start);
  date(end);
  const n = (Date.parse(end) - Date.parse(start)) / 86400000;
  demand(n >= 0 && n <= 365, 'VALIDATION_ERROR');
}
export function plannedTime(v: string | null | undefined) {
  demand(v == null || /^([01]\d|2[0-3]):[0-5][05]$/.test(v), 'VALIDATION_ERROR');
  return v ?? null;
}
export function retention(end: string) {
  const d = new Date(`${date(end)}T00:00:00Z`),
    month = d.getUTCMonth() + 3;
  const day = Math.min(
    d.getUTCDate(),
    new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate(),
  );
  const last = new Date(Date.UTC(d.getUTCFullYear(), month, day));
  return {
    lastDate: last.toISOString().slice(0, 10),
    expiresAt: new Date(last.getTime() + 15 * 3600000).toISOString(),
  };
}
export function isExpired(s: Record<string, any>) {
  return (
    Date.now() >=
    Date.parse(s.expires_at ?? retention(s.cancelled_end_date ?? s.end_date).expiresAt)
  );
}
export function rangeDate(s: Record<string, any>, d: string) {
  date(d);
  demand(d >= s.start_date && d <= s.end_date, 'DATE_OUTSIDE_SCHEDULE');
}

export function businessDeadline(start: Date, days: number, holidays: string[] = []) {
  const d = new Date(start);
  for (let left = days; left > 0;) {
    d.setTime(d.getTime() + 86400000);
    const local = new Date(d.getTime() + 9 * 3600000);
    const day = local.getUTCDay(), date = local.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.includes(date)) left--;
  }
  return d;
}
