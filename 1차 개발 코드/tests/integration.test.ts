import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const enabled = process.env.RUN_INTEGRATION === '1';
process.env.MODERATION_MODE = 'development';
process.env.AUTH_MODE = 'development';
const { Ajv2020 } = await import('ajv/dist/2020.js');
const { default: addFormats } = await import('ajv-formats');
const { buildApp, contract } = await import('../server/api/app.js');
const { pool, tx, one } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const app = await buildApp();
const validator = new Ajv2020({ strict: false });
(addFormats as any)(validator);
validator.addSchema({ $id: 'atp', components: contract.components });
function rewrite(v: any): any {
  return Array.isArray(v)
    ? v.map(rewrite)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v).map(([k, x]) => [
            k,
            k === '$ref' && typeof x === 'string' && x.startsWith('#/') ? 'atp' + x : rewrite(x),
          ]),
        )
      : v;
}
function checkResponse(method: string, path: string, status: number, data: any) {
  for (const [pattern, methods] of Object.entries<any>(contract.paths)) {
    if (!new RegExp('^' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path.split('?')[0]))
      continue;
    const schema =
      methods[method.toLowerCase()]?.responses?.[status]?.content?.['application/json']?.schema;
    if (schema) {
      const v = validator.compile(rewrite(schema));
      assert.ok(v(data), `${method} ${path}: ${JSON.stringify(v.errors)}`);
    }
    return;
  }
}
after(async () => {
  await app.close();
  await pool.end();
});
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
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Idempotency-Key': key },
    payload: body,
  });
  let data: any;
  try {
    data = r.json();
  } catch {
    data = r.body;
  }
  return { status: r.statusCode, data, headers: r.headers };
}
async function ok(method: string, path: string, body?: any, token?: string, key?: string) {
  const r = await call(method, path, body, token, key);
  assert.ok(r.status < 300, JSON.stringify(r));
  checkResponse(method, path, r.status, r.data);
  return r.data;
}
async function user() {
  const credential = `dev:${randomUUID()}`,
    a = await ok('POST', '/auth/attempts', { provider: 'google', deviceId: randomUUID() }),
    u = await ok('POST', '/auth/exchange', { provider: 'google', credential, ...a });
  const docs = await ok('GET', '/consent-documents');
  await ok(
    'POST',
    '/onboarding',
    {
      displayName: '테스트',
      consents: docs.documents.map((d: any) => ({
        documentId: d.id,
        version: d.version,
        agreed: true,
      })),
    },
    u.session.accessToken,
  );
  return { ...u, token: u.session.accessToken, credential };
}
async function group(token: string) {
  return ok(
    'POST',
    '/groups',
    {
      name: '검증 모임',
      firstSchedule: {
        title: '검증 일정',
        startDate: '2026-10-24',
        endDate: '2026-10-26',
        timezone: 'Asia/Seoul',
      },
    },
    token,
  );
}
test('모든 설계 API의 핸들러가 실제 등록됨', () => {
  assert.ok(app.hasRoute({ method: 'PATCH', url: '/v1/upload-tasks/:taskId/content' }));
  assert.ok(app.hasRoute({ method: 'POST', url: '/v1/ops/recovery-requests/:requestId/decision' }));
});
test('DB API 통합: 인증·원자 생성·멱등·권한·일정·초대·한도·전송', { skip: !enabled }, async (t) => {
  const a = await user(),
    b = await user();
  let created: any;
  await t.test('모임+방장+첫일정 원자 생성과 멱등 본문 충돌', async () => {
    const key: string = randomUUID(),
      body = {
        name: '멱등 모임',
        firstSchedule: {
          title: '여행',
          startDate: '2026-10-24',
          endDate: '2026-10-26',
          timezone: 'Asia/Seoul',
        },
      };
    created = await ok('POST', '/groups', body, a.token, key);
    const repeat = await ok('POST', '/groups', body, a.token, key);
    assert.equal(repeat.group.id, created.group.id);
    assert.equal(
      (await call('POST', '/groups', { ...body, name: '다른 모임' }, a.token, key)).data.code,
      'IDEMPOTENCY_CONFLICT',
    );
    assert.equal(
      (await ok('GET', '/groups', undefined, a.token)).items.filter(
        (g: any) => g.id === created.group.id,
      ).length,
      1,
    );
  });
  const gid = () => created.group.id,
    sid = () => created.firstSchedule.id;
  await t.test('직접 일정 접근을 비참여자에게 거부', async () => {
    assert.equal((await call('GET', `/schedules/${sid()}`, undefined, b.token)).status, 403);
  });
  await t.test('초대 참여 멱등과 일반 참여자의 일정 생성 거부', async () => {
    const i = await ok('POST', `/groups/${gid()}/invites`, {}, a.token);
    const preview = await ok('GET', `/invite-preview?tokenOrCode=${i.code}`);
    assert.equal(preview.usesRemaining, 49);
    await ok('POST', '/invitations/join', { tokenOrCode: i.code }, b.token);
    const r = await ok('POST', '/invitations/join', { tokenOrCode: i.code }, b.token);
    assert.equal(r.alreadyMember, true);
    assert.equal(
      (
        await call(
          'POST',
          `/groups/${gid()}/schedules`,
          {
            title: '권한 없음',
            startDate: '2026-10-24',
            endDate: '2026-10-24',
            timezone: 'Asia/Seoul',
          },
          b.token,
        )
      ).status,
      403,
    );
  });
  await t.test('초대 49회에서 동시 확인: 성공 하나·소진 하나', async () => {
    const i = await ok('POST', `/groups/${gid()}/invites`, {}, a.token);
    await tx((db) => db.query('UPDATE invitations SET use_count=49 WHERE id=$1', [i.id]));
    const res = await Promise.all([
      call('GET', `/invite-preview?tokenOrCode=${i.code}`),
      call('GET', `/invite-preview?tokenOrCode=${i.code}`),
    ]);
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 410]);
    assert.equal(res.find((r) => r.status === 200)!.data.usesRemaining, 0);
  });
  await t.test('방문 14개에서 동시 추가는 15개까지만', async () => {
    for (let i = 0; i < 14; i++)
      await ok(
        'POST',
        `/schedules/${sid()}/visits`,
        { visitDate: '2026-10-24', manual: { name: `장소${i}` }, plannedTime: '10:00' },
        a.token,
      );
    const res = await Promise.all([
      call(
        'POST',
        `/schedules/${sid()}/visits`,
        { visitDate: '2026-10-24', manual: { name: '동시A' } },
        a.token,
      ),
      call(
        'POST',
        `/schedules/${sid()}/visits`,
        { visitDate: '2026-10-24', manual: { name: '동시B' } },
        b.token,
      ),
    ]);
    assert.deepEqual(res.map((r) => r.status).sort(), [200, 409]);
    assert.equal(res.find((r) => r.status === 409)!.data.code, 'VISIT_LIMIT');
    const detail = await ok('GET', `/schedules/${sid()}`, undefined, a.token);
    assert.equal(detail.plan[0].visits.length, 15);
  });
  await t.test('기간 축소는 영향 확인 후 보존·보관기한 고정 전 예상값', async () => {
    const detail = await ok('GET', `/schedules/${sid()}`, undefined, a.token);
    const body = { startDate: '2026-10-25', expectedVersion: detail.schedule.version };
    const fail = await call('PATCH', `/schedules/${sid()}`, body, a.token);
    assert.equal(fail.data.code, 'OUTSIDE_RANGE_CONFIRMATION_REQUIRED');
    assert.equal(fail.data.details.visits, 15);
    await ok('PATCH', `/schedules/${sid()}`, { ...body, confirmOutsideRange: true }, a.token);
    const newDetail = await ok('GET', `/schedules/${sid()}`, undefined, a.token);
    assert.equal(newDetail.plan[0].outsideRange, true);
  });
  let task: any,
    content = Buffer.from('not-a-real-image-test-transport');
  await t.test('사진 5개 접수 후 여섯번째 부분 거부', async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      clientFileId: `f${i}`,
      selectionIndex: i,
      name: 'test.jpg',
      kind: 'photo',
      mime: 'image/jpeg',
      declaredBytes: content.length,
      fingerprint: hash(content),
      checksum: hash(content),
      recordDate: '2026-10-25',
    }));
    const r = await ok('POST', `/schedules/${sid()}/submissions`, { files }, a.token);
    assert.equal(r.tasks.length, 5);
    assert.equal(r.fileErrors.length, 1);
    assert.equal(r.fileErrors[0].code, 'MEDIA_LIMIT');
    task = r.tasks[0];
  });
  await t.test('청크 해시·offset·중복 PATCH·HEAD 계약', async () => {
    const url = task.transport.uploadEndpoint;
    const headers = {
      Authorization: `Bearer ${a.token}`,
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Generation': String(task.transport.generation),
      'Upload-Offset': '0',
      'Upload-Checksum': `sha256 ${hash(content)}`,
    };
    for (let i = 0; i < 2; i++) {
      const r = await app.inject({ method: 'PATCH', url, headers, payload: content });
      assert.equal(r.statusCode, 204, r.body);
      assert.equal(Number(r.headers['upload-offset']), content.length);
    }
    const head = await app.inject({
      method: 'HEAD',
      url,
      headers: { Authorization: `Bearer ${a.token}`, 'Upload-Generation': '1' },
    });
    assert.equal(head.statusCode, 204);
    assert.equal(head.body, '');
    const bad = await app.inject({
      method: 'PATCH',
      url,
      headers: { ...headers, 'Upload-Checksum': `sha256 ${'a'.repeat(64)}` },
      payload: content,
    });
    assert.equal(bad.statusCode, 400);
  });
  await t.test('기록·진행 작업이 있는 일정 삭제 거부', async () => {
    const d = await ok('GET', `/schedules/${sid()}`, undefined, a.token);
    assert.equal(
      (
        await call(
          'POST',
          `/schedules/${sid()}/deletion`,
          { expectedVersion: d.schedule.version },
          a.token,
        )
      ).data.code,
      'NOT_EMPTY',
    );
  });
  await t.test('실패 반환 자리를 새 파일이 쓴 뒤 재시도하면 MEDIA_LIMIT', async () => {
    const failed = await tx(async (db) => {
      const t = await one(
        db,
        "SELECT * FROM upload_tasks WHERE schedule_id=$1 AND state='queued' ORDER BY id LIMIT 1 FOR UPDATE",
        [sid()],
      );
      await db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
        gid(),
        t.reserved_bytes,
      ]);
      await db.query("UPDATE upload_tasks SET state='failed',reserved_bytes=0 WHERE id=$1", [t.id]);
      return t;
    });
    const replacement = {
      clientFileId: 'replacement',
      selectionIndex: 0,
      name: 'replacement.jpg',
      kind: 'photo',
      mime: 'image/jpeg',
      declaredBytes: content.length,
      fingerprint: hash(content),
      checksum: hash(content),
      recordDate: '2026-10-25',
    };
    const p = await ok(
      'POST',
      `/schedules/${sid()}/submissions`,
      { files: [replacement] },
      a.token,
    );
    assert.equal(p.tasks.length, 1);
    const retry = await call(
      'POST',
      `/upload-tasks/${failed.id}/retries`,
      { sameFileFingerprint: failed.fingerprint },
      a.token,
    );
    assert.equal(retry.status, 409);
    assert.equal(retry.data.code, 'MEDIA_LIMIT');
  });
  await t.test('취소 전 접수는 전송 유지·새 접수는 거부', async () => {
    const d = await ok('GET', `/schedules/${sid()}`, undefined, a.token);
    await ok(
      'POST',
      `/schedules/${sid()}/cancellation`,
      { expectedVersion: d.schedule.version },
      a.token,
    );
    assert.equal(
      (await call('POST', `/schedules/${sid()}/submissions`, { files: [] }, a.token)).status,
      400,
    );
    const r = await ok('GET', `/upload-tasks/${task.id}`, undefined, a.token);
    assert.equal(r.id, task.id);
  });
  await t.test('계정 삭제 선행 조건·운영 인증 경계', async () => {
    const re = await ok(
      'POST',
      '/auth/reauthentication',
      { provider: 'google', credential: a.credential, nonce: randomUUID() },
      a.token,
    );
    assert.equal(
      (
        await call(
          'POST',
          '/me/deletion',
          { reauthProof: re.reauthProof, confirmAllOwnMediaDeletion: true },
          a.token,
        )
      ).data.code,
      'OWNER_ROLES_REMAIN',
    );
    assert.equal((await call('GET', '/ops/cases', undefined, a.token)).status, 403);
  });
});
