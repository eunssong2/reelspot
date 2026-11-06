import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PanResponder } from './native';
import { CropModal } from '../../src/vlog/CropModal';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');
// Run the installed RN gesture accumulator, rather than the usual empty panHandlers mock.
function load(name: string, dependencies: Record<string, unknown> = {}) {
  const file = join(
    dirname(require.resolve('react-native/package.json')),
    'Libraries/Interaction',
    name + '.js',
  );
  const code = babel.transformSync(readFileSync(file, 'utf8'), {
    babelrc: false,
    configFile: false,
    filename: file,
    plugins: [
      {
        parserOverride(source: string) {
          return require('hermes-parser').parse(source, {
            babel: true,
            sourceType: 'module',
            flow: 'all',
          });
        },
      },
      require.resolve('@babel/plugin-transform-flow-strip-types'),
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  }).code;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (id: string) => {
      if (!(id in dependencies)) throw Error('Unexpected dependency ' + id);
      return dependencies[id];
    },
    m,
    m.exports,
  );
  return (m.exports as any).default;
}
const real = load('PanResponder', {
  './TouchHistoryMath': { default: load('TouchHistoryMath') },
  './InteractionManager': {
    default: { createInteractionHandle: () => 1, clearInteractionHandle() {} },
  },
});
test('full-image crop leaves every corner handle inside the stage', async () => {
  let tree: any;
  try {
    await act(async () => {
      tree = create(
        <CropModal visible clip={{ itemId: 'full', kind: 'photo', image: 'https://example.invalid/photo' }}
          aspect="portrait" onApply={() => {}} onClose={() => {}} />,
      );
    });
    const handles = tree.root.findAllByProps({ accessibilityLabel: '자를 영역 크기 조절' });
    expect(handles).toHaveLength(4);
    for (const handle of handles) {
      const bounds = Object.assign({}, ...handle.props.style);
      const stage = Object.assign({}, ...handle.parent.props.style);
      expect(bounds.width).toBeGreaterThanOrEqual(48);
      expect(bounds.height).toBeGreaterThanOrEqual(48);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(stage.width);
      expect(bounds.top + bounds.height).toBeLessThanOrEqual(stage.height);
    }
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
function event(x: number, previous: number, t: number) {
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}] },
    touchHistory: {
      mostRecentTimeStamp: t,
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      touchBank: [
        {
          touchActive: true,
          startPageX: 100,
          startPageY: 100,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: 100,
          currentTimeStamp: t,
          previousPageX: previous,
          previousPageY: 100,
          previousTimeStamp: t - 16,
        },
      ],
    },
  };
}
test.each(['move', 'resize'])(
  'crop %s accumulates a 100px drag across React renders',
  async (kind) => {
    const spy = vi.spyOn(PanResponder, 'create').mockImplementation(real.create);
    let tree: any;
    try {
      await act(async () => {
        tree = create(
          <CropModal
            visible
            clip={{ itemId: 'one', kind: 'photo', image: 'https://example.invalid/photo' }}
            aspect="portrait"
            crop={{ x: 0.1, y: 0.1, w: 0.4, h: 0.4 }}
            onApply={() => {}}
            onClose={() => {}}
          />,
        );
      });
      const box = () => tree.root.findByProps({ accessibilityLabel: '자를 영역. 끌어서 옮겨요' });
      const target = () =>
        kind === 'move'
          ? box()
          : tree.root.findAllByProps({ accessibilityLabel: '자를 영역 크기 조절' })[3];
      const style = () => Object.assign({}, ...box().props.style);
      const before = style(),
        handler = target().props.onResponderMove;
      await act(async () => target().props.onResponderGrant(event(100, 100, 1000)));
      for (let i = 1; i <= 10; i++)
        await act(async () =>
          target().props.onResponderMove(event(100 + i * 10, 90 + i * 10, 1000 + i * 16)),
        );
      expect(target().props.onResponderMove).toBe(handler);
      expect(
        kind === 'move' ? style().left - before.left : style().width - before.width,
      ).toBeCloseTo(100);
    } finally {
      if (tree) await act(async () => tree.unmount());
      spy.mockRestore();
    }
  },
);
