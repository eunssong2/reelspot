import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorPhotoIds } from '../src/lib/author-photos';
test('author download includes later pages, excludes other authors, videos and unavailable records', async () => {
  const photo = { id: 'a', authorUserId: 'owner', kind: 'photo', accessState: 'available' };
  const ids = await authorPhotoIds('owner', async (cursor) => cursor ? {
    items: [{ ...photo, id: 'b' }, { ...photo, id: 'hidden', accessState: 'restricted' }, { ...photo, id: 'video', kind: 'video' }], nextCursor: null,
  } : { items: [photo, { ...photo, id: 'other', authorUserId: 'other' }], nextCursor: 'next' });
  assert.deepEqual(ids, ['a', 'b']);
});
