import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { router } from './router';
import { Records } from '../../src/components/records';
vi.mock('../../src/components/records', async (original) => await original());
vi.mock('../../src/components/profile-ui', () => ({ Avatar: () => null }));
const media = (id: string, kind: string, accessState = 'available', authorUserId = 'author') =>
  ({ id, kind, accessState, authorUserId, displayName: '친구', version: 1, scheduleId: 'schedule' }) as any;
const text = (node: any): string => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
test('selection survives record refresh, supports clear-all, and ends on view change as F19 requires', async () => {
  let tree: any;
  const items = [media('p', 'photo'), media('v', 'video')];
  const toolbar = { view: 'by_photo', order: 'desc', onView: vi.fn(), onOrder: vi.fn() };
  const press = async (label: string) => {
    const n = tree.root.findAll((n: any) => typeof n.type === 'string' && n.props.onPress && (text(n) === label || n.props.accessibilityLabel === label))[0];
    expect(n, label).toBeTruthy(); await act(async () => n.props.onPress());
  };
  try {
    await act(async () => { tree = create(<Records items={items} toolbar={toolbar} />); });
    await press('선택'); await press('전체 선택');
    await act(async () => tree.update(<Records items={[...items].reverse()} toolbar={toolbar} />));
    expect(JSON.stringify(tree.toJSON())).toContain('2개 다운받기');
    await press('전체 해제'); expect(JSON.stringify(tree.toJSON())).toContain('다운받을 기록을 선택해 주세요');
    await press('전체 선택'); await press('사람별 보기');
    expect(JSON.stringify(tree.toJSON())).not.toContain('2개 다운받기');
    expect(toolbar.onView).toHaveBeenCalledWith('by_author');
  } finally { if (tree) await act(async () => tree.unmount()); }
});
for (const scoped of [false, true]) {
  for (const mixed of [false, true]) {
    test(`actual author menu includes videos and matches save count (scope=${scoped}, mixed=${mixed})`, async () => {
      const available = mixed ? [media('p1', 'photo'), media('v1', 'video'), media('p2', 'photo')] : [media('v1', 'video')];
      const hidden = [media('blocked', 'video', 'restricted'), media('expired', 'photo', 'expired'), media('other', 'video', 'available', 'other')];
      const pages = [available.slice(0, 1), [...available.slice(1), available[0], ...hidden]];
      fixtures.api.mockImplementation(async (path: string) => ({ items: pages[path.includes('cursor=next') ? 1 : 0], nextCursor: path.includes('cursor=next') ? null : 'next' }));
      let tree: any;
      try {
        await act(async () => { tree = create(<Records
          items={scoped ? pages[0] : [...available, ...hidden]}
          groups={[{ authorUserId: 'author', displayName: '친구', photos: mixed ? 2 : 0, videos: 1 }]}
          recordScope={scoped ? { scheduleId: 'schedule', query: { view: 'by_author', recordDate: '2026-12-02' } } : undefined}
        />); });
        await act(async () => tree.root.findByProps({ accessibilityLabel: '친구 기록 메뉴' }).props.onPress());
        const save = tree.root.findAll((n: any) => n.type === 'button' && text(n).includes('다운받기'))[0];
        expect(save.props.disabled).toBe(false);
        expect(text(save)).toBe(`사진 다운받기 · ${available.length}개`);
        await act(async () => save.props.onPress());
        expect(router.push).toHaveBeenCalledWith({ pathname: '/save', params: { ids: available.map((m) => m.id).join(',') } });
        if (scoped) {
          expect(fixtures.api).toHaveBeenCalledTimes(2);
          expect(fixtures.api.mock.calls[1][0]).toContain('recordDate=2026-12-02');
        } else expect(fixtures.api).not.toHaveBeenCalled();
      } finally { if (tree) await act(async () => tree.unmount()); }
    });
  }
}
