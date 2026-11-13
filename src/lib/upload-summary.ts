export type BatchTask = { state: string; kind: 'photo' | 'video' };
/** States that will not change without the user or an operator acting. */
const SETTLED = ['complete', 'failed', 'cancelled', 'review'];
export const isSettled = (state: string) => SETTLED.includes(state);
/**
 * One submission's result. Only files the server has published count as uploaded:
 * sent bytes, files waiting for review, failures and unknown results do not.
 */
export function summarizeBatch(tasks: BatchTask[]) {
  const done = tasks.filter((t) => t.state === 'complete');
  return {
    settled: tasks.length > 0 && tasks.every((t) => isSettled(t.state)),
    photos: done.filter((t) => t.kind === 'photo').length,
    videos: done.filter((t) => t.kind === 'video').length,
    failed: tasks.filter((t) => t.state === 'failed').length,
    review: tasks.filter((t) => t.state === 'review').length,
    pending: tasks.filter((t) => !isSettled(t.state)).length,
  };
}
const counted = (photos: number, videos: number) =>
  [photos > 0 && `사진 ${photos}장`, videos > 0 && `동영상 ${videos}개`].filter(Boolean).join('·');
/** "사진 3장을 업로드했습니다." Empty when nothing was published. */
export function uploadedMessage(photos: number, videos: number) {
  if (photos + videos === 0) return '';
  return `${counted(photos, videos)}${videos > 0 ? '를' : '을'} 업로드했습니다.`;
}
/** Result of saving to the phone; counts files actually written to the album. */
export function savedMessage(photos: number, videos: number) {
  if (photos + videos === 0) return '';
  if (photos === 1 && videos === 0) return '사진이 휴대폰에 저장되었습니다.';
  return `${counted(photos, videos)}${videos > 0 ? '를' : '을'} 휴대폰에 저장했습니다.`;
}
