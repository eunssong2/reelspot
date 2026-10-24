import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../core/db.js';
import { hash } from '../core/crypto.js';
export async function migrate() {
  const db = await pool.connect();
  try {
    await db.query('SELECT pg_advisory_lock(74103103)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS public.atp_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = fileURLToPath(new URL('./migrations/', import.meta.url));
    for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
      const sql = await readFile(`${dir}/${name}`, 'utf8'),
        digest = hash(sql),
        old = (await db.query('SELECT sha256 FROM public.atp_migrations WHERE name=$1', [name]))
          .rows[0];
      if (old) {
        if (old.sha256 !== digest) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      // Existing baseline has its own BEGIN/COMMIT; retain statements under one runner transaction.
      const body = sql.replace(/^BEGIN;\s*/m, '').replace(/COMMIT;\s*$/, '');
      await db.query('BEGIN');
      try {
        await db.query(body);
        await db.query('INSERT INTO public.atp_migrations(name,sha256) VALUES($1,$2)', [
          name,
          digest,
        ]);
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      }
      process.stdout.write(`Applied ${name}\n`);
    }
  } finally {
    await db.query('SELECT pg_advisory_unlock(74103103)');
    db.release();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
  await pool.end();
}
