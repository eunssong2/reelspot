import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.env.AUTH_MODE = 'development';
process.env.KAKAO_APP_ID = '123456';
process.env.KAKAO_REST_KEY = 'fixture-rest-key';
process.env.KAKAO_CLIENT_SECRET = 'fixture-client-secret';
const { buildApp } = await import('../server/api/app.js');
const { pool, tx } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const { verifyIdentity } = await import('../server/adapters/auth.js');
const app = await buildApp();
after(async () => {
  await app.close();
  await pool.end();
});
const integration = process.env.RUN_INTEGRATION === '1';
async function call(
  method: string,
  path: string,
  body?: any,
  token?: string,
  key: string = randomUUID(),
) {
  const r = await app.inject({
    method: method as any,
    url: '/v1' + path,
    payload: body,
    headers: { 'Idempotency-Key': key, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  return { status: r.statusCode, data: r.statusCode === 302 ? null : r.json(), headers: r.headers };
}
async function ok(method: string, path: string, body?: any, token?: string, key?: string) {
  const r = await call(method, path, body, token, key);
  assert.ok(r.status < 300, JSON.stringify(r));
  return r.data;
}
async function user() {
  const a = await ok('POST', '/auth/attempts', { provider: 'kakao', deviceId: randomUUID() });
  const r = await ok('POST', '/auth/exchange', {
    provider: 'kakao',
    credential: 'dev:' + randomUUID(),
    ...a,
  });
  const docs = await ok('GET', '/consent-documents');
  await ok(
    'POST',
    '/onboarding',
    {
      displayName: '초대 검증',
      consents: docs.documents.filter((d: any) => d.kind !== 'notice').map((d: any) => ({
        documentId: d.id,
        version: d.version,
        agreed: true,
      })),
    },
    r.session.accessToken,
  );
  return { token: r.session.accessToken, id: r.session.userId };
}
test('실제 Kakao 토큰은 개발 모드에서도 앱 ID와 사용자 ID 검증을 통과해야 함', async (t) => {
  let foreign = false;
  t.mock.method(
    globalThis,
    'fetch',
    async (url: any) =>
      new Response(
        JSON.stringify(
          String(url).endsWith('access_token_info')
            ? { app_id: foreign ? 987 : 123456, id: 99 }
            : { id: 99, properties: { nickname: '카카오' } },
        ),
      ),
  );
  assert.deepEqual(await verifyIdentity('kakao', 'real-access-token'), {
    subject: '99',
    name: '카카오',
  });
  foreign = true;
  await assert.rejects(
    verifyIdentity('kakao', 'real-access-token'),
    (e: any) => e.code === 'AUTH_INVALID',
  );
});
test(
  '카카오 로그인: 상태·검증값·토큰 교환·한 번만 소비·취소·만료',
  { skip: !integration },
  async (t) => {
    let exchanges = 0;
    t.mock.method(globalThis, 'fetch', async (url: any, opts: any) => {
      assert.equal(String(url), 'https://kauth.kakao.com/oauth/token');
      const form = new URLSearchParams(opts.body);
      assert.equal(form.get('client_secret'), 'fixture-client-secret');
      assert.equal(form.get('code'), 'fixture-code');
      exchanges++;
      return new Response(JSON.stringify({ access_token: 'fixture-access-token' }));
    });
    const verifier = 'a'.repeat(64);
    const start = () =>
      ok('POST', '/auth/kakao/start', { verifierHash: hash(verifier), deviceId: 'test' });
    const validRedirect = process.env.KAKAO_REDIRECT_URI;
  process.env.KAKAO_REDIRECT_URI = 'http://example.invalid/v1/auth/kakao/callback';
  assert.equal((await call('POST','/auth/kakao/start',{verifierHash:hash(verifier),deviceId:'test'})).status,503);
  if (validRedirect === undefined) delete process.env.KAKAO_REDIRECT_URI;
  else process.env.KAKAO_REDIRECT_URI = validRedirect;
  const f = await start();
    const url = new URL(f.authorizationUrl);
  assert.equal(new URL(url.searchParams.get('redirect_uri')!).protocol, 'https:');
    assert.equal(url.searchParams.get('state'), f.state);
    assert.equal(url.searchParams.get('client_id'), 'fixture-rest-key');
    assert.equal(url.searchParams.has('client_secret'), false);
    assert.equal(
      (await call('POST', '/auth/kakao/finish', { state: f.state, verifier })).status,
      401,
    );
    assert.equal(
      (await call('GET', '/auth/kakao/callback?state=' + 'Z'.repeat(43) + '&code=fixture-code'))
        .status,
      401,
    );
    const cb = await call('GET', `/auth/kakao/callback?state=${f.state}&code=fixture-code`);
    assert.equal(cb.status, 302);
    assert.equal(cb.headers.location, `atthatplace://oauth/kakao?state=${f.state}`);
    assert.equal(exchanges, 1);
    assert.equal(
      (await call('POST', '/auth/kakao/finish', { state: f.state, verifier: 'b'.repeat(64) }))
        .status,
      401,
    );
    const finish = await ok('POST', '/auth/kakao/finish', { state: f.state, verifier });
    assert.equal(finish.credential, 'fixture-access-token');
    assert.ok(finish.loginAttemptId);
    assert.ok(finish.nonce);
    assert.equal(
      (await call('POST', '/auth/kakao/finish', { state: f.state, verifier })).status,
      401,
    );
    assert.equal(
      (await call('GET', `/auth/kakao/callback?state=${f.state}&code=fixture-code`)).status,
      401,
    );
    assert.equal(exchanges, 1);
    const rows = await tx((db) =>
      db.query('SELECT credential_encrypted FROM kakao_login_flows WHERE state_hash=$1', [
        hash(f.state),
      ]),
    );
    assert.equal(rows.rows[0].credential_encrypted, null);
    const cancelled = await start();
    await call('GET', `/auth/kakao/callback?state=${cancelled.state}&error=access_denied`);
    assert.equal(
      (await call('POST', '/auth/kakao/finish', { state: cancelled.state, verifier })).data.code,
      'AUTH_CANCELLED',
    );
    const expired = await start();
    await tx((db) =>
      db.query(
        "UPDATE kakao_login_flows SET expires_at=now()-interval '1 second' WHERE state_hash=$1",
        [hash(expired.state)],
      ),
    );
    assert.equal(
      (await call('GET', `/auth/kakao/callback?state=${expired.state}&code=fixture-code`)).status,
      401,
    );
  },
);
test(
  '모든 현재 참여자의 초대 발급·조회·다른 발급자 링크 폐기와 탈퇴 후 캐시 요청 차단',
  { skip: !integration },
  async () => {
    const owner = await user(),
      member = await user(),
      outsider = await user();
    const created = await ok(
        'POST',
        '/groups',
        {
          name: '권한 검증',
          firstSchedule: {
            title: '첫 일정',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            timezone: 'Asia/Seoul',
          },
        },
        owner.token,
      ),
      gid = created.group.id;
    const path = `/groups/${gid}/invites`,
      initial = await ok('POST', path, {}, owner.token);
    await ok('POST', '/invitations/join', { tokenOrCode: initial.code }, member.token);
    const key: string = randomUUID(),
      issued = await ok('POST', path, {}, member.token, key);
    assert.ok(
      (await ok('GET', path, undefined, member.token)).invites.some((i: any) => i.id === issued.id),
    );
    assert.equal((await call('POST', path, {}, outsider.token)).status, 403);
    const revokePath = `/invites/${initial.id}/revocation`,
      revokeKey = randomUUID(),
      body = { expectedVersion: initial.version };
    const revoked = await ok('POST', revokePath, body, member.token, revokeKey);
    assert.equal(revoked.state, 'revoked');
    await tx(db => db.query("UPDATE users SET status='restricted' WHERE id=$1", [member.id]));
    assert.equal((await call('POST', path, {}, member.token, key)).status, 403);
    await tx(db => db.query("UPDATE users SET status='active' WHERE id=$1", [member.id]));
    // Simulate committed membership termination, then retry identical idempotency keys.
    await tx((db) =>
      db.query(
        "UPDATE memberships SET ended_at=now(),end_reason='left' WHERE group_id=$1 AND user_id=$2",
        [gid, member.id],
      ),
    );
    assert.equal((await call('POST', path, {}, member.token, key)).status, 403);
    assert.equal((await call('GET', path, undefined, member.token)).status, 403);
    assert.equal((await call('POST', revokePath, body, member.token, revokeKey)).status, 403);
    const closedKey = randomUUID();
    await ok('POST', path, {}, owner.token, closedKey);
    await tx(db => db.query("UPDATE groups SET status='closed',closed_at=now() WHERE id=$1", [gid]));
    assert.ok((await call('POST', path, {}, owner.token, closedKey)).status >= 400);

  },
);
