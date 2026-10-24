import '@formatjs/intl-segmenter/polyfill.js';
const segments = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export function inputText(value: string, label: string, max: number, required = true, multiline = false) {
  const v = value.normalize('NFC').trim();
  if (required && !v) throw new Error(`${label}을(를) 입력해 주세요.`);
  if ([...segments.segment(v)].length > max) throw new Error(`${label}은(는) 최대 ${max}자입니다.`);
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
  if (value && !/^([01]\d|2[0-3]):[0-5][05]$/.test(value)) throw new Error('예정 시각은 00:00~23:55 사이 5분 단위로 입력해 주세요.');
  return value || null;
}
