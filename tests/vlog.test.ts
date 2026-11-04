import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, defaultSetting, draftProblem, buildTimeline, type VlogDay } from '../src/vlog/model';
const day: VlogDay = { key: 'schedule/day', itineraryId: 'schedule', dayId: 'day', date: '2027-01-01', title: '여행', cancelled: false, mediaCount: 2, places: [{ key: 'visit', place: { id: 'visit', name: '카페' }, media: [
  { item: { id: 'a', kind: 'video', imageUrl: 'a' }, seconds: 15, memberId: 'member', time: '2027-01-01T00:00:00Z' },
  { item: { id: 'b', kind: 'video', imageUrl: 'b' }, seconds: 8, memberId: 'member', time: '2027-01-01T00:00:00Z' },
] }] };
function draft() { return { ...emptyDraft('group'), dayKeys: [day.key], placeKeys: { [day.key]: ['visit'] }, mediaIds: { visit: ['a', 'b'] }, settings: { visit: { ...defaultSetting(), mode: 'split' as const, templateId: 'c2-cols', done: true, lengthSec: 8 } } }; }
test('VB01: old preview and generation cannot bypass incomplete places', () => {
  const d = draft(); assert.equal(draftProblem(d, [day]), null);
  d.settings.visit.done = false; assert.match(draftProblem(d, [day])!, /완료/);
});
test('VB02: split start13 + length8 cannot exceed15; start7 is allowed', () => {
  const d = draft(); d.settings.visit.videoStart = { a: 13 };
  assert.match(draftProblem(d, [day])!, /구간/);
  d.settings.visit.videoStart.a = 7; assert.equal(draftProblem(d, [day]), null);
});
test('Q21: removed media, removed day, zero length cannot silently pass', () => {
  const d = draft(); assert.match(draftProblem(d, [])!, /날짜/);
  assert.match(draftProblem(d, [{ ...day, places: [{ ...day.places[0], media: day.places[0].media.slice(1) }] }])!, /삭제/);
  const zero = structuredClone(day); zero.places[0].media[0].seconds = 0;
  assert.ok(draftProblem(d, [zero]));
});
test('timeline preserves selection order and never edits original records', () => {
  const original = JSON.stringify(day); const d = draft(); d.mediaIds.visit = ['b', 'a'];
  const timeline = buildTimeline(d, { days: [day] });
  assert.deepEqual(timeline.scenes.find((s) => s.placeKey === 'visit')!.clips.map((c) => c.itemId), ['b', 'a']);
  assert.equal(JSON.stringify(day), original);
});

test('VB02: growing a split clamps each start and preserves subsecond originals', async () => {
  const { resizeSplit } = await import('../src/vlog/edits');
  const d = draft(); d.settings.visit.videoStart = { a: 13, b: 6 };
  const change = resizeSplit(d.settings.visit, day.places[0].media, 8, 8);
  assert.deepEqual(change.videoStart, { a: 7, b: 0 });
  assert.equal(change.done, false);
  const short = structuredClone(day.places[0].media); short[0].seconds = 0.5;
  assert.equal(resizeSplit(d.settings.visit, short, 1, 0.5).lengthSec, 0.5);
  assert.equal(d.settings.visit.videoStart.a, 13);
});
test('VB03/VB04: crop and global font invalidate every affected completion without changing sources', async () => {
  const { cropMedia, applyFont } = await import('../src/vlog/edits');
  const d = draft(); d.settings.other = { ...defaultSetting(), done: true };
  const crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  const cropped = cropMedia(d, 'visit', 'a', crop);
  assert.equal(cropped.settings.visit.done, false); assert.equal(cropped.settings.other.done, true);
  assert.deepEqual(cropped.settings.visit.frames?.a.crop, crop);
  const font = applyFont(d, ['visit', 'other'], 'round');
  assert.equal(font.settings.visit.done, false); assert.equal(font.settings.other.done, false);
  assert.equal(d.settings.visit.done, true); assert.equal(d.settings.other.fontId, 'gothic');
});
test('draft restore rejects corrupt and cross-group saves and discards stale render URI', async () => {
  const { restoreDrafts } = await import('../src/vlog/restore');
  const d = { ...draft(), render: { uri: 'file:///expired.mp4', signature: 'old' } };
  assert.equal(restoreDrafts(JSON.stringify({ group: d }), 'group').group.render, undefined);
  assert.throws(() => restoreDrafts(JSON.stringify({ group: d }), 'another-group'));
  assert.throws(() => restoreDrafts(JSON.stringify({ group: { ...d, mediaIds: { visit: null } } }), 'group'));
  assert.throws(() => restoreDrafts('null', 'group'));
});
test('Q20: disconnected rendering and saving never report success or fabricated progress', async () => {
  const { renderVlog, saveToGallery } = await import('../src/vlog/vlogBridge');
  let progress = 0;
  const outcome = await renderVlog({ title: '여행', timeline: buildTimeline(draft(), { days: [day] }), onProgress: () => progress++, isCancelled: () => false });
  assert.equal(outcome.status, 'not_connected'); assert.equal(progress, 0);
  assert.equal(await saveToGallery('file:///missing.mp4'), 'not_connected');
});

test('video end boundary tolerates floating-point roundoff but rejects a real overrun', () => {
  const d = draft(); d.settings.visit.lengthSec = 10.252;
  const source = structuredClone(day); source.places[0].media[0].seconds = 27.56; source.places[0].media[1].seconds = 10.252;
  d.settings.visit.videoStart = { a: 27.56 - 10.252, b: 0 };
  assert.equal(draftProblem(d, [source]), null);
  for (let millis = 1000; millis <= 60000; millis += 13) {
    const original = millis / 1000, length = Math.max(1, original * 0.372);
    source.places[0].media[0].seconds = original; source.places[0].media[1].seconds = length; d.settings.visit.lengthSec = length; d.settings.visit.videoStart.a = original - length;
    assert.equal(draftProblem(d, [source]), null, `end of ${original}`);
  }
  d.settings.visit.videoStart.a += 0.001;
  assert.match(draftProblem(d, [source])!, /구간/);
});
