import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { Alert } from './native';
import { removal, router, setParams } from './router';
import DayEdit from '../../src/app/schedule/day';
import Onboard from '../../src/app/onboarding';
import EditRecords from '../../src/app/edit-records';
import { ToastProvider } from '../../src/components/toast-provider';
vi.mock('../../src/lib/device', () => ({ installationId: async () => 'test-device' }));
vi.mock('../../src/lib/unsaved', async (original) => original());
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.restoreAllMocks(); });
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const button = (name: string) => tree.root.findAll((n: any) => typeof n.type === 'string' && n.props.onPress && (text(n) === name || n.props.accessibilityLabel === name))[0];
async function press(name: string) { const n = button(name); expect(n, name).toBeTruthy(); await act(async () => n.props.onPress()); }
function schedule(cancelled = false) {
  setParams({ scheduleId: 's', date: '2026-11-06' });
  fixtures.api.mockImplementation(async (path, body) => {
    if (path === '/groups/g') return { id: 'g', name: '모임', ownerUserId: 'user' };
    if (path.includes('/days?')) return { items: [], nextCursor: null };
    if (path === '/schedules/s') return { schedule: { id: 's', groupId: 'g', title: '일정', status: 'active', version: 1 }, days: [{ date: '2026-11-06', status: cancelled ? 'cancelled' : 'active', dayNo: 1 }], plan: [] };
    if (body) return {};
    throw Error(path);
  });
}
test('day edit confirms abandoning changes; successful save bypasses confirmation and toasts', async () => {
  schedule(); const alerts = vi.spyOn(Alert, 'alert');
  await act(async () => { tree = create(<ToastProvider><DayEdit /></ToastProvider>); });
  const input = tree.root.findByType('input');
  await act(async () => input.props.onChangeText('새 제목')); expect(removal.enabled).toBe(true);
  await act(async () => removal.callback({ data: { action: { type: 'GO_BACK' } } }));
  expect(alerts).toHaveBeenCalledWith('저장하지 않고 나갈까요?', '바꾼 내용이 사라져요.', expect.any(Array));
  await press('뒤로'); expect(alerts).toHaveBeenCalledTimes(2);
  await press('✓ 저장하기'); expect(router.dismissTo).toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('일정을 바꿨어요'); expect(removal.enabled).toBe(false);
});
test('cancelled day cannot be edited even through a direct route', async () => {
  schedule(true); await act(async () => { tree = create(<DayEdit />); });
  expect(tree.root.findByType('input').props.editable).toBe(false);
});
test('consent document is versioned, cannot be accepted on load failure, and row toggles without opening', async () => {
  const d = { id: 'doc', itemKey: 'terms', title: '이용약관', kind: 'consent', required: true, version: 'dev-1', effectiveAt: '2026-11-06T00:00:00Z', url: 'https://example.invalid/doc' };
  fixtures.api.mockResolvedValue({ documents: [d] });
  await act(async () => { tree = create(<Onboard />); });
  await press('이용약관 동의 선택'); expect(tree.root.findAll((n: any) => n.type === 'Pressable' && n.props.accessibilityLabel === '이용약관 동의')[0].props.accessibilityState.checked).toBe(true);
  await press('이용약관 전문 보기'); expect(button('동의하고 닫기').props.disabled).toBe(true);
  await act(async () => tree.root.findByType('webview').props.onHttpError());
  expect(button('동의하고 닫기').props.disabled).toBe(true);
  await press('문서 다시 시도'); await act(async () => tree.root.findByType('webview').props.onLoad());
  expect(button('동의하고 닫기').props.disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('초안 · 법무'); await press('동의하고 닫기');
});
test('record description over 1000 characters preserves input and blocks mutation', async () => {
  setParams({ ids: 'm', scheduleId: 's' });
  fixtures.api.mockImplementation(async (path) => path.includes('/media') ? { items: [{ id: 'm', authorUserId: 'user', version: 1, kind: 'photo' }], nextCursor: null } : { plan: [] });
  await act(async () => { tree = create(<EditRecords />); });
  const toggle = tree.root.findAll((n: any) => n.type === 'Switch' && n.props.accessibilityLabel === '설명 변경')[0];
  await act(async () => toggle.props.onValueChange(true));
  await act(async () => tree.root.findByType('input').props.onChangeText('가'.repeat(1001)));
  expect(tree.root.findByType('input').props.value).toHaveLength(1001);
  expect(button('선택한 정보 일괄 적용').props.disabled).toBe(true);
  expect(fixtures.api.mock.calls.some(([p]) => p === '/media/metadata-changes')).toBe(false);
});

test('delete confirmation retains photo/video counts, thumbnails and every selected group name', async () => {
  setParams({ ids: 'a,b' });
  fixtures.api.mockResolvedValue({ items: [
    { media: { id: 'a', authorUserId: 'user', kind: 'photo', scheduleId: 's1' }, groupName: '첫 모임', membershipState: 'active' },
    { media: { id: 'b', authorUserId: 'user', kind: 'video', scheduleId: 's2' }, groupName: '둘째 모임', membershipState: 'active' },
  ], nextCursor: null });
  await act(async () => { tree = create(<EditRecords />); });
  await press('선택한 본인 기록 삭제');
  const sheet = tree.root.findByType('sheet');
  expect(text(sheet)).toContain('사진 1개 · 동영상 1개');
  expect(text(sheet)).toContain('첫 모임'); expect(text(sheet)).toContain('둘째 모임');
  expect(sheet.findAllByType('image')).toHaveLength(2);
});
