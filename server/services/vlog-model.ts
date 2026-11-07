import { demand } from '../core/errors.js';
export type Clip = { itemId: string; kind: 'photo'|'video'; startSec: number; seconds: number; caption: string; filter: string; frame: { fit: string; bg: string; crop?: {x:number;y:number;w:number;h:number} } };
export type Scene = { kind: 'title'|'place'; dayKey: string; placeKey?: string; seconds: number; mode?: string; transition: string; clips: Clip[]; template?: { rects: number[][] }; titleDate?: string; titleText?: string; caption: string; dateText?: string; placeText?: string; fontId: string; captionPosition?: string };
export type Timeline = { aspect: 'portrait'|'landscape'; scenes: Scene[]; totalSec: number; itemCount: number };
const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const string = (v: unknown, max: number, optional = false) => (optional && v === undefined) || (typeof v === 'string' && [...segmenter.segment(v)].length <= max);
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
/** Validate all render inputs before using any of them in a filter graph. URLs are never read. */
export function validateTimeline(value: unknown): Timeline {
 const t = value as Timeline;
 demand(t && ['portrait','landscape'].includes(t.aspect) && Array.isArray(t.scenes) && t.scenes.length>0 && t.scenes.length<=100, 'INVALID_VLOG');
 let total=0, count=0; const ids = new Set<string>();
 for (const s of t.scenes) {
  demand(s && ['title','place'].includes(s.kind) && finite(s.seconds,.05,180) && ['none','fade','slide','zoom'].includes(s.transition) && ['gothic','round','hand'].includes(s.fontId), 'INVALID_VLOG');
  demand(typeof s.dayKey==='string' && s.dayKey.length<=80 && Array.isArray(s.clips), 'INVALID_VLOG');
  demand(string(s.caption,40) && string(s.dateText,30,true) && string(s.placeText,100,true) && string(s.titleDate,30,true) && string(s.titleText,100,true), 'INVALID_VLOG');
  demand(s.captionPosition===undefined || ['top','center','bottom'].includes(s.captionPosition), 'INVALID_VLOG');
  if (s.kind==='title') demand(s.seconds===2 && s.clips.length===0, 'INVALID_VLOG');
  else {
   demand(uuid(s.placeKey) && ['sequence','split'].includes(s.mode ?? '') && s.clips.length>0 && s.clips.length<=10, 'INVALID_VLOG');
   if(s.mode==='split') {
    demand(s.clips.length>=2 && s.clips.length<=5 && s.template?.rects?.length===s.clips.length, 'INVALID_VLOG');
    for(const r of s.template!.rects) demand(Array.isArray(r) && r.length===4 && r.every((n)=>finite(n,0,1)) && r[2]>=.05 && r[3]>=.05 && r[0]+r[2]<=1.000001 && r[1]+r[3]<=1.000001,'INVALID_VLOG');
   }
   let duration=0;
   for(const c of s.clips) {
    demand(uuid(c.itemId) && !ids.has(c.itemId) && ['photo','video'].includes(c.kind) && finite(c.startSec,0,60) && finite(c.seconds,.05,c.kind==='photo' && s.clips.every(x=>x.kind==='photo')?10:60) && string(c.caption,40) && ['none','bright','dark','gray'].includes(c.filter),'INVALID_VLOG');
    demand(c.frame && ['fill','contain'].includes(c.frame.fit) && ['black','white','blur'].includes(c.frame.bg),'INVALID_VLOG');
    if(c.frame.crop) { const r=c.frame.crop; demand(finite(r.x,0,1)&&finite(r.y,0,1)&&finite(r.w,.05,1)&&finite(r.h,.05,1)&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001,'INVALID_VLOG'); }
    if(s.mode==='split') demand(Math.abs(c.seconds-s.seconds)<.001,'INVALID_VLOG');
    if(c.kind==='photo') demand(c.startSec===0,'INVALID_VLOG');
    duration+=c.seconds; ids.add(c.itemId); count++;
   }
   if(s.mode==='sequence') demand(Math.abs(duration-s.seconds)<.001,'INVALID_VLOG');
  }
  total+=s.seconds;
 }
 demand(count>0 && count<=50 && total<=180 && finite(t.totalSec,.05,180) && Math.abs(total-t.totalSec)<.001 && t.itemCount===count,'INVALID_VLOG');
 return t;
}
