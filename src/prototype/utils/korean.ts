/**
 * 낱말 뒤에 붙는 조사를 받침에 맞춰 고른다.
 * 화면에 '(으)로', '을(를)' 같은 괄호 표기가 나오지 않게 한다.
 */

/** 한글 음절의 받침 번호. 한글이 아니면 undefined */
function finalConsonant(word: string): number | undefined {
  const last = word.trim().slice(-1);
  if (!last) return undefined;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return undefined;
  return (code - 0xac00) % 28;
}

/**
 * '로' / '으로'. 받침이 없거나 ㄹ 받침이면 '로', 그 밖에는 '으로'.
 *   펜글씨 → 펜글씨로 · 기기 기본 → 기기 기본으로 · 제목 고딕 → 제목 고딕으로
 * 한글이 아닌 낱말(영문·숫자)은 '로'를 붙인다.
 */
export function ro(word: string): string {
  const jong = finalConsonant(word);
  // 8 은 ㄹ 받침이다.
  return jong === undefined || jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}

/** '은' / '는' */
export function eun(word: string): string {
  const jong = finalConsonant(word);
  return jong === undefined || jong === 0 ? `${word}는` : `${word}은`;
}

/** '을' / '를' */
export function eul(word: string): string {
  const jong = finalConsonant(word);
  return jong === undefined || jong === 0 ? `${word}를` : `${word}을`;
}
