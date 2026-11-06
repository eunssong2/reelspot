import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../server/core/config.js';
import { moderate } from '../server/adapters/moderation.js';

test('production에서는 검토 해제로도 텍스트·사진·영상 공개를 우회할 수 없음', async (t) => {
  const previous = { production: config.production, bypass: config.allowTestModerationBypass, mode: config.moderationMode, url: process.env.MODERATION_URL };
  t.after(() => {
    config.production = previous.production;
    config.allowTestModerationBypass = previous.bypass;
    config.moderationMode = previous.mode;
    if (previous.url === undefined) delete process.env.MODERATION_URL;
    else process.env.MODERATION_URL = previous.url;
  });
  config.production = true;
  config.allowTestModerationBypass = false;
  config.moderationMode = 'disabled';
  process.env.MODERATION_URL = 'https://unavailable.invalid/check';
  const classifier = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call classifier'); });
  for (const input of [
    { text: '[review] [reject]' },
    { path: '/does-not-need-reading.jpg', mime: 'image/jpeg' },
    { path: '/does-not-need-reading.mp4', mime: 'video/mp4' },
  ]) assert.equal(await moderate(input), 'review');
  config.allowTestModerationBypass = true;
  for (const input of [{text: '[review] [reject]'}, {path: '/photo.jpg', mime: 'image/jpeg'}, {path: '/video.mp4', mime: 'video/mp4'}])
    assert.equal(await moderate(input), 'passed');
  config.allowTestModerationBypass = false;
  assert.equal(classifier.mock.callCount(), 0);
  delete process.env.MODERATION_URL;
  assert.equal(await moderate({ text: '모임 생성' }), 'review');
  config.moderationMode = 'review';
  assert.equal(await moderate({ text: '모임 생성' }), 'review');
});
