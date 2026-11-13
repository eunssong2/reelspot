import React from 'react';
import { test, expect, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { AppState } from './native';
import { setParams, router } from './router';
import Group from '../../src/app/group/[id]';
import { ApiError } from '../../src/lib/api';
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const output = () => JSON.stringify(tree.toJSON());
async function press(label: string) {
  const n = tree.root.findAll((n: any) => typeof n.type === 'string' && n.props.onPress && (n.props.accessibilityLabel === label || text(n) === label))[0];
  expect(n, label).toBeTruthy(); await act(async () => n.props.onPress());
}
function setup(calendar: (path: string) => any) {
  setParams({ id: 'g' });
  fixtures.storage.set('atp.preference:user:calendar:g', JSON.stringify({ month: '2026-11', selected: '2026-11-06', list: true }));
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/groups/g') return { id: 'g', name: '테스트 모임', ownerUserId: 'user', activeCount: 1 };
    if (path.includes('/calendar?')) return calendar(path);
    if (path.endsWith('/members')) return { members: [] };
    if (path === '/schedules/s') return { schedule: { id: 's' }, plan: [] };
    throw new Error(path);
  });
}
const populated = { schedules: [{ id: 's', title: '보존할 일정', startDate: '2026-11-06', endDate: '2026-11-06', days: [{ date: '2026-11-06', status: 'active', dayNo: 1 }], status: 'active' }] };
async function mount() { await act(async () => { tree = create(<Group />); }); }
async function refresh() { await act(async () => AppState.emit('active')); }
test('first-month loading/failure and cached-month refresh failure have distinct UI', async () => {
  let reject!: (e: Error) => void;
  setup(() => new Promise((_, no) => { reject = no; })); await mount();
  expect(output()).toContain('일정을 불러오는 중');
  await act(async () => reject(new Error('입력 내용을 확인')));
  expect(output()).toContain('일정을 불러오지 못했어요'); expect(output()).not.toContain('입력 내용을 확인');
  setup(() => populated); await press('다시 시도'); expect(output()).toContain('보존할 일정');
  setup(() => { throw Error('503'); }); await refresh();
  expect(output()).toContain('최신 정보를 불러오지 못했어요'); expect(output()).toContain('보존할 일정');
});
test('unseen month cannot reuse another month; cached empty month counts as loaded', async () => {
  let fail = false;
  setup((path) => { if (fail) throw Error('503'); return path.includes('from=2026-11-30') ? { schedules: [] } : populated; });
  await mount(); fail = true; await press('다음 달');
  expect(output()).toContain('일정을 불러오지 못했어요'); expect(output()).not.toContain('보존할 일정'); expect(output()).not.toContain('최신 정보를');
  fail = false; await press('다시 시도'); expect(output()).toContain('이 달에는 일정이 없어요');
  fail = true; await refresh(); expect(output()).toContain('최신 정보를 불러오지 못했어요'); expect(output()).toContain('이 달에는 일정이 없어요');
  await press('이전 달'); expect(output()).toContain('보존할 일정'); expect(output()).toContain('최신 정보를 불러오지 못했어요');
});
test.each(['calendar', 'group', 'details'])('access loss in %s hides cached content and actions', async (which) => {
  setup(() => populated); await mount(); const before = fixtures.api.getMockImplementation()!;
  fixtures.api.mockImplementation(async (path, ...args) => {
    if ((which === 'calendar' && path.includes('/calendar?')) || (which === 'group' && path === '/groups/g') || (which === 'details' && path === '/schedules/s')) throw new ApiError('FORBIDDEN');
    return before(path, ...args);
  });
  await refresh(); expect(output()).toContain('이 모임을 확인할 수 없어요.'); expect(output()).not.toContain('보존할 일정'); expect(output()).not.toContain('브이로그 만들기'); expect(output()).not.toContain('일정 추가');
  await press('내 모임으로'); expect(router.replace).toHaveBeenCalledWith('/');
  const calls = fixtures.api.mock.calls.filter(([p]) => p.includes('/calendar?') || p === '/schedules/s'); expect(calls.every((call) => call[5]?.handleAccessLossLocally === true)).toBe(true);
});
test('late errors from a previous month cannot replace the current month', async () => {
  let reject!: (e: Error) => void;
  setup((p) => p.includes('from=2026-11-30') ? { schedules: [] } : new Promise((_, no) => { reject = no; }));
  await mount(); await press('다음 달'); await act(async () => reject(new ApiError('FORBIDDEN')));
  expect(output()).toContain('이 달에는 일정이 없어요'); expect(output()).not.toContain('이 모임을 확인할 수 없어요.');
});
