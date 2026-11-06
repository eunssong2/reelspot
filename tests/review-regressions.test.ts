import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, access } from 'node:fs/promises';
const enabled = process.env.RUN_INTEGRATION === '1';
process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'development';
const { buildApp } = await import('../server/api/app.js');
const { pool, tx, one, rows } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const { config } = await import('../server/core/config.js');
const { objects } = await import('../server/adapters/object-store.js');
const { tool } = await import('../server/worker/media.js');
const { processOne, cleanupOne } = await import('../server/worker/jobs.js');
const app = await buildApp();
after(async () => {
  await app.close();
  await pool.end();
});
const expected: Record<string, unknown> = {
  'logout {} (app onboarding body)': [400, 'VALIDATION_ERROR'],
  'still logged in after failed logout': 200,
  'logout with deviceId,pendingAction': 200,
  'owner rename with version read before member added a place': [200, undefined],
  close: 200,
  'task state after close': 'complete',
  'same fingerprint twice in one submission': [400, 'DUPLICATE_FILE', undefined],
  'cancel day': 200,
  'rename cancelled day': [409, 'DAY_CANCELLED'],
  'move cancelled day': [409, 'DAY_CANCELLED'],
  'GET schedule expired': 200,
  'GET media?limit=1 expired (app opens schedule with this)': [410, 'EXPIRED'],
  'upload-limits expired': [410, 'EXPIRED'],
  'last day = D+0: warnings': ['last_day'],
  'last day = D+1: warnings': ['last_day'],
  'last day = D+6: warnings': ['week'],
  'last day = D+7: warnings': ['week'],
  'malformed JSON': [400, 'VALIDATION_ERROR', false],
};
function out(label: string, value: any) {
  if (label.startsWith('recovery ')) {
    assert.deepEqual(value.reject, [200, 'rejected']);
    assert.deepEqual(value.approve.slice(0, 2), [409, 'VERSION_CONFLICT']);
  } else if (label === 'cover assets after cleanup') {
    assert.equal(value.length, 4);
    assert.ok(
      value.every((a: any) => a[1] === 'purged' && a[2] === 'gone'),
      JSON.stringify(value),
    );
  } else if (label === 'cover assets before close') assert.equal(value.length, 4);
  else if (label === 'cleanup jobs') assert.ok(value.every((j: any) => j.state === 'complete'));
  else if (label === 'upload-limits fields') assert.ok(value.includes('maxFilesPerSubmission'));
  else {
    assert.ok(label in expected, label);
    assert.deepEqual(value, expected[label], label);
  }
}
let fixtureClient = 0;
async function call(m: string, p: string, body?: any, token?: string) {
  const r = await app.inject({
    method: m as any,
    url: '/v1' + p,
    // Each generated account is a separate fixture client; keep production rate limits intact.
    remoteAddress: p === '/auth/attempts' ? `192.0.2.${++fixtureClient}` : '127.0.0.1',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Idempotency-Key': randomUUID(),
    },
    payload: body,
  });
  let d: any;
  try {
    d = r.json();
  } catch {
    d = r.body;
  }
  return { status: r.statusCode, data: d };
}
async function ok(m: string, p: string, b?: any, t?: string) {
  const r = await call(m, p, b, t);
  if (r.status >= 300) throw new Error(m + ' ' + p + ' ' + JSON.stringify(r));
  return r.data;
}
async function user() {
  const credential = `dev:${randomUUID()}`;
  const a = await ok('POST', '/auth/attempts', { provider: 'google', deviceId: randomUUID() });
  const u = await ok('POST', '/auth/exchange', { provider: 'google', credential, ...a });
  const docs = await ok('GET', '/consent-documents');
  await ok(
    'POST',
    '/onboarding',
    {
      displayName: '테스트',
      consents: docs.documents
        .filter((d: any) => d.kind !== 'notice')
        .map((d: any) => ({ documentId: d.id, version: d.version, agreed: true })),
    },
    u.session.accessToken,
  );
  return { ...u, token: u.session.accessToken, credential, id: u.user?.id };
}
const reauth = async (u: any) =>
  (
    await ok(
      'POST',
      '/auth/reauthentication',
      { provider: 'google', credential: u.credential, nonce: randomUUID() },
      u.token,
    )
  ).reauthProof;
const mkGroup = (t: string, start = '2026-12-01', end = '2026-12-03') =>
  ok(
    'POST',
    '/groups',
    {
      name: '검증' + randomUUID().slice(0, 6),
      firstSchedule: { title: '일정', startDate: start, endDate: end, timezone: 'Asia/Seoul' },
    },
    t,
  );
const addVisit = (sid: string, date: string, t: string) =>
  ok(
    'POST',
    `/schedules/${sid}/visits`,
    { visitDate: date, manual: { name: '장소' + randomUUID().slice(0, 6) } },
    t,
  );

test(
  'logout requires device/pending action and revokes only a valid session',
  { skip: !enabled },
  async () => {
    const a = await user();
    out(
      'logout {} (app onboarding body)',
      await call('POST', '/auth/logout', {}, a.token).then((r) => [r.status, r.data.code]),
    );
    out(
      'still logged in after failed logout',
      (await call('GET', '/me/profile', undefined, a.token)).status,
    );
    out(
      'logout with deviceId,pendingAction',
      (await call('POST', '/auth/logout', { deviceId: 'd', pendingAction: 'none' }, a.token))
        .status,
    );
  },
);

async function recovery(withActivity: boolean, firstDecision = 'reject', churn = '') {
  const a = await user(),
    b = await user();
  const g = await mkGroup(a.token);
  const gid = g.group.id,
    sid = g.firstSchedule.id;
  const inv = await ok('POST', `/groups/${gid}/invites`, {}, a.token);
  await ok('POST', '/invitations/join', { tokenOrCode: inv.code }, b.token);
  const m = await ok('GET', `/groups/${gid}/members`, undefined, a.token);
  const cand = m.members.find((x: any) => x.userId === b.user.id);
  const req = await ok(
    'POST',
    `/groups/${gid}/recovery-requests`,
    {
      candidateMembershipId: cand.id,
      reason: '장기 부재 확인',
      evidenceRefs: [],
      reauthProof: await reauth(b),
    },
    b.token,
  ).catch(async () =>
    ok(
      'POST',
      `/groups/${gid}/recovery-requests`,
      {
        candidateMembershipId: cand.id,
        reason: '장기 부재 확인',
        evidenceRefs: [],
        reauthProof: await reauth(a),
      },
      a.token,
    ),
  );
  await ok(
    'POST',
    `/recovery-requests/${req.requestId}/candidate-consent`,
    { agreed: true, reauthProof: await reauth(b) },
    b.token,
  );
  await ok('POST', `/ops/recovery-requests/${req.requestId}/notice`, {}, config.devOpsToken);
  if (withActivity) await addVisit(sid, '2026-12-02', b.token);
  if (churn) {
    const outsider = await user();
    await ok('POST', '/invitations/join', { tokenOrCode: inv.code }, outsider.token);
    const members = (await ok('GET', `/groups/${gid}/members`, undefined, a.token)).members;
    const leave = async (who: any) => {
      const member = members.find((x: any) => x.userId === who.user.id);
      await ok('POST', `/groups/${gid}/leaving`, { membershipId: member.id, expectedVersion: Number(member.version) }, who.token);
    };
    if (churn === 'leave') await leave(outsider);
    if (churn === 'candidate-left') await leave(b);
    if (churn.startsWith('owner')) {
      const transfer = async (from: any, to: any) => {
        const group = (await ok('GET', '/groups', undefined, from.token)).items.find((x: any) => x.id === gid);
        await ok('POST', `/groups/${gid}/owner-transfers`, {
          targetMembershipId: members.find((x: any) => x.userId === to.user.id).id,
          expectedVersion: group.version,
        }, from.token);
      };
      await transfer(a, outsider);
      if (churn === 'owner-returned') await transfer(outsider, a);
    }
  }

  await tx(async (db: any) => {
    await db.query(
      "UPDATE recovery_requests SET notified_at=now()-interval '8 days',response_due_at=now()-interval '1 day' WHERE id=$1",
      [req.requestId],
    );
  });
  const version = (await ok('GET', '/groups', undefined, a.token)).items.find(
    (x: any) => x.id === gid,
  ).version;
  const body = (d: string) => ({
    decision: d,
    reason: '검증 근거 확인',
    expectedGroupVersion: version,
    evidenceChecklist: {
      requesterVerified: true,
      candidateAgreed: true,
      ownerNotified: true,
      waitCompleted: true,
      disputeResolved: true,
    },
  });
  const r = await call(
    'POST',
    `/ops/recovery-requests/${req.requestId}/decision`,
    body(firstDecision),
    config.devOpsToken,
  );
  const ap = await call(
    'POST',
    `/ops/recovery-requests/${req.requestId}/decision`,
    body('approve'),
    config.devOpsToken,
  );
  return {
    version,
    reject: [r.status, r.data.code ?? r.data.decision],
    approve: [
      ap.status,
      ap.data.code ?? ap.data.decision,
      ap.data.errors ? JSON.stringify(ap.data).slice(0, 160) : undefined,
    ],
  };
}
test(
  'ordinary activity preserves recovery and rejected decisions stay final',
  { skip: !enabled },
  async () => {
    out('recovery no activity (control)', await recovery(false));
    out('recovery participant adds a visit during wait', await recovery(true));
  },
);

test(
  'recovery survives content activity but still requires a current version',
  { skip: !enabled },
  async () => {
    const result = await recovery(true, 'hold');
    assert.deepEqual(result.reject, [200, 'held']);
    assert.deepEqual(result.approve.slice(0, 2), [200, 'applied']);
  },
);

for (const churn of ['join', 'leave']) {
  for (const decision of ['hold', 'approve', 'reject']) {
    test(`recovery ${decision} survives participant ${churn}`, { skip: !enabled }, async () => {
      const result = await recovery(false, decision, churn);
      assert.deepEqual(result.reject, [200, { hold: 'held', approve: 'applied', reject: 'rejected' }[decision]]);
    });
  }
}
for (const churn of ['candidate-left', 'owner-changed', 'owner-returned']) {
  test(`recovery rejects ${churn}`, { skip: !enabled }, async () => {
    const result = await recovery(false, 'approve', churn);
    assert.deepEqual(result.reject, [409, churn === 'candidate-left' ? 'TARGET_INACTIVE' : 'VERSION_CONFLICT']);
  });
}

test('content activity does not invalidate an owner edit', { skip: !enabled }, async () => {
  const a = await user(),
    b = await user();
  const g = await mkGroup(a.token);
  const gid = g.group.id;
  const inv = await ok('POST', `/groups/${gid}/invites`, {}, a.token);
  await ok('POST', '/invitations/join', { tokenOrCode: inv.code }, b.token);
  const v = (await ok('GET', '/groups', undefined, a.token)).items.find(
    (x: any) => x.id === gid,
  ).version;
  await addVisit(g.firstSchedule.id, '2026-12-02', b.token);
  out(
    'owner rename with version read before member added a place',
    await call('PATCH', `/groups/${gid}`, { name: '새이름', expectedVersion: v }, a.token).then(
      (r) => [r.status, r.data.code],
    ),
  );
});

for (const legacyCancelled of [false, true])
  test(
    `cover files after group close (legacy cancelled=${legacyCancelled})`,
    { skip: !enabled || process.env.MEDIA_TESTS !== '1' },
    async () => {
      const a = await user();
      const g = await mkGroup(a.token);
      const gid = g.group.id;
      const prefix = `fixtures/${randomUUID()}`;
      await mkdir(objects.path(prefix), { recursive: true });
      const p = objects.path(`${prefix}/c.jpg`);
      await tool('convert', ['-size', '80x60', 'xc:blue', p]);
      const data = await readFile(p);
      const file = {
        clientFileId: randomUUID(),
        selectionIndex: 0,
        name: 'c.jpg',
        kind: 'photo',
        mime: 'image/jpeg',
        declaredBytes: data.length,
        fingerprint: hash(data),
        checksum: hash(data),
      };
      const task = await ok('POST', `/groups/${gid}/cover-uploads`, { file }, a.token);
      const chunk = await app.inject({
        method: 'PATCH',
        url: task.transport.uploadEndpoint,
        payload: data,
        headers: {
          Authorization: `Bearer ${a.token}`,
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
          'Upload-Generation': '1',
          'Upload-Checksum': `sha256 ${hash(data)}`,
        },
      });
      await ok(
        'POST',
        `/upload-tasks/${task.id}/commit`,
        { checksum: hash(data), actualBytes: data.length },
        a.token,
      );
      let cur: any;
      for (let i = 0; i < 30; i++) {
        await processOne();
        cur = await ok('GET', `/upload-tasks/${task.id}`, undefined, a.token);
        if (cur.state !== 'verifying') break;
      }
      const ver = (await tx((db: any) => one(db, 'SELECT version FROM groups WHERE id=$1', [gid])))
        .version;
      await ok(
        'PATCH',
        `/groups/${gid}`,
        { coverAssetId: cur.coverAssetId, expectedVersion: Number(ver) },
        a.token,
      );
      const ver2 = (await tx((db: any) => one(db, 'SELECT version FROM groups WHERE id=$1', [gid])))
        .version;
      const list = async () =>
        tx((db: any) =>
          rows(db, 'SELECT variant,state,object_key FROM assets WHERE object_key LIKE $1', [
            `assets/${task.id}/%`,
          ]),
        );
      const before = await list();
      out(
        'cover assets before close',
        before.map((x: any) => [x.variant, x.state]),
      );
      out(
        'close',
        (
          await call(
            'POST',
            `/groups/${gid}/closure`,
            { confirmOwnMediaDeletion: true, expectedVersion: Number(ver2) },
            a.token,
          )
        ).status,
      );
      out(
        'task state after close',
        (await tx((db: any) => one(db, 'SELECT state FROM upload_tasks WHERE id=$1', [task.id])))
          .state,
      );
      if (legacyCancelled) {
        await tx(async (db) => {
          await db.query("UPDATE upload_tasks SET state='cancelled' WHERE id=$1", [task.id]);
          await db.query("UPDATE cleanup_jobs SET state='complete' WHERE target_id=$1", [task.id]);
        });
        const migration = await readFile(
          new URL('../server/db/migrations/014_terminal_upload_cleanup.sql', import.meta.url),
          'utf8',
        );
        await tx((db) => db.query(migration.replace(/^BEGIN;\s*/m, '').replace(/COMMIT;\s*$/, '')));
      }
      for (let i = 0; i < 40; i++) {
        const r = await cleanupOne();
        if (!r) break;
      }
      const after_ = await list();
      const ex: any[] = [];
      for (const x of after_) {
        let e = true;
        try {
          await access(objects.path(x.object_key));
        } catch {
          e = false;
        }
        ex.push([x.variant, x.state, e ? 'FILE EXISTS' : 'gone']);
      }
      out('cover assets after cleanup', ex);
      assert.equal(
        (await tx((db) => one(db, 'SELECT completed_bytes FROM groups WHERE id=$1', [gid])))
          .completed_bytes,
        0,
      );
      assert.ok(
        (
          await tx((db) =>
            one(db, 'SELECT storage_released_at FROM upload_tasks WHERE id=$1', [task.id]),
          )
        ).storage_released_at,
      );
      out(
        'cleanup jobs',
        await tx((db: any) =>
          rows(
            db,
            'SELECT target_type,state FROM cleanup_jobs WHERE target_id=$1 OR target_id::text IN (SELECT id::text FROM assets WHERE object_key LIKE $2)',
            [task.id, `assets/${task.id}/%`],
          ),
        ),
      );
    },
  );

test('duplicate files reject the whole submission', { skip: !enabled }, async () => {
  const a = await user();
  const g = await mkGroup(a.token);
  const sid = g.firstSchedule.id;
  const v = await addVisit(sid, '2026-12-02', a.token);
  const fp = 'a'.repeat(64);
  const f = (i: number) => ({
    clientFileId: randomUUID(),
    selectionIndex: i,
    name: 'x.jpg',
    mime: 'image/jpeg',
    kind: 'photo',
    declaredBytes: 10,
    fingerprint: fp,
    checksum: fp,
    recordDate: '2026-12-02',
    visitId: v.id,
  });
  const r = await call('POST', `/schedules/${sid}/submissions`, { files: [f(0), f(1)] }, a.token);
  out('same fingerprint twice in one submission', [r.status, r.data.code, r.data.tasks?.length]);
  out(
    'upload-limits fields',
    Object.keys(
      await ok(
        'GET',
        `/schedules/${sid}/upload-limits?recordDate=2026-12-02&visitId=${v.id}`,
        undefined,
        a.token,
      ),
    ),
  );
});

test('cancelled days cannot be renamed or moved', { skip: !enabled }, async () => {
  const a = await user();
  const g = await mkGroup(a.token);
  const sid = g.firstSchedule.id;
  const ver = async () =>
    (await ok('GET', `/schedules/${sid}`, undefined, a.token)).version ??
    (await ok('GET', `/schedules/${sid}`, undefined, a.token)).schedule.version;
  const c = await call(
    'POST',
    `/schedules/${sid}/days/2026-12-02/cancellation`,
    { expectedVersion: await ver() },
    a.token,
  );
  out('cancel day', c.status);
  out(
    'rename cancelled day',
    await call(
      'PATCH',
      `/schedules/${sid}/days/2026-12-02`,
      { title: '바뀜', expectedVersion: await ver() },
      a.token,
    ).then((r) => [r.status, r.data.code]),
  );
  out(
    'move cancelled day',
    await call(
      'PATCH',
      `/schedules/${sid}/days/2026-12-02`,
      { date: '2026-12-20', expectedVersion: await ver() },
      a.token,
    ).then((r) => [r.status, r.data.code]),
  );
});

test(
  'expired file access and Korean retention warning boundaries',
  { skip: !enabled },
  async () => {
    const a = await user();
    const g = await mkGroup(a.token, '2026-01-01', '2026-01-02');
    const sid = g.firstSchedule.id;
    await tx(async (db: any) => {
      await db.query("SET LOCAL session_replication_role='replica'");
      await db.query(
        "UPDATE schedules SET retention_fixed_at=now()-interval '100 days',retention_last_date=(now() at time zone 'Asia/Seoul')::date-1,expires_at=now()-interval '1 hour' WHERE id=$1",
        [sid],
      );
    });
    out(
      'GET schedule expired',
      (await call('GET', `/schedules/${sid}`, undefined, a.token)).status,
    );
    const m = await call('GET', `/schedules/${sid}/media?limit=1`, undefined, a.token);
    out('GET media?limit=1 expired (app opens schedule with this)', [m.status, m.data.code]);
    out(
      'upload-limits expired',
      await call(
        'GET',
        `/schedules/${sid}/upload-limits?recordDate=2026-01-01`,
        undefined,
        a.token,
      ).then((r) => [r.status, r.data.code]),
    );
    for (const days of [0, 1, 6, 7]) {
      const u = await user();
      const gg = await mkGroup(u.token, '2026-02-01', '2026-02-01');
      await tx(async (db: any) => {
        await db.query("SET LOCAL session_replication_role='replica'");
        await db.query(
          `UPDATE schedules SET retention_fixed_at=now()-interval '10 days',retention_last_date=(now() at time zone 'Asia/Seoul')::date+$2::int,expires_at=(((now() at time zone 'Asia/Seoul')::date+$2::int+1)::timestamp at time zone 'Asia/Seoul') WHERE id=$1`,
          [gg.firstSchedule.id, days],
        );
      });
      const it = (await ok('GET', '/groups', undefined, u.token)).items.find(
        (x: any) => x.id === gg.group.id,
      );
      out(
        `last day = D+${days}: warnings`,
        (it.retentionWarnings || []).map((w: any) => w.urgency),
      );
    }
  },
);

test('malformed JSON is a nonretryable client error', { skip: !enabled }, async () => {
  const a = await user();
  const r = await app.inject({
    method: 'POST',
    url: '/v1/groups',
    headers: {
      Authorization: `Bearer ${a.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    payload: '{bad',
  });
  out('malformed JSON', [r.statusCode, r.json().code, r.json().retryable]);
});

test(
  'failed processing cleans private files and retry starts from a valid offset',
  { skip: !enabled || process.env.MEDIA_TESTS !== '1' },
  async () => {
    const u = await user(),
      g = await mkGroup(u.token),
      data = Buffer.from('invalid-image-fixture');
    const submission = await ok(
      'POST',
      `/schedules/${g.firstSchedule.id}/submissions`,
      {
        files: [
          {
            clientFileId: randomUUID(),
            selectionIndex: 0,
            name: 'broken.jpg',
            kind: 'photo',
            mime: 'image/jpeg',
            declaredBytes: data.length,
            fingerprint: hash(data),
            checksum: hash(data),
            recordDate: '2026-12-02',
          },
        ],
      },
      u.token,
    );
    const task = submission.tasks[0];
    const chunk = await app.inject({
      method: 'PATCH',
      url: task.transport.uploadEndpoint,
      payload: data,
      headers: {
        Authorization: `Bearer ${u.token}`,
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Upload-Generation': '1',
        'Upload-Checksum': `sha256 ${hash(data)}`,
      },
    });
    assert.equal(chunk.statusCode, 204);
    await ok(
      'POST',
      `/upload-tasks/${task.id}/commit`,
      { checksum: hash(data), actualBytes: data.length },
      u.token,
    );
    for (let i = 0; i < 50; i++) {
      await processOne();
      if ((await ok('GET', `/upload-tasks/${task.id}`, undefined, u.token)).state === 'failed')
        break;
    }
    assert.equal((await ok('GET', `/upload-tasks/${task.id}`, undefined, u.token)).state, 'failed');
    for (let i = 0; i < 100 && (await cleanupOne()); i++);
    const stored = await tx((db) => one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [task.id]));
    assert.equal(await objects.exists(`assets/${task.id}`), false);
    assert.equal(await objects.exists(stored.quarantine_key), false);
    assert.equal(Number(stored.upload_offset), 0);
    const retry = await ok(
      'POST',
      `/upload-tasks/${task.id}/retries`,
      { sameFileFingerprint: hash(data) },
      u.token,
    );
    assert.equal(retry.transport.resumeOffset, 0);
  },
);

test('unsupported content type is a nonretryable 415', { skip: !enabled }, async () => {
  const a = await user();
  const r = await app.inject({ method: 'POST', url: '/v1/groups',
    headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'text/xml', 'Idempotency-Key': randomUUID() },
    payload: '<group />' });
  assert.deepEqual([r.statusCode, r.json().code, r.json().retryable], [415, 'UNSUPPORTED_MEDIA_TYPE', false]);
});

for (const cleanupAt of ['before-retry', 'during-retry', 'after-success']) {
  test(`failed generation is removed and successful files survive cleanup ${cleanupAt}`,
    { skip: !enabled || process.env.MEDIA_TESTS !== '1' }, async (t) => {
      const u = await user(), g = await mkGroup(u.token);
      const fixture = `fixtures/${randomUUID()}/retry.jpg`;
      await mkdir(objects.path(fixture).replace(/\/[^/]+$/, ''), { recursive: true });
      await tool('convert', ['-size', '80x60', 'xc:green', objects.path(fixture)]);
      const data = await objects.get(fixture);
      const submission = await ok('POST', `/schedules/${g.firstSchedule.id}/submissions`, {
        files: [{ clientFileId: randomUUID(), selectionIndex: 0, name: 'retry.jpg', kind: 'photo',
          mime: 'image/jpeg', declaredBytes: data.length, fingerprint: hash(data), checksum: hash(data), recordDate: '2026-12-02' }],
      }, u.token);
      const task = submission.tasks[0];
      const chunk = async (generation: number) => {
        const response = await app.inject({ method: 'PATCH', url: task.transport.uploadEndpoint, payload: data,
          headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': '0', 'Upload-Generation': String(generation), 'Upload-Checksum': `sha256 ${hash(data)}` } });
        assert.equal(response.statusCode, 204, response.body);
      };
      const commit = () => ok('POST', `/upload-tasks/${task.id}/commit`, { checksum: hash(data), actualBytes: data.length }, u.token);
      const processUntil = async (state: string) => {
        for (let i = 0; i < 100; i++) {
          await processOne();
          if ((await ok('GET', `/upload-tasks/${task.id}`, undefined, u.token)).state === state) return;
        }
        assert.fail(`Task did not reach ${state}`);
      };
      const clean = async () => { for (let i = 0; i < 200 && await cleanupOne(); i++); };
      await chunk(1);
      await commit();
      const put = objects.put.bind(objects);
      const oldOriginal = `assets/${task.id}/1/original.bin`;
      const fail = t.mock.method(objects, 'put', async (key: string, bytes: Buffer) => {
        const result = await put(key, bytes);
        if (key === oldOriginal) throw new Error('Simulated disk failure after original write');
        return result;
      });
      await processUntil('failed');
      fail.mock.restore();
      assert.equal(await objects.exists(oldOriginal), true);
      if (cleanupAt === 'before-retry') await clean();
      const retry = await ok('POST', `/upload-tasks/${task.id}/retries`, { sameFileFingerprint: hash(data) }, u.token);
      if (cleanupAt === 'during-retry') {
        await clean();
        assert.equal(await objects.exists(oldOriginal), false);
        // Retry still needs the old generation's chunk manifest.
        const stored = await tx((db) => one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [task.id]));
        for (const part of stored.chunk_manifest) assert.equal(await objects.exists(part.key), true);
      }
      if (retry.transport.resumeOffset === 0) await chunk(2);
      await commit();
      await processUntil('complete');
      await clean();
      assert.equal(await objects.exists(`assets/${task.id}/1`), false);
      if (cleanupAt === 'after-success') {
        // Repair already-completed historic cleanup, not just newly queued jobs.
        await objects.put(oldOriginal, data);
        const migration = await readFile(new URL('../server/db/migrations/015_retry_generation_cleanup.sql', import.meta.url), 'utf8');
        await tx((db) => db.query(migration.replace(/^BEGIN;\s*/m, '').replace(/COMMIT;\s*$/, '')));
        await clean();
        assert.equal(await objects.exists(`assets/${task.id}/1`), false);
      }
      const assets = await tx((db) => rows(db, 'SELECT * FROM assets WHERE object_key LIKE $1', [`assets/${task.id}/2/%`]));
      assert.equal(assets.length, 4);
      for (const asset of assets) assert.equal(await objects.exists(asset.object_key), true, asset.object_key);
      const stored = await tx((db) => one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [task.id]));
      assert.equal(await objects.exists(stored.quarantine_key), false);
    });
}
