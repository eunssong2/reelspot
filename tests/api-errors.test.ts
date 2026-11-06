import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, shouldLeaveSharedScope } from '../src/lib/api-errors';
test('known and future server errors display readable messages, never raw codes', () => {
  for (const code of [
    'OWNER_CREATE_LIMIT',
    'CAPACITY_FULL',
    'INTERNAL_ERROR',
    'CONCURRENT_CHANGE',
    'MODERATION_REJECTED',
    'PENDING_UPLOADS',
    'DUPLICATE_FILE',
    'FUTURE_ERROR',
  ]) {
    assert.match(new ApiError(code).message, /[가-힣]/);
    assert.notEqual(new ApiError(code).message, code);
  }
});
test('expiry stays in its screen while membership loss leaves shared scope', () => {
  assert.equal(shouldLeaveSharedScope('GET', '/schedules/id/media?limit=1', 410, 'EXPIRED'), false);
  assert.equal(shouldLeaveSharedScope('GET', '/groups/id', 403, 'ACCESS_REVOKED'), true);
  assert.equal(shouldLeaveSharedScope('GET', '/schedules/id', 410, 'DELETED'), true);
  assert.equal(shouldLeaveSharedScope('POST', '/groups/id', 403, 'FORBIDDEN'), false);
});
test('permanent failures and unknown errors do not promise retry will fix them', () => {
  for (const code of ['FILE_CHANGED', 'MODERATION_RESTRICTED', 'UNSUPPORTED_MEDIA_TYPE', 'FUTURE_ERROR'])
    assert.doesNotMatch(new ApiError(code).message, /잠시 후|다시 시도/);
  assert.match(new ApiError('FILE_CHANGED').message, /다시 선택/);
});
test('access-loss handling is local only when the individual request opts in', () => {
  assert.equal(shouldLeaveSharedScope('GET', '/groups/g/calendar?from=2026-11-01', 403, 'FORBIDDEN', true), false);
  assert.equal(shouldLeaveSharedScope('GET', '/groups/g/calendar?from=2026-11-01', 403, 'FORBIDDEN'), true);
  assert.equal(shouldLeaveSharedScope('GET', '/schedules/s', 403, 'FORBIDDEN'), true);
});
