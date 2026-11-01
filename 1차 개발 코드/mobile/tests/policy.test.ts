import { test } from 'node:test';
import assert from 'node:assert/strict';
import { text, period, plannedTime } from '../../server/core/policy.js';
import { inputText, validPeriod, validTime } from '../src/lib/validation.js';
test('앱·서버 공통 입력 벡터: NFC, grapheme, 공백, 줄바꿈, 기간·5분 시각', () => {
  for (const value of ['가나다','e\u0301','👨‍👩‍👧‍👦','🇰🇷','  산책  ']) assert.equal(inputText(value,'이름',3),text(value,3));
  for (const value of ['    ','1234','줄\n바꿈']) { assert.throws(() => inputText(value,'이름',3)); assert.throws(() => text(value,3)); }
  assert.equal(inputText('첫 줄\n둘째 줄','설명',100,false,true),text('첫 줄\n둘째 줄',100,false,true));
  for (const [start,end] of [['2026-01-01','2026-12-31'],['2026-01-01','2026-01-01']]) { assert.doesNotThrow(() => validPeriod(start,end)); assert.doesNotThrow(() => period(start,end)); }
  for (const [start,end] of [['2026-02-30','2026-03-01'],['2026-02-01','2026-01-31'],['2026-01-01','2027-01-02']]) { assert.throws(() => validPeriod(start,end)); assert.throws(() => period(start,end)); }
  for (const time of ['00:00','10:05','23:55']) assert.equal(validTime(time),plannedTime(time));
  for (const time of ['24:00','10:03','1:00']) { assert.throws(() => validTime(time)); assert.throws(() => plannedTime(time)); }
});
test('입력 오류 문구는 받침에 맞는 조사를 쓴다', () => {
  assert.throws(() => inputText(' ', '닉네임', 20), { message: '닉네임을 입력해 주세요.' });
  assert.throws(() => inputText('', '검색어', 20), { message: '검색어를 입력해 주세요.' });
  assert.throws(() => inputText('가나다', '모임 이름', 2), { message: '모임 이름은 최대 2자입니다.' });
  assert.throws(() => inputText('가나다', '검색어', 2), { message: '검색어는 최대 2자입니다.' });
  assert.throws(() => inputText('', 'URL', 2), { message: 'URL을(를) 입력해 주세요.' });
});
