import { stat } from 'node:fs/promises';
import { one } from '../core/db.js';
import type { Context, Handler } from '../core/context.js';
import { demand } from '../core/errors.js';
import { text } from '../core/policy.js';
import { objects } from '../adapters/object-store.js';
import { groupAccess, fileAccess } from './access.js';
import { validateTimeline, type Timeline } from './vlog-model.js';
export async function vlogSources(c: Context, groupId: string, timeline: Timeline) {
 await groupAccess(c, groupId);
 const files: Record<string,{ path: string; kind: string }> = {};
 for(const scene of timeline.scenes) {
  if(scene.kind==='title') continue;
  for(const clip of scene.clips) {
   const m = await fileAccess(c, clip.itemId);
   demand(m.group_id===groupId && m.kind===clip.kind && m.visit_id===scene.placeKey && `${m.schedule_id}/${m.record_date}`===scene.dayKey,'VLOG_SOURCE_CHANGED',409);
   const asset = await one(c.db, "SELECT * FROM assets WHERE media_id=$1 AND state='ready' AND location_verified_absent AND variant IN ('view','sanitized_original') ORDER BY (variant='view') DESC LIMIT 1",[m.id]);
   demand(asset,'FILE_NOT_READY',409);
   if(clip.kind==='video') {
    const probe=await one(c.db,"SELECT (probe_result->>'durationMs')::int duration FROM assets WHERE media_id=$1 AND probe_result ? 'durationMs' LIMIT 1",[m.id]);
    demand(probe?.duration && (clip.startSec+clip.seconds)*1000<=probe.duration+1,'VLOG_RANGE_INVALID',400);
   }
   files[m.id]={path:objects.path(asset.object_key),kind:m.kind};
  }
 }
 return files;
}
function dto(j:any) {return {id:j.id,state:j.state,progress:j.progress,durationSec:j.duration_sec,expiresAt:j.expires_at,reason:j.error_code,contentUrl:j.state==='complete'?`/v1/vlogs/${j.id}/content`:null};}
export async function ownJob(c: Context) {
 const j=await one(c.db,'SELECT * FROM vlog_jobs WHERE id=$1',[c.params.jobId]);
 demand(j && j.user_id===c.actor.id,'NOT_FOUND',404);
 demand(new Date(j.expires_at)>new Date() && j.state!=='expired','EXPIRED',410);
 await vlogSources(c,j.group_id,validateTimeline(j.timeline));
 return j;
}
export const vlogHandlers: Record<string, Handler> = {
 vlogCreate: async(c)=>{
  const timeline=validateTimeline(c.body.timeline);
  await vlogSources(c,c.params.groupId,timeline);
  const count=await one(c.db,"SELECT count(*) n FROM vlog_jobs WHERE user_id=$1 AND state IN ('queued','rendering') AND expires_at>now()",[c.actor.id]);
  demand(count.n<2,'VLOG_BUSY',409);
  return dto(await one(c.db,'INSERT INTO vlog_jobs(user_id,group_id,title,timeline,duration_sec) VALUES($1,$2,$3,$4,$5) RETURNING *',[c.actor.id,c.params.groupId,text(c.body.title,100),JSON.stringify(timeline),timeline.totalSec]));
 },
 vlogGet: async(c)=>dto(await ownJob(c)),
 vlogCancel: async(c)=>{
  const j=await one(c.db,'SELECT * FROM vlog_jobs WHERE id=$1 FOR UPDATE',[c.params.jobId]);
  demand(j && j.user_id===c.actor.id,'NOT_FOUND',404);
  return dto(await one(c.db,"UPDATE vlog_jobs SET state='cancelled',updated_at=now() WHERE id=$1 RETURNING *",[j.id]));
 },
 vlogContent: async(c)=>{
  const j=await ownJob(c); demand(j.state==='complete' && j.object_key,'FILE_NOT_READY',409);
  const path=objects.path(j.object_key); const f=await stat(path);
  return {file:{path,bytes:f.size,mime:'video/mp4'}};
 },
};
