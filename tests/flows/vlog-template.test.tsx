import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { TemplateStep } from '../../src/vlog/TemplateSteps';
import { emptyDraft, defaultSetting } from '../../src/vlog/model';
test('switching from sequence to split clamps every selected video start', async () => {
  const media = [
    { item: { id: 'a', kind: 'video', imageUrl: 'https://example.invalid/a' }, seconds: 15 },
    { item: { id: 'b', kind: 'video', imageUrl: 'https://example.invalid/b' }, seconds: 8 },
  ];
  const day = {
    key: 'day',
    date: '2027-01-01',
    places: [{ key: 'visit', place: { id: 'visit', name: '카페' }, media }],
  };
  let draft = {
    ...emptyDraft('group'),
    dayKeys: ['day'],
    placeKeys: { day: ['visit'] },
    mediaIds: { visit: ['a', 'b'] },
    settings: { visit: { ...defaultSetting(), videoStart: { a: 10, b: 3 }, done: true } },
  };
  const ctx: any = {
    days: [day],
    draft,
    update: (fn: any) => {
      draft = fn(draft);
    },
    go: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    replace: vi.fn(),
    toastMessage: null,
  };
  let tree: any;
  try {
    await act(async () => {
      tree = create(<TemplateStep ctx={ctx} placeKey="visit" />);
    });
    const option = tree.root.findAll(
      (n: any) => n.type === 'Pressable' && n.props.accessibilityRole === 'radio',
    )[1];
    await act(async () => option.props.onPress());
    const next = tree.root.findAll(
      (n: any) => n.type === 'Pressable' && n.props.accessibilityLabel === '선택한 방식으로 다음',
    )[0];
    await act(async () => next.props.onPress());
    expect(draft.settings.visit.videoStart).toEqual({ a: 7, b: 0 });
    expect(draft.settings.visit.done).toBe(false);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
