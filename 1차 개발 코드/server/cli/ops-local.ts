import { hostname, userInfo } from 'node:os';
import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from '../core/context.js';
import { one, rows, tx, pool } from '../core/db.js';
import { demand } from '../core/errors.js';
import { operationHandlers } from '../services/operations.js';

// Local database administration only. Never register this module as an HTTP route.
// Access is controlled by the server OS account and database/object-store credentials.
export async function localReview(args: string[]) {
  const [command, caseId, ...rest] = args;
  const user = userInfo();
  const subject = `local:${hostname()}:${user.uid}:${user.username}`;
  demand(['list', 'show', 'evidence', 'release', 'reject'].includes(command), 'INVALID_LOCAL_COMMAND');
  if (command === 'list') {
    demand(args.length === 1, 'INVALID_LOCAL_ARGUMENTS');
    return tx((db) => rows(db, `SELECT id,type,target_type,target_id,status,reason,version,created_at
      FROM reports_and_cases WHERE type='scan' AND status='received' ORDER BY created_at,id`));
  }
  demand(typeof caseId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(caseId), 'INVALID_CASE_ID');
  demand(command === 'show' ? rest.length === 0 : command === 'evidence' ? rest.length === 1 : rest.length === 2, 'INVALID_LOCAL_ARGUMENTS');
  const expectedVersion = Number(rest[0]);
  if (['release', 'reject'].includes(command)) {
    demand(Number.isSafeInteger(expectedVersion) && expectedVersion > 0 && !!rest[1]?.trim(), 'VERSION_AND_REASON_REQUIRED');
  }
  // Files are opened exclusively before the transaction: existing paths and symlinks are refused.
  const output = command === 'evidence' ? await open(resolve(rest[0]), 'wx', 0o600) : undefined;
  try {
    return await tx(async (db) => {
      const record = await one(db, 'SELECT * FROM reports_and_cases WHERE id=$1 FOR UPDATE', [caseId]);
      demand(record && record.type === 'scan' && ['task', 'operation', 'cover'].includes(record.target_type), 'REVIEW_CASE_NOT_FOUND', 404);
      const c = { db, actor: undefined, body: {}, params: { caseId }, query: {}, headers: {}, opId: randomUUID(),
        operator: { subject, roles: ['case_reviewer', 'content_moderator'] } } as unknown as Context;
      if (command === 'show' || command === 'evidence') {
        const result = await operationHandlers[command === 'show' ? 'opsCaseGet' : 'opsEvidence'](c);
        await db.query(`INSERT INTO operator_audit(id,operator_id,case_id,target_type,target_id,action,reason,before_state,after_state)
          VALUES($1,$2,$3,$4,$5,$6,$7,'{}','{}')`,
          [randomUUID(),subject,caseId,record.target_type,record.target_id,
            command === 'show' ? 'local_review_read' : 'local_evidence_read', '서버 터미널에서 공개 전 콘텐츠 검토']);
        if (output) {
          await output.truncate(0);
          await output.write(result.binary.data, 0, result.binary.data.length, 0);
          await output.sync();
          return { file: resolve(rest[0]), mime: result.binary.mime, caseId };
        }
        return result;
      }
      demand(record.status === 'received', 'CASE_ALREADY_DECIDED', 409);
      c.body = { action: command === 'release' ? 'release' : 'restrict', expectedVersion, reason: rest[1] };
      return operationHandlers.opsAction(c);
    });
  } finally { await output?.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.length || args[0] === '--help') {
      console.log(`서버 OS 계정과 DB 접근 권한이 있는 운영자 전용입니다. 웹 운영자 인증은 변경하지 않습니다.
npm run ops:local -- list
npm run ops:local -- show <사건 UUID>
npm run ops:local -- evidence <사건 UUID> <새 파일 경로>
npm run ops:local -- release <사건 UUID> <조회한 version> "검토 후 승인 사유"
npm run ops:local -- reject <사건 UUID> <조회한 version> "반려 사유"
증거 파일은 권한 0600으로 저장됩니다. 검토 후 직접 삭제하세요.`);
    } else console.log(JSON.stringify(await localReview(args), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'LOCAL_REVIEW_FAILED');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
