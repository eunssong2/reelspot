/**
 * 데모(테스트 APK)용 예시 이미지·아바타·영상 생성 스크립트.
 *
 * 실제 사진이 아니라 도형만으로 그린 "예시 일러스트"를 만든다(글자·이모지를 쓰지 않아 폰트 환경과 무관하다).
 * 결과물은 assets/demo/ 에 저장되어 앱 번들에 포함되므로 인터넷 없이도 이미지가 깨지지 않는다.
 *
 *   node scripts/build-demo-assets.mjs [ffmpeg 실행 파일 경로]
 *
 * 영상(mp4)은 ffmpeg 가 있을 때만 만든다. 이미 assets/demo/ 에 결과물이 커밋되어 있으니
 * 예시를 바꾸고 싶을 때만 다시 실행하면 된다.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'demo');
mkdirSync(out, { recursive: true });

const W = 800;
const H = 600;

// ---------- 장면(도형만) ----------

const sky = (a, b) =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;

/** t: 0~1 애니메이션 진행도(사진은 고정값 사용) */
const scenes = {
  cafe: ({ a, b, accent }, t = 0.3, v = 0) => {
    const steam = [0, 1, 2]
      .map((i) => {
        const x = 360 + i * 40;
        const rise = ((t * 3 + i * 0.33) % 1) * 90;
        return `<path d="M${x} ${300 - rise} q-14 -26 0 -52 q14 -26 0 -52" stroke="#ffffff" stroke-opacity="${0.75 - rise / 160}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      })
      .join('');
    return `${sky(a, b)}
      <rect y="${430 + v * 6}" width="${W}" height="${H}" fill="${accent}" fill-opacity=".55"/>
      <circle cx="${150 + v * 90}" cy="130" r="64" fill="#fff" fill-opacity=".55"/>
      <rect x="290" y="300" width="220" height="150" rx="30" fill="#ffffff"/>
      <path d="M510 335 h46 a40 40 0 0 1 0 80 h-46" fill="none" stroke="#ffffff" stroke-width="22"/>
      <rect x="305" y="316" width="190" height="42" rx="20" fill="${accent}"/>
      <ellipse cx="400" cy="462" rx="190" ry="26" fill="#000" fill-opacity=".12"/>
      ${steam}`;
  },
  forest: ({ a, b }, t = 0.3, v = 0) => {
    // 나무는 팔레트와 관계없이 초록 계열로 둔다.
    const accent = ['#5fae7a', '#7cb36b', '#4f9d6b'][v % 3];
    const trees = [90, 250, 430, 610, 720]
      .map((x, i) => {
        const h = 190 + ((i * 53 + v * 40) % 90);
        const sway = Math.sin((t + i * 0.2) * Math.PI * 2) * 6;
        return `<rect x="${x - 10}" y="${430 - h * 0.35}" width="20" height="${h * 0.35}" fill="#7b5b45"/>
          <circle cx="${x + sway}" cy="${430 - h * 0.5}" r="${h * 0.38}" fill="${accent}"/>
          <circle cx="${x - 36 + sway}" cy="${430 - h * 0.34}" r="${h * 0.26}" fill="${accent}" fill-opacity=".85"/>`;
      })
      .join('');
    const sx = 120 + t * 560;
    const sy = 210 - Math.sin(t * Math.PI) * 120;
    return `${sky(a, b)}
      <circle cx="${sx}" cy="${sy}" r="52" fill="#fff6c8"/>
      <rect y="430" width="${W}" height="${H}" fill="#cfe3c0"/>
      <path d="M300 ${H} Q380 520 520 430 L560 430 Q440 540 470 ${H} Z" fill="#efe3cf"/>
      ${trees}`;
  },
  food: ({ a, b, accent }, t = 0.3, v = 0) => `${sky(a, b)}
      <rect y="400" width="${W}" height="${H}" fill="#c98f63" fill-opacity=".55"/>
      <ellipse cx="400" cy="380" rx="230" ry="60" fill="#ffffff"/>
      <path d="M190 360 a210 190 0 0 0 420 0 Z" fill="#ffffff"/>
      <path d="M215 360 a185 150 0 0 0 370 0 Z" fill="${accent}"/>
      <circle cx="${330 + v * 20}" cy="350" r="26" fill="#f4d35e"/>
      <circle cx="${440 - v * 14}" cy="340" r="22" fill="#ee6c4d"/>
      <circle cx="400" cy="375" r="20" fill="#98c379"/>
      <rect x="560" y="210" width="12" height="230" rx="6" fill="#8d6e4f" transform="rotate(14 566 325)"/>
      <rect x="595" y="210" width="12" height="230" rx="6" fill="#8d6e4f" transform="rotate(20 601 325)"/>`,
  books: ({ a, b, accent }) => `${sky(a, b)}
      <rect x="120" y="140" width="560" height="340" rx="10" fill="#8d6e4f"/>
      ${[0, 1].map((r) => `<rect x="140" y="${160 + r * 160}" width="520" height="140" fill="#f3e9dc"/>`).join('')}
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${150 + i * 36}" y="${178 + (i % 3) * 8}" width="26" height="${112 - (i % 3) * 8}" fill="${i % 3 === 0 ? accent : i % 3 === 1 ? '#6c8ebf' : '#e9c46a'}"/>`).join('')}`,
  river: ({ a, b, accent }, t = 0.3) => `${sky(a, b)}
      <circle cx="400" cy="${300 + t * 20}" r="84" fill="#ffd8a8"/>
      <rect y="360" width="${W}" height="${H}" fill="${accent}"/>
      <path d="M0 420 Q200 400 400 420 T800 420" stroke="#ffffff" stroke-opacity=".5" stroke-width="6" fill="none"/>
      <path d="M0 480 Q200 460 400 480 T800 480" stroke="#ffffff" stroke-opacity=".35" stroke-width="6" fill="none"/>`,
};

const PALETTES = {
  warm: { a: '#ffe7d6', b: '#ffc9a8', accent: '#e76f51' },
  mint: { a: '#e3f4ea', b: '#bfe3cf', accent: '#52a37a' },
  dusk: { a: '#fbe3d0', b: '#f5b7a0', accent: '#8e6bbf' },
  sea: { a: '#dff0fb', b: '#b4d8f0', accent: '#3d8fb8' },
  sand: { a: '#f7efe0', b: '#ead7b5', accent: '#b8793e' },
};

const svg = (inner, w = W, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;

async function jpg(file, inner, w = W, h = H, quality = 72) {
  await sharp(Buffer.from(svg(inner, w, h))).jpeg({ quality, mozjpeg: true }).toFile(join(out, file));
}

// ---------- 사진 ----------
// 파일명 규칙: <장소>-<번호>.jpg — 앱의 src/demo/demoAssets.ts 에서 require 한다.
const photos = [
  ['cafe-1', 'cafe', 'warm', 0],
  ['cafe-2', 'cafe', 'sand', 1],
  ['cafe-3', 'cafe', 'dusk', 2],
  ['cafe-4', 'cafe', 'mint', 3],
  ['forest-1', 'forest', 'mint', 0],
  ['forest-2', 'forest', 'sea', 1],
  ['forest-3', 'forest', 'sand', 2],
  ['food-1', 'food', 'warm', 0],
  ['food-2', 'food', 'sand', 1],
  ['food-3', 'food', 'dusk', 2],
];
for (const [name, scene, pal, v] of photos) {
  await jpg(`${name}.jpg`, scenes[scene](PALETTES[pal], 0.35 + v * 0.1, v));
}

// ---------- 아바타(머리+어깨 도형) ----------
const avatars = [
  ['me', '#ff7a70'],
  ['suah', '#f4a261'],
  ['doyun', '#4d9de0'],
  ['haeun', '#7bc47f'],
  ['jiho', '#9b72cf'],
];
for (const [name, color] of avatars) {
  const inner = `<rect width="${W}" height="${H}" fill="${color}"/>
    <circle cx="400" cy="250" r="130" fill="#ffffff" fill-opacity=".92"/>
    <path d="M110 ${H} Q110 400 400 400 Q690 400 690 ${H} Z" fill="#ffffff" fill-opacity=".92"/>`;
  await sharp(Buffer.from(svg(inner, 240, 180)))
    .resize(160, 160, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(join(out, `avatar-${name}.jpg`));
}

// ---------- 영상 ----------
const ffmpeg = process.argv[2] ?? 'ffmpeg';
const videos = [
  { name: 'video-cafe', scene: 'cafe', pal: 'warm', seconds: 6 },
  { name: 'video-forest', scene: 'forest', pal: 'mint', seconds: 8 },
];
const FPS = 12;
const VW = 640;
const VH = 480;

for (const v of videos) {
  // 목록 썸네일(첫 장면)
  await jpg(`${v.name}-poster.jpg`, scenes[v.scene](PALETTES[v.pal], 0.15, 0), 640, 480);

  const dir = mkdtempSync(join(tmpdir(), 'reelspot-video-'));
  try {
    const total = v.seconds * FPS;
    for (let i = 0; i < total; i += 1) {
      const t = i / total;
      const frame = svg(scenes[v.scene](PALETTES[v.pal], t, 0), VW, VH);
      await sharp(Buffer.from(frame)).png().toFile(join(dir, `f${String(i).padStart(4, '0')}.png`));
    }
    execFileSync(
      ffmpeg,
      [
        '-y', '-loglevel', 'error',
        '-framerate', String(FPS),
        '-i', join(dir, 'f%04d.png'),
        '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
        '-crf', '30', '-movflags', '+faststart',
        join(out, `${v.name}.mp4`),
      ],
      { stdio: 'inherit' },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log('demo assets →', out);
