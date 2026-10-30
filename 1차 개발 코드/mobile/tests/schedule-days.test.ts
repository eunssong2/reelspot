import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDays } from '../src/lib/schedule-days';
import { scriptJson, kakaoMapHtml } from '../src/lib/kakao-map-html';
test('빈 날짜와 윤년·최대 366일을 모두 표시하며 기간 밖 기존 장소 보존', () => {
  const plan = { date: '2028-02-29', visits: [{ id: 'v' }], title: '윤일' };
  const days = scheduleDays('2028-02-28', '2028-03-01', [plan, { date: '2028-03-03', visits: [] }]);
  assert.deepEqual(
    days.map((d) => d.date),
    ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-03'],
  );
  assert.equal(days[1], plan);
  assert.deepEqual(days[0].visits, []);
  assert.equal(days[3].outsideRange, true);
  assert.equal(scheduleDays('2028-01-01', '2028-12-31', []).length, 366);
  assert.throws(() => scheduleDays('2028-01-01', '2029-01-01', []));
  assert.throws(() => scheduleDays('2028-03-01', '2028-02-01', []));
});
test('지도 데이터의 HTML/script 탈출 방지', () => {
  const name = '</script><script>alert(1)</script>\u2028';
  const encoded = scriptJson({ name });
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded), { name });
  assert.ok(!kakaoMapHtml(name).includes(name));
});

test('앱 네트워크와 게시 문서는 HTTPS만 허용', async () => {
  const { requireHttps } = await import('../src/lib/https');
  assert.equal(
    requireHttps('https://sphan0325.ddns.net/v1/app-config'),
    'https://sphan0325.ddns.net/v1/app-config',
  );
  for (const value of [
    'http://sphan0325.ddns.net:8081',
    'http://localhost',
    'https://user:password@example.com',
    'file:///secret',
  ])
    assert.throws(() => requireHttps(value));
});
