import { test } from 'node:test';
import assert from 'node:assert/strict';
const { searchPlaces } = await import('../server/adapters/places.js');
test('카카오 카테고리 검색·현재 영역·검색어 검색·무료 한도 오류', async (t) => {
  const previous = { provider: process.env.PLACES_PROVIDER, key: process.env.KAKAO_REST_KEY };
  process.env.PLACES_PROVIDER = 'kakao';
  process.env.KAKAO_REST_KEY = 'fixture-key';
  t.after(() => {
    for (const [env, v] of [
      ['PLACES_PROVIDER', previous.provider],
      ['KAKAO_REST_KEY', previous.key],
    ]) {
      if (v === undefined) delete process.env[env!];
      else process.env[env!] = v;
    }
  });
  let sent: URL;
  let quota = false;
  t.mock.method(globalThis, 'fetch', async (input: any, options: any) => {
    sent = new URL(String(input));
    assert.equal(options.headers.Authorization, 'KakaoAK fixture-key');
    return new Response(
      JSON.stringify({
        documents: [
          { id: '123', place_name: '커피', road_address_name: '서울', x: '127', y: '37.5' },
        ],
      }),
      { status: quota ? 429 : 200 },
    );
  });
  const r = await searchPlaces({
    query: '',
    category: 'cafe',
    center: '127,37.5',
    sort: 'distance',
  });
  assert.equal(sent!.pathname, '/v2/local/search/category.json');
  assert.equal(sent!.searchParams.get('category_group_code'), 'CE7');
  assert.equal(sent!.searchParams.get('radius'), '20000');
  assert.equal(sent!.searchParams.has('query'), false);
  assert.equal(r.places[0].distance, 0);
  await searchPlaces({
    query: '',
    category: 'tourism',
    center: '127,37.5',
    bounds: '126,37,128,38',
  });
  assert.equal(sent!.searchParams.get('rect'), '126,37,128,38');
  assert.equal(sent!.searchParams.has('radius'), false);
  await searchPlaces({ query: '경복궁', category: 'all' });
  assert.equal(sent!.pathname, '/v2/local/search/keyword.json');
  assert.equal(sent!.searchParams.get('query'), '경복궁');
  quota = true;
  await assert.rejects(
    searchPlaces({ query: '경복궁' }),
    (e: any) => e.code === 'PROVIDER_QUOTA_EXCEEDED',
  );
  await assert.rejects(
    searchPlaces({ query: '', category: 'all', center: '127,37.5' }),
    (e: any) => e.code === 'VALIDATION_ERROR',
  );
});
