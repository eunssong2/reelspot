import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, access } from 'node:fs/promises';
process.env.AUTH_MODE='development'; process.env.MODERATION_MODE='disabled';
const enabled=process.env.RUN_INTEGRATION==='1';
const {buildApp}=await import('../server/api/app.js');
const {pool,tx,one}=await import('../server/core/db.js');
const {hash}=await import('../server/core/crypto.js');
const {objects}=await import('../server/adapters/object-store.js');
const {tool}=await import('../server/worker/media.js');
const {processOne}=await import('../server/worker/jobs.js');
const {processVlog,cleanupVlogs}=await import('../server/worker/vlogs.js');
const {rotateInvitation}=await import('../server/worker/invitations.js');
const app=await buildApp();
after(async()=>{await app.close();await pool.end();});
async function call(method:string,path:string,body?:any,token?:string,status=200) {
 const r=await app.inject({method:method as any,url:'/v1'+path,payload:body,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),'Idempotency-Key':randomUUID()}});
 assert.equal(r.statusCode,status,`${method} ${path}: ${r.body.slice(0,500)}`); return r.json();
}
async function user() {
 const a=await call('POST','/auth/attempts',{provider:'kakao',deviceId:randomUUID()});
 const u=await call('POST','/auth/exchange',{provider:'kakao',credential:`dev:${randomUUID()}`,...a});
 const docs=await call('GET','/consent-documents');
 await call('POST','/onboarding',{displayName:'추가 요구 검증',consents:docs.documents.filter((d:any)=>d.kind!=='notice').map((d:any)=>({documentId:d.id,version:d.version,agreed:true}))},u.session.accessToken);
 return {id:u.user.id,token:u.session.accessToken};
}
test('customer requests: capacity, invitation rotation, private render lifecycle and filters', {skip:!enabled,timeout:300000},async(t)=>{
 const a=await user(), b=await user();
 const create=async(name:string)=>call('POST','/groups',{name,firstSchedule:{title:'추가 요구 일정',startDate:'2026-11-06',endDate:'2026-11-06',timezone:'Asia/Seoul'}},a.token);
 const g=await create('추가 요구 모임'),gid=g.group.id,sid=g.firstSchedule.id;
 await t.test('current invite is reused concurrently, expires and rotates without revoking old valid codes',async()=>{
  const [x,y]=await Promise.all([call('POST',`/groups/${gid}/invites/current`,{},a.token),call('POST',`/groups/${gid}/invites/current`,{},a.token)]);
  assert.equal(x.id,y.id);
  const other=await call('POST',`/groups/${gid}/invites`,{},a.token);
  await tx(db=>db.query("UPDATE invitations SET issued_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",[other.id]));
  assert.equal((await call('POST',`/groups/${gid}/invites/current`,{},a.token)).id,x.id);
  await tx(db=>db.query('UPDATE invitations SET use_count=max_uses WHERE id=$1',[x.id]));
  assert.equal(await rotateInvitation(),true);
  const next=await call('POST',`/groups/${gid}/invites/current`,{},a.token);assert.notEqual(next.id,x.id);
  await call('POST','/invitations/join',{tokenOrCode:next.code},b.token);
 });
 await t.test('manual revocation pauses rotation even with expired history; explicit creation resumes it',async()=>{
  const group=await create('초대 취소 검증'),id=group.group.id;
  const first=await call('POST',`/groups/${id}/invites/current`,{},a.token);
  await tx(db=>db.query("UPDATE invitations SET expires_at=now()-interval '1 day',issued_at=now()-interval '8 days' WHERE id=$1",[first.id]));
  const current=await call('POST',`/groups/${id}/invites/current`,{},a.token);
  await call('POST',`/invites/${current.id}/revocation`,{expectedVersion:current.version},a.token);
  assert.equal((await tx(db=>one(db,'SELECT invite_rotation_paused FROM groups WHERE id=$1',[id]))).invite_rotation_paused,true);
  await rotateInvitation();
  assert.equal((await call('GET',`/groups/${id}/invites`,undefined,a.token)).invites.length,2);
  const next=await call('POST',`/groups/${id}/invites/current`,{},a.token);assert.notEqual(next.id,current.id);
  assert.equal((await tx(db=>one(db,'SELECT invite_rotation_paused FROM groups WHERE id=$1',[id]))).invite_rotation_paused,false);
  const extra=await call('POST',`/groups/${id}/invites`,{},a.token);
  await call('POST',`/invites/${extra.id}/revocation`,{expectedVersion:extra.version},a.token);
  assert.equal((await tx(db=>one(db,'SELECT invite_rotation_paused FROM groups WHERE id=$1',[id]))).invite_rotation_paused,false);
  await tx(db=>db.query('UPDATE invitations SET use_count=max_uses WHERE id=$1',[next.id]));
  await rotateInvitation();
  const list=await call('GET',`/groups/${id}/invites`,undefined,a.token);
  assert.equal(list.invites.filter((i:any)=>i.state==='active').length,1);
 });
 await t.test('15 participants including owner; 16th is refused',async()=>{
  assert.equal(g.group.capacity,15);
  const invite=await call('POST',`/groups/${gid}/invites/current`,{},a.token);
  for(let i=0;i<12;i++) {const u=await user();await call('POST','/invitations/join',{tokenOrCode:invite.code},u.token);}
  const left=await user(),right=await user();
  const results=await Promise.all([left,right].map(u=>app.inject({method:'POST',url:'/v1/invitations/join',payload:{tokenOrCode:invite.code},headers:{Authorization:`Bearer ${u.token}`,'Idempotency-Key':randomUUID()}})));
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
  assert.equal(results.find(r=>r.statusCode===409)!.json().code,'CAPACITY_FULL');
  assert.equal((await call('GET',`/groups/${gid}/members`,undefined,a.token)).members.length,15);
 });
 if(process.env.MEDIA_TESTS!=='1')return;
 const v=await call('POST',`/schedules/${sid}/visits`,{visitDate:'2026-11-06',manual:{name:'검증 장소'}},a.token);
 const prefix=`fixtures/${randomUUID()}`; await mkdir(objects.path(prefix),{recursive:true});
 const photo=objects.path(`${prefix}/photo.jpg`),video=objects.path(`${prefix}/video.mp4`);
 await tool('convert',['-size','320x240','xc:blue',photo]);
 await tool('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=red:s=320x240:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video]);
 async function upload(path:string,kind:string) {
  const bytes=await readFile(path),sha=hash(bytes);
  const p=await call('POST',`/schedules/${sid}/submissions`,{files:[{clientFileId:randomUUID(),selectionIndex:0,name:path.split('/').at(-1),kind,mime:kind==='photo'?'image/jpeg':'video/mp4',declaredBytes:bytes.length,fingerprint:sha,checksum:sha,recordDate:'2026-11-06',visitId:v.id}]},a.token);
  const task=p.tasks[0];assert.ok(task,JSON.stringify(p));
  const chunk=await app.inject({method:'PATCH',url:task.transport.uploadEndpoint,payload:bytes,headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/offset+octet-stream','Upload-Offset':'0','Upload-Generation':'1','Upload-Checksum':`sha256 ${sha}`}});assert.equal(chunk.statusCode,204,chunk.body);
  await call('POST',`/upload-tasks/${task.id}/commit`,{actualBytes:bytes.length,checksum:sha},a.token,202);
  for(let i=0;i<40;i++){const row=await call('GET',`/upload-tasks/${task.id}`,undefined,a.token);if(row.state==='complete')return row.mediaId;await processOne();}
  assert.fail('upload did not complete');
 }
 const photoId=await upload(photo,'photo'),videoId=await upload(video,'video');
 const clip=(itemId:string,kind:string)=>({itemId,kind,startSec:0,seconds:1,caption:'한글 자막',filter:kind==='photo'?'gray':'bright',frame:{fit:'contain',bg:'blur',crop:{x:0,y:0,w:1,h:1}}});
 const base={kind:'place',dayKey:`${sid}/2026-11-06`,placeKey:v.id,seconds:1,mode:'split',transition:'slide',clips:[clip(photoId,'photo'),clip(videoId,'video')],template:{rects:[[0,0,.5,1],[.5,0,.5,1]]},caption:'함께한 하루 🌼 & <친구>',fontId:'round',captionPosition:'top',dateText:'2026.11.06',placeText:'검증 장소'};
 const timeline:any={aspect:'portrait',scenes:[{kind:'title',dayKey:base.dayKey,seconds:2,transition:'none',clips:[],caption:'',fontId:'gothic',titleText:'우리의 기록',titleDate:'2026.11.06'},base],totalSec:3,itemCount:2};
 let rendered:any;
 await t.test('participant renders split video with audio and downloads real portrait MP4',async()=>{
  rendered=await call('POST',`/groups/${gid}/vlogs`,{title:'한글 영상',timeline},b.token);
  assert.equal(rendered.state,'queued');assert.equal(await processVlog(),true);
  const j=await call('GET',`/vlogs/${rendered.id}`,undefined,b.token);assert.equal(j.state,'complete',JSON.stringify(j));assert.equal(j.progress,1);
  const row=await tx(db=>one(db,'SELECT * FROM vlog_jobs WHERE id=$1',[j.id]));
  const probe=JSON.parse(await tool('ffprobe',['-v','error','-show_streams','-show_format','-of','json',objects.path(row.object_key)]));
  assert.equal(probe.streams[0].width,1080);assert.equal(probe.streams[0].height,1920);assert.ok(probe.streams.some((s:any)=>s.codec_type==='audio'));assert.ok(Math.abs(Number(probe.format.duration)-3)<.1);
  const r=await app.inject({method:'GET',url:`/v1/vlogs/${j.id}/content`,headers:{Authorization:`Bearer ${b.token}`,Range:'bytes=0-31'}});assert.equal(r.statusCode,206);assert.equal(r.rawPayload.length,32);assert.match(r.rawPayload.toString(),/ftyp/);
  await call('GET',`/vlogs/${j.id}`,undefined,a.token,404);
 });
 await t.test('blocking source author immediately denies already rendered job and content',async()=>{
  await call('POST','/me/blocks',{targetUserId:a.id},b.token);
  await call('GET',`/vlogs/${rendered.id}`,undefined,b.token,403);
  const r=await app.inject({method:'GET',url:`/v1/vlogs/${rendered.id}/content`,headers:{Authorization:`Bearer ${b.token}`}});assert.equal(r.statusCode,403);
  await call('DELETE',`/me/blocks/${a.id}`,{},b.token);
 });
 await t.test('job quota, cancel, source mismatch and video duration are enforced',async()=>{
  const x=await call('POST',`/groups/${gid}/vlogs`,{title:'큐1',timeline},a.token);
  const y=await call('POST',`/groups/${gid}/vlogs`,{title:'큐2',timeline},a.token);
  assert.equal((await call('POST',`/groups/${gid}/vlogs`,{title:'큐3',timeline},a.token,409)).code,'VLOG_BUSY');
  for(const j of [x,y])await call('POST',`/vlogs/${j.id}/cancellation`,{},a.token);
  assert.equal(await processVlog(),false);
  const wrong=structuredClone(timeline);wrong.scenes[1].placeKey=randomUUID();
  assert.equal((await call('POST',`/groups/${gid}/vlogs`,{title:'다른 장소',timeline:wrong},a.token,409)).code,'VLOG_SOURCE_CHANGED');
  const long=structuredClone(timeline);long.scenes[1].clips[1].startSec=2;
  assert.equal((await call('POST',`/groups/${gid}/vlogs`,{title:'초과',timeline:long},a.token,400)).code,'VLOG_RANGE_INVALID');
 });
 await t.test('expiry removes output; personal record group filter and expiry order keep author scope',async()=>{
  const row=await tx(db=>one(db,'SELECT * FROM vlog_jobs WHERE id=$1',[rendered.id]));
  await tx(db=>db.query("UPDATE vlog_jobs SET expires_at=now()-interval '1 second' WHERE id=$1",[rendered.id]));
  await call('GET',`/vlogs/${rendered.id}`,undefined,b.token,410);
  for(let i=0;i<10 && await cleanupVlogs();i++);
  await assert.rejects(access(objects.path(row.object_key)));
  const r=await call('GET',`/me/media?groupId=${gid}&order=expires_first`,undefined,a.token);assert.equal(r.items.length,2);assert.ok(r.groups.some((x:any)=>x.id===gid));
  const other=await create('다른 모임');assert.equal((await call('GET',`/me/media?groupId=${other.group.id}`,undefined,a.token)).items.length,0);
  assert.equal((await call('GET',`/me/media?groupId=${gid}`,undefined,b.token)).items.length,0);
 });
});
