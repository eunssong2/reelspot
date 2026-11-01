import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'review';
delete process.env.MODERATION_URL;
const { buildApp } = await import('../server/api/app.js');
const { pool, tx, one } = await import('../server/core/db.js');
const { config } = await import('../server/core/config.js');
const { hash } = await import('../server/core/crypto.js');
const { localReview } = await import('../server/cli/ops-local.js');
const { publishDocuments } = await import('../server/services/documents.js');
const { processOne } = await import('../server/worker/jobs.js');
const app = await buildApp();
after(async () => { await app.close(); await pool.end(); });
const enabled = process.env.RUN_INTEGRATION === '1';
async function call(path: string, body?: any, token?: string) {
  const r = await app.inject({ method: body ? 'POST' : 'GET', url: '/v1'+path, payload: body,
    headers: { 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  assert.ok(r.statusCode < 300, r.body);
  return r.json();
}

test('문서 dry-run은 DB 접속 없이 본문·승인 검증, 해시 계산만 수행', async (t) => {
  t.mock.method(pool, 'connect', () => { throw new Error('Dry-run must not connect'); });
  const docs = await publishDocuments('deploy/documents.test.json', { dryRun: true });
  assert.deepEqual(docs.map((d) => d.version), ['test-2026-11-01','test-2026-11-01']);
  await assert.rejects(publishDocuments('deploy/documents.example.json', { dryRun: true }),
    (e: any) => e.code === 'DOCUMENT_REVIEW_REQUIRED');
});

test('수동 검토: 가입→모임 텍스트 승인→사진 증거 열람·승인·반려, 감사 기록과 중복 방지', { skip: !enabled }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'atp-local-review-'));
  try {
    const attempt = await call('/auth/attempts', { provider:'google',deviceId:randomUUID() });
    const login = await call('/auth/exchange', { provider:'google',credential:'dev:'+randomUUID(),...attempt });
    const token = login.session.accessToken;
    const docs = await call('/consent-documents');
    const onboarding = await call('/onboarding', { displayName:'수동 검토 확인',consents:docs.documents.filter((d:any)=>d.kind==='consent').map((d:any)=>({documentId:d.id,version:d.version,agreed:true})) }, token);
    assert.equal(onboarding.state,'review');
    const onboardingCase = (await localReview(['list']) as any[]).find(r=>r.target_id===onboarding.operationId);
    await localReview(['release',onboardingCase.id,String(onboardingCase.version),'테스트 표시명 확인']);
    for(let i=0;i<50;i++) { await processOne(); if((await call(`/operations/${onboarding.operationId}`,undefined,token)).state==='succeeded') break; }
    assert.equal((await call(`/operations/${onboarding.operationId}`,undefined,token)).state,'succeeded');
    // Remote operator API remains closed without OIDC; local CLI uses OS/DB privileges.
    config.opsMode = 'oidc';
    delete process.env.OPS_ISSUER; delete process.env.OPS_AUDIENCE;
    const denied = await app.inject({method:'GET',url:'/v1/ops/cases',headers:{Authorization:`Bearer ${config.devOpsToken}`}});
    assert.equal(denied.statusCode,403);
    const pending = await call('/groups', { name:'수동 검토 모임',firstSchedule:{title:'검토 일정',startDate:'2026-11-01',endDate:'2026-11-01',timezone:'Asia/Seoul'} }, token);
    assert.equal(pending.state,'review');
    const queue = await localReview(['list']) as any[];
    const c = queue.find((r)=>r.target_id===pending.operationId);
    assert.ok(c);
    const detail = await localReview(['show',c.id]);
    assert.equal(detail.evidenceSnapshot.proposedInput.name,'수동 검토 모임');
    await assert.rejects(localReview(['release',c.id,String(c.version+1),'오래된 화면']), (e:any)=>e.code==='VERSION_CONFLICT');
    await localReview(['release',c.id,String(c.version),'테스트 문구 확인']);
    await assert.rejects(localReview(['release',c.id,String(c.version),'중복']), (e:any)=>e.code==='CASE_ALREADY_DECIDED');
    for(let i=0;i<50;i++) { await processOne(); if((await call(`/operations/${pending.operationId}`,undefined,token)).state==='succeeded') break; }
    const groupOp = await call(`/operations/${pending.operationId}`,undefined,token);
    assert.equal(groupOp.state,'succeeded');
    const sid = groupOp.result.firstSchedule.id;
    const fixture = join(dir,'fixture.jpg');
    execFileSync('convert',['-size','80x60','xc:#336699',fixture]);
    const data = await readFile(fixture);
    async function upload() {
      const prepared = await call(`/schedules/${sid}/submissions`, { files:[{clientFileId:randomUUID(),selectionIndex:0,name:'fixture.jpg',kind:'photo',mime:'image/jpeg',declaredBytes:data.length,fingerprint:hash(data),checksum:hash(data),recordDate:'2026-11-01'}] },token);
      const task = prepared.tasks[0];
      const chunk = await app.inject({method:'PATCH',url:task.transport.uploadEndpoint,payload:data,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/offset+octet-stream','Upload-Offset':'0','Upload-Generation':'1','Upload-Checksum':`sha256 ${hash(data)}`}});
      assert.equal(chunk.statusCode,204,chunk.body);
      await call(`/upload-tasks/${task.id}/commit`,{checksum:hash(data),actualBytes:data.length},token);
      for(let i=0;i<50;i++) { await processOne(); if((await call(`/upload-tasks/${task.id}`,undefined,token)).state==='review') break; }
      assert.equal((await call(`/upload-tasks/${task.id}`,undefined,token)).state,'review');
      return { task, c:await tx(db=>one(db,'SELECT * FROM reports_and_cases WHERE target_id=$1',[task.id])) };
    }
    const approved = await upload();
    const file = join(dir,'evidence.jpg');
    await localReview(['evidence',approved.c.id,file]);
    assert.equal((await readFile(file))[0],255);
    await assert.rejects(localReview(['evidence',approved.c.id,file]),(e:any)=>e.code==='EEXIST');
    await localReview(['release',approved.c.id,String(approved.c.version),'합성 이미지 확인']);
    for(let i=0;i<50;i++) { await processOne(); if((await call(`/upload-tasks/${approved.task.id}`,undefined,token)).state==='complete') break; }
    assert.equal((await call(`/upload-tasks/${approved.task.id}`,undefined,token)).state,'complete');
    const rejected = await upload();
    await localReview(['reject',rejected.c.id,String(rejected.c.version),'반려 동작 검증']);
    assert.equal((await call(`/upload-tasks/${rejected.task.id}`,undefined,token)).state,'failed');
    const audits = await tx(db=>db.query('SELECT operator_id,action FROM operator_audit WHERE case_id=ANY($1::uuid[])',[[c.id,approved.c.id,rejected.c.id]]));
    assert.ok(audits.rows.every(a=>a.operator_id.startsWith('local:')));
    assert.deepEqual(new Set(audits.rows.map(a=>a.action)),new Set(['local_review_read','local_evidence_read','release','restrict']));
    assert.ok(!(await localReview(['list']) as any[]).some(r=>[c.id,approved.c.id,rejected.c.id].includes(r.id)));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
