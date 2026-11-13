import React from 'react';
import { test, expect } from 'vitest';
import { act, create } from 'react-test-renderer';
import { fixtures } from './setup';
import { setParams } from './router';
import { ApiError } from '../../src/lib/api';
import Invite from '../../src/app/invite';
const text = (node: any): string => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
// F05: a full group may free up, so capacity is retryable unlike a revoked or expired invite.
test('capacity rejection after preview keeps the join action for a retry', async () => {
  setParams({ code: 'ABCD2345' });
  fixtures.api.mockImplementation(async (path) => {
    if (path.startsWith('/invite-preview')) return { groupName: '모임', alreadyMember: false };
    if (path === '/invitations/join') throw new ApiError('CAPACITY_FULL');
    throw Error(path);
  });
  let tree: any;
  try {
    await act(async () => { tree = create(<Invite />); });
    const join = tree.root.findAll((n: any) => n.type === 'button' && text(n) === '모임 참여하기 →')[0];
    await act(async () => join.props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain('모임 정원(15명)이 다 찼어요.');
    expect(tree.root.findAll((n: any) => n.type === 'button' && text(n) === '모임 참여하기 →')).toHaveLength(1);
    expect(tree.root.findAll((n: any) => n.type === 'button' && text(n) === '닫기')).toHaveLength(0);
  } finally { if (tree) await act(async () => tree.unmount()); }
});
