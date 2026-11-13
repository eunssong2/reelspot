import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams } from './router';
import { ApiError } from '../../src/lib/api';
import Places from '../../src/app/places';
import * as FS from 'expo-file-system/legacy';
vi.unmock('../../src/lib/uploads');
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('expo-location', () => ({}));
vi.mock('../../src/components/place-map', () => ({ PlaceMap: () => null }));
vi.mock('../../src/components/time-edit-modal', () => ({ TimeEditModal: () => null }));
vi.mock('../../src/components/toast-provider', () => ({ useAppToast: () => () => {} }));
vi.mock('../../modules/atp-transfer', () => ({ Transfer: { enqueue: async () => {} } }));
import { forgetTasks, enqueueTask, queue } from '../../src/lib/uploads';
let tree: any;
afterEach(async () => { if (tree) { await act(async () => tree.unmount()); tree = null; } });
const text = (n: any): string => typeof n === 'string' ? n : (n.children ?? []).map(text).join('');

// Review 2026-11-13 #2: a retry after a conflict must not send back values the user never changed.
test('conflict keeps my edit, takes the latest for untouched fields, and retries only my change', async () => {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-13', endDate: '2026-11-13', visitDate: '2026-11-13', visitId: 'v' });
  let v: any = { id: 'v', name: 'original', address: 'old address', lat: 37.5, lng: 127, plannedTime: '09:00', version: 1 };
  const sent: any[] = [];
  fixtures.api.mockImplementation(async (path: string, body: any, method: string) => {
    if (path === '/schedules/s') return { schedule: { title: 's', status: 'active' }, plan: [{ date: '2026-11-13', status: 'active', visits: [v] }] };
    if (method === 'PATCH') {
      sent.push(body);
      if (sent.length === 1) {
        // Another member changed the address, the pin and the time first.
        v = { ...v, address: 'other member address', lat: 37.6, lng: 127.1, plannedTime: '10:00', version: 2 };
        throw new ApiError('VERSION_CONFLICT');
      }
      v = { ...v, ...body, version: v.version + 1 };
      return { visit: v, replaceable: true, editable: true, planVersion: 3 };
    }
    return { visit: v, replaceable: true, editable: true, planVersion: 1 };
  });
  await act(async () => { tree = create(<Places />); });
  const input = (label: string) => tree.root.findAll((n: any) => n.type === 'input' && n.props.label === label)[0];
  await act(async () => input('장소 이름').props.onChangeText('my name'));
  const save = () => tree.root.findAll((n: any) => n.type === 'button' && text(n) === '수정 완료')[0].props.onPress();
  await act(async () => { await save(); });
  expect(sent[0]).toEqual({ expectedVersion: 1, name: 'my name' });
  expect(JSON.stringify(tree.toJSON())).toContain('내가 고친 내용은 그대로 두고');
  // The form now shows my name and the other member's address.
  expect(input('장소 이름').props.value).toBe('my name');
  expect(input('주소').props.value).toBe('other member address');
  await act(async () => { await save(); });
  expect(sent[1]).toEqual({ expectedVersion: 2, name: 'my name' });
  expect(v).toMatchObject({ name: 'my name', address: 'other member address', lat: 37.6, lng: 127.1, plannedTime: '10:00' });
});

test('my own change to a field another member also changed is kept, not silently replaced', async () => {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-13', endDate: '2026-11-13', visitDate: '2026-11-13', visitId: 'v' });
  let v: any = { id: 'v', name: 'original', address: 'old address', lat: null, lng: null, plannedTime: null, version: 1 };
  const sent: any[] = [];
  fixtures.api.mockImplementation(async (path: string, body: any, method: string) => {
    if (path === '/schedules/s') return { schedule: { title: 's', status: 'active' }, plan: [{ date: '2026-11-13', status: 'active', visits: [v] }] };
    if (method === 'PATCH') {
      sent.push(body);
      if (sent.length === 1) { v = { ...v, address: 'their address', version: 2 }; throw new ApiError('VERSION_CONFLICT'); }
      return { visit: { ...v, ...body }, replaceable: true, editable: true, planVersion: 3 };
    }
    return { visit: v, replaceable: true, editable: true, planVersion: 1 };
  });
  await act(async () => { tree = create(<Places />); });
  const input = (label: string) => tree.root.findAll((n: any) => n.type === 'input' && n.props.label === label)[0];
  await act(async () => input('주소').props.onChangeText('my address'));
  const save = () => tree.root.findAll((n: any) => n.type === 'button' && text(n) === '수정 완료')[0].props.onPress();
  await act(async () => { await save(); });
  expect(input('주소').props.value).toBe('my address');
  await act(async () => { await save(); });
  expect(sent[1]).toEqual({ expectedVersion: 2, address: 'my address' });
});

// Review 2026-11-13 #1: removing finished tasks must not drop a task added at the same time.
test('cleanup running while a new task is queued keeps the new task', async () => {
  fixtures.storage.set('atp.queue:user', JSON.stringify({ done: { task: { id: 'done' }, file: { uri: 'file:done' } } }));
  let release!: () => void;
  const hold = new Promise<void>((r) => { release = r; });
  // Slow storage write while the cleanup is in progress.
  vi.mocked(FS.deleteAsync).mockImplementationOnce(async () => { await hold; });
  const cleanup = forgetTasks(['done']);
  const added = enqueueTask({ id: 'new', transport: { generation: 1 } }, { uri: 'file:new', fingerprint: 'x' } as any);
  release();
  await Promise.all([cleanup, added]);
  const q = JSON.parse(fixtures.storage.get('atp.queue:user')!);
  expect(q).toHaveProperty('new');
  expect(q).not.toHaveProperty('done');
  // The file of a removed task is deleted, the new task's file is not.
  const deleted = vi.mocked(FS.deleteAsync).mock.calls.map((c) => c[0]);
  expect(deleted).toContain('file:done');
  expect(deleted).not.toContain('file:new');
});

test('many cleanups and additions interleaved end with exactly the added tasks', async () => {
  fixtures.storage.set('atp.queue:user', JSON.stringify(Object.fromEntries(['a', 'b', 'c'].map((id) => [id, { task: { id }, file: { uri: `file:${id}` } }]))));
  await Promise.all([
    forgetTasks(['a']),
    enqueueTask({ id: 'x', transport: { generation: 1 } }, { uri: 'file:x', fingerprint: 'x' } as any),
    forgetTasks(['b']),
    enqueueTask({ id: 'y', transport: { generation: 1 } }, { uri: 'file:y', fingerprint: 'y' } as any),
    forgetTasks(['c']),
  ]);
  expect(Object.keys(await queue()).sort()).toEqual(['x', 'y']);
});
