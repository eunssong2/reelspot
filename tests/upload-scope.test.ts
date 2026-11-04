import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadDraftKey, assertUploadScope } from '../src/lib/upload-scope';
test('upload candidates are isolated by account, schedule, date and visit, with no silent retargeting', () => {
  const s = { userId: 'u', scheduleId: 's', recordDate: '2027-01-01', visitId: 'A' };
  const scopes = [s, { ...s, userId: 'v' }, { ...s, scheduleId: 't' }, { ...s, recordDate: '2027-01-02' }, { ...s, visitId: 'B' }, { ...s, visitId: null }];
  assert.equal(new Set(scopes.map(uploadDraftKey)).size, scopes.length);
  const original: any = { clientFileId: 'file', recordDate: s.recordDate, visitId: s.visitId };
  assertUploadScope(s, [original]);
  assert.throws(() => assertUploadScope({ ...s, visitId: 'B' }, [original]), /다른 날짜·장소/);
  assert.equal(original.visitId, 'A');
});
