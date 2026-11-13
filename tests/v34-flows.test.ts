import test from 'node:test';
import assert from 'node:assert/strict';
import { visitChanges } from '../src/lib/place-edit';
import { summarizeBatch, uploadedMessage, savedMessage } from '../src/lib/upload-summary';
import { retentionLastDate, retentionPassed, retentionNotice, noticeForDaysLeft } from '../src/lib/retention';
import { capTitle } from '../src/lib/validation';

const place = { name: '성수 카페', address: '서울 성동구', lat: 37.544, lng: 127.055, plannedTime: '14:00' };

test('QA-01: 장소 수정은 바꾼 값만 보내고 손대지 않은 좌표·주소를 보존한다', () => {
  assert.deepEqual(visitChanges(place, { ...place }), {});
  assert.deepEqual(visitChanges(place, { ...place, name: '단골 카페' }), { name: '단골 카페' });
  assert.deepEqual(visitChanges(place, { ...place, plannedTime: null }), { plannedTime: null });
  // 지도·문자열 왕복에서 생기는 소수점 오차는 변경으로 보지 않는다.
  assert.deepEqual(visitChanges(place, { ...place, lat: 37.5440000001, lng: 127.0549999999 }), {});
  assert.deepEqual(visitChanges(place, { ...place, lat: 37.55, lng: 127.06 }), { location: { lat: 37.55, lng: 127.06 } });
});

test('QA-01: 지운 값만 명시적으로 삭제한다', () => {
  assert.deepEqual(visitChanges(place, { ...place, address: '' }), { address: null });
  assert.deepEqual(visitChanges(place, { ...place, lat: null, lng: null }), { location: null });
  const bare = { name: '직접 등록', address: '', lat: null, lng: null, plannedTime: null };
  assert.deepEqual(visitChanges(bare, { ...bare }), {});
  assert.deepEqual(visitChanges(bare, { ...bare, lat: 37.5, lng: 127 }), { location: { lat: 37.5, lng: 127 } });
});

test('QA-02: 이번 제출에서 서버가 공개한 파일만 성공으로 센다', () => {
  const batch = summarizeBatch([
    { state: 'complete', kind: 'photo' },
    { state: 'complete', kind: 'photo' },
    { state: 'review', kind: 'photo' },
    { state: 'failed', kind: 'video' },
    { state: 'cancelled', kind: 'video' },
  ]);
  assert.deepEqual(batch, { settled: true, photos: 2, videos: 0, failed: 1, review: 1, pending: 0 });
  // 전송 100%·서버 확인 중은 완료가 아니므로 아직 안내하지 않는다.
  assert.equal(summarizeBatch([{ state: 'complete', kind: 'photo' }, { state: 'verifying', kind: 'video' }]).settled, false);
  assert.equal(summarizeBatch([{ state: 'complete', kind: 'photo' }, { state: 'uploading', kind: 'video' }]).pending, 1);
  assert.equal(summarizeBatch([]).settled, false);
});

test('QA-02·QA-04: 종류별 안내 문구', () => {
  assert.equal(uploadedMessage(3, 0), '사진 3장을 업로드했습니다.');
  assert.equal(uploadedMessage(0, 2), '동영상 2개를 업로드했습니다.');
  assert.equal(uploadedMessage(2, 1), '사진 2장·동영상 1개를 업로드했습니다.');
  assert.equal(uploadedMessage(0, 0), '');
  assert.equal(savedMessage(1, 0), '사진이 휴대폰에 저장되었습니다.');
  assert.equal(savedMessage(2, 1), '사진 2장·동영상 1개를 휴대폰에 저장했습니다.');
  assert.equal(savedMessage(0, 1), '동영상 1개를 휴대폰에 저장했습니다.');
  assert.equal(savedMessage(4, 0), '사진 4장을 휴대폰에 저장했습니다.');
  assert.equal(savedMessage(0, 0), '');
});

test('F21·F03: 보관 마지막 날과 7일 전·전날·당일 안내', () => {
  assert.equal(retentionLastDate('2026-08-09'), '2026-11-09');
  assert.equal(retentionLastDate('2026-11-30'), '2027-02-28'); // 없는 날은 그달 말일
  assert.equal(retentionLastDate('2027-11-30'), '2028-02-29');
  assert.equal(retentionPassed('2026-07-02', '2026-11-11'), true);
  assert.equal(retentionPassed('2026-08-11', '2026-11-11'), false); // 마지막 날 당일까지는 올릴 수 있다
  assert.equal(retentionPassed('', '2026-11-11'), false);
  assert.equal(retentionNotice('2026-11-11', '2026-11-11'), '오늘 보관이 끝나는 기록이 있어요');
  assert.equal(retentionNotice('2026-11-12', '2026-11-11'), '내일 보관이 끝나는 기록이 있어요');
  assert.equal(retentionNotice('2026-11-18', '2026-11-11'), '보관 안내 · 만료 7일 전 기록이 있어요');
  assert.equal(retentionNotice('2026-11-19', '2026-11-11'), '');
  assert.equal(retentionNotice('2026-11-10', '2026-11-11'), '');
  assert.equal(noticeForDaysLeft(0), '오늘 보관이 끝나는 기록이 있어요');
});

test('F10: 날짜 제목 입력 칸은 30자에서 멈추고 기존 긴 제목은 자르지 않는다', () => {
  const thirty = '가'.repeat(30);
  assert.equal(capTitle('', thirty), thirty);
  assert.equal(capTitle(thirty, thirty + '나'), thirty);
  assert.equal(capTitle('', '가'.repeat(45)), thirty); // 붙여 넣기는 끝을 자른다
  assert.equal(capTitle(thirty, '나' + thirty), thirty); // 가운데·앞 삽입으로 끝 글자가 밀려나지 않는다
  assert.equal(capTitle(thirty, '가'.repeat(29)), '가'.repeat(29));
  const legacy = '다'.repeat(40);
  assert.equal(capTitle(legacy, legacy + '라'), legacy); // Q15: 31~100자 기존 제목 보존
  assert.equal(capTitle(legacy, '다'.repeat(39)), '다'.repeat(39));
  assert.equal(capTitle('', '👨‍👩‍👧'.repeat(31)), '👨‍👩‍👧'.repeat(30)); // 이모지는 1자
});
