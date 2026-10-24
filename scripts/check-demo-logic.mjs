/**
 * 데모 순수 로직 점검(별도 테스트 러너 없이 node 로 실행):
 *   node scripts/check-demo-logic.mjs
 *
 * src/demo 의 로직(장소 추가 중복 방지, 순서 저장, 저장본 검증, 예시 검색, 방문별 기록 분리)을
 * typescript 로 임시 폴더에 컴파일한 뒤 assert 로 확인한다. 실패하면 종료 코드 1.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'reelspot-check-'));

try {
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
      '--noEmit', 'false', '--jsx', 'react-jsx', '--rootDir', join(root, 'src'),
      join(root, 'src', 'demo', 'demoStore.ts'),
      join(root, 'src', 'demo', 'sampleSearch.ts'),
      join(root, 'src', 'demo', 'records.ts'),
    ],
    { cwd: root, stdio: 'inherit' },
  );

  // 데모 빌드와 같은 조건(방문 단위 기록 조회)으로 점검한다.
  process.env.EXPO_PUBLIC_DEMO_MODE = '1';
  const require = createRequire(join(out, 'x.js'));
  // 이미지·영상 자산(require)은 숫자 ID 로 대신한다.
  const Module = createRequire(import.meta.url)('node:module');
  const originalLoad = Module._load;
  Module._load = (request, ...rest) => (/\.(jpg|png|mp4)$/.test(request) ? 1 : originalLoad(request, ...rest));
  const demoData = require(join(out, 'demo', 'demoData.js'));
  const store = require(join(out, 'demo', 'demoStore.js'));
  const search = require(join(out, 'demo', 'sampleSearch.js'));
  const records = require(join(out, 'demo', 'records.js'));

  const IT = 'itin-seoul-1';
  const fresh = () => demoData.createDemoItineraries();
  const day = (list, id) => list[0].days.find((d) => d.id === id);
  const checks = [];
  const test = (name, fn) => { fn(); checks.push(name); };

  test('하루짜리 예시 일정(시작일=종료일, 날짜 1개)이 있고 기록은 일정별로 분리된다', () => {
    const it = fresh();
    const one = it.find((i) => i.id === 'itin-seoul-oneday');
    assert.ok(one);
    assert.equal(one.startDate, one.endDate);
    assert.equal(one.days.length, 1);
    assert.equal(one.days[0].places.length, 3);
    const media = one.days[0].places.map((p) => records.countMedia(records.recordsForVisit(one.id, 'day-1', p)).total);
    assert.deepEqual(media, [2, 0, 1]);
    // 3일 일정의 day-1 과 id 가 같아도 방문 식별자가 달라 기록이 섞이지 않는다
    assert.notEqual(one.days[0].places[0].visitId, it[0].days[0].places[0].visitId);
  });

  test('이전 저장본(일정 1개)도 새 예시 일정이 추가된 뒤 그대로 읽힌다', () => {
    const old = JSON.stringify({ version: 1, itineraries: [fresh()[0]] });
    const loaded = store.parseStoredItineraries(old, fresh());
    assert.ok(loaded);
    assert.equal(loaded.length, 2);
  });

  test('초기 데이터: DAY1 3곳 / DAY2 2곳 / DAY3 0곳, 5명 여행', () => {
    const it = fresh();
    assert.equal(it[0].name, '우리의 서울 여행');
    assert.equal(it[0].startDate, '2026-10-17');
    assert.equal(it[0].endDate, '2026-10-19');
    assert.deepEqual(it[0].days.map((d) => d.places.length), [3, 2, 0]);
  });

  test('미디어 있는 장소/없는 장소가 모두 있다', () => {
    const it = fresh();
    const counts = (dayId) => day(it, dayId).places.map((p) => records.countMedia(records.recordsForVisit(IT, dayId, p)).total);
    assert.deepEqual(counts('day-1'), [5, 4, 0]);
    assert.deepEqual(counts('day-2'), [3, 0]);
  });

  test('같은 날짜 중복 추가 방지', () => {
    const base = fresh();
    const place = demoData.DEMO_SAMPLE_PLACES[0];
    const item = { id: place.id, name: place.name, address: place.address, categoryLabel: '관광지', emoji: '🏯', tint: '#fff' };
    const first = store.addPlaceToDay(base, IT, 'day-3', item);
    assert.equal(first.added, true);
    assert.equal(day(first.itineraries, 'day-3').places.length, 1);
    const second = store.addPlaceToDay(first.itineraries, IT, 'day-3', item);
    assert.equal(second.added, false);
    assert.equal(day(second.itineraries, 'day-3').places.length, 1);
  });

  test('원본 데이터를 변경하지 않는다(불변)', () => {
    const base = fresh();
    const snapshot = JSON.stringify(base);
    store.addPlaceToDay(base, IT, 'day-3', { id: 'x', name: 'x', address: '', categoryLabel: '', emoji: '', tint: '' });
    assert.equal(JSON.stringify(base), snapshot);
  });

  test('다른 날짜에는 같은 장소를 담을 수 있고 방문 식별자·기록이 분리된다', () => {
    const base = fresh();
    const cafe = day(base, 'day-1').places[0]; // 기록이 있는 장소
    const moved = store.addPlaceToDay(base, IT, 'day-3', { ...cafe, visitId: undefined });
    assert.equal(moved.added, true);
    const onDay3 = day(moved.itineraries, 'day-3').places[0];
    assert.notEqual(onDay3.visitId, cafe.visitId);
    assert.equal(records.countMedia(records.recordsForVisit(IT, 'day-1', cafe)).total, 5);
    assert.equal(records.countMedia(records.recordsForVisit(IT, 'day-3', onDay3)).total, 0);
  });

  test('순서·방문 시간·메모 저장', () => {
    const base = fresh();
    const [a, b, c] = day(base, 'day-1').places;
    const saved = store.updateDayPlaces(base, IT, 'day-1', { places: [c, a, { ...b, visitTime: '09:30' }], memo: '메모' });
    const d = day(saved, 'day-1');
    assert.deepEqual(d.places.map((p) => p.id), [c.id, a.id, b.id]);
    assert.equal(d.places[2].visitTime, '09:30');
    assert.equal(d.memo, '메모');
    // 순서가 바뀌어도 기록은 장소를 따라간다
    assert.equal(records.countMedia(records.recordsForVisit(IT, 'day-1', d.places[1])).total, 5);
    assert.equal(day(saved, 'day-2').places.length, 2);
  });

  test('날짜 제목 수정·삭제와 저장 왕복', () => {
    const base = fresh();
    const places = day(base, 'day-1').places;
    const renamed = store.updateDayPlaces(base, IT, 'day-1', { places, memo: '', title: '  새 제목  ' });
    assert.equal(day(renamed, 'day-1').title, '새 제목');
    const kept = store.updateDayPlaces(renamed, IT, 'day-1', { places, memo: '' }); // title 생략 = 그대로
    assert.equal(day(kept, 'day-1').title, '새 제목');
    const cleared = store.updateDayPlaces(renamed, IT, 'day-1', { places, memo: '', title: '' });
    assert.equal(day(cleared, 'day-1').title, undefined);
    // 저장 후 다시 읽어도: 바꾼 제목은 유지, 지운 제목은 기본 제목이 되살아나지 않는다
    assert.equal(day(store.parseStoredItineraries(store.serializeItineraries(renamed), fresh()), 'day-1').title, '새 제목');
    assert.equal(day(store.parseStoredItineraries(store.serializeItineraries(cleared), fresh()), 'day-1').title, undefined);
  });

  test('일정 추가(새 날짜): 마지막 날 다음 날이 붙고, 저장 후에도 유지되며, 다른 일정·장소는 그대로', () => {
    const base = fresh();
    const r = store.addDayToItinerary(base, IT);
    assert.equal(r.dayId, 'day-4');
    const it = r.itineraries[0];
    assert.equal(it.days.length, 4);
    assert.equal(it.endDate, '2026-10-20');
    assert.equal(it.days[3].date, '2026-10-20');
    assert.equal(it.days[3].dayNumber, 4);
    assert.deepEqual(it.days[3].places, []);
    assert.equal(r.itineraries[1].days.length, 1); // 하루 일정은 그대로
    assert.equal(base[0].days.length, 3); // 원본 불변
    // 월 경계(10/31 → 11/01)
    assert.equal(store.nextDate('2026-10-31'), '2026-11-01');
    assert.equal(store.nextDate('2026-12-31'), '2027-01-01');
    // 새 날짜에 장소를 담고 저장 → 읽기
    const withPlace = store.addPlaceToDay(r.itineraries, IT, 'day-4', { id: 'n1', name: 'n1', address: 'a', categoryLabel: 'c', emoji: 'e', tint: 't' }).itineraries;
    const loaded = store.parseStoredItineraries(store.serializeItineraries(withPlace), fresh());
    assert.ok(loaded);
    assert.equal(loaded[0].days.length, 4);
    assert.equal(loaded[0].endDate, '2026-10-20');
    assert.deepEqual(loaded[0].days[3].places.map((p) => p.id), ['n1']);
    assert.equal(loaded[0].days[3].places[0].visitId, 'itin-seoul-1/day-4/n1');
    // 두 번 더 추가해도 이어서 붙고, 존재하지 않는 일정은 추가하지 않는다
    const twice = store.addDayToItinerary(store.addDayToItinerary(r.itineraries, IT).itineraries, IT);
    assert.equal(twice.itineraries[0].days.length, 6);
    assert.equal(twice.itineraries[0].endDate, '2026-10-22');
    assert.equal(store.addDayToItinerary(base, 'nope').dayId, null);
    // 날짜 수 상한
    let many = base;
    for (let i = 0; i < 60; i += 1) many = store.addDayToItinerary(many, IT).itineraries;
    assert.equal(many[0].days.length, store.MAX_DAYS);
    // 날짜가 이어지지 않는 저장본은 버린다
    const broken = JSON.parse(store.serializeItineraries(r.itineraries));
    broken.itineraries[0].days[3].date = '2026-11-05';
    assert.equal(store.parseStoredItineraries(JSON.stringify(broken), fresh()), null);
  });

  test('저장 → 읽기 왕복(앱 재시작 시 유지)', () => {
    const base = fresh();
    const next = store.addPlaceToDay(base, IT, 'day-3', { id: 'p1', name: 'p1', address: 'a', categoryLabel: 'c', emoji: 'e', tint: 't' }).itineraries;
    const raw = store.serializeItineraries(next);
    const loaded = store.parseStoredItineraries(raw, fresh());
    assert.ok(loaded);
    assert.deepEqual(day(loaded, 'day-3').places.map((p) => p.id), ['p1']);
    assert.equal(loaded[0].name, '우리의 서울 여행');
  });

  test('깨진·낡은 저장본은 무시한다(null)', () => {
    const defaults = fresh();
    assert.equal(store.parseStoredItineraries(null, defaults), null);
    assert.equal(store.parseStoredItineraries('not json', defaults), null);
    assert.equal(store.parseStoredItineraries('{"version":0,"itineraries":[]}', defaults), null);
    assert.equal(store.parseStoredItineraries('{"version":1,"itineraries":[{"id":"itin-seoul-1","days":[]}]}', defaults), null);
    const dup = store.serializeItineraries(fresh()).replace('"demo-books"', '"demo-cafe"'); // 같은 날짜 중복 장소
    assert.equal(store.parseStoredItineraries(dup, defaults), null);
  });

  test('기록 정렬: 최신순/오래된순(절대 시각·상대 표현·원본 불변)', () => {
    const rec = (id, time) => ({ id, memberId: 'me', time, items: [] });
    const abs = [rec('a', '10.17 14:12'), rec('b', '10.17 15:50'), rec('c', '10.17 14:25')];
    assert.deepEqual(records.sortRecords(abs, true).map((r) => r.id), ['b', 'c', 'a']);
    assert.deepEqual(records.sortRecords(abs, false).map((r) => r.id), ['a', 'c', 'b']);
    assert.deepEqual(abs.map((r) => r.id), ['a', 'b', 'c']);
    const rel = [rec('x', '방금 전'), rec('y', '12분 전')]; // 앞쪽이 더 최근
    assert.deepEqual(records.sortRecords(rel, true).map((r) => r.id), ['x', 'y']);
    assert.deepEqual(records.sortRecords(rel, false).map((r) => r.id), ['y', 'x']);
  });

  test('예시 검색: 키워드·여러 단어·카테고리·결과 없음', () => {
    const all = demoData.DEMO_SAMPLE_PLACES;
    assert.ok(all.every((p) => p.sample === true));
    assert.ok(search.searchSamplePlaces(all, '카페').length >= 4);
    assert.deepEqual(search.searchSamplePlaces(all, '성수 카페').map((p) => p.name), ['성수 로스터리 카페']);
    assert.equal(search.searchSamplePlaces(all, 'zzzz').length, 0);
    assert.equal(search.searchSamplePlaces(all, '   ').length, 0);
    assert.ok(search.searchSampleByCategory(all, 'stay').every((p) => p.category.startsWith('숙박')));
    assert.ok(search.searchSampleByCategory(all, 'cafe').every((p) => p.category.includes('카페')));
    assert.ok(search.searchSampleByCategory(all, 'food').every((p) => p.category.startsWith('음식점') && !p.category.includes('카페')));
  });

  console.log(`OK ${checks.length}개 점검 통과\n- ${checks.join('\n- ')}`);
} catch (error) {
  console.error('데모 로직 점검 실패:', error.message ?? error);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
