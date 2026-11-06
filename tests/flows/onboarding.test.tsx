import React from 'react';
import { test, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { Alert } from './native';
import { removal } from './router';
import { fixtures } from './setup';
import Onboard from '../../src/app/onboarding';
vi.mock('../../src/lib/unsaved', async (importOriginal) => await importOriginal());
vi.mock('../../src/lib/device', () => ({ installationId: async () => 'test-installation' }));
test.each([false, true])(
  'onboarding exit revokes session only after server success (failure=%s)',
  async (fail) => {
    fixtures.api.mockImplementation(async (path, body) => {
      if (path.startsWith('/consent-documents')) return { documents: [] };
      if (path === '/auth/logout') {
        expect(body).toEqual({ deviceId: 'test-installation', pendingAction: 'none' });
        if (fail) throw new Error('연결을 확인해 주세요');
        return { sessionRevoked: true };
      }
      throw Error(path);
    });
    const alerts = vi.spyOn(Alert, 'alert');
    let tree: any;
    try {
      await act(async () => {
        tree = create(<Onboard />);
      });
      expect(removal.enabled).toBe(true);
      await act(async () => removal.callback({ data: { action: { type: 'GO_BACK' } } }));
      expect(alerts.mock.calls[0].slice(0, 2)).toEqual(['가입을 그만둘까요?', '입력한 내용은 저장되지 않아요.']);
      const buttons = (alerts.mock.calls[0] as any)[2];
      expect(buttons.map((b: any) => b.text)).toEqual(['계속하기', '그만두기']);
      await act(async () => buttons[1].onPress());
      expect(fixtures.api.mock.calls.some(([path]) => path === '/auth/logout')).toBe(true);
      if (fail) {
        expect(removal.dispatch).not.toHaveBeenCalled();
        expect(fixtures.sessionChange).not.toHaveBeenCalled();
        expect(alerts).toHaveBeenLastCalledWith('나갈 수 없어요', '연결을 확인해 주세요');
      } else {
        expect(fixtures.sessionChange).toHaveBeenCalledWith(null);
        expect(removal.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
      alerts.mockRestore();
    }
  },
);

test('onboarding header/hardware back handler confirms at the root and preserves pending invite', async () => {
  fixtures.storage.set('atp.pending-invite', 'pending-invite-fixture');
  fixtures.api.mockImplementation(async (path) => path === '/auth/logout' ? { sessionRevoked: true } : { documents: [] });
  const alerts = vi.spyOn(Alert, 'alert');
  const { router } = await import('./router');
  let tree: any;
  try {
    await act(async () => { tree = create(<Onboard />); });
    const button = tree.root.findAll((n: any) => n.type === 'button' && n.children.join('') === '뒤로')[0];
    await act(async () => { expect(button.props.onPress()).toBe(true); });
    const buttons = (alerts.mock.calls[0] as any)[2];
    expect(buttons[0].text).toBe('계속하기');
    expect(fixtures.api.mock.calls.some(([path]) => path === '/auth/logout')).toBe(false);
    await act(async () => buttons[1].onPress());
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(fixtures.storage.get('atp.pending-invite')).toBe('pending-invite-fixture');
  } finally { if (tree) await act(async () => tree.unmount()); alerts.mockRestore(); }
});
