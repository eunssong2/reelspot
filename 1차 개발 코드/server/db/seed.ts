import { fileURLToPath } from 'node:url';
import { config } from '../core/config.js';
import { pool, tx } from '../core/db.js';
import { developmentBodies } from '../services/documents.js';
import { hash } from '../core/crypto.js';
export async function seed() {
  if (config.production) throw new Error('Development documents cannot be seeded in production');
  await tx(async (db) => {
    for (const [key, body] of Object.entries(developmentBodies)) {
      await db.query(
        `INSERT INTO consent_documents(item_key,version,required,content_ref,content_hash,effective_at,kind,title,body) VALUES($1,'dev-1',$4,$2,$3,now(),$5,$6,$7) ON CONFLICT DO NOTHING`,
        [key, `/documents/${key}?version=dev-1`, hash(body), key === 'terms', key === 'terms' ? 'consent' : 'notice', key === 'terms' ? '서비스 이용약관' : '개인정보 처리방침', body],
      );
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed();
  await pool.end();
}
