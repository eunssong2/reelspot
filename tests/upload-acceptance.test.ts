import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingCandidates } from '../src/lib/upload-acceptance';
test('partial acceptance preserves rejected and unknown candidates and their original order', () => {
  const files = ['a','b','c'].map((clientFileId) => ({ clientFileId, uri: clientFileId }));
  assert.deepEqual(remainingCandidates(files, [{ clientFileId: 'b' }]), [files[0], files[2]]);
  assert.deepEqual(remainingCandidates(files, []), files);
  assert.deepEqual(remainingCandidates(files, [{ clientFileId: 'unknown' }]), files);
});
