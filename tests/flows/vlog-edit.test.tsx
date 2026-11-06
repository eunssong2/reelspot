import React, { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { EditStep } from '../../src/vlog/EditStep';
import { buildTimeline, defaultSetting, draftSignature, emptyDraft, splitTemplatesFor } from '../../src/vlog/model';
import { Keyboard } from './native';
let tree: any, draft: any, ctx: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const header = (name: string) => tree.root.findAll((n: any) => n.type === 'Pressable' && n.props.accessibilityLabel?.startsWith(name))[0];
async function press(name: string) { const n = tree.root.findAll((n: any) => n.type === 'Pressable' && (n.props.accessibilityLabel === name || text(n) === name))[0]; expect(n, name).toBeTruthy(); await act(async () => n.props.onPress()); }
async function mount(mode = 'sequence', video = false) {
  const media = ['a', 'b'].map((id) => ({ item: { id, kind: video ? 'video' : 'photo', imageUrl: `https://example.invalid/${id}` }, ...(video ? { seconds: 15 } : {}) }));
  const days: any = [{ key: 'day', date: '2027-01-01', places: [{ key: 'visit', place: { id: 'visit', name: '카페' }, media }] }];
  const initial: any = { ...emptyDraft('g'), dayKeys: ['day'], placeKeys: { day: ['visit'] }, mediaIds: { visit: ['a', 'b'] }, settings: { visit: { ...defaultSetting(), mode, templateId: splitTemplatesFor(2)[0].id, done: true, captions: { a: '첫 자막', b: '둘째 자막' } } } };
  function Harness() {
    const [value, setValue] = useState(initial); draft = value;
    ctx = { draft, days, timeline: buildTimeline(draft, { days }), update: setValue, back: vi.fn(), close: vi.fn(), go: vi.fn(), replace: vi.fn() };
    return <EditStep ctx={ctx} placeKey="visit" />;
  }
  await act(async () => { tree = create(<Harness />); });
}
test('accordion toggles one section without changing the draft or completion; navigation retains the open section', async () => {
  await mount(); const signature = draftSignature(draft, ctx.timeline);
  expect(header('색감 효과').props.accessibilityState.expanded).toBe(false);
  await act(async () => header('색감 효과').props.onPress());
  expect(header('색감 효과').props.accessibilityState.expanded).toBe(true);
  await act(async () => header('이 장면 자막').props.onPress());
  expect(header('색감 효과').props.accessibilityState.expanded).toBe(false);
  expect(tree.root.findByType('TextInput').props.value).toBe('첫 자막');
  await press('다음 ›');
  expect(header('이 장면 자막').props.accessibilityState.expanded).toBe(true);
  expect(tree.root.findByType('TextInput').props.value).toBe('둘째 자막');
  expect(draftSignature(draft, ctx.timeline)).toBe(signature); expect(draft.settings.visit.done).toBe(true);
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('바꾼 자막'));
  expect(draft.settings.visit.captions.a).toBe('첫 자막'); expect(draft.settings.visit.captions.b).toBe('바꾼 자막'); expect(draft.settings.visit.done).toBe(false);
});
test('preview stays outside settings scroll and shrinks while keyboard is shown', async () => {
  await mount();
  const canvas = () => tree.root.findAll((n: any) => n.type?.name === 'SceneCanvas')[0];
  const preview = () => tree.root.findAll((n: any) => n.type === 'View' && n.props.testID === 'vlog-edit-preview')[0];
  const width = preview().props.style.width;
  let node = canvas(); while (node.parent) { expect(node.props.testID).not.toBe('vlog-edit-settings'); node = node.parent; }
  await act(async () => Keyboard.emit('keyboardDidShow'));
  expect(preview().props.style.width).toBeLessThan(width);
  await act(async () => Keyboard.emit('keyboardDidHide')); expect(preview().props.style.width).toBe(width);
});
test.each(['sequence', 'split'])('%s edits preserve the selected media frame and support transition none', async (mode) => {
  await mount(mode);
  await act(async () => header('화면 맞춤').props.onPress()); await press('맞춤');
  expect(draft.settings.visit.frames.a.fit).toBe('contain'); expect(draft.settings.visit.frames.b).toBeUndefined();
  await act(async () => header('장면 전환').props.onPress());
  const replay = tree.root.findAll((n: any) => n.type === 'Pressable' && text(n).includes('다시 보기'))[0];
  expect(replay.props.disabled).toBe(true);
});
test('video sequence has length controls while split opens the common length screen', async () => {
  await mount('sequence', true); expect(JSON.stringify(tree.toJSON())).toContain('동영상 길이');
  await act(async () => tree.unmount()); tree = null;
  await mount('split', true); expect(JSON.stringify(tree.toJSON())).not.toContain('동영상 길이'); expect(JSON.stringify(tree.toJSON())).toContain('길이 변경');
});
