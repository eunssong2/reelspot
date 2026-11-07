import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { tx, one } from '../core/db.js';
import { objects } from '../adapters/object-store.js';
import { validateTimeline } from '../services/vlog-model.js';
import { vlogSources } from '../services/vlogs.js';
import { renderTimeline } from './vlog-render.js';
import type { Context } from '../core/context.js';
export async function processVlog() {
 // A dead worker cannot leave a job showing progress forever.
 await tx(db=>db.query("UPDATE vlog_jobs SET state='failed',error_code='WORKER_INTERRUPTED',updated_at=now() WHERE state='rendering' AND updated_at<now()-interval '15 minutes'"));
 const job=await tx(async db=>{
  const j=await one(db,"SELECT * FROM vlog_jobs WHERE state='queued' AND expires_at>now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
  if(!j)return null;
  return one(db,"UPDATE vlog_jobs SET state='rendering',lease=$2,updated_at=now() WHERE id=$1 RETURNING *",[j.id,randomUUID()]);
 });
 if(!job)return false;
 const key=`vlogs/${job.id}/${job.lease}`,dir=objects.path(key);
 const alive=async()=>tx(async db=>!!await one(db,"SELECT 1 FROM vlog_jobs j JOIN users u ON u.id=j.user_id WHERE j.id=$1 AND j.lease=$2 AND j.state='rendering' AND j.expires_at>now() AND u.status='active'",[job.id,job.lease]));
 const context=async(db:any):Promise<Context>=>({db,actor:await one(db,'SELECT * FROM users WHERE id=$1',[job.user_id]),body:{},params:{},query:{},headers:{},opId:job.id});
 const heartbeat=setInterval(()=>{void tx(db=>db.query("UPDATE vlog_jobs SET updated_at=now() WHERE id=$1 AND lease=$2 AND state='rendering'",[job.id,job.lease])).catch(()=>{});},30000);
 try {
  const timeline=validateTimeline(job.timeline);
  const sources=await tx(async db=>vlogSources(await context(db),job.group_id,timeline));
  await renderTimeline(timeline,sources,dir,async progress=>{
   await tx(db=>db.query("UPDATE vlog_jobs SET progress=$3,updated_at=now() WHERE id=$1 AND lease=$2 AND state='rendering'",[job.id,job.lease,progress]));
  },async()=>!await alive());
  const completed=await tx(async db=>{
   await vlogSources(await context(db),job.group_id,timeline);
   return one(db,"UPDATE vlog_jobs SET state='complete',progress=1,object_key=$3,updated_at=now() WHERE id=$1 AND lease=$2 AND state='rendering' AND expires_at>now() RETURNING id",[job.id,job.lease,`${key}/result.mp4`]);
  });
  if(!completed)await objects.remove(key);
  else for(const name of await readdir(dir))if(name!=='result.mp4')await rm(`${dir}/${name}`,{force:true});
 } catch(e) {
  await objects.remove(key);
  await tx(db=>db.query("UPDATE vlog_jobs SET state='failed',error_code=$3,updated_at=now() WHERE id=$1 AND lease=$2 AND state='rendering'",[job.id,job.lease,(e as any).code ?? 'RENDER_FAILED']));
 } finally {clearInterval(heartbeat);}
 return true;
}
export async function cleanupVlogs() {
 const expired=await tx(async db=>{
  const j=await one(db,`SELECT j.* FROM vlog_jobs j JOIN users u ON u.id=j.user_id WHERE
    (j.expires_at<=now() OR j.state IN ('cancelled','failed') OR u.status IN ('deleting','deleted'))
    AND j.cleaned_at IS NULL ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`);
  if(j) {
   await objects.remove(`vlogs/${j.id}`);
   await db.query("UPDATE vlog_jobs SET state=CASE WHEN expires_at<=now() OR state NOT IN ('cancelled','failed') THEN 'expired' ELSE state END,object_key=NULL,cleaned_at=now() WHERE id=$1",[j.id]);
  }
  return j;
 });
 return !!expired;
}
