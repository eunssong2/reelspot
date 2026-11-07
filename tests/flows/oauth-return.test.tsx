import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams, router } from './router';
import { ApiError, NetworkError } from '../../src/lib/api-errors';
vi.mock('../../src/lib/device', () => ({ installationId: async () => 'device' }));
vi.mock('expo-crypto', () => ({}));
vi.mock('expo-web-browser', () => ({}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => fixtures.storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { fixtures.storage.set(key, value); },
  deleteItemAsync: async (key: string) => { fixtures.storage.delete(key); },
}));
import { OAuthReturn } from '../../src/components/oauth-return';
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const output = () => JSON.stringify(tree.toJSON());
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
const button = (label: string) => tree.root.findAll((n: any) => n.type === 'button' && text(n) === label)[0];
function pending(state: string, result?: object) {
  setParams({ state }); fixtures.storage.set('atp.browser-login', JSON.stringify({ state, provider: 'kakao', purpose: 'signin', verifier: 'fixture', expiresAt: Date.now() + 600000, result }));
}
test('definitive finish failure clears consumed state and makes login the primary action without a misleading retry', async () => {
  pending('terminal-finish'); fixtures.storage.set('atp.pending-invite', 'keep');
  fixtures.api.mockRejectedValue(new ApiError('PROVIDER_UNAVAILABLE'));
  await act(async () => { tree = create(<OAuthReturn provider="kakao" />); });
  expect(output()).toContain('카카오 로그인이 잠시 원활하지 않아요');
  expect(output()).not.toContain('인증 결과를 확인하고 있어요');
  expect(button('결과 다시 확인')).toBeUndefined();
  expect(button('로그인 화면으로').props.secondary).toBe(false);
  expect(fixtures.storage.has('atp.browser-login')).toBe(false);
  expect(fixtures.storage.get('atp.pending-invite')).toBe('keep');
  await act(async () => button('로그인 화면으로').props.onPress());
  expect(router.replace).toHaveBeenCalledWith('/login');
});
test('transport failure can retry finish, then exchange failure retries the cached credential without finishing twice', async () => {
  pending('network-then-exchange');
  const credential = { credential: 'fixture-token', loginAttemptId: 'attempt', nonce: 'nonce' };
  fixtures.api.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(credential)
    .mockRejectedValueOnce(new ApiError('PROVIDER_UNAVAILABLE')).mockResolvedValueOnce({ session: { userId: 'user' }, onboardingRequired: false });
  await act(async () => { tree = create(<OAuthReturn provider="kakao" />); });
  expect(button('결과 다시 확인')).toBeTruthy();
  expect(output()).not.toContain('인증 결과를 확인하고 있어요');
  await act(async () => button('결과 다시 확인').props.onPress());
  expect(JSON.parse(fixtures.storage.get('atp.browser-login')!).result).toEqual(credential);
  expect(button('결과 다시 확인')).toBeTruthy();
  await act(async () => button('결과 다시 확인').props.onPress());
  expect(fixtures.api.mock.calls.map(([p]) => p)).toEqual(['/auth/kakao/finish', '/auth/kakao/finish', '/auth/exchange', '/auth/exchange']);
  expect(router.replace).toHaveBeenCalledWith('/');
});
test('missing browser state offers login rather than an impossible result retry', async () => {
  setParams({ state: 'missing' });
  await act(async () => { tree = create(<OAuthReturn provider="kakao" />); });
  expect(button('결과 다시 확인')).toBeUndefined();
  expect(output()).not.toContain('인증 결과를 확인하고 있어요');
  expect(button('로그인 화면으로').props.secondary).toBe(false);
});
