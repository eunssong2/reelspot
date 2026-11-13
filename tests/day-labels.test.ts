import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayLabel,
  dateHeading,
  shortDate,
  periodLabel,
  periodBadge,
  groupDays,
  takenDates,
  relativeTime,
  formatDuration,
  dDay,
  scheduleDayList,
  monthDayTime,
} from '../src/lib/day-labels';
import { inviteCodeHint } from '../src/lib/invite-input';
test('하루 제목: 날짜 제목 우선, 없으면 N일차 · 일정 이름, 하루짜리는 일정 이름', () => {
  assert.equal(dayLabel({ title: null, dayNo: 3, scheduleTitle: '서울 여행', single: false }), '3일차 · 서울 여행');
  assert.equal(dayLabel({ title: '성수 오후', dayNo: 1, scheduleTitle: '서울 여행', single: false }), '성수 오후');
  assert.equal(dayLabel({ title: null, dayNo: 1, scheduleTitle: '당일치기', single: true }), '당일치기');
  assert.equal(dayLabel({ title: '옛 날짜 제목', dayNo: 1, scheduleTitle: '당일치기', single: true }), '옛 날짜 제목');
});
test('날짜 표기: 요일 머리글·짧은 날짜·기간·기간 배지', () => {
  assert.equal(dateHeading('2026-10-17'), '10월 17일 토요일');
  assert.equal(shortDate('2026-10-07'), '10.07');
  assert.equal(periodLabel('2026-10-17', '2026-10-24'), '2026.10.17 - 10.24');
  assert.equal(periodLabel('2026-12-30', '2027-01-02'), '2026.12.30 - 2027.01.02');
  assert.equal(periodLabel('2026-10-17', '2026-10-17'), '2026.10.17');
  assert.equal(periodBadge('2026-11-10', '2026-11-10'), '당일');
  assert.equal(periodBadge('2026-11-10', '2026-11-12'), '3일 동안');
});
test('모임 날짜 목록: days 없으면 기간으로 계산, 취소 일정은 취소, 다른 일정의 사용 중인 날짜만 막음', () => {
  assert.deepEqual(scheduleDayList({ startDate: '2026-10-17', endDate: '2026-10-18', status: 'active' }).map((d) => d.dayNo), [1, 2]);
  const days = groupDays([
    { id: 'a', title: 'A', status: 'active', startDate: '2026-10-17', endDate: '2026-10-19', days: [
      { date: '2026-10-19', dayNo: 3, title: null, status: 'active', visitCount: 0 },
      { date: '2026-10-17', dayNo: 1, title: '첫날', status: 'active', visitCount: 2 },
      { date: '2026-10-18', dayNo: 2, title: null, status: 'cancelled', visitCount: 0 },
    ] },
    { id: 'b', title: 'B', status: 'cancelled', startDate: '2026-10-20', endDate: '2026-10-20' },
  ]);
  assert.deepEqual(days.map((d) => `${d.date}:${d.status}`), ['2026-10-17:active', '2026-10-18:cancelled', '2026-10-19:active', '2026-10-20:cancelled']);
  assert.equal(days[3].single, true);
  assert.deepEqual([...takenDates(days, 'b')], ['2026-10-17', '2026-10-19']);
  assert.deepEqual([...takenDates(days, 'a')], []);
});
test('상대 시각·영상 길이·D-day', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  assert.equal(relativeTime('2026-11-01T11:59:40Z', now), '방금 전');
  assert.equal(relativeTime('2026-11-01T11:48:00Z', now), '12분 전');
  assert.equal(relativeTime('2026-11-01T09:00:00Z', now), '3시간 전');
  assert.equal(relativeTime('2026-10-30T12:00:00Z', now), '2일 전');
  assert.equal(relativeTime('2026-10-01T12:00:00Z', now), '10.01');
  assert.equal(relativeTime(null, now), '');
  assert.equal(formatDuration(8000), '0:08');
  assert.equal(formatDuration(65400), '1:05');
  assert.equal(formatDuration(null), '');
  assert.equal(monthDayTime('2026-10-29T14:31:00Z'), '10.29 23:31');
  assert.equal(monthDayTime('2026-12-31T15:00:00Z'), '01.01 00:00');
  assert.equal(dDay('2026-12-31', '2027-01-02', '2026-10-31'), 'D-61');
  assert.equal(dDay('2026-10-31', '2026-11-02', '2026-10-31'), '진행 중');
  assert.equal(dDay('2026-10-30', '2026-11-02', '2026-10-31'), '진행 중');
});
test('초대 코드 형식: 8자 영숫자·예전 12자 16진수·링크 허용', () => {
  assert.deepEqual(inviteCodeHint(' c4mpus27 '), { kind: 'code', code: 'C4MPUS27', count: 8, valid: true });
  assert.equal(inviteCodeHint('C4MPU').valid, false);
  assert.equal(inviteCodeHint('C4MPU').count, 5);
  assert.equal(inviteCodeHint('0123456789ab').valid, true);
  assert.equal(inviteCodeHint('C4MPUS27X').valid, false);
  assert.equal(inviteCodeHint('https://a.test/invite?token=x').kind, 'link');
});
test('설정의 약관 4종은 itemKey·제목으로 게시 문서를 찾고 없으면 undefined', async () => {
  const { findPolicyDoc } = await import('../src/lib/documents');
  const docs = [
    { itemKey: 'terms', title: '서비스 이용약관', kind: 'consent' },
    { itemKey: 'privacy-consent', title: '개인정보 수집 및 이용 동의', kind: 'consent' },
    { itemKey: 'privacy', title: '개인정보 처리방침', kind: 'notice' },
    { itemKey: 'location-terms', title: '위치정보 이용약관', kind: 'consent' },
  ];
  assert.equal(findPolicyDoc(docs, 'terms')?.itemKey, 'terms');
  assert.equal(findPolicyDoc(docs, 'privacy')?.itemKey, 'privacy');
  assert.equal(findPolicyDoc(docs, 'location')?.itemKey, 'location-terms');
  assert.equal(findPolicyDoc(docs, 'policy'), undefined);
  assert.equal(findPolicyDoc([{ itemKey: 'operation-policy', title: '서비스 이용정책' }], 'policy')?.itemKey, 'operation-policy');
});
