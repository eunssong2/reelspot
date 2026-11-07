import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateTimeline } from '../server/services/vlog-model.js';
const clip = () => ({ itemId: randomUUID(), kind: 'photo', startSec: 0, seconds: 2, caption: '안녕', filter: 'none', frame: { fit: 'contain', bg: 'blur' } });
const timeline = () => ({ aspect: 'portrait', scenes: [{ kind: 'place', dayKey: `${randomUUID()}/2026-11-06`, placeKey: randomUUID(), seconds: 2, mode: 'sequence', transition: 'fade', clips: [clip()], caption: '', fontId: 'hand' }], totalSec: 2, itemCount: 1 });
test('render input accepts Korean captions and rejects unsafe/inconsistent timelines', () => {
  assert.equal(validateTimeline(timeline()).totalSec, 2);
  for (const mutate of [
    (t:any) => { t.scenes[0].clips[0].itemId = 'https://example.invalid/private'; },
    (t:any) => { t.scenes[0].clips[0].filter = 'none;movie=/etc/passwd'; },
    (t:any) => { t.scenes[0].fontId = '../../secret'; },
    (t:any) => { t.scenes[0].clips[0].frame.crop = {x: .9, y: 0, w: .5, h: 1}; },
    (t:any) => { t.scenes[0].clips[0].seconds = NaN; },
    (t:any) => { t.totalSec = 1; },
    (t:any) => { t.itemCount = 0; },
    (t:any) => { t.scenes[0].clips.push(t.scenes[0].clips[0]); },
    (t:any) => { t.scenes[0].captionPosition = 'outside'; },
    (t:any) => { t.scenes[0].mode = 'split'; t.scenes[0].template = {rects: [[0,0,1,1]]}; },
  ]) {
    const t = timeline(); mutate(t); assert.throws(() => validateTimeline(t), {code: 'INVALID_VLOG'});
  }
});
test('split cells must fit the frame and have equal durations', () => {
  const t:any=timeline(), s=t.scenes[0]; s.mode='split'; s.clips.push(clip()); s.template={rects:[[0,0,.5,1],[.5,0,.5,1]]}; t.itemCount=2;
  assert.equal(validateTimeline(t).itemCount,2);
  s.clips[1].seconds=1; assert.throws(()=>validateTimeline(t),{code:'INVALID_VLOG'});
  s.clips[1].seconds=2; s.template.rects[1][2]=1; assert.throws(()=>validateTimeline(t),{code:'INVALID_VLOG'});
});
test('caption limit counts composed emoji and Korean graphemes, matching the editor', () => {
  const t=timeline();t.scenes[0].caption='👨‍👩‍👧‍👦'.repeat(40);
  assert.equal(validateTimeline(t).itemCount,1);
  t.scenes[0].caption+='가';assert.throws(()=>validateTimeline(t),{code:'INVALID_VLOG'});
});
