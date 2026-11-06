import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import MyPage from '../../src/app/my-page';
import Account from '../../src/app/account';
import { ToastProvider } from '../../src/components/toast-provider';
import { router, setParams } from './router';
const state = vi.hoisted(() => ({ profile: { id: 'user', displayName: 'abcdefghijklmnopqrst', version: 1 }, refresh: vi.fn(async () => {}) }));
vi.mock('../../src/lib/state', () => ({ useAccount: () => ({ ...state, session: { userId: 'user' } }) }));
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
function label(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(label).join(''); }
const button = (text: string) => tree.root.findAll((n: any) => typeof n.type === 'string' && n.props.onPress && label(n) === text)[0];
const input = () => tree.root.findByType('input');
async function press(text: string) { const b = button(text); expect(b.props.disabled).not.toBe(true); await act(async () => b.props.onPress()); }
test.each([[MyPage, '닉네임 변경'], [Account, '수정']] as const)('%s preserves legacy names, disables save and supports grapheme-limited keyboard save', async (Component, open) => {
  fixtures.api.mockImplementation(async (path) => path === '/groups' ? { items: [] } : path === '/me/identities' ? { identities: [] } : {});
  await act(async () => { tree = create(<ToastProvider><Component /></ToastProvider>); });
  await press(open);
  expect(input().props.value).toBe(state.profile.displayName);
  expect(input().props.maxLength).toBeUndefined();
  expect(button('저장').props.disabled).toBe(true);
  await act(async () => input().props.onSubmitEditing());
  expect(fixtures.api.mock.calls.some(([p]) => p === '/me/profile')).toBe(false);
  await act(async () => input().props.onChangeText('짧은 이름'));
  await press('취소'); await press(open);
  expect(input().props.value).toBe(state.profile.displayName);
  await act(async () => input().props.onChangeText(''));
  await act(async () => input().props.onChangeText('😀'.repeat(13)));
  expect(input().props.value).toBe('😀'.repeat(12));
  expect(input().props.placeholder).toBe('닉네임을 입력하세요');
  expect(input().props.returnKeyType).toBe('done');
  const full = input().props.value;
  await act(async () => input().props.onChangeText('ㅎ' + full));
  expect(input().props.value).toBe(full);
  await act(async () => input().props.onChangeText('😀'.repeat(6) + 'ㅎ' + '😀'.repeat(6)));
  expect(input().props.value).toBe(full);
  await act(async () => input().props.onSubmitEditing());
  expect(fixtures.api).toHaveBeenCalledWith('/me/profile', { displayName: '😀'.repeat(12), expectedVersion: 1 }, 'PATCH');
  expect(JSON.stringify(tree.toJSON())).toContain('닉네임을 바꿨어요');
});
test.each([[MyPage, '닉네임 변경'], [Account, '수정']] as const)('%s does not show success when saving fails', async (Component, open) => {
  fixtures.api.mockImplementation(async (path) => {
    if (path === '/me/profile') throw Error('저장 실패');
    return path === '/groups' ? { items: [] } : path === '/me/identities' ? { identities: [] } : {};
  });
  await act(async () => { tree = create(<ToastProvider><Component /></ToastProvider>); });
  await press(open);
  await act(async () => input().props.onChangeText('새 이름'));
  await press('저장');
  expect(JSON.stringify(tree.toJSON())).not.toContain('닉네임을 바꿨어요');
  expect(input().props.value).toBe('새 이름');
});
test('account confirmation survives returning to the previous screen', async () => {
  setParams({ edit: 'yes' });
  router.canGoBack.mockReturnValueOnce(true);
  fixtures.api.mockImplementation(async (path) => path === '/me/identities' ? { identities: [] } : {});
  await act(async () => { tree = create(<ToastProvider><Account /></ToastProvider>); });
  await act(async () => input().props.onChangeText('새 이름'));
  await act(async () => input().props.onSubmitEditing());
  expect(router.back).toHaveBeenCalled();
  await act(async () => tree.update(<ToastProvider><text>이전 화면</text></ToastProvider>));
  expect(JSON.stringify(tree.toJSON())).toContain('닉네임을 바꿨어요');
});
