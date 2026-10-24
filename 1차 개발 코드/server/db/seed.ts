import { fileURLToPath } from 'node:url';
import { config } from '../core/config.js';
import { pool, tx } from '../core/db.js';
import { hash } from '../core/crypto.js';
export async function seed() {
  if (config.production) throw new Error('Development documents cannot be seeded in production');
  await tx(async (db) => {
    for (const [key, body] of [
      ['terms', '개발 환경 이용약관 예시입니다. 실제 서비스 약관이 아닙니다.'],
      ['privacy', '개발 환경 개인정보 안내 예시입니다. 실제 서비스 문서가 아닙니다.'],
    ]) {
      await db.query(
        `INSERT INTO consent_documents(item_key,version,required,content_ref,content_hash,effective_at) VALUES($1,'dev-1',true,$2,$3,now()) ON CONFLICT DO NOTHING`,
        [key, `/documents/${key}`, hash(body)],
      );
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed();
  await pool.end();
}
