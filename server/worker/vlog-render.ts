import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tool } from './media.js';
import type { Timeline, Scene, Clip } from '../services/vlog-model.js';
type Source = {path:string;kind:string};
export async function renderTimeline(t:Timeline, sources:Record<string,Source>, dir:string, progress:(n:number)=>Promise<void>, cancelled:()=>Promise<boolean>) {
 await mkdir(dir,{recursive:true,mode:0o700});
 const [w,h]=t.aspect==='landscape'?[1920,1080]:[1080,1920];
 const segments:{file:string;seconds:number;transition:string}[]=[];
 const run=async(args:string[])=>{
  if(await cancelled()) throw Error('CANCELLED');
  await new Promise<void>((resolve,reject)=>{
   const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','2','-filter_complex_threads','1',...args],{cwd:dir,stdio:['ignore','ignore','pipe']});
   let error='';p.stderr.on('data',(b)=>{error=(error+b.toString()).slice(-4000);});
   const timeout=setTimeout(()=>p.kill('SIGKILL'),10*60*1000);
   let checking=false;
   const interval=setInterval(async()=>{if(checking)return;checking=true;try{if(await cancelled())p.kill('SIGTERM');}catch{p.kill('SIGTERM');}finally{checking=false;}},1000);
   p.on('error',(e)=>{clearTimeout(timeout);clearInterval(interval);reject(e);});
   p.on('close',(code)=>{clearTimeout(timeout);clearInterval(interval);code===0?resolve():reject(new Error(`RENDER_FAILED: ${error}`));});
  });
 };
 function words(value:string|undefined, font:string, size:number, y:number|'center', color='white', box=true) {
  if(!value)return '';
  const columns=Math.max(1,Math.floor(w*.9/size));
  const letters=[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(value)].map(x=>x.segment);
  const lines=Array.from({length:Math.ceil(letters.length/columns)},(_,i)=>letters.slice(i*columns,(i+1)*columns).join(''));
  const top=y==='center'?(h-lines.length*size*1.25)/2:h*y;
  const family=({gothic:'NanumGothic',round:'Jua',hand:'Nanum Pen'} as Record<string,string>)[font];
  const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  // Pango/fontconfig provide Korean shaping and color-emoji fallback. User text
  // is escaped SVG text only, never markup, a URL or an FFmpeg expression.
  return lines.map((line,i)=>{
   const yy=top+i*size*1.25;
   const n=[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(line)].length;
   const boxW=Math.min(w*.94,n*size+24);
   return `${box?`<rect x="${(w-boxW)/2}" y="${yy}" width="${boxW}" height="${size*1.25}" fill="black" opacity="0.5"/>`:''}<text x="${w/2}" y="${yy+size}" text-anchor="middle" font-family="${family}, Noto Color Emoji" font-size="${size}" fill="${color}">${escape(line)}</text>`;
  }).join('');
 }
 const encoding=['-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-map_metadata','-1','-movflags','+faststart'];
 async function segment(scene:Scene, clips:Clip[], rects:number[][], seconds:number, caption:string, transition:string) {
  const index=segments.length,file=`segment-${index}.mp4`;
  const args:string[]=[];const filters:string[]=[];
  for(const c of clips) {
   if(c.kind==='photo')args.push('-loop','1','-framerate','30');
   else args.push('-ss',String(c.startSec));
   args.push('-t',String(seconds),'-i',sources[c.itemId].path);
  }
  const base=clips.length;
  args.push('-f','lavfi','-i',`color=c=${scene.kind==='title'?'0xFDEDEB':'black'}:s=${w}x${h}:r=30:d=${seconds}`,'-f','lavfi','-i',`anullsrc=r=48000:cl=stereo:d=${seconds}`);
  filters.push(`[${base}:v]setsar=1[bg0]`);
  let canvas='bg0';
  for(const [i,c] of clips.entries()) {
   const r=rects[i],cw=Math.max(2,Math.floor(r[2]*w/2)*2),ch=Math.max(2,Math.floor(r[3]*h/2)*2),x=Math.floor(r[0]*w/2)*2,y=Math.floor(r[1]*h/2)*2;
   const crop=c.frame.crop;
   const color=c.filter==='bright'?',colorchannelmixer=rr=1.3:gg=1.3:bb=1.3':c.filter==='dark'?',colorchannelmixer=rr=0.7:gg=0.7:bb=0.7':c.filter==='gray'?',hue=s=0':'';
   const cut=crop?`,crop=iw*${crop.w}:ih*${crop.h}:iw*${crop.x}:ih*${crop.y}`:'';
   const source=`[${i}:v]setpts=PTS-STARTPTS,fps=30${cut}${color}`;
   if(c.frame.fit==='contain' && c.frame.bg==='blur') {
    filters.push(`${source},split=2[b${i}][f${i}]`);
    filters.push(`[b${i}]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},boxblur=20:2[bk${i}]`);
    filters.push(`[f${i}]scale=${cw}:${ch}:force_original_aspect_ratio=decrease[fg${i}]`);
    filters.push(`[bk${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,setsar=1[v${i}]`);
   } else {
    const fit=c.frame.fit==='fill'?`scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch}`:`scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2:color=${c.frame.bg==='white'?'white':'black'}`;
    filters.push(`${source},${fit},setsar=1[v${i}]`);
   }
   filters.push(`[${canvas}][v${i}]overlay=${x}:${y}:shortest=1[bg${i+1}]`);canvas=`bg${i+1}`;
  }
  let overlay='';
  if(scene.kind==='title') overlay=words(scene.titleDate,'gothic',48,.40,'#F1706B',false)+words(scene.titleText,'gothic',56,.52,'#191F28',false);
  else {
   overlay=words([scene.dateText,scene.placeText].filter(Boolean).join(' · '),scene.fontId,32,.78);
   overlay+=words(caption,scene.fontId,48,scene.captionPosition==='top'?.1:scene.captionPosition==='center'?'center':.86);
  }
  if(overlay) {
   const svg=`${dir}/overlay-${index}.svg`,png=`${dir}/overlay-${index}.png`;
   await writeFile(svg,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${overlay}</svg>`,{mode:0o600});
   await tool('rsvg-convert',['-o',png,svg]);
   args.push('-i',png);
   filters.push(`[${canvas}][${base+2}:v]overlay=0:0,format=yuv420p[outv]`);
  } else filters.push(`[${canvas}]format=yuv420p[outv]`);
  // Input videos may be silent. Probe before selecting audio streams; preserve all available original audio.
  const audio:string[]=[];
  for(const [i,c] of clips.entries()) if(c.kind==='video') {
   const hasAudio=await new Promise<boolean>((resolve,reject)=>{const p=spawn('ffprobe',['-v','error','-select_streams','a','-show_entries','stream=index','-of','csv=p=0',sources[c.itemId].path]);let out='';p.stdout.on('data',b=>out+=b);p.on('error',reject);p.on('close',code=>code===0?resolve(!!out.trim()):reject(Error('PROBE_FAILED')));});
   if(hasAudio){filters.push(`[${i}:a]asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration=${seconds}[a${i}]`);audio.push(`[a${i}]`);}
  }
  if(audio.length)filters.push(`${audio.join('')}amix=inputs=${audio.length}:normalize=1,atrim=duration=${seconds}[outa]`);
  else filters.push(`[${base+1}:a]atrim=duration=${seconds}[outa]`);
  args.push('-filter_complex',filters.join(';'),'-map','[outv]','-map','[outa]','-t',String(seconds),...encoding,file);
  await run(args);segments.push({file,seconds,transition});
 }
 let done=0;
 for(const scene of t.scenes) {
  if(scene.kind==='title')await segment(scene,[],[],scene.seconds,'',scene.transition);
  else if(scene.mode==='split') await segment(scene,scene.clips,scene.template!.rects,scene.seconds,scene.caption,scene.transition);
  else for(const [i,c] of scene.clips.entries()) await segment(scene,[c],[[0,0,1,1]],c.seconds,c.caption,i===0?scene.transition:'none');
  done+=scene.seconds;await progress(.85*done/t.totalSec);
 }
 const args=segments.flatMap(s=>['-i',s.file]);
 const filters:string[]=[];
 segments.forEach((s,i)=>{
  // Pad the original segment, whose frame rate is known. Padding an xfade
  // output can lose its frame-rate metadata and truncate later transitions.
  const next=segments[i+1];
  const pad=next && next.transition!=='none'?`,tpad=stop_mode=clone:stop_duration=${Math.min(.5,next.seconds)}`:'';
  filters.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS${pad}[v${i}]`);
  filters.push(`[${i}:a]asetpts=PTS-STARTPTS[a${i}]`);
 });
 let last='v0',elapsed=segments[0].seconds;
 for(let i=1;i<segments.length;i++) {
  const s=segments[i],next=`join${i}`;
  if(s.transition==='none')filters.push(`[${last}][v${i}]concat=n=2:v=1:a=0[${next}]`);
  else {
   const duration=Math.min(.5,s.seconds);
   filters.push(`[${last}][v${i}]xfade=transition=${s.transition==='slide'?'slideleft':s.transition==='zoom'?'zoomin':'fade'}:duration=${duration}:offset=${elapsed}[${next}]`);
  }
  elapsed+=s.seconds;last=next;
 }
 filters.push(`${segments.map((_,i)=>`[a${i}]`).join('')}concat=n=${segments.length}:v=0:a=1[audio]`);
 args.push('-filter_complex',filters.join(';'),'-map',`[${last}]`,'-map','[audio]','-t',String(t.totalSec),...encoding,'result.mp4');
 await run(args);await progress(.98);
 return `${dir}/result.mp4`;
}
