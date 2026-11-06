import { afterEach, expect, test, vi } from 'vitest';
import { Share } from './native';
import { inviteShareMessage, shareGroupInvite } from '../../src/lib/invite-share';
afterEach(() => vi.restoreAllMocks());
const invite = { code: 'ABCDEFGH', link: 'https://example.invalid/invite', expiresAt: '2026-11-13T00:00:00Z' };
test('both invite entry points use the F05 message with optional schedule and expiry', async () => {
  const group = { name: '친구 모임', scheduleSummary: { title: '여행', startDate: '2026-11-06', endDate: '2026-11-07' } };
  const message = inviteShareMessage(group, invite);
  expect(message).toBe("[At that place] '친구 모임'에 초대해요.\n일정: 여행 (2026-11-06 ~ 2026-11-07)\n링크를 누르거나 앱에서 코드 ABCDEFGH 를 입력하세요.\nhttps://example.invalid/invite\n11.13 09:00까지 참여할 수 있어요.");
  const share = vi.spyOn(Share, 'share');
  await expect(shareGroupInvite(group, invite)).resolves.toBeUndefined();
  expect(share).toHaveBeenCalledWith({ message });
  expect(inviteShareMessage({ name: '친구 모임' }, invite)).not.toContain('일정:');
});
test('share dismissal is silent and native share errors give the link-copy fallback', async () => {
  const share = vi.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
  await expect(shareGroupInvite({ name: '모임' }, invite)).resolves.toBeUndefined();
  share.mockRejectedValue(new Error('native'));
  await expect(shareGroupInvite({ name: '모임' }, invite)).rejects.toThrow('공유할 수 없어요. 링크 복사를 이용해 주세요');
});
