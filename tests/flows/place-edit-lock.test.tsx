import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams, router } from './router';
import { ApiError } from '../../src/lib/api';
import Places from '../../src/app/places';
const map = vi.hoisted(() => ({ props: null as any }));
vi.mock('expo-location', () => ({}));
vi.mock('../../src/components/place-map', () => ({ PlaceMap: (props: any) => { map.props = props; return null; } }));
vi.mock('../../src/components/time-edit-modal', () => ({ TimeEditModal: () => null }));
vi.mock('../../src/components/toast-provider', () => ({ useAppToast: () => () => {} }));
let tree: any;
afterEach(async () => { if (tree) { await act(async () => tree.unmount()); tree = null; } });
const text = (n: any): string => typeof n === 'string' ? n : (n.children ?? []).map(text).join('');
const input = (label: string) => tree.root.findAll((n: any) => n.type === 'input' && n.props.label === label)[0];
const button = (label: string) => tree.root.findAll((n: any) => n.type === 'button' && text(n) === label)[0];
const timeButton = () => tree.root.findAll((n: any) => n.type === 'Pressable' && n.props.accessibilityLabel === '방문 시간 수정')[0];
const output = () => JSON.stringify(tree.toJSON());
const headerSwitch = () => {
  const screen = tree.root.findAll((n: any) => typeof n.type !== 'string' && n.props && 'headerRight' in n.props)[0];
  return screen.props.headerRight; // the TextButton element itself
};
const start = { id: 'v', name: 'original', address: 'old address', lat: 37.5, lng: 127, plannedTime: '09:00', version: 1 };
function gate() { let open!: () => void; const p = new Promise<void>((r) => { open = r; }); return { p, open }; }
async function mount(handler: (path: string, body: any, method: string) => Promise<any>) {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-13', endDate: '2026-11-13', visitDate: '2026-11-13', visitId: 'v' });
  fixtures.api.mockImplementation(async (path: string, body: any, method: string) =>
    path === '/schedules/s' ? { schedule: { title: 's', status: 'active' }, plan: [{ date: '2026-11-13', status: 'active', visits: [start] }] } : handler(path, body, method));
  await act(async () => { tree = create(<Places />); });
}
function expectLocked(on: boolean) {
  expect(input('장소 이름').props.editable).toBe(!on);
  expect(input('주소').props.editable).toBe(!on);
  expect(timeButton().props.disabled).toBe(on);
  expect(button('핀 지우기').props.disabled).toBe(on);
  // The test Screen does not render the header, so the header switch is read from its prop.
  expect(headerSwitch().props.disabled).toBe(on);
}

test('a slow normal save locks every edit until it finishes, then returns', async () => {
  const save = gate();
  await mount(async (_path, body, method) => {
    if (method === 'PATCH') { await save.p; return { visit: { ...start, ...body, version: 2 }, replaceable: true, editable: true, planVersion: 2 }; }
    return { visit: start, replaceable: true, editable: true, planVersion: 1 };
  });
  expectLocked(false);
  await act(async () => input('장소 이름').props.onChangeText('my name'));
  let pending!: Promise<any>;
  await act(async () => { pending = button('수정 완료').props.onPress(); });
  expectLocked(true);
  // A map tap arriving during the save does not move the pin.
  await act(async () => map.props.onPin({ lat: 1, lng: 2 }));
  await act(async () => { save.open(); await pending; });
  const patches = fixtures.api.mock.calls.filter((c) => c[2] === 'PATCH');
  expect(patches).toHaveLength(1);
  expect(patches[0][1]).toEqual({ expectedVersion: 1, name: 'my name' });
  expect(router.back).toHaveBeenCalled();
});

test('while the conflict reload is slow the form stays locked; input typed anyway is kept', async () => {
  const reload = gate();
  let reads = 0;
  await mount(async (_path, _body, method) => {
    if (method === 'PATCH') throw new ApiError('VERSION_CONFLICT');
    if (++reads === 1) return { visit: start, replaceable: true, editable: true, planVersion: 1 };
    await reload.p;
    return { visit: { ...start, address: 'their address', plannedTime: '10:00', version: 2 }, replaceable: true, editable: true, planVersion: 2 };
  });
  await act(async () => input('장소 이름').props.onChangeText('my name'));
  let pending!: Promise<any>;
  await act(async () => { pending = button('수정 완료').props.onPress(); });
  expectLocked(true);
  // Even if an input slips past the lock, the merge reads the form when the answer arrives.
  await act(async () => input('주소').props.onChangeText('typed while waiting'));
  await act(async () => { reload.open(); await pending; });
  expect(input('장소 이름').props.value).toBe('my name');
  expect(input('주소').props.value).toBe('typed while waiting');
  expect(output()).toContain('10:00'); // untouched time takes the latest value
  expect(output()).toContain('최신 내용으로 바꿨어요');
  expectLocked(false); // a failed save leaves the form editable
});

test('a failed reload after a conflict keeps the input and does not claim the latest was loaded', async () => {
  let reads = 0, patches = 0;
  await mount(async (_path, body, method) => {
    if (method === 'PATCH') {
      if (++patches === 1) throw new ApiError('VERSION_CONFLICT');
      return { visit: { ...start, ...body, version: 3 }, replaceable: true, editable: true, planVersion: 3 };
    }
    if (++reads === 2) throw new Error('offline');
    return { visit: { ...start, version: reads === 1 ? 1 : 2 }, replaceable: true, editable: true, planVersion: reads };
  });
  await act(async () => input('장소 이름').props.onChangeText('my name'));
  await act(async () => { await button('수정 완료').props.onPress(); });
  expect(output()).toContain('최신 내용을 불러오지 못했어요');
  expect(output()).not.toContain('최신 내용으로 바꿨어요');
  expect(input('장소 이름').props.value).toBe('my name');
  expect(input('주소').props.value).toBe('old address');
  expectLocked(false);
  // Saving again still uses the old version: the server answers with another conflict
  // instead of overwriting, and that reload succeeds here.
  await act(async () => { await button('수정 완료').props.onPress(); });
  expect(fixtures.api.mock.calls.filter((c) => c[2] === 'PATCH')[1][1]).toEqual({ expectedVersion: 1, name: 'my name' });
});
