import { buildApp } from './app.js';
import { config } from '../core/config.js';
import { pool } from '../core/db.js';
const app = await buildApp({ logging: true });
await app.listen({ port: config.port, host: config.host });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
