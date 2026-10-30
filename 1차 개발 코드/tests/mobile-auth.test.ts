import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const source = await readFile(new URL('../mobile/src/lib/social.ts',import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture() {
  const storage=new Map<string,string>();
  const counts={finish:0,exchange:0,session:0};
  let reply:any;
  let opened:()=>void;
  const open=new Promise<void>((r)=>{opened=r;});
  const browser=new Promise<any>((r)=>{reply=r;});
  const state='S'.repeat(43);
  const mocks:any={
    'expo-web-browser':{openAuthSessionAsync:()=>{opened();return browser;}},
    'expo-crypto':{randomUUID,digestStringAsync:async (_:any,v:string)=>createHash('sha256').update(v).digest('hex'),CryptoDigestAlgorithm:{SHA256:'sha256'}},
    'expo-secure-store':{getItemAsync:async(k:string)=>storage.get(k)??null,setItemAsync:async(k:string,v:string)=>{storage.set(k,v);},deleteItemAsync:async(k:string)=>{storage.delete(k);}},
    './device':{installationId:async()=> 'fixture-installation'},
    './https':{requireHttps:(url:string)=>{assert.equal(new URL(url).protocol,'https:');return url;}},
    './api':{setSession:async()=>{counts.session++;},api:async(path:string,body:any)=>{
      if(path==='/auth/kakao/start')return {state,authorizationUrl:'https://kauth.kakao.com/oauth/authorize',returnUri:'atthatplace://oauth/kakao'};
      if(path==='/auth/kakao/finish'){assert.equal(body.state,state);assert.equal(body.verifier.length,64);counts.finish++;return{credential:'fixture-token',loginAttemptId:'fixture-attempt',nonce:'fixture-nonce'};}
      if(path==='/auth/exchange'){counts.exchange++;return{session:{userId:'fixture'},onboardingRequired:false};}
      throw new Error('Unexpected API '+path);
    }},
  };
  const load=()=>{
    const exports:any={};
    vm.runInNewContext(compiled,{exports,require:(key:string)=>{assert.ok(mocks[key],key);return mocks[key];},URL,Date,Map,setTimeout:(fn:any,ms:number)=>setTimeout(fn,ms).unref()});
    return exports;
  };
  return{storage,counts,state,open,reply:(url?:string)=>reply(url?{type:'success',url}:{type:'cancel'}),load};
}
test('모바일 로그인: 브라우저와 앱 복귀 화면이 동시에 끝나도 토큰 교환·세션 저장 한 번', async()=>{
  const f=fixture(),m=f.load();const warm=m.signInWithProvider('kakao');await f.open;
  const cold=m.completePendingSignIn(f.state,'kakao');
  f.reply(`atthatplace://oauth/kakao?state=${f.state}`);
  await Promise.all([warm,cold]);
  assert.deepEqual(f.counts,{finish:1,exchange:1,session:1});
  assert.equal(f.storage.has('atp.browser-login'),false);
});
test('모바일 로그인: 프로세스 재시작 후 안전 저장소의 검증값으로 가입 흐름 복구',async()=>{
  const f=fixture(),m=f.load();void m.signInWithProvider('kakao');await f.open;
  const restarted=f.load();await restarted.completePendingSignIn(f.state,'kakao');
  assert.deepEqual(f.counts,{finish:1,exchange:1,session:1});
});
test('모바일 로그인: 취소·다른 state·만료·재인증 복귀를 로그인 성공으로 처리하지 않음',async()=>{
  const f=fixture(),m=f.load();const cancelled=m.signInWithProvider('kakao');await f.open;f.reply();
  await assert.rejects(cancelled,/취소/);assert.equal(f.storage.size,0);assert.equal(f.counts.exchange,0);
  for(const pending of [
    {provider:'kakao',purpose:'signin',state:'other',expiresAt:Date.now()+1000},
    {provider:'kakao',purpose:'signin',state:f.state,expiresAt:Date.now()-1},
    {provider:'kakao',purpose:'credential',state:f.state,expiresAt:Date.now()+1000},
  ]) {
    f.storage.set('atp.browser-login',JSON.stringify({...pending,verifier:'v'.repeat(64)}));
    await assert.rejects(m.completePendingSignIn(f.state,'kakao'),/이어갈 로그인/);
  }
  assert.equal(f.counts.finish,0);assert.equal(f.counts.exchange,0);
});
