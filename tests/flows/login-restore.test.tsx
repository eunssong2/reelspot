import React from 'react';
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);
const originalJpg = localRequire.extensions['.jpg'];
localRequire.extensions['.jpg'] = (module) => { module.exports = 'fixture-logo'; };
afterAll(() => { if (originalJpg) localRequire.extensions['.jpg'] = originalJpg; else delete localRequire.extensions['.jpg']; });
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { router, setFocused, setParams } from './router';
import Home from '../../src/app/index';
import Invite from '../../src/app/invite';
import Login from '../../src/app/login';
import Identities from '../../src/app/identities';
import { LoginCancelled } from '../../src/lib/social';
const auth = vi.hoisted(() => ({ signIn: vi.fn(), credential: vi.fn(), complete: vi.fn() }));
vi.mock('../../src/lib/state', () => ({ useAccount: () => ({ ready: true, session: { userId: 'user' }, profile: { status: 'active' } }) }));
vi.mock('../../src/lib/device', () => ({ installationId: async () => 'test-device' }));
vi.mock('../../src/lib/social', () => ({ LoginCancelled: class extends Error {}, signInWithProvider: auth.signIn, reauth: async () => 'proof', socialCredential: auth.credential, pendingBrowserLogin: async () => ({ purpose: 'signin' }), completePendingSignIn: auth.complete }));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession() {} }));
vi.mock('expo-secure-store', () => ({ setItemAsync: async () => {} }));
(globalThis as any).__DEV__ = true;
let tree: any;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); auth.signIn.mockReset(); auth.credential.mockReset(); router.canGoBack.mockReturnValue(false); });
const output = () => JSON.stringify(tree.toJSON());
function text(n: any): string { return typeof n === 'string' ? n : (n.children ?? []).map(text).join(''); }
async function press(name: string) { const b = tree.root.findAll((n: any) => n.type === 'button' && text(n).includes(name))[0]; expect(b.props.disabled).not.toBe(true); await act(async () => b.props.onPress()); }
test('restored session opens pending invite once without spending another preview', async () => {
  fixtures.storage.set('atp.pending-invite', JSON.stringify({ token: 'ABCDEFGH', preview: {} }));
  fixtures.api.mockResolvedValue({ items: [], nextCursor: null });
  await act(async () => { tree = create(<Home />); });
  expect(router.replace).toHaveBeenCalledWith('/invite');
  expect(fixtures.api).not.toHaveBeenCalled();
  router.replace.mockClear();
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Invite />); });
  await press('뒤로');
  expect(router.replace).toHaveBeenCalledWith('/');
  router.replace.mockClear();
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Home />); });
  expect(router.replace).not.toHaveBeenCalled(); expect(fixtures.api).toHaveBeenCalledWith('/groups');
  expect(fixtures.storage.has('atp.pending-invite')).toBe(true);
});
test.each([true, false])('invite back preserves its caller when canGoBack=%s and keeps the pending invite', async (canGoBack) => {
  const pending = JSON.stringify({ token: 'ABCDEFGH', preview: { groupName: '초대 모임' } });
  fixtures.storage.set('atp.pending-invite', pending);
  router.canGoBack.mockReturnValue(canGoBack);
  await act(async () => { tree = create(<Invite />); });
  await press('뒤로');
  if (canGoBack) {
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  } else {
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/');
  }
  expect(fixtures.storage.get('atp.pending-invite')).toBe(pending);
});
test('closing provider login is silent and preserves pending invite', async () => {
  fixtures.storage.set('atp.pending-invite', 'keep');
  fixtures.api.mockImplementation(async (p) => p === '/app-config' ? { providers: { kakao: true, google: true } } : { documents: [] });
  auth.signIn.mockRejectedValue(new LoginCancelled('cancelled'));
  await act(async () => { tree = create(<Login />); }); await press('카카오로 시작하기');
  expect(output()).not.toContain('cancelled'); expect(fixtures.storage.get('atp.pending-invite')).toBe('keep'); expect(router.replace).not.toHaveBeenCalled();
});
test('Google linking is available when configured and sends the returned credential with reauthentication', async () => {
  fixtures.api.mockImplementation(async (p) => p === '/app-config' ? { providers: { google: true } } : { identities: [{ id: 'k', provider: 'kakao' }] });
  auth.credential.mockResolvedValue({ credential: 'google-token' });
  await act(async () => { tree = create(<Identities />); }); await press('Google 계정 연결');
  expect(auth.credential).toHaveBeenCalledWith('google', true);
  expect(fixtures.api).toHaveBeenCalledWith('/me/identities', { provider: 'google', credential: 'google-token', reauthProof: 'proof' });
});

import { ApiError, NetworkError } from '../../src/lib/api-errors';
test.each([
  [new NetworkError(), '네트워크를 확인하고'],
  [new ApiError('PROVIDER_UNAVAILABLE'), '카카오 로그인이 잠시 원활하지 않아요'],
  [new ApiError('AUTH_INVALID'), '로그인하지 못했어요. 다시 시도해 주세요.'],
  [new Error('network 네트워크 arbitrary message'), '로그인하지 못했어요. 다시 시도해 주세요.'],
])('login classifies typed errors and preserves pending invite: %s', async (error, message) => {
  fixtures.storage.set('atp.pending-invite', 'keep');
  fixtures.api.mockImplementation(async (p) => p === '/app-config' ? { providers: { kakao: true } } : { documents: [] });
  auth.signIn.mockRejectedValue(error);
  await act(async () => { tree = create(<Login />); }); await press('카카오로 시작하기');
  expect(output()).toContain(message);
  expect(fixtures.storage.get('atp.pending-invite')).toBe('keep');
});

import { OAuthReturn } from '../../src/components/oauth-return';
test.each([
  [new NetworkError(), '네트워크를 확인하고'],
  [new ApiError('PROVIDER_UNAVAILABLE'), '카카오 로그인이 잠시 원활하지 않아요'],
  [new ApiError('PROVIDER_QUOTA_EXCEEDED'), '카카오 로그인이 잠시 원활하지 않아요'],
  [new ApiError('AUTH_INVALID'), '로그인하지 못했어요. 다시 시도해 주세요.'],
])('OAuth return uses the same typed login errors: %s', async (error, message) => {
  setParams({ state: 'fixture-state' }); fixtures.storage.set('atp.pending-invite', 'keep');
  auth.complete.mockRejectedValue(error);
  await act(async () => { tree = create(<OAuthReturn provider="kakao" />); });
  expect(output()).toContain(message); expect(fixtures.storage.get('atp.pending-invite')).toBe('keep');
});
test('OAuth return cancellation returns to login silently and preserves pending invite', async () => {
  setParams({ state: 'fixture-state' }); fixtures.storage.set('atp.pending-invite', 'keep');
  auth.complete.mockRejectedValue(new ApiError('AUTH_CANCELLED'));
  await act(async () => { tree = create(<OAuthReturn provider="kakao" />); });
  expect(router.replace).toHaveBeenCalledWith('/login'); expect(tree.root.findAllByType('error')).toHaveLength(0);
  expect(fixtures.storage.get('atp.pending-invite')).toBe('keep');
});
