import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'disabled';
const enabled = process.env.RUN_INTEGRATION === '1';
const { buildApp } = await import('../server/api/app.js');
const { pool, tx, one } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const { objects } = await import('../server/adapters/object-store.js');
const { tool } = await import('../server/worker/media.js');
const { processOne } = await import('../server/worker/jobs.js');
const app = await buildApp();
after(async () => {
  await app.close();
  await pool.end();
});
async function send(method: string, path: string, body?: any, token?: string, key = randomUUID()) {
  const r = await app.inject({
    method: method as any,
    url: '/v1' + path,
    payload: body,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Idempotency-Key': key },
  });
  return { status: r.statusCode, data: r.json() };
}
async function call(method: string, path: string, body?: any, token?: string, status = 200) {
  const r = await send(method, path, body, token);
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(r.data).slice(0, 500)}`);
  return r.data;
}
async function user() {
  const a = await call('POST', '/auth/attempts', { provider: 'kakao', deviceId: randomUUID() });
  const u = await call('POST', '/auth/exchange', { provider: 'kakao', credential: `dev:${randomUUID()}`, ...a });
  const docs = await call('GET', '/consent-documents');
  await call(
    'POST',
    '/onboarding',
    {
      displayName: '장소 수정 검증',
      consents: docs.documents
        .filter((d: any) => d.kind !== 'notice')
        .map((d: any) => ({ documentId: d.id, version: d.version, agreed: true })),
    },
    u.session.accessToken,
  );
  return { id: u.user.id, token: u.session.accessToken };
}
// UI50 (QA-01, Q23): the visit keeps its id, date, order and records while its place changes.
test('place edit keeps the visit and guards replacement', { skip: !enabled, timeout: 300000 }, async (t) => {
  const a = await user(),
    b = await user(),
    outsider = await user();
  const g = await call(
    'POST',
    '/groups',
    {
      name: '장소 수정 모임',
      firstSchedule: { title: '장소 수정 일정', startDate: '2026-11-12', endDate: '2026-11-13', timezone: 'Asia/Seoul' },
    },
    a.token,
  );
  const gid = g.group.id,
    sid = g.firstSchedule.id;
  const invite = await call('POST', `/groups/${gid}/invites/current`, {}, a.token);
  await call('POST', '/invitations/join', { tokenOrCode: invite.code }, b.token);
  // Search results are stored per group; the provider itself is not called in tests.
  const provider = async (id: string, name: string) =>
    tx((db) =>
      db.query(
        "INSERT INTO places(group_id,provider,provider_place_id,name,address,latitude,longitude,normalized_fingerprint) VALUES($1,'kakao',$2,$3,'서울 성동구 성수동',37.544,127.055,$4)",
        [gid, id, name, hash('kakao:' + id)],
      ),
    );
  await provider('K1', '성수 카페');
  await provider('K2', '서울숲');
  const add = (visitDate: string, body: any, token = a.token) =>
    call('POST', `/schedules/${sid}/visits`, { visitDate, ...body }, token);
  const first = await add('2026-11-12', { manual: { name: '집결지', address: '성수역 3번 출구', lat: 37.5446, lng: 127.0559 } });
  const cafe = await add('2026-11-12', { providerPlaceId: 'K1' });
  const cafeNextDay = await add('2026-11-13', { providerPlaceId: 'K1' });
  const day = async (date: string) =>
    (await call('GET', `/schedules/${sid}`, undefined, a.token)).plan.find((d: any) => d.date === date);

  await t.test('reads current values for a member and refuses outsiders', async () => {
    const d = await call('GET', `/visits/${first.id}`, undefined, b.token);
    assert.equal(d.visit.name, '집결지');
    assert.equal(d.visit.address, '성수역 3번 출구');
    assert.equal(d.visit.lat, 37.5446);
    assert.equal(d.replaceable, true);
    assert.equal(d.editable, true);
    assert.equal(d.planVersion, (await day('2026-11-12')).version);
    await call('GET', `/visits/${first.id}`, undefined, outsider.token, 403);
    await call('PATCH', `/visits/${first.id}`, { expectedVersion: d.visit.version, name: '침입' }, outsider.token, 403);
  });

  await t.test('edits name, address, pin and time; omitted values stay; null clears', async () => {
    const before = await call('GET', `/visits/${first.id}`, undefined, a.token);
    const r = await call(
      'PATCH',
      `/visits/${first.id}`,
      { expectedVersion: before.visit.version, name: '  새 집결지 ', plannedTime: '09:07' },
      b.token,
    );
    assert.equal(r.visit.id, first.id);
    assert.equal(r.visit.name, '새 집결지');
    assert.equal(r.visit.address, '성수역 3번 출구');
    assert.equal(r.visit.lat, 37.5446);
    assert.equal(r.visit.plannedTime, '09:07');
    assert.equal(r.visit.position, 0);
    assert.equal(r.visit.visitDate, '2026-11-12');
    assert.equal(r.visit.version, before.visit.version + 1);
    assert.equal(r.planVersion, before.planVersion + 1);
    const stale = await send('PATCH', `/visits/${first.id}`, { expectedVersion: before.visit.version, name: '늦은 수정' }, a.token);
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, 'VERSION_CONFLICT');
    assert.equal(stale.data.currentVersion, r.visit.version);
    const cleared = await call(
      'PATCH',
      `/visits/${first.id}`,
      { expectedVersion: r.visit.version, address: null, location: null, plannedTime: null },
      a.token,
    );
    assert.equal(cleared.visit.name, '새 집결지');
    assert.equal(cleared.visit.address, '');
    assert.equal(cleared.visit.lat, null);
    assert.equal(cleared.visit.lng, null);
    assert.equal(cleared.visit.plannedTime, null);
    const invalid = async (body: any) =>
      assert.equal((await send('PATCH', `/visits/${first.id}`, { expectedVersion: cleared.visit.version, ...body }, a.token)).status, 400);
    await invalid({ name: ' ' });
    await invalid({ name: 'ㄱ'.repeat(101) });
    await invalid({ location: { lat: 37.5 } });
    await invalid({ location: { lat: 91, lng: 127 } });
    await invalid({ plannedTime: '24:00' });
    await invalid({ providerPlaceId: 'K2', name: '함께 보낼 수 없음' });
    assert.equal((await call('GET', `/visits/${first.id}`, undefined, a.token)).visit.version, cleared.visit.version);
  });

  await t.test('same request key returns the same result without a second change', async () => {
    const d = await call('GET', `/visits/${first.id}`, undefined, a.token);
    const key = randomUUID(),
      body = { expectedVersion: d.visit.version, address: '서울 성동구 아차산로 100' };
    const x = await send('PATCH', `/visits/${first.id}`, body, a.token, key),
      y = await send('PATCH', `/visits/${first.id}`, body, a.token, key);
    assert.equal(x.status, 200);
    assert.deepEqual(y.data, x.data);
    assert.equal((await day('2026-11-12')).visits.length, 2);
    assert.equal((await call('GET', `/visits/${first.id}`, undefined, a.token)).visit.version, d.visit.version + 1);
  });

  await t.test('editing a searched place does not change the same place on another date', async () => {
    const d = await call('GET', `/visits/${cafe.id}`, undefined, a.token);
    const r = await call(
      'PATCH',
      `/visits/${cafe.id}`,
      { expectedVersion: d.visit.version, name: '우리 단골 카페', location: { lat: 37.5451234, lng: 127.0561234 } },
      a.token,
    );
    assert.equal(r.visit.name, '우리 단골 카페');
    assert.equal(r.visit.address, '서울 성동구 성수동');
    assert.equal(r.visit.lat, 37.545123);
    assert.notEqual(r.visit.placeId, cafe.placeId);
    const other = await call('GET', `/visits/${cafeNextDay.id}`, undefined, a.token);
    assert.equal(other.visit.name, '성수 카페');
    assert.equal(other.visit.placeId, cafeNextDay.placeId);
    assert.equal(other.visit.version, cafeNextDay.version);
    const original = await tx((db) => one(db, "SELECT name FROM places WHERE group_id=$1 AND provider_place_id='K1'", [gid]));
    assert.equal(original.name, '성수 카페');
    // A second edit reuses this visit's own copy instead of adding rows.
    const again = await call('PATCH', `/visits/${cafe.id}`, { expectedVersion: r.visit.version, name: '단골 카페' }, a.token);
    assert.equal(again.visit.placeId, r.visit.placeId);
    // An unchanged save keeps the place and only moves the versions.
    const same = await call('PATCH', `/visits/${cafeNextDay.id}`, { expectedVersion: other.visit.version, name: '성수 카페' }, a.token);
    assert.equal(same.visit.placeId, cafeNextDay.placeId);
  });

  await t.test('duplicates on the same date are refused', async () => {
    const twin = await add('2026-11-12', { manual: { name: '쌍둥이' } });
    const d = await call('GET', `/visits/${first.id}`, undefined, a.token);
    const r = await send(
      'PATCH',
      `/visits/${first.id}`,
      { expectedVersion: d.visit.version, name: '쌍둥이', address: null, location: null },
      a.token,
    );
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'DUPLICATE_VISIT');
    await call('DELETE', `/visits/${twin.id}`, { expectedVersion: twin.version }, a.token);
  });

  await t.test('replacement keeps id, order and time; unfinished uploads block it', async () => {
    const before = await day('2026-11-12');
    const target = before.visits.find((v: any) => v.id === cafe.id);
    const timed = await call('PATCH', `/visits/${cafe.id}`, { expectedVersion: target.version, plannedTime: '14:30' }, a.token);
    const unknown = await send('PATCH', `/visits/${cafe.id}`, { expectedVersion: timed.visit.version, providerPlaceId: 'NOPE' }, a.token);
    assert.equal(unknown.data.code, 'PLACE_SEARCH_REQUIRED');
    const bytes = Buffer.from('place-edit-pending-upload'),
      sha = hash(bytes);
    const submitted = await call(
      'POST',
      `/schedules/${sid}/submissions`,
      {
        files: [
          {
            clientFileId: randomUUID(), selectionIndex: 0, name: 'a.jpg', kind: 'photo', mime: 'image/jpeg',
            declaredBytes: bytes.length, fingerprint: sha, checksum: sha, recordDate: '2026-11-12', visitId: cafe.id,
          },
        ],
      },
      b.token,
    );
    const task = submitted.tasks[0];
    assert.ok(task, JSON.stringify(submitted));
    assert.equal((await call('GET', `/visits/${cafe.id}`, undefined, a.token)).replaceable, false);
    const blocked = await send('PATCH', `/visits/${cafe.id}`, { expectedVersion: timed.visit.version, providerPlaceId: 'K2' }, a.token);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.code, 'VISIT_HAS_RECORDS');
    // Information can still be edited while files are attached.
    const renamed = await call('PATCH', `/visits/${cafe.id}`, { expectedVersion: timed.visit.version, name: '기록 있는 카페' }, a.token);
    await call('POST', `/upload-tasks/${task.id}/cancellation`, { expectedVersion: task.version }, b.token);
    assert.equal((await call('GET', `/visits/${cafe.id}`, undefined, a.token)).replaceable, true);
    const replaced = await call('PATCH', `/visits/${cafe.id}`, { expectedVersion: renamed.visit.version, providerPlaceId: 'K2' }, a.token);
    assert.equal(replaced.visit.id, cafe.id);
    assert.equal(replaced.visit.name, '서울숲');
    assert.equal(replaced.visit.plannedTime, '14:30');
    assert.equal(replaced.visit.position, target.position);
    const afterDay = await day('2026-11-12');
    assert.deepEqual(afterDay.visits.map((v: any) => v.id), before.visits.map((v: any) => v.id));
    // The same searched place cannot be put on the date twice.
    const extra = await add('2026-11-12', { providerPlaceId: 'K1' });
    const dup = await send('PATCH', `/visits/${extra.id}`, { expectedVersion: extra.version, providerPlaceId: 'K2' }, a.token);
    assert.equal(dup.data.code, 'DUPLICATE_VISIT');
  });

  await t.test('replacement and a new upload cannot both win', async () => {
    const v = await add('2026-11-13', { manual: { name: '경합 장소' } });
    const bytes = Buffer.from('place-edit-race'),
      sha = hash(bytes);
    const [replace, upload] = await Promise.all([
      send('PATCH', `/visits/${v.id}`, { expectedVersion: v.version, providerPlaceId: 'K2' }, a.token),
      send(
        'POST',
        `/schedules/${sid}/submissions`,
        {
          files: [
            {
              clientFileId: randomUUID(), selectionIndex: 0, name: 'r.jpg', kind: 'photo', mime: 'image/jpeg',
              declaredBytes: bytes.length, fingerprint: sha, checksum: sha, recordDate: '2026-11-13', visitId: v.id,
            },
          ],
        },
        b.token,
      ),
    ]);
    const accepted = upload.status === 200 && upload.data.tasks.length === 1;
    const detail = await call('GET', `/visits/${v.id}`, undefined, a.token);
    if (replace.status === 200) {
      // The replacement committed first; whatever was accepted afterwards belongs to the new place.
      assert.equal(detail.visit.name, '서울숲');
    } else {
      assert.equal(replace.data.code, 'VISIT_HAS_RECORDS');
      assert.equal(accepted, true);
      assert.equal(detail.visit.name, '경합 장소');
    }
  });

  await t.test('cancelled days and removed visits cannot be edited', async () => {
    const v = await add('2026-11-13', { manual: { name: '취소될 장소' } });
    const removed = await add('2026-11-13', { manual: { name: '뺄 장소' } });
    await call('DELETE', `/visits/${removed.id}`, { expectedVersion: removed.version }, a.token);
    assert.equal((await send('PATCH', `/visits/${removed.id}`, { expectedVersion: removed.version + 1, name: '복구' }, a.token)).status, 410);
    const s = await call('GET', `/schedules/${sid}`, undefined, a.token);
    await call('POST', `/schedules/${sid}/days/2026-11-13/cancellation`, { expectedVersion: s.schedule.version }, a.token);
    const d = await call('GET', `/visits/${v.id}`, undefined, a.token);
    assert.equal(d.editable, false);
    const r = await send('PATCH', `/visits/${v.id}`, { expectedVersion: d.visit.version, name: '취소 후 수정' }, a.token);
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'DAY_CANCELLED');
  });

  if (process.env.MEDIA_TESTS !== '1') return;
  await t.test('hidden records still block replacement', async () => {
    const v = await add('2026-11-12', { manual: { name: '숨김 기록 장소' } });
    const prefix = `fixtures/${randomUUID()}`;
    await mkdir(objects.path(prefix), { recursive: true });
    const photo = objects.path(`${prefix}/photo.jpg`);
    await tool('convert', ['-size', '320x240', 'xc:green', photo]);
    const bytes = await readFile(photo),
      sha = hash(bytes);
    const p = await call(
      'POST',
      `/schedules/${sid}/submissions`,
      {
        files: [
          {
            clientFileId: randomUUID(), selectionIndex: 0, name: 'photo.jpg', kind: 'photo', mime: 'image/jpeg',
            declaredBytes: bytes.length, fingerprint: sha, checksum: sha, recordDate: '2026-11-12', visitId: v.id,
          },
        ],
      },
      a.token,
    );
    const task = p.tasks[0];
    const chunk = await app.inject({
      method: 'PATCH',
      url: task.transport.uploadEndpoint,
      payload: bytes,
      headers: {
        Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0', 'Upload-Generation': '1', 'Upload-Checksum': `sha256 ${sha}`,
      },
    });
    assert.equal(chunk.statusCode, 204, chunk.body);
    await call('POST', `/upload-tasks/${task.id}/commit`, { actualBytes: bytes.length, checksum: sha }, a.token, 202);
    let mediaId = '';
    for (let i = 0; i < 40 && !mediaId; i++) {
      const row = await call('GET', `/upload-tasks/${task.id}`, undefined, a.token);
      if (row.state === 'complete') mediaId = row.mediaId;
      else await processOne();
    }
    assert.ok(mediaId, 'upload did not complete');
    await tx((db) => db.query("UPDATE media SET access_state='restricted',moderation_state='restricted' WHERE id=$1", [mediaId]));
    const d = await call('GET', `/visits/${v.id}`, undefined, a.token);
    assert.equal(d.replaceable, false);
    const r = await send('PATCH', `/visits/${v.id}`, { expectedVersion: d.visit.version, providerPlaceId: 'K1' }, a.token);
    assert.equal(r.data.code, 'VISIT_HAS_RECORDS');
    const edited = await call('PATCH', `/visits/${v.id}`, { expectedVersion: d.visit.version, name: '이름만 수정' }, a.token);
    assert.equal(edited.visit.name, '이름만 수정');
    const media = await tx((db) => one(db, 'SELECT visit_id FROM media WHERE id=$1', [mediaId]));
    assert.equal(media.visit_id, v.id);
  });
});
