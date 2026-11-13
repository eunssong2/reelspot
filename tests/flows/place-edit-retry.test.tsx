import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams, router } from './router';
vi.mock('expo-location', () => ({}));
vi.mock('../../src/components/place-map', () => ({ PlaceMap: () => null }));
vi.mock('../../src/components/time-edit-modal', () => ({ TimeEditModal: () => null }));
vi.mock('../../src/components/toast-provider', () => ({ useAppToast: () => () => {} }));
vi.mock('../../src/lib/api', () => ({
  api: fixtures.api, currentSession: () => ({ userId: 'user' }), awaitOperation: async (v: any) => v,
  ApiError: class extends Error { constructor(public code: string) { super(code); } }, PendingOperationError: class extends Error {},
}));
// The real useAction, error view and retry button; only layout pieces are simplified.
vi.mock('../../src/components/ui', async () => {
  const actual: any = await vi.importActual('../../src/components/ui');
  return {
    ...actual,
    Screen: ({ children, footer }: any) => <screen>{children}{footer}</screen>,
    Field: (p: any) => <input {...p} />,
    Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
    TextButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
    Sheet: ({ visible, children }: any) => (visible ? <sheet>{children}</sheet> : null),
    Card: ({ children }: any) => <card>{children}</card>,
  };
});
import Places from '../../src/app/places';
let tree: any;
afterEach(async () => { if (tree) { await act(async () => tree.unmount()); tree = null; } });
const text = (n: any): string => typeof n === 'string' ? n : (n.children ?? []).map(text).join('');
const field = (label: string) => tree.root.findAll((n: any) => n.type === 'input' && n.props.label === label)[0];
const buttons = (label: string) => tree.root.findAll((n: any) => typeof n.type === 'string' && n.props.onPress && text(n) === label);

// Review 2026-11-13 (3rd): retrying a failed save must use the current form and the edit lock.
test('after a failed save there is no inline retry; saving again sends the current input under the lock', async () => {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-13', endDate: '2026-11-13', visitDate: '2026-11-13', visitId: 'v' });
  const v = { id: 'v', name: 'original', address: 'old address', lat: 37.5, lng: 127, plannedTime: '09:00', version: 1 };
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const sent: any[] = [];
  fixtures.api.mockImplementation(async (path: string, body: any, method: string) => {
    if (path === '/schedules/s') return { schedule: { title: 's', status: 'active' }, plan: [{ date: '2026-11-13', status: 'active', visits: [v] }] };
    if (method === 'PATCH') {
      sent.push(body);
      if (sent.length === 1) throw new Error('network failure');
      await gate;
      return { visit: { ...v, ...body, version: 2 } };
    }
    return { visit: v, editable: true, replaceable: true };
  });
  await act(async () => { tree = create(<Places />); });
  await act(async () => field('장소 이름').props.onChangeText('first edit'));
  await act(async () => { await buttons('수정 완료')[0].props.onPress(); });
  expect(JSON.stringify(tree.toJSON())).toContain('network failure');
  expect(buttons('다시 시도')).toHaveLength(0);
  expect(field('주소').props.editable).toBe(true); // failure unlocks the form
  await act(async () => field('장소 이름').props.onChangeText('revised edit'));
  let pending!: Promise<any>;
  await act(async () => { pending = buttons('수정 완료')[0].props.onPress(); });
  expect(sent[1]).toEqual({ expectedVersion: 1, name: 'revised edit' });
  expect(field('주소').props.editable).toBe(false);
  expect(field('장소 이름').props.editable).toBe(false);
  await act(async () => { open(); await pending; });
  expect(router.back).toHaveBeenCalled();
});

test('loading the place can still be retried inline (no input to lose)', async () => {
  setParams({ id: 's', groupId: 'g', startDate: '2026-11-13', endDate: '2026-11-13', visitDate: '2026-11-13', visitId: 'v' });
  let reads = 0;
  fixtures.api.mockImplementation(async (path: string) => {
    if (path === '/schedules/s') return { schedule: { title: 's', status: 'active' }, plan: [{ date: '2026-11-13', status: 'active', visits: [] }] };
    if (++reads === 1) throw new Error('load failed');
    return { visit: { id: 'v', name: 'original', address: '', lat: null, lng: null, plannedTime: null, version: 1 }, editable: true, replaceable: true };
  });
  await act(async () => { tree = create(<Places />); });
  expect(buttons('다시 시도')).toHaveLength(1);
  await act(async () => { await buttons('다시 시도')[0].props.onPress(); });
  expect(field('장소 이름').props.value).toBe('original');
});
