import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderTimeline } from '../server/worker/vlog-render.js';
import { validateTimeline } from '../server/services/vlog-model.js';
import { tool } from '../server/worker/media.js';

test('chained transitions retain the full video and audio, fonts, emoji and crop in both orientations', {skip:process.env.MEDIA_TESTS!=='1',timeout:120000}, async(t)=>{
  const dir=await mkdtemp(join(tmpdir(),'vlog-render-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const photo=join(dir,'photo.jpg'), video=join(dir,'video.mp4');
  await tool('convert',['-size','160x120','xc:blue',photo]);
  await tool('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=red:s=160x120:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video]);
  const sources:Record<string,{path:string;kind:string}>={},scenes:any[]=[];
  for(const [i,transition] of ['none','fade','slide','zoom'].entries()){
    const id=randomUUID(),kind=i%2?'video':'photo';sources[id]={path:kind==='photo'?photo:video,kind};
    scenes.push({kind:'place',dayKey:'s/2026-11-06',placeKey:randomUUID(),seconds:1,mode:'sequence',transition,
      clips:[{itemId:id,kind,startSec:0,seconds:1,caption:'우리의 하루 🌼 <친구> & 가족',filter:['none','bright','gray','dark'][i],frame:{fit:i===3?'fill':'contain',bg:['black','white','blur','black'][i],crop:i===2?{x:.1,y:.1,w:.8,h:.8}:undefined}}],
      caption:'',fontId:['gothic','round','hand','gothic'][i],captionPosition:['top','center','bottom','top'][i]});
  }
  for(const aspect of ['portrait','landscape'] as const){
    const timeline=validateTimeline({aspect,scenes,itemCount:4,totalSec:4});
    const output=await renderTimeline(timeline,sources,join(dir,aspect),async()=>{},async()=>false);
    const probe=JSON.parse(await tool('ffprobe',['-v','error','-show_streams','-of','json',output]));
    const v=probe.streams.find((s:any)=>s.codec_type==='video'),a=probe.streams.find((s:any)=>s.codec_type==='audio');
    assert.equal(v.width,aspect==='portrait'?1080:1920);assert.equal(v.r_frame_rate,'30/1');
    // Container duration alone can hide a truncated video track behind a longer audio track.
    assert.ok(Math.abs(Number(v.duration)-4)<.05,JSON.stringify(v));
    assert.ok(Math.abs(Number(a.duration)-4)<.05,JSON.stringify(a));
    const last=join(dir,`${aspect}-last.png`);
    await tool('ffmpeg',['-v','error','-y','-ss','3.8','-i',output,'-frames:v','1',last]);
    assert.ok((await stat(last)).size>100);
  }
  const long=validateTimeline({aspect:'portrait',scenes:[{...scenes[0],seconds:10,clips:[{...scenes[0].clips[0],seconds:10}]}],itemCount:1,totalSec:10});
  const started=Date.now();
  await assert.rejects(renderTimeline(long,sources,join(dir,'cancelled'),async()=>{},async()=>Date.now()-started>50));
  assert.ok(Date.now()-started<10000,'cancellation must terminate active encoding');
});
