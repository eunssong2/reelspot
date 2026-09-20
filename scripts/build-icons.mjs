// assets/logo.svg 하나에서 앱 아이콘 계열을 만든다.
// 로고를 고치면 `node scripts/build-icons.mjs` 로 다시 뽑는다.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'assets/logo.svg'));

/** 로고를 캔버스 가운데에 비율대로 놓는다. padding 은 캔버스 대비 여백 비율. */
async function render({ out, size, padding, background }) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(source).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const buffer = await canvas.composite([{ input: logo, gravity: 'centre' }]).png().toBuffer();
  await writeFile(resolve(root, out), buffer);
  console.log(`${out}  ${size}x${size}`);
}

const white = { r: 255, g: 255, b: 255, alpha: 1 };

// 앱 아이콘은 흰 바탕 (iOS 는 투명을 허용하지 않는다)
await render({ out: 'assets/icon.png', size: 1024, padding: 0.14, background: white });
// 안드로이드 적응형 아이콘은 시스템이 66% 안쪽만 보여주므로 여백을 더 준다
await render({ out: 'assets/adaptive-icon.png', size: 1024, padding: 0.26 });
await render({ out: 'assets/splash-icon.png', size: 512, padding: 0.1 });
await render({ out: 'assets/favicon.png', size: 64, padding: 0.08, background: white });
