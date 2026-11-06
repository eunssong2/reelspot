import '@formatjs/intl-segmenter/polyfill.js';
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const NICKNAME_LIMIT = 12;
export const nicknameLength = (value: string) => [...segmenter.segment(value.normalize('NFC').trim())].length;
export const canSaveNickname = (value: string) => nicknameLength(value) > 0 && nicknameLength(value) <= NICKNAME_LIMIT && !/[\r\n]/.test(value);

/** Preserve legacy values on open; allow shortening them without silently truncating them. */
export function editNickname(previous: string, next: string) {
  const count = nicknameLength(next);
  if (count <= NICKNAME_LIMIT) return next;
  if (nicknameLength(previous) > NICKNAME_LIMIT) {
    return count <= nicknameLength(previous) ? next : previous;
  }
  // At capacity, reject the entire over-limit edit. Truncating `next` would
  // remove an existing final character when inserting at the start or middle.
  // Composition/replacement that still fits was already accepted above.
  if (nicknameLength(previous) === NICKNAME_LIMIT) return previous;
  // Do not normalize composing text. Grapheme segmentation keeps Korean syllables and
  // joined emoji intact; native maxLength counts a different unit on Android.
  const leading = next.match(/^\s*/)?.[0] ?? '';
  const trailing = next.match(/\s*$/)?.[0] ?? '';
  return leading + [...segmenter.segment(next.trim())].slice(0, NICKNAME_LIMIT).map((s) => s.segment).join('') + trailing;
}
