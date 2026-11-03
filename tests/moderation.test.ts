import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../server/core/config.js';
import { moderate } from '../server/adapters/moderation.js';

test('명시적 검토 해제는 production에서도 텍스트·사진·영상을 외부 판정 없이 통과', async (t) => {
  const previous = { production: config.production, mode: config.moderationMode, url: process.env.MODERATION_URL };
  t.after(() => {
    config.production = previous.production;
    config.moderationMode = previous.mode;
    if (previous.url === undefined) delete process.env.MODERATION_URL;
    else process.env.MODERATION_URL = previous.url;
  });
  config.production = true;
  config.moderationMode = 'disabled';
  process.env.MODERATION_URL = 'https://unavailable.invalid/check';
  const classifier = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call classifier'); });
  for (const input of [
    { text: '[review] [reject]' },
    { path: '/does-not-need-reading.jpg', mime: 'image/jpeg' },
    { path: '/does-not-need-reading.mp4', mime: 'video/mp4' },
  ]) assert.equal(await moderate(input), 'passed');
  assert.equal(classifier.mock.callCount(), 0);
  delete process.env.MODERATION_URL;
  assert.equal(await moderate({ text: '모임 생성' }), 'passed');
  config.moderationMode = 'review';
  assert.equal(await moderate({ text: '모임 생성' }), 'review');
});
