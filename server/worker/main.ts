import { processVlog, cleanupVlogs } from './vlogs.js';
import { rotateInvitation } from './invitations.js';
import { processProviderUnlink } from '../services/provider-unlink.js';
import { setTimeout } from 'node:timers/promises';
import { pool } from '../core/db.js';
import { cleanupOne, expireMedia, processOne } from './jobs.js';
let running = true;
let rendering: Promise<unknown> | null = null;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    running = false;
  });
while (running) {
  try {
    await expireMedia();
    await cleanupVlogs();
    if (!rendering) rendering = processVlog().catch(() => {}).finally(() => { rendering = null; });
    const work = await processOne();
    await cleanupOne();
    await rotateInvitation();
    await processProviderUnlink();
    if (!work) await setTimeout(1000);
  } catch (e) {
    process.stderr.write(`worker: ${(e as Error).name}\n`);
    await setTimeout(1000);
  }
}
await rendering;
await pool.end();
