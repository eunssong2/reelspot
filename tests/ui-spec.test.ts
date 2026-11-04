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
const { hash, encrypt } = await import('../server/core/crypto.js');
const { objects } = await import('../server/adapters/object-store.js');
const { cleanupOne } = await import('../server/worker/jobs.js');
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
async function call(method: string, path: string, body?: any, token?: string) {
  const r = await app.inject({
    method: method as any,
    url: '/v1' + path,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Idempotency-Key': randomUUID(),
    },
    payload: body,
  });
  let data: any;
  try {
    data = r.json();
  } catch {
    data = r.body;
  }
  return { status: r.statusCode, data, headers: r.headers, raw: r.rawPayload };
}
async function ok(method: string, path: string, body?: any, token?: string) {
  const r = await call(method, path, body, token);
  assert.ok(r.status < 300, JSON.stringify(r.data));
  checkResponse(method, path, r.status, r.data);
  return r.data;
}
async function fail(method: string, path: string, body: any, token: string, status: number, code: string) {
  const r = await call(method, path, body, token);
  assert.equal(r.status, status, JSON.stringify(r.data));
  assert.equal(r.data.code, code);
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
      displayName: '화면 검증',
      consents: docs.documents
        .filter((d: any) => d.kind !== 'notice')
        .map((d: any) => ({ documentId: d.id, version: d.version, agreed: true })),
    },
    u.session.accessToken,
  );
  return { ...u, token: u.session.accessToken, id: u.user.id as string, credential };
}
const tz = 'Asia/Seoul';
async function detail(sid: string, token: string) {
  return ok('GET', `/schedules/${sid}`, undefined, token);
}
test('일정=일차 묶음: 날짜 중복 거부·일차 이동·취소·삭제', { skip: !enabled }, async (t) => {
  const a = await user(),
    b = await user();
  const g = await ok(
    'POST',
    '/groups',
    { name: '일차 모임', firstSchedule: { title: '제주 여행', startDate: '2026-12-01', endDate: '2026-12-03', timezone: tz } },
    a.token,
  );
  const gid = g.group.id,
    sid = g.firstSchedule.id;
  const invite = await ok('POST', `/groups/${gid}/invites`, {}, a.token);
  await ok('POST', '/invitations/join', { tokenOrCode: invite.code }, b.token);

  await t.test('상세와 달력에 days[]', async () => {
    const d = await detail(sid, a.token);
    assert.deepEqual(
      d.days.map((x: any) => [x.date, x.dayNo, x.title, x.status, x.visitCount]),
      [
        ['2026-12-01', 1, null, 'active', 0],
        ['2026-12-02', 2, null, 'active', 0],
        ['2026-12-03', 3, null, 'active', 0],
      ],
    );
    assert.deepEqual(d.plan.map((p: any) => p.date), ['2026-12-01', '2026-12-02', '2026-12-03']);
    const cal = await ok('GET', `/groups/${gid}/calendar?from=2026-12-01&to=2026-12-31`, undefined, b.token);
    assert.equal(cal.schedules.length, 1);
    assert.equal(cal.schedules[0].days.length, 3);
    assert.equal(cal.dateCounts['2026-12-02'], 1);
    assert.equal(cal.dateCounts['2026-12-04'], 0);
  });

  await t.test('같은 모임 같은 날짜의 두 번째 일정은 SCHEDULE_DATE_TAKEN', async () => {
    const e = await fail(
      'POST',
      `/groups/${gid}/schedules`,
      { title: '겹침', startDate: '2026-12-03', endDate: '2026-12-05', timezone: tz },
      a.token,
      409,
      'SCHEDULE_DATE_TAKEN',
    );
    assert.deepEqual(e.details.dates, ['2026-12-03']);
    assert.deepEqual(e.details.schedules, [{ id: sid, title: '제주 여행' }]);
    // A different group may use the same date.
    await ok(
      'POST',
      '/groups',
      { name: '다른 모임', firstSchedule: { title: '같은 날', startDate: '2026-12-03', endDate: '2026-12-03', timezone: tz } },
      a.token,
    );
  });

  let other: any;
  await t.test('기간 변경이 다른 일정 날짜를 덮으면 거부', async () => {
    other = await ok(
      'POST',
      `/groups/${gid}/schedules`,
      { title: '다음 주말', startDate: '2026-12-10', endDate: '2026-12-11', timezone: tz },
      a.token,
    );
    await fail(
      'PATCH',
      `/schedules/${other.id}`,
      { startDate: '2026-12-03', expectedVersion: other.version },
      a.token,
      409,
      'SCHEDULE_DATE_TAKEN',
    );
    // Title-only edits never re-check dates.
    other = await ok('PATCH', `/schedules/${other.id}`, { title: '다음 주말 여행', expectedVersion: other.version }, a.token);
  });

  let visit: any;
  await t.test('일차 제목과 이동: 방문·기록 날짜와 일차 번호가 함께 바뀜', async () => {
    let d = await detail(sid, a.token);
    let r = await ok(
      'PATCH',
      `/schedules/${sid}/days/2026-12-02`,
      { title: '둘째 날 오름', expectedVersion: d.schedule.version },
      a.token,
    );
    assert.equal(r.days[1].title, '둘째 날 오름');
    assert.equal(r.schedule.title, '제주 여행');
    visit = await ok(
      'POST',
      `/schedules/${sid}/visits`,
      { visitDate: '2026-12-02', manual: { name: '오름' } },
      b.token,
    );
    await fail('PATCH', `/schedules/${sid}/days/2026-12-02`, { date: '2026-12-10', expectedVersion: r.schedule.version }, a.token, 409, 'SCHEDULE_DATE_TAKEN');
    await fail('PATCH', `/schedules/${sid}/days/2026-12-02`, { date: '2026-12-03', expectedVersion: r.schedule.version }, a.token, 409, 'SCHEDULE_DATE_TAKEN');
    await fail('PATCH', `/schedules/${sid}/days/2026-12-02`, { date: '2026-12-05', expectedVersion: r.schedule.version - 1 }, a.token, 409, 'VERSION_CONFLICT');
    await fail('PATCH', `/schedules/${sid}/days/2026-12-02`, { date: '2026-12-05', expectedVersion: r.schedule.version }, b.token, 403, 'FORBIDDEN');
    // A file still transferring for the day blocks the move.
    const content = Buffer.from('day-busy-check');
    const prep = await ok(
      'POST',
      `/schedules/${sid}/submissions`,
      { files: [{ clientFileId: 'busy', selectionIndex: 0, name: 'a.jpg', kind: 'photo', mime: 'image/jpeg', declaredBytes: content.length, fingerprint: hash(content), checksum: hash(content), recordDate: '2026-12-02', visitId: visit.id }] },
      b.token,
    );
    await fail('PATCH', `/schedules/${sid}/days/2026-12-02`, { date: '2026-12-05', expectedVersion: r.schedule.version }, a.token, 409, 'DAY_BUSY');
    await ok('POST', `/upload-tasks/${prep.tasks[0].id}/cancellation`, { expectedVersion: prep.tasks[0].version }, b.token);
    r = await ok(
      'PATCH',
      `/schedules/${sid}/days/2026-12-02`,
      { date: '2026-12-05', expectedVersion: r.schedule.version },
      a.token,
    );
    assert.deepEqual(
      r.days.map((x: any) => [x.date, x.dayNo, x.title, x.visitCount]),
      [
        ['2026-12-01', 1, null, 0],
        ['2026-12-03', 2, null, 0],
        ['2026-12-05', 3, '둘째 날 오름', 1],
      ],
    );
    assert.equal(r.schedule.startDate, '2026-12-01');
    assert.equal(r.schedule.endDate, '2026-12-05');
    d = await detail(sid, a.token);
    assert.deepEqual(d.plan.map((p: any) => p.date), ['2026-12-01', '2026-12-03', '2026-12-05']);
    assert.equal(d.plan[2].visits[0].id, visit.id);
    assert.equal(d.plan[2].visits[0].visitDate, '2026-12-05');
    const task = await tx((db) => one(db, 'SELECT record_date FROM upload_tasks WHERE id=$1', [prep.tasks[0].id]));
    assert.equal(task.record_date, '2026-12-05');
    // The vacated date is a gap: not a day, so new visits are refused like outside-range dates.
    await fail('POST', `/schedules/${sid}/visits`, { visitDate: '2026-12-02', manual: { name: '틈' } }, a.token, 400, 'DATE_OUTSIDE_SCHEDULE');
    const cal = await ok('GET', `/groups/${gid}/calendar?from=2026-12-01&to=2026-12-31`, undefined, a.token);
    assert.equal(cal.dateCounts['2026-12-02'], 0);
    assert.equal(cal.dateCounts['2026-12-05'], 1);
    // The gap is free for another schedule of the group.
    const gap = await ok('POST', `/groups/${gid}/schedules`, { title: '틈 일정', startDate: '2026-12-02', endDate: '2026-12-02', timezone: tz }, a.token);
    // A one-day schedule: the day title is independent of its parent schedule.
    const renamed = await ok('PATCH', `/schedules/${gap.id}/days/2026-12-02`, { title: '하루 나들이', expectedVersion: gap.version }, a.token);
    assert.equal(renamed.schedule.title, '틈 일정');
    assert.equal(renamed.days[0].title, '하루 나들이');
  });

  await t.test('하루 취소: 기록은 남고 새 방문·업로드는 DAY_CANCELLED', async () => {
    const d = await detail(sid, a.token);
    const r = await ok('POST', `/schedules/${sid}/days/2026-12-05/cancellation`, { expectedVersion: d.schedule.version }, a.token);
    assert.equal(r.days[2].status, 'cancelled');
    assert.equal(r.days[2].visitCount, 1);
    assert.equal(r.schedule.status, 'active');
    await fail('POST', `/schedules/${sid}/visits`, { visitDate: '2026-12-05', manual: { name: '취소일' } }, b.token, 409, 'DAY_CANCELLED');
    const content = Buffer.from('cancelled-day');
    await fail(
      'POST',
      `/schedules/${sid}/submissions`,
      { files: [{ clientFileId: 'c', selectionIndex: 0, name: 'a.jpg', kind: 'photo', mime: 'image/jpeg', declaredBytes: content.length, fingerprint: hash(content), checksum: hash(content), recordDate: '2026-12-05' }] },
      b.token,
      409,
      'DAY_CANCELLED',
    );
    await fail('POST', `/schedules/${sid}/days/2026-12-05/cancellation`, { expectedVersion: r.schedule.version }, a.token, 409, 'ALREADY_CANCELLED');
    // A cancelled day frees its date for other schedules of the group.
    const reuse = await ok('POST', `/groups/${gid}/schedules`, { title: '취소일 재사용', startDate: '2026-12-05', endDate: '2026-12-05', timezone: tz }, a.token);
    const cal = await ok('GET', `/groups/${gid}/calendar?from=2026-12-05&to=2026-12-05`, undefined, a.token);
    assert.equal(cal.dateCounts['2026-12-05'], 2);
    assert.ok(cal.schedules.some((s: any) => s.id === reuse.id));
  });

  await t.test('하루 삭제: 방문 있으면 NOT_EMPTY, 빈 날은 삭제·마지막 날은 일정 삭제', async () => {
    let d = await detail(sid, a.token);
    await fail('POST', `/schedules/${sid}/days/2026-12-05/deletion`, { expectedVersion: d.schedule.version }, a.token, 409, 'NOT_EMPTY');
    let r = await ok('POST', `/schedules/${sid}/days/2026-12-01/deletion`, { expectedVersion: d.schedule.version }, a.token);
    assert.deepEqual(r.days.map((x: any) => [x.date, x.dayNo]), [['2026-12-03', 1], ['2026-12-05', 2]]);
    assert.equal(r.schedule.startDate, '2026-12-03');
    r = await ok('POST', `/schedules/${sid}/days/2026-12-03/deletion`, { expectedVersion: r.schedule.version }, a.token);
    // Only the cancelled day remains, so the schedule is cancelled.
    assert.equal(r.schedule.status, 'cancelled');
    assert.deepEqual(r.days.map((x: any) => x.status), ['cancelled']);
    // Single-day schedule with nothing in it: deleting its last day deletes the schedule.
    d = await detail(other.id, a.token);
    r = await ok('POST', `/schedules/${other.id}/days/2026-12-10/deletion`, { expectedVersion: d.schedule.version }, a.token);
    assert.equal(r.days.length, 1);
    r = await ok('POST', `/schedules/${other.id}/days/2026-12-11/deletion`, { expectedVersion: r.schedule.version }, a.token);
    assert.deepEqual(r, { schedule: null, days: [] });
    assert.equal((await call('GET', `/schedules/${other.id}`, undefined, a.token)).status, 410);
  });

  await t.test('일정 전체 취소는 모든 일차를 취소', async () => {
    const s = await ok('POST', `/groups/${gid}/schedules`, { title: '전체 취소', startDate: '2026-12-20', endDate: '2026-12-21', timezone: tz }, a.token);
    await ok('POST', `/schedules/${s.id}/cancellation`, { expectedVersion: s.version }, a.token);
    const d = await detail(s.id, a.token);
    assert.deepEqual(d.days.map((x: any) => x.status), ['cancelled', 'cancelled']);
    await ok('POST', `/groups/${gid}/schedules`, { title: '대체', startDate: '2026-12-20', endDate: '2026-12-21', timezone: tz }, a.token);
  });
});

test('초대 코드 8자리·이전 코드 유지·참여자를 포함한 성공 확인 횟수 차감', { skip: !enabled }, async () => {
  const a = await user(),
    b = await user();
  const g = await ok(
    'POST',
    '/groups',
    { name: '초대 모임', firstSchedule: { title: '모임', startDate: '2027-01-01', endDate: '2027-01-01', timezone: tz } },
    a.token,
  );
  const i = await ok('POST', `/groups/${g.group.id}/invites`, {}, a.token);
  assert.match(i.code, /^[A-HJ-NP-Z2-9]{8}$/);
  let p = await ok('GET', `/invite-preview?tokenOrCode=${i.code}`, undefined, a.token);
  assert.equal(p.alreadyMember, true);
  assert.equal(p.usesRemaining, 49);
  p = await ok('GET', `/invite-preview?tokenOrCode=${i.code.toLowerCase()}`, undefined, b.token);
  assert.equal(p.alreadyMember, false);
  assert.equal(p.usesRemaining, 48);
  p = await ok('GET', `/invite-preview?tokenOrCode=${i.code}`);
  assert.equal(p.alreadyMember, false);
  assert.equal(p.usesRemaining, 47);
  await ok('POST', '/invitations/join', { tokenOrCode: i.code }, b.token);
  p = await ok('GET', `/invite-preview?tokenOrCode=${i.code}`, undefined, b.token);
  assert.equal(p.alreadyMember, true);
  assert.equal(p.usesRemaining, 46);
  // An invalid bearer on the public preview is treated as anonymous.
  p = await ok('GET', `/invite-preview?tokenOrCode=${i.code}`, undefined, 'not-a-token');
  assert.equal(p.alreadyMember, false);
  // A 12-hex legacy code issued before the change still previews and joins.
  const legacy = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
    token = randomUUID();
  await tx((db) =>
    db.query(
      "INSERT INTO invitations(group_id,issuer_user_id,code_hash,token_hash,code_ciphertext,token_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '168 hours')",
      [g.group.id, a.id, hash(legacy), hash(token), Buffer.from(encrypt(legacy)), Buffer.from(encrypt(token))],
    ),
  );
  const c = await user();
  p = await ok('GET', `/invite-preview?tokenOrCode=${legacy.toLowerCase()}`, undefined, c.token);
  assert.equal(p.groupName, '초대 모임');
  const joined = await ok('POST', '/invitations/join', { tokenOrCode: legacy }, c.token);
  assert.equal(joined.alreadyMember, false);
});

test('프로필 사진: 준비→완료→적용→열람→기본 복원, 비참여자 거부', { skip: !enabled }, async () => {
  const a = await user(),
    b = await user(),
    outsider = await user();
  const g = await ok(
    'POST',
    '/groups',
    { name: '사진 모임', firstSchedule: { title: '모임', startDate: '2027-02-01', endDate: '2027-02-01', timezone: tz } },
    a.token,
  );
  const i = await ok('POST', `/groups/${g.group.id}/invites`, {}, a.token);
  await ok('POST', '/invitations/join', { tokenOrCode: i.code }, b.token);
  let profile = await ok('GET', '/me/profile', undefined, a.token);
  assert.equal(profile.avatarVersion, null);
  await fail('GET', `/users/${a.id}/avatar`, undefined, b.token, 404, 'NOT_FOUND');
  await fail('POST', '/me/avatar-uploads', { file: { name: 'x.gif', mime: 'image/gif', declaredBytes: 10, fingerprint: 'a'.repeat(64) } }, a.token, 400, 'FILE_INVALID');
  // Upload one photo through the regular transport; the worker step is simulated (media tools are covered by media tests).
  const upload = async () => {
    const data = Buffer.from(`avatar-${randomUUID()}`);
    const task = await ok(
      'POST',
      '/me/avatar-uploads',
      { file: { name: 'me.jpg', mime: 'image/jpeg', declaredBytes: data.length, fingerprint: hash(data) } },
      a.token,
    );
    assert.equal(task.targetType, 'avatar');
    assert.equal(task.avatarUserId, a.id);
    assert.equal(task.avatarAssetId, null);
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
    assert.equal(chunk.statusCode, 204, chunk.body);
    const commit = await call('POST', `/upload-tasks/${task.id}/commit`, { checksum: hash(data), actualBytes: data.length }, a.token);
    assert.equal(commit.status, 202);
    const key = `assets/${task.id}/1/sanitized.jpg`;
    await objects.put(key, data);
    await tx(async (db) => {
      await db.query(
        "INSERT INTO assets(avatar_user_id,variant,object_key,bytes,checksum,location_verified_absent,probe_result,state) VALUES($1,'sanitized_original',$2,$3,$4,true,$5,'ready')",
        [a.id, key, data.length, hash(data), JSON.stringify({ mime: 'image/jpeg', extension: 'jpg' })],
      );
      await db.query("UPDATE upload_tasks SET state='complete',reserved_bytes=0,version=version+1 WHERE id=$1", [task.id]);
    });
    const done = await ok('GET', `/upload-tasks/${task.id}`, undefined, a.token);
    assert.equal(done.state, 'complete');
    assert.ok(done.avatarAssetId);
    return { data, done };
  };
  const first = await upload();
  // Another user cannot apply someone else's asset.
  const bp = await ok('GET', '/me/profile', undefined, b.token);
  await fail('PATCH', '/me/profile', { avatarAssetId: first.done.avatarAssetId, expectedVersion: bp.version }, b.token, 400, 'FILE_INVALID');
  profile = await ok('PATCH', '/me/profile', { avatarAssetId: first.done.avatarAssetId, expectedVersion: profile.version }, a.token);
  assert.equal(profile.displayName, '화면 검증');
  const v1 = profile.avatarVersion;
  assert.ok(Number.isInteger(v1));
  for (const viewer of [a, b]) {
    const s = await call('GET', `/users/${a.id}/avatar?v=${v1}`, undefined, viewer.token);
    assert.equal(s.status, 200);
    assert.deepEqual(Buffer.from(s.raw), first.data);
  }
  await fail('GET', `/users/${a.id}/avatar`, undefined, outsider.token, 403, 'FORBIDDEN');
  const members = await ok('GET', `/groups/${g.group.id}/members`, undefined, b.token);
  assert.equal(members.members.find((m: any) => m.userId === a.id).avatarVersion, v1);
  assert.equal(members.members.find((m: any) => m.userId === b.id).avatarVersion, null);
  // Replacing queues cleanup of the previous photo.
  const second = await upload();
  profile = await ok('PATCH', '/me/profile', { avatarAssetId: second.done.avatarAssetId, displayName: '새 이름', expectedVersion: profile.version }, a.token);
  assert.equal(profile.displayName, '새 이름');
  assert.ok(profile.avatarVersion > v1);
  for (let n = 0; n < 50 && (await cleanupOne()); n++);
  const old = await tx((db) => one(db, 'SELECT state FROM assets WHERE id=$1', [first.done.avatarAssetId]));
  assert.equal(old.state, 'purged');
  assert.ok(!(await objects.exists(`assets/${first.done.id}/1/sanitized.jpg`)));
  assert.deepEqual(Buffer.from((await call('GET', `/users/${a.id}/avatar`, undefined, b.token)).raw), second.data);
  await fail('PATCH', '/me/profile', { avatarAssetId: second.done.avatarAssetId, restoreDefaultAvatar: true, expectedVersion: profile.version }, a.token, 400, 'VALIDATION_ERROR');
  profile = await ok('PATCH', '/me/profile', { restoreDefaultAvatar: true, expectedVersion: profile.version }, a.token);
  assert.equal(profile.avatarVersion, null);
  await fail('GET', `/users/${a.id}/avatar`, undefined, b.token, 404, 'NOT_FOUND');
  for (let n = 0; n < 50 && (await cleanupOne()); n++);
  const gone = await tx((db) => one(db, 'SELECT state FROM assets WHERE id=$1', [second.done.avatarAssetId]));
  assert.equal(gone.state, 'purged');
});

test('계정 삭제는 프로필 사진도 정리', { skip: !enabled }, async () => {
  const a = await user();
  const data = Buffer.from('avatar-delete');
  const task = await ok('POST', '/me/avatar-uploads', { file: { name: 'me.jpg', mime: 'image/jpeg', declaredBytes: data.length, fingerprint: hash(data) } }, a.token);
  const key = `assets/${task.id}/1/sanitized.jpg`;
  await objects.put(key, data);
  const asset = await tx(async (db) => {
    await db.query("UPDATE upload_tasks SET state='complete',reserved_bytes=0 WHERE id=$1", [task.id]);
    return one(
      db,
      "INSERT INTO assets(avatar_user_id,variant,object_key,bytes,checksum,location_verified_absent,probe_result,state) VALUES($1,'sanitized_original',$2,$3,$4,true,'{\"mime\":\"image/jpeg\"}','ready') RETURNING id",
      [a.id, key, data.length, hash(data)],
    );
  });
  const p = await ok('GET', '/me/profile', undefined, a.token);
  await ok('PATCH', '/me/profile', { avatarAssetId: asset.id, expectedVersion: p.version }, a.token);
  const re = await ok('POST', '/auth/reauthentication', { provider: 'google', credential: a.credential, nonce: randomUUID() }, a.token);
  await ok('POST', '/me/deletion', { reauthProof: re.reauthProof, confirmAllOwnMediaDeletion: true }, a.token);
  for (let n = 0; n < 50 && (await cleanupOne()); n++);
  const u = await tx((db) => one(db, 'SELECT avatar_asset_id FROM users WHERE id=$1', [a.id]));
  assert.equal(u.avatar_asset_id, null);
  assert.equal((await tx((db) => one(db, 'SELECT state FROM assets WHERE id=$1', [asset.id]))).state, 'purged');
  assert.ok(!(await objects.exists(key)));
});

test('v3.2: 전체 날짜 페이지·독립 제목·긴 제목 보존·1분 시간·업로드 10개', { skip: !enabled }, async () => {
  const a = await user(), outsider = await user();
  const g = await ok('POST', '/groups', { name: 'v3.2 검수', firstSchedule: { title: '부모 일정', startDate: '2027-01-01', endDate: '2027-03-10', timezone: tz } }, a.token);
  const sid = g.firstSchedule.id, gid = g.group.id;
  const legacyView = await ok('GET', `/schedules/${sid}/media?view=by_time`, undefined, a.token);
  const currentView = await ok('GET', `/schedules/${sid}/media?view=by_photo`, undefined, a.token);
  assert.deepEqual(legacyView, currentView);
  await fail('GET', `/schedules/${sid}/media?view=unknown`, undefined, a.token, 400, 'VALIDATION_ERROR');
  let version = g.firstSchedule.version;
  const longTitle = '가'.repeat(80);
  const changed = await ok('PATCH', `/schedules/${sid}/days/2027-01-01`, { title: longTitle, expectedVersion: version }, a.token);
  version = changed.schedule.version;
  assert.equal(changed.schedule.title, '부모 일정'); assert.equal(changed.days[0].title, longTitle);
  const visit = await ok('POST', `/schedules/${sid}/visits`, { visitDate: '2027-01-01', manual: { name: '서울 장소' } }, a.token);
  assert.equal(visit.plannedTime, null);
  const detail = await ok('GET', `/schedules/${sid}`, undefined, a.token);
  const plan = detail.plan[0];
  const saved = await ok('PUT', `/schedules/${sid}/plans/2027-01-01`, { title: longTitle, visits: [{ id: visit.id, order: 0, plannedTime: '23:59' }], expectedVersion: plan.version }, a.token);
  assert.equal(saved.title, longTitle); assert.equal(saved.visits[0].plannedTime, '23:59');
  await fail('PUT', `/schedules/${sid}/plans/2027-01-01`, { title: '나'.repeat(31), visits: [{ id: visit.id, order: 0, plannedTime: '10:01' }], expectedVersion: saved.version }, a.token, 400, 'VALIDATION_ERROR');
  const first = await ok('GET', `/groups/${gid}/days`, undefined, a.token);
  assert.equal(first.items.length, 60); assert.ok(first.nextCursor); assert.equal(first.items[0].day.title, longTitle);
  const second = await ok('GET', `/groups/${gid}/days?cursor=${encodeURIComponent(first.nextCursor)}`, undefined, a.token);
  assert.equal(second.items.length, 9); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((x: any) => x.day.date)).size, 69);
  await fail('GET', `/groups/${gid}/days`, undefined, outsider.token, 403, 'FORBIDDEN');
  await fail('GET', `/groups/${gid}/vlog-sources`, undefined, outsider.token, 403, 'FORBIDDEN');
  const file = { clientFileId: 'f', selectionIndex: 0, name: 'file.jpg', kind: 'photo', mime: 'image/jpeg', declaredBytes: 10, fingerprint: hash('image'), checksum: hash('image'), recordDate: '2027-01-01' };
  await fail('POST', `/schedules/${sid}/submissions`, { files: Array.from({ length: 11 }, (_, i) => ({ ...file, clientFileId: `f${i}`, selectionIndex: i })) }, a.token, 400, 'VALIDATION_ERROR');
  const fresh = await ok('GET', `/schedules/${sid}`, undefined, a.token);
  await ok('POST', `/schedules/${sid}/days/2027-01-01/cancellation`, { expectedVersion: fresh.schedule.version }, a.token);
  const active = await ok('GET', `/groups/${gid}/days`, undefined, a.token);
  assert.equal(active.items[0].day.date, '2027-01-02');
  const sources = await ok('GET', `/groups/${gid}/vlog-sources`, undefined, a.token);
  assert.deepEqual(sources.scheduleIds, [sid]);
  await fail('PUT', `/schedules/${sid}/plans/2027-01-01`, { title: longTitle, visits: [{ id: visit.id, order: 0, plannedTime: '10:01' }], expectedVersion: saved.version }, a.token, 409, 'DAY_CANCELLED');
});
