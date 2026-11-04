import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaSortKey, mediaDto } from '../server/services/records.js';
test('Q16: submission time wins over capture/completion dates, selection order is stable in both directions', () => {
  const first = { id: 'a1', submission_id: 'a', submission_completed_at: '2026-12-31T15:00:00Z', completed_at: '2027-01-02T00:00:00Z', captured_at: '2027-03-01T00:00:00Z', selection_index: 1 };
  const second = { ...first, id: 'a0', selection_index: 0, completed_at: '2026-12-31T15:00:00Z' };
  const newer = { ...first, id: 'b0', submission_id: 'b', submission_completed_at: '2027-01-01T00:00:00Z', captured_at: '2020-01-01T00:00:00Z', selection_index: 0 };
  const sort = (order: string) => [first, newer, second].sort((a, b) => mediaSortKey(a, order).localeCompare(mediaSortKey(b, order))).map((m) => m.id);
  assert.deepEqual(sort('asc'), ['a0', 'a1', 'b0']); assert.deepEqual(sort('desc'), ['b0', 'a0', 'a1']);
  assert.equal(mediaDto(first).sortAt, first.submission_completed_at);
  assert.equal(mediaDto(first).sortBasis, 'submission');
});
