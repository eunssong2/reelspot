import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.env.AUTH_MODE='development';process.env.MODERATION_MODE='development';
process.env.KAKAO_APP_ID='123456';
const {buildApp}=await import('../server/api/app.js');
const {pool,tx}=await import('../server/core/db.js');
const {processProviderUnlink}=await import('../server/services/provider-unlink.js');
const {encrypt}=await import('../server/core/crypto.js');
const app=await buildApp();const enabled=process.env.RUN_INTEGRATION==='1';
after(async()=>{await app.close();await pool.end();});
async function call(method:any,path:string,body?:any,token?:string){
 const r=await app.inject({method,url:'/v1'+path,payload:body,headers:{'Idempotency-Key':randomUUID(),...(token?{Authorization:'Bearer '+token}:{})}});
 assert.ok(r.statusCode<300,r.body);return r.json();
}
test('카카오 탈퇴: 실제 사용자 검증 후 연결 해제 예약·일시 실패 재시도·성공 시 토큰 제거', {skip:!enabled},async(t)=>{
 const subject=String(Date.now());let unlinkCalls=0;
 t.mock.method(globalThis,'fetch',async(url:any,opts:any)=>{
  const path=new URL(url).pathname;
  if(path.endsWith('access_token_info'))return new Response(JSON.stringify({app_id:123456,id:Number(subject)}));
  if(path.endsWith('/me'))return new Response(JSON.stringify({id:Number(subject)}));
  assert.equal(path,'/v1/user/unlink');assert.equal(opts.headers.Authorization,'Bearer fixture-access');unlinkCalls++;
  return unlinkCalls===1?new Response('{}',{status:503}):new Response(JSON.stringify({id:Number(subject)}));
 });
 const attempt=await call('POST','/auth/attempts',{provider:'kakao',deviceId:randomUUID()});
 const login=await call('POST','/auth/exchange',{provider:'kakao',credential:'fixture-access',...attempt});
 const token=login.session.accessToken;
 const docs=await call('GET','/consent-documents');
 await call('POST','/onboarding',{displayName:'탈퇴 검증',consents:docs.documents.filter((d:any)=>d.kind==='consent').map((d:any)=>({documentId:d.id,version:d.version,agreed:true}))},token);
 const identities=await call('GET','/me/identities',undefined,token);const identityId=identities.identities[0].id;
 const proof=await call('POST','/auth/reauthentication',{provider:'kakao',credential:'fixture-access',nonce:randomUUID()},token);
 const deletion=await call('POST','/me/deletion',{reauthProof:proof.reauthProof,confirmAllOwnMediaDeletion:true},token);
 assert.equal(deletion.accessRevoked,true);assert.equal(deletion.providerUnlinkPending,true);
 const job=async()=>tx(async(db)=>(await db.query('SELECT * FROM provider_unlink_jobs WHERE identity_id=$1',[identityId])).rows[0]);
 assert.equal((await job()).state,'pending');assert.ok(!(await job()).payload_encrypted.includes('fixture-access'));
 await processProviderUnlink();assert.equal((await job()).state,'pending');assert.equal(unlinkCalls,1);
 await tx((db)=>db.query('UPDATE provider_unlink_jobs SET due_at=now() WHERE identity_id=$1',[identityId]));
 await processProviderUnlink();assert.equal((await job()).state,'complete');assert.equal((await job()).payload_encrypted,null);assert.equal(unlinkCalls,2);
});
test('이전 탈퇴 작업이 새 카카오 계정 연결을 해제하지 않음·실패를 성공으로 표시하지 않음',{skip:!enabled},async(t)=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:401});});
 const subject=String(Date.now()+1);const identityId=randomUUID();
 await tx(async(db)=>{
  const user=(await db.query("INSERT INTO users(display_name) VALUES('연결 유지') RETURNING id")).rows[0];
  await db.query("INSERT INTO identities(user_id,provider,provider_subject) VALUES($1,'kakao',$2)",[user.id,subject]);
  await db.query('INSERT INTO provider_unlink_jobs(identity_id,payload_encrypted) VALUES($1,$2)',[identityId,encrypt({subject,credential:'old'})]);
 });
 await processProviderUnlink();assert.equal(calls,0);
 const get=()=>tx(async(db)=>(await db.query('SELECT * FROM provider_unlink_jobs WHERE identity_id=$1',[identityId])).rows[0]);
 assert.equal((await get()).state,'superseded');assert.equal((await get()).payload_encrypted,null);
 await tx((db)=>db.query("UPDATE provider_unlink_jobs SET state='pending',payload_encrypted=$2,due_at=now() WHERE identity_id=$1",[identityId,encrypt({subject:'987654323',credential:'invalid'})]));
 await processProviderUnlink();assert.equal(calls,1);assert.equal((await get()).state,'attention');assert.equal((await get()).payload_encrypted,null);
});
