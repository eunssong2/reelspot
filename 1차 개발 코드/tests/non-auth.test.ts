import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { businessDeadline } from '../server/core/policy.js';


process.env.AUTH_MODE = 'development';
process.env.MODERATION_MODE = 'development';
const { coordinates, distanceMeters, searchPlaces } = await import('../server/adapters/places.js');
const { buildApp } = await import('../server/api/app.js');
const { pool, tx } = await import('../server/core/db.js');
const { config } = await import('../server/core/config.js');
const { hash } = await import('../server/core/crypto.js');
const app = await buildApp();
after(async () => { await app.close(); await pool.end(); });

test('지도 좌표 검증과 검색 중심 거리: 없는 좌표·잘못된 영역을 지어내지 않음', () => {
  assert.equal(coordinates(undefined, 2), null);
  assert.deepEqual(coordinates('126.978,37.5665', 2), [126.978,37.5665]);
  for (const value of ['1,','x,37','181,37','127,91']) assert.throws(() => coordinates(value,2));
  assert.throws(() => coordinates('128,38,127,37',4));
  assert.equal(distanceMeters([127,37],[127,37]),0);
  assert.ok(distanceMeters([127,37],[127,38]) > 111000);
});
test('이의 검토 기한은 한국 날짜 기준 3영업일: 주말·설정 휴일 제외', () => {
  assert.equal(businessDeadline(new Date('2026-10-23T06:00:00Z'),3).toISOString(), '2026-10-28T06:00:00.000Z');
  assert.equal(businessDeadline(new Date('2026-10-23T06:00:00Z'),3,['2026-10-26']).toISOString(),'2026-10-29T06:00:00.000Z');
});
test('Google 장소 검색 요청·영역·필드·거리 정렬과 공급자 오류 매핑', async (t) => {
  const oldKey = process.env.GOOGLE_PLACES_API_KEY, oldProvider = process.env.PLACES_PROVIDER;
  process.env.GOOGLE_PLACES_API_KEY = 'fixture-key'; process.env.PLACES_PROVIDER = 'google';
  t.after(() => { if (oldKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = oldKey; if (oldProvider === undefined) delete process.env.PLACES_PROVIDER; else process.env.PLACES_PROVIDER = oldProvider; });
  let sent: any, headers: any;
  const mock = t.mock.method(globalThis,'fetch', async (url: any, options: any) => {
    assert.equal(String(url),'https://places.googleapis.com/v1/places:searchText');
    sent = JSON.parse(options.body); headers = options.headers;
    return new Response(JSON.stringify({ places: [
      { id:'far', displayName:{text:'먼 곳'},formattedAddress:'서울',location:{latitude:37.6,longitude:127} },
      { id:'near',displayName:{text:'가까운 곳'},formattedAddress:'서울',location:{latitude:37.5,longitude:127} },
    ] }), { status:200, headers:{'Content-Type':'application/json'} });
  });
  const result = await searchPlaces({ query:'카페',category:'cafe',center:'127,37.5',bounds:'126,37,128,38',sort:'distance' });
  assert.equal(result.provider,'google'); assert.equal(result.places[0].id,'near'); assert.equal(result.places[0].distance,0);
  assert.equal(sent.includedType,'cafe'); assert.equal(sent.rankPreference,'DISTANCE'); assert.equal(sent.languageCode,'ko');
  assert.ok(sent.locationRestriction); assert.equal(sent.locationBias,undefined); assert.equal(headers['X-Goog-Api-Key'],'fixture-key'); assert.ok(!headers['X-Goog-FieldMask'].includes('*'));
  mock.mock.mockImplementation(async () => new Response('{}',{status:429}));
  await assert.rejects(searchPlaces({query:'카페'}),(e: any) => e.code === 'PROVIDER_UNAVAILABLE');
});

const enabled = process.env.RUN_INTEGRATION === '1';
async function call(method: string, path: string, body?: any, token?: string) {
  const r = await app.inject({ method: method as any, url:'/v1'+path, headers:{ 'Idempotency-Key':randomUUID(),...(token ? { Authorization:'Bearer '+token } : {}) }, payload:body });
  return { status:r.statusCode, data:r.json() };
}
async function ok(method: string,path: string,body?: any,token?: string) { const r = await call(method,path,body,token); assert.ok(r.status < 300,`${method} ${path}: ${JSON.stringify(r)}`); return r.data; }
async function user() {
  const credential = 'dev:'+randomUUID();
  const attempt = await ok('POST','/auth/attempts',{provider:'google',deviceId:randomUUID()});
  const u = await ok('POST','/auth/exchange',{provider:'google',credential,...attempt});
  const docs = await ok('GET','/consent-documents');
  await ok('POST','/onboarding',{displayName:'누락 검증',consents:docs.documents.filter((d: any) => d.kind !== 'notice').map((d: any) => ({documentId:d.id,version:d.version,agreed:true}))},u.session.accessToken);
  return {token:u.session.accessToken,credential,id:u.session.userId};
}
async function reauth(u: any) { return (await ok('POST','/auth/reauthentication',{provider:'google',credential:u.credential,nonce:randomUUID()},u.token)).reauthProof; }

test('실제 PostgreSQL: 인증 외 누락 기능과 복구 경계', {skip:!enabled}, async (t) => {
  const a = await user(), b = await user();
  const g = await ok('POST','/groups',{name:'추가 검증',firstSchedule:{title:'3일 일정',startDate:'2026-11-01',endDate:'2026-11-03',timezone:'Asia/Seoul'}},a.token);
  const gid = g.group.id, sid = g.firstSchedule.id;
  let visitId: string, tasks: any[] = [];
  await t.test('최신 필수 동의 누락 시 새 데이터 쓰기 제한·조회와 문의 허용·재동의 후 복구', async () => {
    await tx(async (db) => { await db.query('DELETE FROM consent_events WHERE user_id=$1',[b.id]); });
    const body = {name:'재동의 검증',firstSchedule:{title:'동의 후 일정',startDate:'2026-11-01',endDate:'2026-11-01',timezone:'Asia/Seoul'}};
    assert.equal((await call('POST','/groups',body,b.token)).data.code,'CONSENT_REQUIRED');
    await ok('GET','/groups',undefined,b.token);
    await ok('POST','/inquiries',{category:'consent',reason:'동의 확인 문의'},b.token);
    const docs = await ok('GET','/consent-documents');
    await ok('PATCH','/me/consents',{items:docs.documents.filter((d: any) => d.kind !== 'notice').map((d: any) => ({documentId:d.id,version:d.version,agreed:true}))},b.token);
    assert.ok((await ok('POST','/groups',body,b.token)).group.id);
  });
  await t.test('방문 없는 날짜 계획의 생성·수정·충돌과 전체 기간 표시',async () => {
    const detail = await ok('GET',`/schedules/${sid}`,undefined,a.token);
    assert.deepEqual(detail.plan.map((d: any) => d.date),['2026-11-01','2026-11-02','2026-11-03']);
    const body = {title:'둘째 날',visits:[],expectedVersion:1};
    const plan = await ok('PUT',`/schedules/${sid}/plans/2026-11-02`,body,a.token); assert.equal(plan.version,2);
    const conflict = await call('PUT',`/schedules/${sid}/plans/2026-11-02`,{...body,title:'오래된 편집'},a.token); assert.equal(conflict.data.code,'VERSION_CONFLICT');
    assert.equal((await ok('GET',`/schedules/${sid}`,undefined,a.token)).plan[1].title,'둘째 날');
  });
  await t.test('수기 장소·중복 및 좌표 검증',async () => {
    const body = {visitDate:'2026-11-01',manual:{name:'직접 등록',address:'서울',lat:37.5,lng:127},plannedTime:'10:05'};
    const v = await ok('POST',`/schedules/${sid}/visits`,body,a.token); visitId = v.id;
    assert.equal(v.lat,37.5); assert.equal(v.plannedTime,'10:05');
    assert.equal((await call('POST',`/schedules/${sid}/visits`,body,a.token)).data.code,'DUPLICATE_VISIT');
    assert.equal((await call('POST',`/schedules/${sid}/visits`,{...body,manual:{name:'잘못된 좌표',lat:100,lng:127}},a.token)).status,400);
  });
  await t.test('지도 키 없이도 유효한 분류 검색은 이용 불가 사유를 반환하고 직접 등록 경로를 유지', async (t) => {
    const key = process.env.GOOGLE_PLACES_API_KEY, provider = process.env.PLACES_PROVIDER;
    delete process.env.GOOGLE_PLACES_API_KEY; process.env.PLACES_PROVIDER = 'google';
    t.after(() => { if (key !== undefined) process.env.GOOGLE_PLACES_API_KEY = key; if (provider === undefined) delete process.env.PLACES_PROVIDER; else process.env.PLACES_PROVIDER = provider; });
    for (const category of ['all','tourism','restaurant','cafe','lodging']) {
      const result = await ok('GET',`/places?groupId=${gid}&query=cafe&category=${category}`,undefined,a.token);
      assert.equal(result.searchContext.available,false); assert.ok(result.searchContext.message.includes('직접 등록')); assert.deepEqual(result.places,[]);
    }
  });
  await t.test('Google 검색 결과를 방문으로 선택하고 같은 날짜 중복 차단',async (t) => {
    const key = process.env.GOOGLE_PLACES_API_KEY, provider = process.env.PLACES_PROVIDER;
    process.env.GOOGLE_PLACES_API_KEY = 'fixture-key'; process.env.PLACES_PROVIDER = 'google';
    t.after(() => { if (key === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = key; if (provider === undefined) delete process.env.PLACES_PROVIDER; else process.env.PLACES_PROVIDER = provider; });
    const placeId = 'google-fixture-'+randomUUID();
    t.mock.method(globalThis,'fetch', async (_url: any, options: any) => { assert.equal(JSON.parse(options.body).includedType, 'cafe'); return new Response(JSON.stringify({ places: [{id:placeId,displayName:{text:'지도 검증 장소'},formattedAddress:'서울',location:{latitude:37.5,longitude:127}}] }),{status:200}); });
    const search = await ok('GET',`/places?groupId=${gid}&query=park&category=cafe&center=127,37.5`,undefined,a.token);
    assert.equal(search.provider,'google'); assert.equal(search.places[0].id,placeId);
    const visit = await ok('POST',`/schedules/${sid}/visits`,{visitDate:'2026-11-03',providerPlaceId:placeId},a.token);
    assert.equal(visit.name,'지도 검증 장소');
    const again = await call('POST',`/schedules/${sid}/visits`,{visitDate:'2026-11-03',providerPlaceId:placeId},a.token); assert.equal(again.data.code,'DUPLICATE_VISIT');
    const otherDate = await ok('POST',`/schedules/${sid}/visits`,{visitDate:'2026-11-02',providerPlaceId:placeId},a.token); assert.notEqual(otherDate.id,visit.id);
  });
  await t.test('남은 업로드 개수: 예약·취소·다른 날짜·권한 반영',async () => {
    const initial = await ok('GET',`/schedules/${sid}/upload-limits?recordDate=2026-11-01&visitId=${visitId}`,undefined,a.token);
    assert.equal(initial.photos,5); assert.equal(initial.videos,2);
    const files = Array.from({length:5},(_,i) => ({clientFileId:randomUUID(),selectionIndex:i,name:'fixture.jpg',mime:'image/jpeg',kind:'photo',declaredBytes:10,fingerprint:hash('fixture'+i),checksum:hash('fixture'+i),recordDate:'2026-11-01',visitId,description:''}));
    const r = await ok('POST',`/schedules/${sid}/submissions`,{files},a.token); tasks = r.tasks; assert.equal(tasks.length,5);
    assert.equal((await ok('GET',`/schedules/${sid}/upload-limits?recordDate=2026-11-01&visitId=${visitId}`,undefined,a.token)).photos,0);
    await ok('POST',`/upload-tasks/${tasks[0].id}/cancellation`,{expectedVersion:tasks[0].version},a.token);
    assert.equal((await ok('GET',`/schedules/${sid}/upload-limits?recordDate=2026-11-01&visitId=${visitId}`,undefined,a.token)).photos,1);
    assert.equal((await ok('GET',`/schedules/${sid}/upload-limits?recordDate=2026-11-02`,undefined,a.token)).photos,5);
    assert.equal((await call('GET',`/schedules/${sid}/upload-limits?recordDate=2026-11-01`,undefined,b.token)).status,403);
  });
  await t.test('묶음 전송 조회: 본인만, 최대 120개, 서버 상태 복원',async () => {
    const query = tasks.map((u) => u.id).join(',');
    const list = await ok('GET',`/me/upload-tasks?ids=${query}`,undefined,a.token); assert.equal(list.tasks.length,5); assert.equal(list.tasks.find((x: any) => x.id === tasks[0].id).state,'cancelled');
    assert.equal((await ok('GET',`/me/upload-tasks?ids=${query}`,undefined,b.token)).tasks.length,0);
    assert.equal((await call('GET',`/me/upload-tasks?ids=${Array.from({length:121},() => randomUUID()).join(',')}`,undefined,a.token)).status,400);
  });
  await t.test('문의 유형·관련 번호·3영업일 기한·운영 답변 조회',async () => {
    const r = await ok('POST','/inquiries',{category:'report',reason:'기존 운영 결과에 이의',referenceId:'request-fixture-123'},a.token);
    const reports = await ok('GET','/me/reports',undefined,a.token), row = reports.reports.find((x: any) => x.id === r.inquiryId);
    assert.equal(row.referenceId,'request-fixture-123'); assert.equal(row.type,'appeal'); assert.ok(Date.parse(row.reviewDueAt)-Date.now() > 2*86400000);
    await ok('POST',`/ops/cases/${r.inquiryId}/actions`,{action:'no_action',reason:'답변 검증 완료',expectedVersion:1},config.devOpsToken);
    const updated = (await ok('GET','/me/reports',undefined,a.token)).reports.find((x: any) => x.id === r.inquiryId); assert.equal(updated.decisionReason,'답변 검증 완료');
    assert.ok(!(await ok('GET','/me/reports',undefined,b.token)).reports.some((x: any) => x.id === r.inquiryId));
  });
  await t.test('방장 부재: 후보 동의·통지·7일·이의·오래된 승인 거부',async () => {
    const invite = await ok('POST',`/groups/${gid}/invites`,{},a.token);
    await ok('POST','/invitations/join',{tokenOrCode:invite.code},b.token);
    const members = await ok('GET',`/groups/${gid}/members`,undefined,a.token), candidate = members.members.find((m: any) => m.userId === b.id);
    const request = await ok('POST',`/groups/${gid}/recovery-requests`,{candidateMembershipId:candidate.id,reason:'장기 부재 확인',evidenceRefs:[],reauthProof:await reauth(b)},b.token);
    const candidateView = await ok('GET',`/recovery-requests/${request.requestId}`,undefined,b.token);
    const ownerView = await ok('GET',`/recovery-requests/${request.requestId}`,undefined,a.token);
    assert.equal(candidateView.canConsent,true); assert.equal(ownerView.canConsent,false); assert.equal(ownerView.canRespond,false);
    await ok('POST',`/recovery-requests/${request.requestId}/candidate-consent`,{agreed:true,reauthProof:await reauth(b)},b.token);
    await ok('POST',`/ops/recovery-requests/${request.requestId}/notice`,{},config.devOpsToken);
    const notice = await ok('GET','/me/notifications',undefined,a.token); assert.ok(notice.notifications.some((n: any) => n.kind === 'recovery_owner_notice' && n.referenceId === request.requestId));
    const version = (await ok('GET','/groups',undefined,a.token)).items.find((x: any) => x.id === gid).version;
    const body = {decision:'approve',reason:'검증 근거 확인',expectedGroupVersion:version,evidenceChecklist:{requesterVerified:true,candidateAgreed:true,ownerNotified:true,waitCompleted:true,disputeResolved:true}};
    assert.equal((await call('POST',`/ops/recovery-requests/${request.requestId}/decision`,body,config.devOpsToken)).data.code,'WAIT_PERIOD_REQUIRED');
    await tx(async (db) => { await db.query("UPDATE recovery_requests SET notified_at=now()-interval '8 days',response_due_at=now()-interval '1 day' WHERE id=$1",[request.requestId]); });
    await ok('POST',`/recovery-requests/${request.requestId}/owner-response`,{response:'object',reason:'이의 확인 필요'},a.token);
    assert.equal((await call('POST',`/ops/recovery-requests/${request.requestId}/decision`,body,config.devOpsToken)).data.code,'DISPUTED');
    await ok('POST',`/recovery-requests/${request.requestId}/owner-response`,{response:'agree',reason:'이의 해소'},a.token);
    const decision = await ok('POST',`/ops/recovery-requests/${request.requestId}/decision`,body,config.devOpsToken); assert.equal(decision.decision,'applied');
    assert.equal((await call('POST',`/ops/recovery-requests/${request.requestId}/decision`,body,config.devOpsToken)).data.code,'VERSION_CONFLICT');
  });
  await t.test('정리 실패·24시간 초과 운영 지표 조회',async () => {
    const ops = await ok('GET','/ops/cases',undefined,config.devOpsToken); assert.equal(typeof ops.maintenance.pending,'number'); assert.equal(typeof ops.maintenance.failed,'number'); assert.equal(typeof ops.maintenance.overdue,'number');
  });
  for (const task of tasks.slice(1)) { const current = await ok('GET',`/upload-tasks/${task.id}`,undefined,a.token); await ok('POST',`/upload-tasks/${task.id}/cancellation`,{expectedVersion:current.version},a.token); }
});
