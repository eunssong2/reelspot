import { spawn } from 'node:child_process';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { demand } from '../core/errors.js';
import { objects } from '../adapters/object-store.js';
import { hash } from '../core/crypto.js';
export async function tool(name: string, args: string[], timeout = 120000): Promise<string> {
  if (['ffmpeg', 'ffprobe'].includes(name)) args = ['-protocol_whitelist', 'file,pipe', ...args];
  return new Promise((resolve, reject) => {
    const p = spawn(name, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        LANG: 'C.UTF-8',
        MAGICK_MEMORY_LIMIT: '256MiB',
        MAGICK_MAP_LIMIT: '512MiB',
        MAGICK_DISK_LIMIT: '1GiB',
        MAGICK_TIME_LIMIT: '60',
      },
    });
    let out = '',
      err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), timeout);
    p.stdout.on('data', (b) => {
      if (out.length < 2000000) out += b;
    });
    p.stderr.on('data', (b) => {
      if (err.length < 16000) err += b;
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out)
        : reject(new Error(`MEDIA_TOOL_${name}_${code}: ${err.slice(-1500)}`));
    });
  });
}
export type PreparedAsset = {
  variant: string;
  key: string;
  bytes: number;
  checksum: string;
  probe: Record<string, any>;
};
export async function prepareMedia(t: any): Promise<{
  assets: PreparedAsset[];
  originalPath: string;
  mime: string;
  capturedAt: string | null;
  durationMs: number | null;
}> {
  const manifest = [...t.chunk_manifest].sort((a: any, b: any) => a.offset - b.offset);
  let at = 0;
  const chunks: Buffer[] = [];
  for (const m of manifest) {
    demand(m.offset === at, 'FILE_INVALID');
    const data = await objects.get(m.key);
    demand(data.length === m.size && hash(data) === m.hash, 'FILE_INVALID');
    chunks.push(data);
    at += data.length;
  }
  const raw = Buffer.concat(chunks);
  demand(raw.length === t.declared_bytes && hash(raw) === t.fingerprint, 'FILE_INVALID');
  const prefix = `assets/${t.id}/${t.upload_generation}`,
    inputKey = `${prefix}/original.bin`;
  await objects.put(inputKey, raw);
  const input = objects.path(inputKey);
  const metadata = JSON.parse(await tool('exiftool', ['-j', '-n', '-G1', input]))[0];
  const fileType = metadata['File:MIMEType'];
  const isVideo = t.kind === 'video';
  demand(
    isVideo
      ? ['video/mp4', 'video/quicktime'].includes(fileType)
      : ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(fileType),
    'FILE_INVALID',
  );
  const capturedValue =
    metadata['EXIF:DateTimeOriginal'] ??
    metadata['ExifIFD:DateTimeOriginal'] ??
    metadata['QuickTime:CreateDate'];
  let capturedAt: string | null = null;
  if (capturedValue && /^\d{4}:\d{2}:\d{2} /.test(capturedValue)) {
    const v = capturedValue.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
    const off =
      metadata['ExifIFD:OffsetTimeOriginal'] ??
      (capturedValue === metadata['QuickTime:CreateDate'] ? '+00:00' : '+09:00');
    const d = new Date(`${v}${off}`);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) capturedAt = d.toISOString();
  }
  let durationMs: number | null = null,
    extension = 'jpg',
    mime = 'image/jpeg',
    viewExt = 'jpg',
    viewMime = 'image/jpeg';
  const assets: PreparedAsset[] = [];
  const asset = async (variant: string, key: string, mimeType: string, extension: string) => {
    const data = await readFile(objects.path(key));
    demand(data.length > 0, 'FILE_INVALID');
    assets.push({
      variant,
      key,
      bytes: data.length,
      checksum: hash(data),
      probe: { mime: mimeType, extension, capturedAt, durationMs },
    });
  };
  const sanitizedKey = `${prefix}/sanitized${isVideo ? '.mov' : extname(t.file_name) || '.img'}`,
    sanitized = objects.path(sanitizedKey);
  await objects.put(sanitizedKey, raw);
  // Remove location families while retaining capture date, orientation and audiovisual streams.
  await tool('exiftool', [
    '-overwrite_original',
    '-GPS:all=',
    '-XMP:Geotag=',
    '-XMP:GPSLatitude=',
    '-XMP:GPSLongitude=',
    '-QuickTime:GPSCoordinates=',
    '-Keys:GPSCoordinates=',
    '-UserData:GPSCoordinates=',
    '-ItemList:GPSCoordinates=',
    sanitized,
  ]);
  const check = JSON.parse(await tool('exiftool', ['-j', '-G1', '-n', sanitized]))[0];
  demand(
    !Object.entries(check).some(
      ([key, v]) => /GPS|LocationISO6709|LocationInformation/i.test(key) && v !== '' && v != null,
    ),
    'LOCATION_UNVERIFIED',
  );
  const viewKey = `${prefix}/view.${isVideo ? 'mp4' : 'jpg'}`,
    view = objects.path(viewKey),
    thumbKey = `${prefix}/thumbnail.jpg`,
    thumb = objects.path(thumbKey);
  await mkdir(dirname(view), { recursive: true });
  if (isVideo) {
    const probe = JSON.parse(
      await tool('ffprobe', [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        sanitized,
      ]),
    );
    const video = probe.streams.find((s: any) => s.codec_type === 'video'),
      audio = probe.streams.filter((s: any) => s.codec_type === 'audio');
    durationMs = Math.round(Number(probe.format.duration) * 1000);
    demand(
      video &&
        ['h264', 'hevc'].includes(video.codec_name) &&
        audio.every((a: any) => a.codec_name === 'aac') &&
        durationMs > 0 &&
        durationMs <= 60000,
      'FILE_INVALID',
    );
    const hdr = ['smpte2084', 'arib-std-b67'].includes(video.color_transfer),
      vf = `scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30${hdr ? ',zscale=t=linear:npl=100,format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709,format=yuv420p' : ',format=yuv420p'}`;
    await tool('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-threads',
      '2',
      '-i',
      sanitized,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-c:a',
      'aac',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      view,
    ]);
    await tool('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-threads',
      '2',
      '-i',
      view,
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-2',
      thumb,
    ]);
    extension = fileType === 'video/quicktime' ? 'mov' : 'mp4';
    mime = fileType;
    viewExt = 'mp4';
    viewMime = 'video/mp4';
  } else {
    const info = (await tool('identify', ['-format', '%w %h %n %m\n', sanitized]))
      .trim()
      .split(/\s+/);
    demand(Number(info[0]) * Number(info[1]) <= 100000000 && Number(info[2]) === 1, 'FILE_INVALID');
    const format = info[3]?.toUpperCase();
    extension =
      (
        { JPEG: 'jpg', PNG: 'png', HEIC: 'heic', HEIF: 'heif', WEBP: 'webp' } as Record<
          string,
          string
        >
      )[format] ?? 'img';
    mime = fileType;
    if (format === 'PNG') {
      viewExt = 'png';
      viewMime = 'image/png';
    }
    const actualViewKey = `${prefix}/view.${viewExt}`,
      actualView = objects.path(actualViewKey);
    await tool('convert', [
      `${sanitized}[0]`,
      '-auto-orient',
      '-resize',
      t.cover_group_id ? '1600x1600>' : '1920x1920>',
      '-strip',
      actualView,
    ]);
    await tool('convert', [
      `${sanitized}[0]`,
      '-auto-orient',
      '-thumbnail',
      '480x480>',
      '-strip',
      thumb,
    ]);
    if (t.cover_group_id) {
      const b = await readFile(actualView);
      demand(b.length <= 5000000, 'FILE_INVALID');
      await objects.put(sanitizedKey, b);
      mime = viewMime;
      extension = viewExt;
    }
    await asset('view', actualViewKey, viewMime, viewExt);
  }
  if (isVideo) await asset('view', viewKey, viewMime, viewExt);
  for (const a of [...assets]) {
    const tags = JSON.parse(await tool('exiftool', ['-j', '-G1', objects.path(a.key)]))[0];
    demand(!Object.keys(tags).some((k) => /GPS|LocationISO6709/i.test(k)), 'LOCATION_UNVERIFIED');
  }
  await asset('original_private', inputKey, fileType, isVideo ? 'mov' : extension);
  await asset('sanitized_original', sanitizedKey, mime, extension);
  await asset('thumbnail', thumbKey, 'image/jpeg', 'jpg');
  return { assets, originalPath: sanitized, mime: fileType, capturedAt, durationMs };
}
