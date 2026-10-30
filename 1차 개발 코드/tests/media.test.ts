import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'development';
const enabled = process.env.MEDIA_TESTS === '1';
const { buildApp } = await import('../server/api/app.js');
const { pool, tx, one, rows } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const { config } = await import('../server/core/config.js');
const { objects } = await import('../server/adapters/object-store.js');
const { tool } = await import('../server/worker/media.js');
const { prepareMedia } = await import('../server/worker/media.js');
const { processOne, cleanupOne } = await import('../server/worker/jobs.js');
const app = await buildApp();
after(async () => {
  await app.close();
  await pool.end();
});
test('실제 MOV·HEIC 파일: 위치 제거·영상 전체 구간·소리·호환본', { skip: !enabled }, async () => {
  const prefix = `fixtures/${randomUUID()}`;
  await mkdir(objects.path(prefix), { recursive: true });
  const movie = objects.path(`${prefix}/input.mov`);
  await tool('ffmpeg', [
    '-nostdin',
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=320x240:r=60',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100',
    '-t',
    '1.5',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-metadata',
    'location=+37.5000+127.0000/',
    '-metadata',
    'creation_time=2026-10-24T01:00:00Z',
    movie,
  ]);
  const bytes = await readFile(movie),
    key = `quarantine/${randomUUID()}/1/0`;
  await objects.put(key, bytes);
  const t = {
    id: randomUUID(),
    kind: 'video',
    file_name: 'input.mov',
    declared_bytes: bytes.length,
    fingerprint: hash(bytes),
    chunk_manifest: [{ key, offset: 0, size: bytes.length, hash: hash(bytes) }],
    upload_generation: 1,
  };
  const result = await prepareMedia(t),
    view = result.assets.find((a) => a.variant === 'view')!;
  const probe = JSON.parse(
    await tool('ffprobe', [
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      objects.path(view.key),
    ]),
  );
  assert.ok(probe.streams.some((s: any) => s.codec_type === 'audio'));
  assert.ok(Math.abs(Number(probe.format.duration) - 1.5) < 0.25);
  const tags = JSON.parse(
    await tool('exiftool', [
      '-j',
      '-G1',
      objects.path(result.assets.find((a) => a.variant === 'sanitized_original')!.key),
    ]),
  )[0];
  assert.ok(!Object.keys(tags).some((k) => /GPS/i.test(k)));
  const heic = objects.path(`${prefix}/photo.heic`);
  await tool('convert', ['-size', '100x80', 'xc:blue', heic]);
  const image = await readFile(heic),
    imageKey = `quarantine/${randomUUID()}/1/0`;
  await objects.put(imageKey, image);
  const photo = await prepareMedia({
    ...t,
    id: randomUUID(),
    kind: 'photo',
    file_name: 'photo.heic',
    declared_bytes: image.length,
    fingerprint: hash(image),
    chunk_manifest: [{ key: imageKey, offset: 0, size: image.length, hash: hash(image) }],
  });
  assert.ok(photo.assets.some((a) => a.variant === 'view' && a.probe.mime === 'image/jpeg'));
  assert.ok(photo.assets.find((a) => a.variant === 'sanitized_original')!.bytes > 0);
});
async function call(method: string, path: string, body: any, token?: string) {
  const r = await app.inject({
    method: method as any,
    url: '/v1' + path,
    payload: body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Idempotency-Key': randomUUID(),
    },
  });
  assert.ok(r.statusCode < 300, `${path}: ${r.body}`);
  return r.json() as any;
}
async function user() {
  const credential = `dev:${randomUUID()}`,
    p = await call('POST', '/auth/attempts', { provider: 'google', deviceId: 'media-test' }),
    r = await call('POST', '/auth/exchange', { provider: 'google', credential, ...p }),
    token = r.session.accessToken,
    d = await call('GET', '/consent-documents', undefined);
  await call(
    'POST',
    '/onboarding',
    {
      displayName: '미디어 검증',
      consents: d.documents.filter((d: any) => d.kind !== 'notice').map((d: any) => ({
        documentId: d.id,
        version: d.version,
        agreed: true,
      })),
    },
    token,
  );
  return { ...r, token, credential };
}
test('실파일: GPS 제거·공개 검사·감상·한도·보존·삭제 정리', { skip: !enabled }, async (t) => {
  const a = await user(),
    b = await user(),
    g = await call(
      'POST',
      '/groups',
      {
        name: '실파일 검증',
        firstSchedule: {
          title: '사진 여행',
          startDate: '2026-10-24',
          endDate: '2026-10-26',
          timezone: 'Asia/Seoul',
        },
      },
      a.token,
    ),
    gid = g.group.id,
    sid = g.firstSchedule.id;
  const invite = await call('POST', `/groups/${gid}/invites`, {}, a.token);
  await call('POST', '/invitations/join', { tokenOrCode: invite.code }, b.token);
  const fixture = objects.path(`fixtures/${randomUUID()}.jpg`);
  await mkdir(objects.path('fixtures'), { recursive: true });
  await tool('convert', ['-size', '80x60', 'xc:#AF5245', fixture]);
  await tool('exiftool', [
    '-overwrite_original',
    '-GPSLatitude=37.5',
    '-GPSLongitude=127',
    '-GPSLatitudeRef=N',
    '-GPSLongitudeRef=E',
    '-DateTimeOriginal=2026:10:24 10:00:00',
    fixture,
  ]);
  const data = await readFile(fixture);
  async function upload(description = '') {
    const f = {
        clientFileId: randomUUID(),
        selectionIndex: 0,
        name: 'gps.jpg',
        kind: 'photo',
        mime: 'image/jpeg',
        declaredBytes: data.length,
        fingerprint: hash(data),
        checksum: hash(data),
        recordDate: '2026-10-24',
        description,
      },
      prep = await call('POST', `/schedules/${sid}/submissions`, { files: [f] }, a.token);
    assert.equal(prep.fileErrors.length, 0, JSON.stringify(prep));
    const task = prep.tasks[0];
    const r = await app.inject({
      method: 'PATCH',
      url: task.transport.uploadEndpoint,
      headers: {
        Authorization: `Bearer ${a.token}`,
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Upload-Generation': '1',
        'Upload-Checksum': `sha256 ${hash(data)}`,
      },
      payload: data,
    });
    assert.equal(r.statusCode, 204, r.body);
    const op = await call(
      'POST',
      `/upload-tasks/${task.id}/commit`,
      { checksum: hash(data), actualBytes: data.length },
      a.token,
    );
    for (let i = 0; i < 30; i++) {
      const current = await call('GET', `/upload-tasks/${task.id}`, undefined, a.token);
      if (!['verifying'].includes(current.state)) return { task: current, op };
      await processOne();
    }
    throw new Error('Worker did not settle');
  }
  let mediaId: string, taskId: string;
  await t.test('실제 JPEG 처리 후 GPS 없이 저장·촬영일 보존', async () => {
    const r = await upload();
    assert.equal(r.task.state, 'complete', JSON.stringify(r));
    mediaId = r.task.mediaId;
    taskId = r.task.id;
    const asset = await tx((db) =>
      one(db, "SELECT * FROM assets WHERE media_id=$1 AND variant='sanitized_original'", [mediaId]),
    );
    const meta = JSON.parse(
      await tool('exiftool', ['-j', '-G1', objects.path(asset.object_key)]),
    )[0];
    assert.ok(!Object.keys(meta).some((k) => /GPS/i.test(k)));
    assert.equal(meta['ExifIFD:DateTimeOriginal'], '2026:10:24 10:00:00');
    const d = await call('GET', `/schedules/${sid}`, undefined, a.token);
    assert.equal(d.retention.fixed, true);
    assert.equal(d.retention.lastDate, '2027-01-26');
  });
  await t.test('타인 공동 감상과 개인 차단이 직접 파일 GET에도 반영', async () => {
    const metadata = await app.inject({ method: 'GET', url: `/v1/media/${mediaId}?context=shared`, headers: { Authorization: `Bearer ${b.token}` } });
    assert.equal(metadata.statusCode, 200); assert.equal(metadata.json().canSave, true); assert.equal(metadata.json().canEdit, false);
    const r = await app.inject({
      method: 'GET',
      url: `/v1/media/${mediaId}/content?variant=view&context=shared`,
      headers: { Authorization: `Bearer ${b.token}` },
    });
    assert.equal(r.statusCode, 200);
    await call('POST', '/me/blocks', { targetUserId: a.user.id }, b.token);
    const blocked = await app.inject({
      method: 'GET',
      url: `/v1/media/${mediaId}/content?variant=view&context=shared`,
      headers: { Authorization: `Bearer ${b.token}` },
    });
    assert.equal(blocked.statusCode, 403);
    await call('DELETE', `/me/blocks/${a.user.id}`, {}, b.token);
  });
  await t.test('정보 수정 원자성: 타인 파일 혼입은 전체 미적용', async () => {
    const before = await tx((db) => one(db, 'SELECT * FROM media WHERE id=$1', [mediaId]));
    const r = await call(
      'POST',
      '/media/metadata-changes',
      {
        targets: [{ id: mediaId, expectedVersion: before.version }],
        fields: { description: { apply: true, value: '새 설명' } },
      },
      a.token,
    );
    assert.equal(r.state, 'succeeded');
    assert.equal(
      (await tx((db) => one(db, 'SELECT description FROM media WHERE id=$1', [mediaId])))
        .description,
      '새 설명',
    );
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/media/metadata-changes',
      headers: { Authorization: `Bearer ${b.token}`, 'Idempotency-Key': randomUUID() },
      payload: {
        targets: [{ id: mediaId, expectedVersion: before.version }],
        fields: { description: { apply: true, value: '타인 변경' } },
      },
    });
    assert.equal(bad.statusCode, 403);
  });
  await t.test('사전 export 준비 후 나가기: 본인 열람 유지·새 저장 거부', async () => {
    const e = await call('POST', '/exports', { mediaIds: [mediaId], purpose: 'save' }, b.token);
    const members = await call('GET', `/groups/${gid}/members`, undefined, b.token),
      m = members.members.find((m: any) => m.userId === b.user.id);
    await call(
      'POST',
      `/groups/${gid}/leaving`,
      { membershipId: m.id, expectedVersion: m.version },
      b.token,
    );
    const r = await app.inject({
      method: 'GET',
      url: `/v1/exports/${e.exportId}/files/${mediaId}`,
      headers: { Authorization: `Bearer ${b.token}` },
    });
    assert.equal(r.statusCode, 403);
  });
  await t.test('검사 review는 비공개·운영 승인 뒤에만 완료', async () => {
    const r = await upload('[review]');
    assert.equal(r.task.state, 'review');
    const caseRow = await tx((db) =>
      one(db, "SELECT * FROM reports_and_cases WHERE target_type='task' AND target_id=$1", [
        r.task.id,
      ]),
    );
    assert.ok(caseRow.evidence_ref.startsWith('evidence/'));
    const stored = await objects.get(caseRow.evidence_ref);
    assert.ok(!stored.includes(Buffer.from('[review]')));
    const details = await call('GET', `/ops/cases/${caseRow.id}`, undefined, config.devOpsToken);
    assert.equal(details.evidenceSnapshot.mime, 'image/jpeg');
    const proof = await app.inject({
      method: 'GET',
      url: `/v1/ops/cases/${caseRow.id}/evidence`,
      headers: { Authorization: `Bearer ${config.devOpsToken}` },
    });
    assert.equal(proof.statusCode, 200);
    assert.equal(proof.rawPayload[0], 255);
    const denied = await app.inject({
      method: 'GET',
      url: `/v1/ops/cases/${caseRow.id}/evidence`,
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(denied.statusCode, 403);
    const action = await call(
      'POST',
      `/ops/cases/${caseRow.id}/actions`,
      { action: 'release', reason: '테스트 수동 검토 통과', expectedVersion: caseRow.version },
      config.devOpsToken,
    );
    assert.equal(action.decision, 'release');
    for (let i = 0; i < 20; i++) {
      const current = await call('GET', `/upload-tasks/${r.task.id}`, undefined, a.token);
      if (current.state === 'complete') return;
      await processOne();
    }
    assert.fail('Review approval did not complete');
  });
  await t.test('운영 제한 파일은 한도를 유지하고 해제 시 초과하지 않음', async () => {
    for (let i = 0; i < 3; i++) await upload();
    const r = await call(
      'POST',
      '/reports',
      { targetType: 'media', targetId: mediaId, reason: '한도와 제한 검증' },
      a.token,
    );
    const current = await tx((db) =>
      one(db, 'SELECT * FROM reports_and_cases WHERE id=$1', [r.reportId]),
    );
    await call(
      'POST',
      `/ops/cases/${current.id}/actions`,
      { action: 'restrict', reason: '제한 상태 한도 검증', expectedVersion: current.version },
      config.devOpsToken,
    );
    const f = {
      clientFileId: randomUUID(),
      selectionIndex: 0,
      name: 'sixth.jpg',
      kind: 'photo',
      mime: 'image/jpeg',
      declaredBytes: data.length,
      fingerprint: hash(data),
      checksum: hash(data),
      recordDate: '2026-10-24',
    };
    const prepared = await call('POST', `/schedules/${sid}/submissions`, { files: [f] }, a.token);
    assert.equal(prepared.tasks.length, 0);
    assert.equal(prepared.fileErrors[0].code, 'MEDIA_LIMIT');
    await call(
      'POST',
      `/ops/cases/${current.id}/actions`,
      { action: 'release', reason: '제한 해제 검증', expectedVersion: Number(current.version) + 1 },
      config.devOpsToken,
    );
    const n = await tx((db) =>
      one(
        db,
        "SELECT count(*)::int n FROM media WHERE schedule_id=$1 AND access_state='available'",
        [sid],
      ),
    );
    assert.equal(n.n, 5);
  });
  await t.test('논리 삭제는 즉시 GET 차단·물리 정리 후 용량 반환', async () => {
    const initial = await call('GET', `/groups/${gid}/storage`, undefined, a.token);
    await call('POST', '/media/deletions', { mediaIds: [mediaId] }, a.token);
    const forbidden = await app.inject({
      method: 'GET',
      url: `/v1/media/${mediaId}/content?variant=view&context=mine`,
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(forbidden.statusCode, 410);
    for (let i = 0; i < 50; i++) {
      const m = await tx((db) => one(db, 'SELECT purged_at FROM media WHERE id=$1', [mediaId]));
      if (m.purged_at) break;
      await cleanupOne();
    }
    const after = await call('GET', `/groups/${gid}/storage`, undefined, a.token);
    assert.equal(after.completedOriginalBytes, initial.completedOriginalBytes - data.length);
  });
  await t.test('모임 종료 후 이전 작성자 파일 보존과 본인 열람·저장 권한 분리', async () => {
    const i = await call('POST', `/groups/${gid}/invites`, {}, a.token);
    const joined = await call('POST', '/invitations/join', { tokenOrCode: i.code }, b.token);
    const members = await call('GET', `/groups/${gid}/members`, undefined, a.token);
    const target = members.members.find((m: any) => m.userId === b.user.id);
    const groupNow = (await call('GET', '/groups', undefined, a.token)).items.find(
      (g: any) => g.id === gid,
    );
    await call(
      'POST',
      `/groups/${gid}/owner-transfers`,
      { targetMembershipId: target.id, expectedVersion: groupNow.version },
      a.token,
    );
    const mine = members.members.find((m: any) => m.userId === a.user.id);
    await call(
      'POST',
      `/groups/${gid}/leaving`,
      { membershipId: mine.id, expectedVersion: mine.version },
      a.token,
    );
    const last = (await call('GET', '/groups', undefined, b.token)).items.find(
      (g: any) => g.id === gid,
    );
    await call(
      'POST',
      `/groups/${gid}/closure`,
      { confirmOwnMediaDeletion: true, expectedVersion: last.version },
      b.token,
    );
    const own = await call('GET', '/me/media', undefined, a.token);
    const preserved = own.items.find((m: any) => m.media.scheduleId === sid);
    assert.ok(preserved);
    assert.equal(preserved.groupState, 'closed');
    const metadata = await app.inject({ method: 'GET', url: `/v1/media/${preserved.media.id}?context=mine`, headers: { Authorization: `Bearer ${a.token}` } });
    assert.equal(metadata.statusCode, 200); assert.equal(metadata.json().canSave, false); assert.equal(metadata.json().canEdit, false);
    const read = await app.inject({
      method: 'GET',
      url: `/v1/media/${preserved.media.id}/content?variant=view&context=mine`,
      headers: { Authorization: `Bearer ${a.token}` },
    });
    assert.equal(read.statusCode, 200);
    const save = await app.inject({
      method: 'POST',
      url: '/v1/exports',
      payload: { mediaIds: [preserved.media.id], purpose: 'save' },
      headers: { Authorization: `Bearer ${a.token}`, 'Idempotency-Key': randomUUID() },
    });
    assert.equal(save.json().results[0].state, 'failed');
  });
});
