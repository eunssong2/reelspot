import { setTimeout } from 'node:timers/promises';
import { pool } from '../core/db.js';
import { cleanupOne, expireMedia, processOne } from './jobs.js';
let running = true;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    running = false;
  });
while (running) {
  try {
    await expireMedia();
    const work = await processOne();
    await cleanupOne();
    if (!work) await setTimeout(1000);
  } catch (e) {
    process.stderr.write(`worker: ${(e as Error).name}\n`);
    await setTimeout(1000);
  }
}
await pool.end();
