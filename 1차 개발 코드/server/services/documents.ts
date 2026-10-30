import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { one, rows, tx } from '../core/db.js';
import { config } from '../core/config.js';
import { demand } from '../core/errors.js';
import { hash } from '../core/crypto.js';
import { escapeHtml, page, publicPageHeaders } from '../api/public-pages.js';
export const developmentBodies: Record<string, string> = {
  terms: '개발 환경 이용약관 예시입니다. 실제 서비스 약관이 아닙니다.',
  privacy: '개발 환경 개인정보 안내 예시입니다. 실제 서비스 문서가 아닙니다.',
};
export async function latestDocuments(db: any) {
  return rows(db, `SELECT DISTINCT ON(item_key) * FROM consent_documents WHERE effective_at<=now()
    AND ($1=false OR version NOT LIKE 'dev-%') ORDER BY item_key,effective_at DESC,created_at DESC`, [config.production]);
}
export function registerDocuments(app: FastifyInstance) {
  app.get('/documents/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const version = (req.query as { version?: string }).version;
    demand(/^[a-z][a-z0-9-]{0,63}$/.test(key) && (!version || version.length <= 100), 'NOT_FOUND', 404);
    const doc = await tx((db) => one<any>(db, `SELECT * FROM consent_documents WHERE item_key=$1 AND effective_at<=now()
      AND ($2::text IS NULL OR version=$2) AND ($3=false OR version NOT LIKE 'dev-%') ORDER BY effective_at DESC LIMIT 1`, [key, version ?? null, config.production]));
    demand(doc, 'DOCUMENT_UNAVAILABLE', 503);
    const body = doc.body ?? (!config.production && doc.version === 'dev-1' ? developmentBodies[doc.item_key] : null);
    demand(typeof body === 'string' && hash(body) === doc.content_hash, 'DOCUMENT_UNAVAILABLE', 503);
    // Store and render the exact agreed version. Markdown is escaped, never executed as HTML.
    return reply.headers(publicPageHeaders).type('text/html; charset=utf-8').send(page(doc.title || doc.item_key,
      `<p>버전 ${escapeHtml(doc.version)} · 시행 ${new Date(doc.effective_at).toISOString().slice(0,10)}</p><pre>${escapeHtml(body)}</pre>`));
  });
}
export async function publishDocuments(manifestPath: string) {
  const path = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  demand(manifest.approvedForPublication === true && Array.isArray(manifest.documents), 'DOCUMENT_REVIEW_REQUIRED');
  const documents = await Promise.all(manifest.documents.map(async (d: any) => {
    demand(/^[a-z][a-z0-9-]{0,63}$/.test(d.itemKey) && typeof d.version === 'string' && d.version.length <= 100 &&
      d.version.length > 0 && !d.version.startsWith('dev-') && ['consent','notice'].includes(d.kind) &&
      typeof d.required === 'boolean' && !(d.kind === 'notice' && d.required) &&
      typeof d.title === 'string' && d.title.trim() && typeof d.file === 'string' &&
      typeof d.effectiveAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(d.effectiveAt) && Number.isFinite(Date.parse(d.effectiveAt)), 'INVALID_DOCUMENT');
    const body = await readFile(resolve(dirname(path), d.file), 'utf8');
    demand(body.trim().length >= 30 && !/\{\{[^}]*\}\}/.test(body), 'DOCUMENT_PLACEHOLDERS_REMAIN');
    return { ...d, body, digest: hash(body) };
  }));
  demand(new Set(documents.map((d) => d.itemKey)).size === documents.length, 'DUPLICATE_DOCUMENT');
  await tx(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(74103104)');
    for (const d of documents) {
      const old = await one(db, 'SELECT * FROM consent_documents WHERE item_key=$1 AND version=$2', [d.itemKey,d.version]);
      if (old) {
        demand(old.content_hash === d.digest && old.kind === d.kind && old.required === d.required && old.title === d.title &&
          new Date(old.effective_at).getTime() === Date.parse(d.effectiveAt), 'DOCUMENT_VERSION_IMMUTABLE', 409);
        continue;
      }
      demand(!await one(db,'SELECT 1 FROM consent_documents WHERE item_key=$1 AND effective_at=$2',[d.itemKey,d.effectiveAt]),'DOCUMENT_EFFECTIVE_TIME_CONFLICT',409);
      await db.query(`INSERT INTO consent_documents(item_key,version,kind,title,required,body,content_hash,content_ref,effective_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [d.itemKey,d.version,d.kind,d.title,d.required,d.body,d.digest,
          `/documents/${d.itemKey}?version=${encodeURIComponent(d.version)}`,d.effectiveAt]);
    }
  });
  return documents.map((d) => ({ itemKey: d.itemKey, version: d.version, sha256: d.digest }));
}
