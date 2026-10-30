import { one, tx } from '../core/db.js';
import type { Context } from '../core/context.js';
import { decrypt, encrypt } from '../core/crypto.js';
export async function rememberKakaoCredential(c: Context, provider: string, subject: string, credential: string) {
  if (provider !== 'kakao' || credential.startsWith('dev:')) return;
  // Called only after verifyIdentity validated the application and subject.
  await c.db.query(`INSERT INTO provider_credentials(identity_id,credential_encrypted,expires_at)
    SELECT id,$3,now()+interval '2 hours' FROM identities WHERE provider='kakao' AND provider_subject=$1 AND user_id=$2
    ON CONFLICT(identity_id) DO UPDATE SET credential_encrypted=EXCLUDED.credential_encrypted,expires_at=EXCLUDED.expires_at`,
    [subject,c.actor.id,encrypt(credential)]);
}
export async function queueKakaoUnlink(c: Context, identity: any) {
  if (identity.provider !== 'kakao' || !/^\d+$/.test(identity.provider_subject)) return false;
  const saved=await one(c.db,'SELECT credential_encrypted FROM provider_credentials WHERE identity_id=$1 AND expires_at>now()',[identity.id]);
  await c.db.query(`INSERT INTO provider_unlink_jobs(identity_id,payload_encrypted,state,error_code)
    VALUES($1,$2,$3,$4) ON CONFLICT(identity_id) DO NOTHING`,[
      identity.id,
      saved ? encrypt({subject:identity.provider_subject,credential:decrypt(saved.credential_encrypted)}) : null,
      saved ? 'pending' : 'attention',saved ? null : 'PROVIDER_CREDENTIAL_UNAVAILABLE',
    ]);
  return true;
}
export async function processProviderUnlink() {
  return tx(async(db)=>{
    await db.query('DELETE FROM provider_credentials WHERE expires_at<=now()');
    await db.query("UPDATE provider_unlink_jobs SET payload_encrypted=NULL,state='attention',error_code='PROVIDER_UNLINK_EXPIRED' WHERE state='pending' AND expires_at<=now()");
    const job=await one(db,"SELECT * FROM provider_unlink_jobs WHERE state='pending' AND due_at<=now() ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if(!job)return false;
    const payload=decrypt<{subject:string;credential:string}>(job.payload_encrypted);
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`kakao:${payload.subject}`]);
    if(await one(db,"SELECT 1 FROM identities WHERE provider='kakao' AND provider_subject=$1",[payload.subject])) {
      await db.query("UPDATE provider_unlink_jobs SET state='superseded',payload_encrypted=NULL,finished_at=now() WHERE id=$1",[job.id]);
      return true; // A newer connection must not be revoked by an old deletion job.
    }
    let code='PROVIDER_UNLINK_RETRY';
    try {
      const r=await fetch('https://kapi.kakao.com/v1/user/unlink',{method:'POST',headers:{Authorization:`Bearer ${payload.credential}`},signal:AbortSignal.timeout(10000)});
      const result=await r.json() as any;
      if(r.ok && String(result.id)===payload.subject) {
        await db.query("UPDATE provider_unlink_jobs SET state='complete',payload_encrypted=NULL,error_code=NULL,attempts=attempts+1,finished_at=now() WHERE id=$1",[job.id]);
        return true;
      }
      // Invalid tokens may also mean the prior response was lost; never claim success without evidence.
      if(r.status>=400 && r.status<500 && r.status!==429) code='PROVIDER_UNLINK_ATTENTION';
    }catch { /* Temporary network failure: retry without retaining tokens in logs. */ }
    await db.query(`UPDATE provider_unlink_jobs SET state=$2,error_code=$3,attempts=attempts+1,due_at=now()+interval '1 minute',
      payload_encrypted=CASE WHEN $2='attention' THEN NULL ELSE payload_encrypted END WHERE id=$1`,
      [job.id,code==='PROVIDER_UNLINK_ATTENTION'?'attention':'pending',code]);
    return true;
  });
}
