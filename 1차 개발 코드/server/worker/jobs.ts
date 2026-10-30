import { randomUUID } from 'node:crypto';
import { tx, one, rows } from '../core/db.js';
import type { Context } from '../core/context.js';
import { demand, mapDbError } from '../core/errors.js';
import { decrypt } from '../core/crypto.js';
import { moderate } from '../adapters/moderation.js';
import { objects } from '../adapters/object-store.js';
import { prepareMedia } from './media.js';
import { activity, cleanup, taskAccess } from '../services/access.js';
import { newCase, notify } from '../services/operations.js';
import { dispatch } from '../api/dispatch.js';
const makeContext = (db: any, actor: any, opId: string): Context => ({
  db,
  actor,
  opId,
  body: {},
  params: {},
  query: {},
  headers: {},
});
async function finishOperation(
  db: any,
  id: string,
  kind: string,
  state: string,
  result: any,
  errors: any[] = [],
) {
  await db.query(
    "UPDATE operations SET state=$2,response_snapshot=$3,finished_at=CASE WHEN $2 IN ('failed','succeeded') THEN now() ELSE NULL END WHERE id=$1",
    [id, state, JSON.stringify({ operationId: id, kind, state, result, itemErrors: errors })],
  );
}
export async function processOne() {
  const claimed = await tx(async (db) => {
    const e = await one(
      db,
      "SELECT e.* FROM outbox_events e LEFT JOIN upload_tasks t ON t.id=e.target_id WHERE e.published_at IS NULL AND (e.event_type='text.apply' OR (e.event_type='media.process' AND t.state='verifying' AND (t.processing_until IS NULL OR t.processing_until<now()))) ORDER BY e.created_at FOR UPDATE OF e SKIP LOCKED LIMIT 1",
    );
    if (!e) return null;
    if (e.event_type === 'media.process') {
      const claim = randomUUID();
      await db.query(
        "UPDATE upload_tasks SET processing_claim=$2,processing_until=now()+interval '10 minutes' WHERE id=$1",
        [e.target_id, claim],
      );
      return { ...e, claim };
    }
    await db.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [e.id]);
    return e;
  });
  if (!claimed) return false;
  const e = claimed;
  if (e.event_type === 'text.apply') {
    try {
      await tx(async (db) => {
        const cmd = decrypt(e.payload.command),
          actor = await one(db, 'SELECT * FROM users WHERE id=$1 FOR UPDATE', [cmd.actorId]);
        demand(actor && ['active', 'onboarding'].includes(actor.status), 'ACCESS_REVOKED', 403);
        const c = makeContext(db, { ...actor, sessionId: cmd.sessionId }, e.operation_id);
        const result = await dispatch(cmd.id, {
          ...c,
          body: cmd.body,
          params: cmd.params,
          query: cmd.query,
        });
        const o = await one(db, 'SELECT kind FROM operations WHERE id=$1', [e.operation_id]);
        await finishOperation(
          db,
          e.operation_id,
          o.kind,
          'succeeded',
          result?.kind ? result.result : result,
        );
      });
    } catch (err) {
      await tx(async (db) => {
        const o = await one(db, 'SELECT kind FROM operations WHERE id=$1', [e.operation_id]);
        await finishOperation(db, e.operation_id, o.kind, 'failed', null, [
          { code: mapDbError(err).code, message: '검토 후 최신 상태 검증에 실패했습니다.' },
        ]);
      });
    }
    return true;
  }
  const t = await tx((db) => one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [e.target_id]));
  try {
    const prepared = await prepareMedia(t);
    const verdict = t.review_approved
      ? 'passed'
      : await moderate({ path: prepared.originalPath, mime: prepared.mime, text: t.description });
    await tx(async (db) => {
      const actor = await one(db, 'SELECT * FROM users WHERE id=$1 FOR UPDATE', [t.author_user_id]);
      const c = makeContext(db, actor, e.operation_id);
      await taskAccess(c, t.id, true);
      const current = await one(db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [t.id]);
      demand(
        current.state === 'verifying' &&
          current.processing_claim === e.claim &&
          current.upload_generation === t.upload_generation,
        'CANCELLED',
        410,
      );
      if (verdict === 'review') {
        await db.query(
          "UPDATE upload_tasks SET state='review',processing_claim=NULL,processing_until=NULL,version=version+1 WHERE id=$1",
          [t.id],
        );
        const r = await newCase(
          c,
          'scan',
          'task',
          t.id,
          '画像・영상 공개 전 검토',
          t.author_user_id,
        );
        await notify(
          c,
          t.author_user_id,
          'review_pending',
          { message: '파일 공개 전 운영 검토를 기다리고 있어요.' },
          r.id,
        );
        await finishOperation(db, e.operation_id, 'media_commit', 'review', null);
        await db.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [e.id]);
        return;
      }
      demand(verdict === 'passed', 'MODERATION_REJECTED');
      let media: any = null;
      const gid =
        t.cover_group_id ??
        (await one(db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id;
      if (!t.cover_group_id) {
        const s = await one(db, 'SELECT * FROM schedules WHERE id=$1 FOR UPDATE', [t.schedule_id]);
        if (!s.retention_fixed_at)
          await db.query(
            'UPDATE schedules SET retention_fixed_at=now(),retention_last_date=retention_last_day(COALESCE(cancelled_end_date,end_date)),expires_at=retention_expires(COALESCE(cancelled_end_date,end_date)) WHERE id=$1',
            [s.id],
          );
        media = await one(
          db,
          `INSERT INTO media(task_id,submission_id,schedule_id,author_user_id,record_date,visit_id,description,kind,mime,original_bytes,captured_at,completed_at,selection_index,moderation_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,'passed') RETURNING *`,
          [
            t.id,
            t.submission_id,
            t.schedule_id,
            t.author_user_id,
            t.record_date,
            t.visit_id,
            t.description,
            t.kind,
            prepared.mime,
            t.declared_bytes,
            prepared.capturedAt,
            t.selection_index,
          ],
        );
      }
      let coverAssetId: string | null = null;
      for (const a of prepared.assets) {
        const r = await one(
          db,
          `INSERT INTO assets(media_id,cover_group_id,variant,object_key,bytes,checksum,location_verified_absent,probe_result,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ready') RETURNING id`,
          [
            media?.id ?? null,
            t.cover_group_id,
            a.variant,
            a.key,
            a.bytes,
            a.checksum,
            a.variant !== 'original_private',
            JSON.stringify(a.probe),
          ],
        );
        if (t.cover_group_id && a.variant === 'sanitized_original') coverAssetId = r.id;
      }
      await db.query(
        "UPDATE upload_tasks SET state='complete',reserved_bytes=0,processing_claim=NULL,processing_until=NULL,version=version+1 WHERE id=$1",
        [t.id],
      );
      await db.query(
        'UPDATE groups SET reserved_bytes=reserved_bytes-$2,completed_bytes=completed_bytes+$3 WHERE id=$1',
        [gid, current.reserved_bytes, t.declared_bytes],
      );
      if (media) {
        await db.query(
          'UPDATE submissions SET first_completed_at=COALESCE(first_completed_at,now()) WHERE id=$1',
          [t.submission_id],
        );
        await activity(c, gid);
      }
      await finishOperation(db, e.operation_id, 'media_commit', 'succeeded', {
        taskId: t.id,
        mediaId: media?.id ?? null,
        coverAssetId,
      });
      await db.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [e.id]);
      await cleanup(c, 'task', t.id, Number(current.version) + 1);
    });
  } catch (err) {
    await tx(async (db) => {
      const current = await one(db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [t.id]);
      if (current.processing_claim !== e.claim) return;
      const gid =
        t.cover_group_id ??
        (await one(db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id;
      if (current.state === 'verifying') {
        await db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
          gid,
          current.reserved_bytes,
        ]);
        await db.query(
          "UPDATE upload_tasks SET state='failed',reserved_bytes=0,error_code=$2,processing_claim=NULL,processing_until=NULL,version=version+1 WHERE id=$1",
          [
            t.id,
            mapDbError(err).code === 'INTERNAL_ERROR'
              ? 'MEDIA_PROCESSING_FAILED'
              : mapDbError(err).code,
          ],
        );
      }
      await finishOperation(db, e.operation_id, 'media_commit', 'failed', null, [
        { code: mapDbError(err).code, message: '파일 처리 또는 최종 권한 검증에 실패했습니다.' },
      ]);
      await db.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [e.id]);
    });
  }
  return true;
}
export async function expireMedia() {
  return tx(async (db) => {
    const expired = await rows(
      db,
      "SELECT m.* FROM media m JOIN schedules s ON s.id=m.schedule_id WHERE s.expires_at<=now() AND m.access_state NOT IN ('deleted','expired') ORDER BY m.id FOR UPDATE OF m SKIP LOCKED LIMIT 100",
    );
    const c = makeContext(db, undefined, randomUUID());
    for (const m of expired) {
      await db.query(
        "UPDATE media SET access_state='expired',description='',version=version+1 WHERE id=$1",
        [m.id],
      );
      await db.query(
        "UPDATE assets SET state='delete_pending' WHERE media_id=$1 AND state<>'purged'",
        [m.id],
      );
      await cleanup(c, 'media', m.id, Number(m.version) + 1);
    }
    for (const r of await rows(
      db,
      'SELECT id,version FROM reports_and_cases WHERE evidence_delete_at<=now() AND evidence_ref IS NOT NULL',
    ))
      await cleanup(c, 'evidence', r.id, Number(r.version));
    await db.query('DELETE FROM reauth_proofs WHERE expires_at<now()');
    await db.query('DELETE FROM kakao_login_flows WHERE expires_at<now()');
    await db.query('DELETE FROM google_login_flows WHERE expires_at<now()');
    await db.query("DELETE FROM login_attempts WHERE expires_at<now()-interval '1 day'");
    const expiredTasks = await rows(
      db,
      `SELECT t.*,s.group_id FROM upload_tasks t JOIN schedules s ON s.id=t.schedule_id WHERE t.state NOT IN ('complete','cancelled') AND COALESCE(s.expires_at,retention_expires(COALESCE(s.cancelled_end_date,s.end_date)))<=now() ORDER BY t.id FOR UPDATE OF t SKIP LOCKED LIMIT 100`,
    );
    for (const task of expiredTasks) {
      await db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
        task.group_id,
        task.reserved_bytes,
      ]);
      await db.query(
        "UPDATE upload_tasks SET state='cancelled',error_code='EXPIRED',reserved_bytes=0,version=version+1 WHERE id=$1",
        [task.id],
      );
      await cleanup(c, 'task', task.id, Number(task.version) + 1);
    }
    return expired.length;
  });
}
export async function cleanupOne() {
  const job = await tx(async (db) => {
    const j = await one(
      db,
      "SELECT * FROM cleanup_jobs WHERE state<>'complete' AND due_at<=now() AND (claimed_until IS NULL OR claimed_until<now()) ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (j)
      await db.query(
        "UPDATE cleanup_jobs SET state='running',attempts=attempts+1,claimed_until=now()+interval '5 minutes' WHERE id=$1",
        [j.id],
      );
    return j;
  });
  if (!job) return false;
  try {
    if (job.target_type === 'evidence') {
      const r = await tx((db) =>
        one(db, 'SELECT * FROM reports_and_cases WHERE id=$1', [job.target_id]),
      );
      if (r?.evidence_ref && r.evidence_delete_at && new Date(r.evidence_delete_at) <= new Date()) {
        if (r.evidence_ref.startsWith('evidence/')) await objects.remove(r.evidence_ref);
        await tx((db) =>
          db.query('UPDATE reports_and_cases SET evidence_ref=NULL WHERE id=$1', [r.id]),
        );
      }
    } else if (job.target_type === 'task') {
      const t = await tx((db) =>
        one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [job.target_id]),
      );
      if (t && ['cancelled', 'complete'].includes(t.state)) await objects.remove(t.quarantine_key);
    } else if (job.target_type === 'cover_task') {
      const pending = await tx(async (db) => {
        const initial = await one(db, 'SELECT * FROM upload_tasks WHERE id=$1', [job.target_id]);
        if (!initial) return null;
        await db.query('SELECT id FROM groups WHERE id=$1 FOR UPDATE', [initial.cover_group_id]);
        const task = await one(db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [
          initial.id,
        ]);
        if (task.state !== 'complete' || task.storage_released_at) return null;
        const used = await one(
          db,
          'SELECT 1 FROM groups g JOIN assets a ON a.id=g.cover_asset_id WHERE a.object_key LIKE $1',
          [`assets/${task.id}/%`],
        );
        if (used) return null;
        const assets = await rows(
          db,
          "UPDATE assets SET state='delete_pending' WHERE object_key LIKE $1 AND state<>'purged' RETURNING *",
          [`assets/${task.id}/%`],
        );
        return { task, assets };
      });
      if (pending) {
        for (const a of pending.assets) await objects.remove(a.object_key);
        await tx(async (db) => {
          const current = await one(db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [
            pending.task.id,
          ]);
          if (current.storage_released_at) return;
          await db.query('UPDATE upload_tasks SET storage_released_at=now() WHERE id=$1', [
            current.id,
          ]);
          await db.query("UPDATE assets SET state='purged' WHERE object_key LIKE $1", [
            `assets/${current.id}/%`,
          ]);
          await db.query('UPDATE groups SET completed_bytes=completed_bytes-$2 WHERE id=$1', [
            current.cover_group_id,
            current.declared_bytes,
          ]);
        });
      }
    } else if (job.target_type === 'media') {
      const m = await tx((db) =>
        one(
          db,
          `SELECT m.*,s.group_id FROM media m JOIN schedules s ON s.id=m.schedule_id WHERE m.id=$1`,
          [job.target_id],
        ),
      );
      if (m && ['deleted', 'expired'].includes(m.access_state) && !m.purged_at) {
        const assets = await tx((db) =>
          rows(db, "SELECT * FROM assets WHERE media_id=$1 AND state='delete_pending'", [m.id]),
        );
        for (const a of assets) await objects.remove(a.object_key);
        await tx(async (db) => {
          const current = await one(db, 'SELECT * FROM media WHERE id=$1 FOR UPDATE', [m.id]);
          if (current.purged_at) return;
          demand(['deleted', 'expired'].includes(current.access_state), 'CLEANUP_STALE', 409);
          await db.query("UPDATE assets SET state='purged' WHERE media_id=$1", [m.id]);
          await db.query('UPDATE media SET purged_at=now() WHERE id=$1', [m.id]);
          await db.query('UPDATE groups SET completed_bytes=completed_bytes-$2 WHERE id=$1', [
            m.group_id,
            m.original_bytes,
          ]);
        });
      }
    }
    await tx((db) =>
      db.query(
        "UPDATE cleanup_jobs SET state='complete',finished_at=now(),claimed_until=NULL WHERE id=$1",
        [job.id],
      ),
    );
  } catch {
    await tx((db) =>
      db.query(
        "UPDATE cleanup_jobs SET state='failed',claimed_until=NULL,error_code='CLEANUP_FAILED',due_at=now()+interval '1 minute' WHERE id=$1",
        [job.id],
      ),
    );
  }
  return true;
}
