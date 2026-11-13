/**
 * Last day records of a schedule ending on `end` are kept: the same day three calendar
 * months later, or that month's last day when it has no such day. Mirrors the server policy.
 */
export function retentionLastDate(end: string) {
  const d = new Date(`${end}T00:00:00Z`),
    month = d.getUTCMonth() + 3;
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(d.getUTCFullYear(), month, day)).toISOString().slice(0, 10);
}
/** True when files for a period ending on `end` could no longer be uploaded on `today`. */
export const retentionPassed = (end: string, today: string) => !!end && retentionLastDate(end) < today;
/** Days from `today` to the last retention day: 0 is the last day, negative is expired. */
export const daysUntil = (lastDate: string, today: string) =>
  Math.round((Date.parse(lastDate) - Date.parse(today)) / 86400000);
/** In-app retention notice for the week before expiry (F21). Empty outside that week. */
export const retentionNotice = (lastDate: string, today: string) => noticeForDaysLeft(daysUntil(lastDate, today));
export function noticeForDaysLeft(left: number) {
  if (left < 0 || left > 7) return '';
  if (left === 0) return '오늘 보관이 끝나는 기록이 있어요';
  if (left === 1) return '내일 보관이 끝나는 기록이 있어요';
  return '보관 안내 · 만료 7일 전 기록이 있어요';
}
