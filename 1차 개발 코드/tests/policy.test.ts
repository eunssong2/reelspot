import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retention, period, text, plannedTime } from '../server/core/policy.js';
import { encrypt, decrypt, signCursor, readCursor } from '../server/core/crypto.js';
test('한국 시간 말일 보정과 배타적 만료', () => {
  assert.deepEqual(retention('2027-01-31'), {
    lastDate: '2027-04-30',
    expiresAt: '2027-04-30T15:00:00.000Z',
  });
  assert.equal(retention('2026-11-30').lastDate, '2027-02-28');
  assert.equal(retention('2023-11-30').lastDate, '2024-02-29');
});
test('일정 기간과 예정 시각 경계', () => {
  period('2026-01-01', '2027-01-01');
  assert.throws(() => period('2026-01-01', '2027-01-02'));
  assert.throws(() => period('2026-02-30', '2026-03-01'));
  assert.equal(plannedTime('23:55'), '23:55');
  assert.throws(() => plannedTime('24:00'));
  assert.throws(() => plannedTime('10:01'));
});
test('표시명 NFC·grapheme·공백과 개행', () => {
  assert.equal(text('  가  ', 1), '가');
  assert.equal(text('👨‍👩‍👧‍👦', 1), '👨‍👩‍👧‍👦');
  assert.throws(() => text('a\nb', 20));
  assert.throws(() => text(' ', 20));
  assert.equal(text('a\nb', 20, true, true), 'a\nb');
});
test('암호화된 민감 응답 및 커서 위변조 차단', () => {
  const cipher = encrypt({ token: 'private' });
  assert.ok(!cipher.includes('private'));
  assert.deepEqual(decrypt(cipher), { token: 'private' });
  const cursor = signCursor({ last: 42 });
  assert.deepEqual(readCursor(cursor), { last: 42 });
  assert.throws(() => readCursor(cursor + 'x'));
});
