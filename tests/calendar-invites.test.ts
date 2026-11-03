import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, moveMonth, inMonth, rangeTap } from '../src/lib/calendar';
import { parseInviteInput } from '../src/lib/invite-input';
test('달력은 월요일 시작42일·윤년·연도 경계와 월에 겹치는 일정을 보존', () => {
  const days = monthDays('2028-02');
  assert.equal(days.length, 42);
  assert.equal(new Date(days[0]).getUTCDay(), 1);
  assert.ok(days.includes('2028-02-29'));
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2027-01', -1), '2026-12');
  assert.equal(inMonth({ startDate: '2026-09-29', endDate: '2026-10-02' }, '2026-10'), true);
  assert.equal(inMonth({ startDate: '2026-11-01', endDate: '2026-11-02' }, '2026-10'), false);
});
test('기간 선택 당일·앞 날짜 재선택·윤년366일·367일 거부', () => {
  assert.equal(rangeTap('2028-01-01', '', '2028-01-01').end, '2028-01-01');
  assert.equal(rangeTap('2028-01-03', '', '2028-01-01').start, '2028-01-01');
  assert.equal(rangeTap('2028-01-01', '', '2028-12-31').end, '2028-12-31');
  assert.ok(rangeTap('2028-01-01', '', '2029-01-01').error);
  assert.equal(rangeTap('2028-01-01', '2028-01-02', '2028-01-04').end, '');
});
test('초대는 등록HTTPS도메인/경로만 허용하며 코드 정규화와 토큰 대소문자를 보존', () => {
  const base = 'https://app.example.test';
  assert.equal(parseInviteInput(' ab12-cd34 ', base), 'AB12CD34');
  assert.equal(parseInviteInput(base + '/invite?token=ab_CD-123', base), 'ab_CD-123');
  for (const url of [
    'http://app.example.test/invite?token=x',
    'https://evil.test/invite?token=x',
    'https://app.example.test.evil.test/invite?token=x',
    base + '/admin?token=x',
    'https://user:pass@app.example.test/invite?token=x',
    base + '/invite?token=%2Fetc',
    'file:///tmp/a',
  ])
    assert.throws(() => parseInviteInput(url, base));
});

test('딥링크 token 파라미터와 복원된 토큰은 코드처럼 대문자화하거나 하이픈을 제거하지 않음', () => {
  const origin = 'https://sphan0325.ddns.net';
  const token = 'aBc-D_e123';
  assert.equal(parseInviteInput(token, origin, true), token);
  assert.equal(parseInviteInput(`${origin}/invite?token=${token}`, origin), token);
  assert.equal(parseInviteInput('ab-cd', origin), 'ABCD');
  assert.throws(() => parseInviteInput('bad/token', origin, true));
});
