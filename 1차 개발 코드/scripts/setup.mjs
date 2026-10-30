import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const root = new URL('../', import.meta.url);
try {
  await readFile(new URL('.env', root));
  process.stdout.write('기존 .env를 유지합니다.\n');
} catch {
  let text = await readFile(new URL('.env.example', root), 'utf8');
  for (const key of ['TOKEN_SECRET', 'DATA_SECRET', 'CURSOR_SECRET', 'DEV_OPS_TOKEN'])
    text = text.replace(
      new RegExp(`^${key}=.*$`, 'm'),
      `${key}=${randomBytes(32).toString('hex')}`,
    );
  text = text.replace('MODERATION_MODE=review', 'MODERATION_MODE=development');
  await writeFile(new URL('.env', root), text, { mode: 0o600, flag: 'wx' });
  process.stdout.write('개발 전용 .env를 생성했습니다.\n');
}
await mkdir(new URL('.data/objects', root), { recursive: true, mode: 0o700 });
