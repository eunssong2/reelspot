import '@formatjs/intl-segmenter/polyfill.js';
const segments = new Intl.Segmenter('ko', { granularity: 'grapheme' });
// Picks the Korean particle from the label's last syllable; non-Hangul keeps both forms.
function particle(word: string, batchim: string, plain: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${batchim}(${plain})`;
  return word + (code % 28 ? batchim : plain);
}
export function inputText(value: string, label: string, max: number, required = true, multiline = false) {
  const v = value.normalize('NFC').trim();
  if (required && !v) throw new Error(`${particle(label, '을', '를')} 입력해 주세요.`);
  if ([...segments.segment(v)].length > max) throw new Error(`${particle(label, '은', '는')} 최대 ${max}자입니다.`);
  if (!multiline && /[\r\n]/.test(v)) throw new Error(`${label}에는 줄바꿈을 사용할 수 없습니다.`);
  return v;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.');
  return value;
}
export function validPeriod(start: string, end: string) {
  validDate(start); validDate(end);
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days < 0 || days > 365) throw new Error('종료 날짜는 시작 날짜 이후이며, 기간은 최대 366일입니다.');
}
export function validTime(value: string) {
  if (value && !/^([01]\d|2[0-3]):[0-5][0-9]$/.test(value)) throw new Error('예정 시각은 00:00~23:59 사이 1분 단위로 입력해 주세요.');
  return value || null;
}

const graphemes = (text: string) => [...segments.segment(text)].map((x) => x.segment);
/**
 * The field itself stops at 30 characters. A longer title saved elsewhere (Q15) stays as it
 * is and can be shortened; text typed or pasted past the limit is cut at the end, and an
 * insertion in the middle that would push other characters out is ignored.
 */
export function capTitle(previous: string, next: string, max = 30) {
  const count = graphemes(next).length;
  if (count <= max || count <= graphemes(previous).length) return next;
  return next.startsWith(previous) || !previous ? graphemes(next).slice(0, Math.max(max, graphemes(previous).length)).join('') : previous;
}
