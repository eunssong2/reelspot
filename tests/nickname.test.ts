import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editNickname, canSaveNickname, nicknameLength } from '../src/lib/nickname';
test('nickname input caps user-perceived characters, not emoji code units', () => {
  assert.equal(editNickname('abcdefghijkl', 'abcdefghijklm'), 'abcdefghijkl');
  const emoji = '👨‍👩‍👧‍👦';
  assert.equal(editNickname('', emoji.repeat(13)), emoji.repeat(12));
  assert.equal(nicknameLength(emoji.repeat(12)), 12);
  assert.equal(canSaveNickname(emoji.repeat(12)), true);
  assert.equal(canSaveNickname(emoji.repeat(13)), false);
});
test('Korean composition at the boundary can replace the final syllable', () => {
  let value = '가'.repeat(11);
  for (const composition of ['ㅎ', '하', '한']) {
    value = editNickname(value, '가'.repeat(11) + composition);
    assert.equal(value, '가'.repeat(11) + composition);
  }
  assert.equal(editNickname(value, value + 'ㄱ'), value);
  assert.equal(nicknameLength('  한  '), 1);
  assert.equal(canSaveNickname('   '), false);
});
test('inserting at the beginning or middle of a full nickname preserves every existing character', () => {
  for (const value of ['abcdefghijkl', '가나다라마바사아자차카타', '😀'.repeat(12)]) {
    const parts = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value)].map((s) => s.segment);
    for (const index of [0, 6, 12]) {
      const next = [...parts.slice(0, index), 'ㅎ', ...parts.slice(index)].join('');
      assert.equal(editNickname(value, next), value);
    }
    const replacement = [...parts.slice(0, 6), '한', ...parts.slice(7)].join('');
    assert.equal(editNickname(value, replacement), replacement);
  }
});
test('legacy names are preserved until explicitly edited, with no silent truncation', () => {
  const legacy = 'abcdefghijklmnopqrst';
  assert.equal(canSaveNickname(legacy), false);
  assert.equal(editNickname(legacy, legacy), legacy);
  assert.equal(editNickname(legacy, legacy.slice(0, -1)), legacy.slice(0, -1));
  assert.equal(editNickname(legacy, legacy + 'u'), legacy);
  assert.equal(editNickname(legacy, ''), '');
  assert.equal(editNickname(legacy, '새 이름'), '새 이름');
  assert.equal(canSaveNickname('새 이름'), true);
});
