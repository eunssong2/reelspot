import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { GenerateStep } from '../../src/vlog/OutputSteps';
import { emptyDraft } from '../../src/vlog/model';
import { setRenderHandler } from '../../src/vlog/vlogBridge';
test('current generation returning cancelled leaves the spinner and allows retry', async () => {
  const ctx: any = { draft: emptyDraft('group'), group: { name: '모임' }, timeline: { scenes: [], totalSec: 0, itemCount: 0, aspect: 'portrait' }, revalidate: async () => {}, toast: vi.fn(), back: vi.fn(), close: vi.fn(), replace: vi.fn(), update: vi.fn() };
  setRenderHandler(async () => ({ status: 'cancelled' }));
  let tree: any;
  try {
    await act(async () => { tree = create(<GenerateStep ctx={ctx} />); });
    expect(tree.root.findAllByType('ActivityIndicator')).toHaveLength(0);
    expect(tree.root.findAll((n: any) => n.type === 'Pressable' && n.props.accessibilityLabel === '다시 생성')).toHaveLength(1);
    expect(ctx.toast).toHaveBeenCalledWith('영상 생성이 중단됐어요. 다시 시도해 주세요.');
  } finally { if (tree) await act(async () => tree.unmount()); setRenderHandler(null); }
});
