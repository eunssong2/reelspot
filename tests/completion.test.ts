import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'development';
process.env.GOOGLE_CLIENT_ID = 'fixture-client';
process.env.GOOGLE_CLIENT_SECRET = 'fixture-secret';
const { buildApp } = await import('../server/api/app.js');
const { pool, tx } = await import('../server/core/db.js');
const { hash } = await import('../server/core/crypto.js');
const { publishDocuments } = await import('../server/services/documents.js');
const app = await buildApp();
const enabled = process.env.RUN_INTEGRATION === '1';
after(async () => { await app.close(); await pool.end(); });
async function call(path: string, body?: any, token?: string, method?: any) {
  return app.inject({ method: method ?? (body ? 'POST' : 'GET'), url: path,
    payload: body, headers: { 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}
async function ok(path: string, body?: any, token?: string, method?: any) {
  const r = await call(path,body,token,method); assert.ok(r.statusCode<300,r.body);return r.json();
}
test('HTTPS 초대 안내는 사용 횟수를 소비하지 않으며 임의 HTML·외부 리디렉션을 받지 않음', async () => {
  const r = await call('/invite?token='+'a'.repeat(43));
  assert.equal(r.statusCode,200); assert.match(r.body,/atthatplace:\/\/invite/);
  assert.match(r.body,/https:\/\//); assert.equal(r.headers['referrer-policy'],'no-referrer');
  assert.equal(r.headers['cache-control'],'no-store');
  assert.equal((await call('/invite?token=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).statusCode,400);
  const old = process.env.ANDROID_APP_SHA256;
  process.env.ANDROID_APP_SHA256 = Array(32).fill('AB').join(':');
  const links = await ok('/.well-known/assetlinks.json');
  assert.equal(links[0].target.package_name,'kr.atthatplace.app');
  assert.equal(links[0].target.sha256_cert_fingerprints.length,1);
  if(old===undefined) delete process.env.ANDROID_APP_SHA256; else process.env.ANDROID_APP_SHA256=old;
});
test('Google HTTPS 인가 코드 교환: 비밀키 서버 한정·nonce·취소·재사용 거부', {skip:!enabled}, async (t) => {
  const verifier = 'z'.repeat(64);
  t.mock.method(globalThis,'fetch',async (url:any, options:any) => {
    assert.equal(String(url),'https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('client_id'),'fixture-client');
    assert.equal(form.get('client_secret'),'fixture-secret');
    assert.match(form.get('redirect_uri')!,/^https:\/\//);
    return new Response(JSON.stringify({id_token:'fixture-id-token'}));
  });
  const start = await ok('/v1/auth/google/start',{verifierHash:hash(verifier),deviceId:'fixture'});
  const authorization = new URL(start.authorizationUrl);
  assert.equal(authorization.origin,'https://accounts.google.com');
  assert.equal(authorization.searchParams.get('scope'),'openid profile');
  assert.ok(authorization.searchParams.get('nonce'));
  assert.equal(authorization.searchParams.has('client_secret'),false);
  const callback = await call(`/v1/auth/google/callback?state=${start.state}&code=fixture`);
  assert.equal(callback.statusCode,302);
  assert.equal(callback.headers.location,`atthatplace://oauth/google?state=${start.state}`);
  assert.equal((await call('/v1/auth/google/finish',{state:start.state,verifier:'x'.repeat(64)})).statusCode,401);
  const finish=await ok('/v1/auth/google/finish',{state:start.state,verifier});
  assert.equal(finish.credential,'fixture-id-token');
  assert.equal(finish.nonce,authorization.searchParams.get('nonce'));
  assert.equal((await call('/v1/auth/google/finish',{state:start.state,verifier})).statusCode,401);
  const cancelled=await ok('/v1/auth/google/start',{verifierHash:hash(verifier),deviceId:'fixture'});
  await call(`/v1/auth/google/callback?state=${cancelled.state}&error=access_denied`);
  assert.equal((await call('/v1/auth/google/finish',{state:cancelled.state,verifier})).json().code,'AUTH_CANCELLED');
});
test('가입은 이용약관만 동의: 안내는 체크 대상 아님·본문 공개·문서 없는 가입 차단', {skip:!enabled}, async () => {
  const docs=await ok('/v1/consent-documents');
  const privacy=docs.documents.find((d:any)=>d.itemKey==='privacy');
  assert.equal(privacy.kind,'notice');assert.equal(privacy.required,false);
  const doc=await call('/documents/privacy?version=dev-1');assert.equal(doc.statusCode,200);
  const attempt=await ok('/v1/auth/attempts',{provider:'kakao',deviceId:randomUUID()});
  const login=await ok('/v1/auth/exchange',{provider:'kakao',credential:'dev:'+randomUUID(),...attempt});
  const token=login.session.accessToken;
  assert.equal((await call('/v1/onboarding',{displayName:'확인',consents:[]},token)).statusCode,400);
  const consent=docs.documents.filter((d:any)=>d.kind==='consent').map((d:any)=>({documentId:d.id,version:d.version,agreed:true}));
  await ok('/v1/onboarding',{displayName:'가입 확인',consents:consent},token);
  const receipts=await ok('/v1/me/consents',undefined,token);
  assert.ok(!receipts.consentReceipts.some((r:any)=>r.documentId===privacy.id));
  assert.equal((await call('/v1/me/consents',{items:[{documentId:privacy.id,version:privacy.version,agreed:true}]},token,'PATCH')).statusCode,409);
  // Same-day timestamps must never silently select an arbitrary document.
});
test('게시 문서: 미완성 자리 거부·동일 버전 불변·이전 본문 열람·HTML 무해화', {skip:!enabled}, async () => {
  const dir=await mkdtemp(join(tmpdir(),'atp-docs-'));
  const itemKey='fixture-'+randomUUID();
  const d={itemKey,version:'v1',kind:'notice',title:'검증 문서',required:false,file:'body.md',effectiveAt:'2026-01-01T00:00:00+09:00'};
  const manifest=join(dir,'manifest.json');
  try {
    await writeFile(manifest,JSON.stringify({approvedForPublication:true,documents:[d]}));
    await writeFile(join(dir,'body.md'),'문서의 운영자 정보 {{운영자명}} 를 확정한 다음 공개합니다.');
    await assert.rejects(publishDocuments(manifest),(e:any)=>e.code==='DOCUMENT_PLACEHOLDERS_REMAIN');
    const body='공개 전 검증 문서입니다. <script>alert("test")</script> 본문은 실행되지 않습니다.';
    await writeFile(join(dir,'body.md'),body);
    await publishDocuments(manifest);await publishDocuments(manifest);
    const response=await call(`/documents/${itemKey}?version=v1`);
    assert.equal(response.statusCode,200);assert.ok(!response.body.includes('<script>'));assert.match(response.body,/&lt;script&gt;/);
    await writeFile(join(dir,'body.md'),body+' 변경');
    await assert.rejects(publishDocuments(manifest),(e:any)=>e.code==='DOCUMENT_VERSION_IMMUTABLE');
  } finally {
    await tx((db)=>db.query('DELETE FROM consent_documents WHERE item_key=$1',[itemKey]));
    await rm(dir,{recursive:true,force:true});
  }
});

test('가입 문서가 없는 환경에서는 빈 동의 배열로 가입할 수 없음',async()=>{
  const { authHandlers }=await import('../server/services/auth.js');
  await assert.rejects(authHandlers.onboard({db:{query:async()=>({rows:[]})},actor:{status:'onboarding'},body:{consents:[],displayName:'확인'}} as any),(e:any)=>e.code==='DOCUMENT_UNAVAILABLE');
});
test('운영 모드에서는 개발 문서를 숨기고 게시한 이용약관 동의만으로 모임 생성 가능',{skip:!enabled},async(t)=>{
  const {config}=await import('../server/core/config.js');
  const previous={production:config.production,authMode:config.authMode,moderationMode:config.moderationMode,url:process.env.MODERATION_URL};
  const key='release-'+randomUUID();const dir=await mkdtemp(join(tmpdir(),'atp-release-doc-'));
  const attempt=await ok('/v1/auth/attempts',{provider:'kakao',deviceId:randomUUID()});
  const login=await ok('/v1/auth/exchange',{provider:'kakao',credential:'dev:'+randomUUID(),...attempt});
  try {
    await writeFile(join(dir,'body.md'),'게시한 이용약관 본문입니다. 버전과 동의 시각을 기록하고 이전 본문도 동일하게 보존합니다.');
    await writeFile(join(dir,'manifest.json'),JSON.stringify({approvedForPublication:true,documents:[{itemKey:key,version:'v1',kind:'consent',title:'검증 이용약관',required:true,file:'body.md',effectiveAt:'2026-01-01T00:00:00Z'}]}));
    await publishDocuments(join(dir,'manifest.json'));
    config.production=true;config.authMode='provider';config.moderationMode='provider';process.env.MODERATION_URL='https://moderation.invalid/check';
    t.mock.method(globalThis,'fetch',async(url:any)=>{assert.equal(String(url),process.env.MODERATION_URL);return new Response(JSON.stringify({verdict:'passed'}));});
    const docs=await ok('/v1/consent-documents');assert.ok(docs.documents.every((d:any)=>!d.development));
    assert.equal((await call('/documents/terms?version=dev-1')).statusCode,503);
    await ok('/v1/onboarding',{displayName:'운영 동의 검증',consents:docs.documents.filter((d:any)=>d.kind==='consent').map((d:any)=>({documentId:d.id,version:d.version,agreed:true}))},login.session.accessToken);
    const group=await ok('/v1/groups',{name:'운영 문서 검증',firstSchedule:{title:'검증',startDate:'2026-10-30',endDate:'2026-10-30',timezone:'Asia/Seoul'}},login.session.accessToken);
    assert.ok(group.group.id);
  } finally {
    config.production=previous.production;config.authMode=previous.authMode;config.moderationMode=previous.moderationMode;
    if(previous.url===undefined)delete process.env.MODERATION_URL;else process.env.MODERATION_URL=previous.url;
    await tx(async(db)=>{await db.query('DELETE FROM consent_events WHERE document_id IN (SELECT id FROM consent_documents WHERE item_key=$1)',[key]);await db.query('DELETE FROM consent_documents WHERE item_key=$1',[key]);});
    await rm(dir,{recursive:true,force:true});
  }
});
