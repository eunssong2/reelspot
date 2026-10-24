import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { one, rows } from '../core/db.js';
import type { Context, Handler } from '../core/context.js';
import { demand, DomainError, mapDbError, version } from '../core/errors.js';
import { hash, readCursor } from '../core/crypto.js';
import { isExpired, rangeDate, text } from '../core/policy.js';
import { page } from '../core/paging.js';
import { config } from '../core/config.js';
import { objects } from '../adapters/object-store.js';
import {
  activity,
  cleanup,
  deleteFile,
  fileAccess,
  groupAccess,
  scheduleAccess,
  taskAccess,
} from './access.js';
const transferable = ['queued', 'uploading', 'failed'];
export function operation(
  c: Context,
  kind: string,
  state = 'succeeded',
  result: any = null,
  itemErrors: any[] = [],
) {
  return { operationId: c.opId, kind, state, result, itemErrors };
}
export async function taskDto(c: Context, t: any) {
  const m = await one(c.db, 'SELECT id FROM media WHERE task_id=$1', [t.id]);
  const asset = t.cover_group_id
    ? await one(
        c.db,
        "SELECT id FROM assets WHERE cover_group_id=$1 AND object_key LIKE $2 AND variant='sanitized_original' ORDER BY created_at DESC LIMIT 1",
        [t.cover_group_id, `assets/${t.id}/%`],
      )
    : null;
  return {
    id: t.id,
    selectionIndex: t.selection_index,
    clientFileId: t.client_file_id,
    targetType: t.cover_group_id ? 'cover' : 'record',
    ...(t.cover_group_id ? { coverGroupId: t.cover_group_id } : { submissionId: t.submission_id }),
    state: t.state,
    transferredBytes: t.upload_offset,
    actualBytes: t.actual_bytes,
    retryable: t.state === 'failed' || transferable.includes(t.state),
    reason: t.error_code,
    version: Number(t.version),
    mediaId: m?.id ?? null,
    coverAssetId: asset?.id ?? null,
    transport: transferable.includes(t.state)
      ? {
          protocol: 'ATP-Upload/1',
          uploadEndpoint: `/v1/upload-tasks/${t.id}/content`,
          generation: t.upload_generation,
          resumeOffset: t.upload_offset,
          length: t.declared_bytes,
          expiresAt: t.transport_expires_at,
          alignmentBytes: 1048576,
          maxChunkBytes: 4194304,
        }
      : null,
  };
}
async function remaining(
  c: Context,
  scheduleId: string,
  visitId: string | null,
  recordDate: string,
) {
  const a = [c.actor.id, scheduleId, visitId, recordDate];
  const r = await one(
    c.db,
    `SELECT media_bucket_count($1,$2,$3,$4,'photo',NULL,NULL) photos,media_bucket_count($1,$2,$3,$4,'video',NULL,NULL) videos`,
    a,
  );
  return {
    visitId,
    recordDate,
    photos: Math.max(0, 5 - r.photos),
    videos: Math.max(0, 2 - r.videos),
  };
}
async function validVisit(c: Context, s: any, recordDate: string, visitId: string | null) {
  rangeDate(s, recordDate);
  if (visitId)
    demand(
      await one(
        c.db,
        'SELECT 1 FROM visits WHERE id=$1 AND schedule_id=$2 AND visit_date=$3 AND deleted_at IS NULL',
        [visitId, s.id, recordDate],
      ),
      'INVALID_VISIT',
    );
}
export function mediaDto(m: any) {
  return {
    id: m.id,
    scheduleId: m.schedule_id,
    authorUserId: m.author_user_id,
    submissionId: m.submission_id,
    selectionIndex: m.selection_index,
    recordDate: m.record_date,
    visitId: m.visit_id,
    description: ['deleted', 'expired'].includes(m.access_state) ? '' : m.description,
    kind: m.kind,
    completedAt: m.completed_at,
    capturedAt: m.captured_at,
    sortAt: m.captured_at ?? m.completed_at,
    sortBasis: m.captured_at ? 'captured' : 'completed',
    retentionLastDate: m.retention_last_date,
    expiresAt: m.expires_at,
    version: Number(m.version),
    accessState: m.access_state,
    displayName: m.display_name,
    visitName: m.visit_name,
    durationMs: m.duration_ms ?? null,
  };
}
export type FileReply = { file: { path: string; mime: string; bytes: number; name?: string } };
export async function assetReply(c: Context, mediaId: string, variant: string): Promise<FileReply> {
  const a = await one(
    c.db,
    "SELECT * FROM assets WHERE media_id=$1 AND variant=$2 AND state='ready' AND location_verified_absent",
    [mediaId, variant],
  );
  demand(a, 'FILE_NOT_READY', 409);
  return {
    file: {
      path: objects.path(a.object_key),
      mime:
        a.probe_result.mime ??
        (variant === 'thumbnail' ? 'image/jpeg' : 'application/octet-stream'),
      bytes: a.bytes,
      name: `${mediaId}.${a.probe_result.extension ?? 'bin'}`,
    },
  };
}
export const recordHandlers: Record<string, Handler> = {
  coverStream: async (c) => {
    const g = await groupAccess(c, c.params.groupId);
    demand(g.cover_asset_id, 'NOT_FOUND', 404);
    const a = await one(
      c.db,
      "SELECT * FROM assets WHERE id=$1 AND state='ready' AND location_verified_absent AND moderation_state='passed'",
      [g.cover_asset_id],
    );
    demand(a, 'MODERATION_RESTRICTED', 403);
    return {
      file: { path: objects.path(a.object_key), mime: a.probe_result.mime, bytes: a.bytes },
    };
  },
  uploadPrepare: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, false, true);
    demand(!isExpired(s), 'EXPIRED', 410);
    demand(
      new Set(c.body.files.map((f: any) => f.selectionIndex)).size === c.body.files.length &&
        new Set(c.body.files.map((f: any) => f.clientFileId)).size === c.body.files.length,
      'VALIDATION_ERROR',
    );
    const sub = await one(
        c.db,
        'INSERT INTO submissions(schedule_id,author_user_id) VALUES($1,$2) RETURNING *',
        [s.id, c.actor.id],
      ),
      tasks: any[] = [],
      fileErrors: any[] = [],
      buckets = new Map<string, { visitId: string | null; recordDate: string }>();
    for (const f of c.body.files) {
      await c.db.query('SAVEPOINT candidate');
      try {
        await validVisit(c, s, f.recordDate, f.visitId ?? null);
        const desc = text(f.description ?? '', 1000, false, true);
        demand(
          f.checksum === f.fingerprint &&
            f.declaredBytes <= (f.kind === 'photo' ? 50000000 : 200000000),
          'FILE_INVALID',
        );
        demand(
          (f.kind === 'photo' &&
            ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(
              f.mime,
            )) ||
            (f.kind === 'video' && ['video/mp4', 'video/quicktime'].includes(f.mime)),
          'FILE_INVALID',
        );
        demand(f.kind !== 'video' || f.durationMs == null || f.durationMs <= 60000, 'FILE_INVALID');
        demand(!f.width || !f.height || f.width * f.height <= 100000000, 'FILE_INVALID');
        const t = await one(
          c.db,
          `INSERT INTO upload_tasks(id,submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,checksum,record_date,visit_id,description,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at,declared_mime,file_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$12,$13,now()+interval '24 hours',$14,$15) RETURNING *`,
          [
            randomUUID(),
            sub.id,
            s.id,
            c.actor.id,
            f.clientFileId,
            f.selectionIndex,
            f.kind,
            f.fingerprint,
            f.recordDate,
            f.visitId ?? null,
            desc,
            f.declaredBytes,
            `quarantine/${randomUUID()}`,
            f.mime,
            f.name,
          ],
        );
        await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes+$2 WHERE id=$1', [
          s.group_id,
          f.declaredBytes,
        ]);
        tasks.push(await taskDto(c, t));
        buckets.set(`${f.visitId ?? 'none'}:${f.recordDate}`, {
          visitId: f.visitId ?? null,
          recordDate: f.recordDate,
        });
        await c.db.query('RELEASE SAVEPOINT candidate');
      } catch (e) {
        await c.db.query('ROLLBACK TO SAVEPOINT candidate');
        await c.db.query('RELEASE SAVEPOINT candidate');
        const err = mapDbError(e);
        fileErrors.push({
          clientFileId: f.clientFileId,
          selectionIndex: f.selectionIndex,
          code: err.code === 'VALIDATION_ERROR' ? 'QUOTA_EXCEEDED' : err.code,
          message: err.message,
        });
      }
    }
    if (!tasks.length) await c.db.query('DELETE FROM submissions WHERE id=$1', [sub.id]);
    return {
      submissionId: tasks.length ? sub.id : null,
      tasks,
      fileErrors,
      remaining: await Promise.all(
        [...buckets.values()].map((b) => remaining(c, s.id, b.visitId, b.recordDate)),
      ),
    };
  },
  coverPrepare: async (c) => {
    const g = await groupAccess(c, c.params.groupId, true),
      f = c.body.file;
    demand(
      f.declaredBytes <= 50000000 &&
        ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(f.mime) &&
        /^[a-f0-9]{64}$/.test(f.fingerprint),
      'FILE_INVALID',
    );
    const t = await one(
      c.db,
      `INSERT INTO upload_tasks(cover_group_id,author_user_id,client_file_id,kind,fingerprint,checksum,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at,declared_mime,file_name) VALUES($1,$2,$3,'photo',$4,$4,$5,$5,$6,now()+interval '24 hours',$7,$8) RETURNING *`,
      [
        g.id,
        c.actor.id,
        randomUUID(),
        f.fingerprint,
        f.declaredBytes,
        `quarantine/${randomUUID()}`,
        f.mime,
        f.name,
      ],
    );
    await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes+$2 WHERE id=$1', [
      g.id,
      f.declaredBytes,
    ]);
    return taskDto(c, t);
  },
  uploadTasksList: async (c) => {
    const ids = c.query.ids ? String(c.query.ids).split(',') : null;
    demand(!ids || (ids.length <= 120 && new Set(ids).size === ids.length), 'VALIDATION_ERROR');
    const tasks = await rows(c.db, 'SELECT * FROM upload_tasks WHERE author_user_id=$1 AND ($2::uuid[] IS NULL OR id=ANY($2)) ORDER BY created_at DESC LIMIT 120', [c.actor.id, ids]);
    const result = []; for (const t of tasks) result.push(await taskDto(c, t));
    return { tasks: result };
  },
  uploadGet: async (c) => taskDto(c, await taskAccess(c, c.params.taskId)),
  uploadHead: async (c) => {
    const t = await taskAccess(c, c.params.taskId, true);
    checkTransfer(t, c.headers);
    return { uploadHeaders: t };
  },
  uploadChunk: async (c) => {
    const initial = await taskAccess(c, c.params.taskId, true);
    checkTransfer(initial, c.headers);
    const offset = Number(c.headers['upload-offset']),
      data = c.body as Buffer,
      checksum = c.headers['upload-checksum'];
    demand(
      Number.isSafeInteger(offset) && offset >= 0 && Buffer.isBuffer(data) && data.length > 0,
      'VALIDATION_ERROR',
    );
    demand(
      data.length <= 4194304 && offset + data.length <= initial.declared_bytes,
      'FILE_TOO_LARGE',
      413,
    );
    demand(
      offset + data.length === initial.declared_bytes || data.length % 1048576 === 0,
      'CHUNK_ALIGNMENT',
    );
    demand(checksum === `sha256 ${hash(data)}`, 'CHUNK_CHECKSUM_INVALID');
    const key = `${initial.quarantine_key}/${initial.upload_generation}/${offset}-${hash(data)}`;
    await objects.put(key, data);
    const t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [initial.id]);
    checkTransfer(t, c.headers);
    const manifest = t.chunk_manifest as any[];
    const old = manifest.find((x) => x.offset === offset);
    if (old && old.size === data.length && old.hash === hash(data)) return { uploadHeaders: t };
    demand(offset === t.upload_offset, 'OFFSET_MISMATCH', 409, { offset: t.upload_offset });
    manifest.push({ key, offset, size: data.length, hash: hash(data) });
    const updated = await one(
      c.db,
      "UPDATE upload_tasks SET chunk_manifest=$2,upload_offset=upload_offset+$3,state='uploading',version=version+1 WHERE id=$1 RETURNING *",
      [t.id, JSON.stringify(manifest), data.length],
    );
    return { uploadHeaders: updated };
  },
  uploadCommit: async (c) => {
    await taskAccess(c, c.params.taskId, true);
    const t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [
      c.params.taskId,
    ]);
    demand(!['cancelled', 'complete'].includes(t.state), 'CANCELLED', 410);
    demand(
      t.upload_offset === t.declared_bytes &&
        c.body.actualBytes === t.declared_bytes &&
        c.body.checksum === t.fingerprint,
      'FILE_INVALID',
    );
    if (['verifying', 'review'].includes(t.state)) {
      const old = await one(
        c.db,
        "SELECT o.* FROM operations o JOIN outbox_events e ON e.operation_id=o.id WHERE e.event_type='media.process' AND e.target_id=$1 ORDER BY o.created_at LIMIT 1",
        [t.id],
      );
      if (old) return old.response_snapshot;
    }
    await c.db.query(
      "UPDATE upload_tasks SET state='verifying',actual_bytes=$2,version=version+1 WHERE id=$1",
      [t.id, c.body.actualBytes],
    );
    await c.db.query(
      "INSERT INTO outbox_events(operation_id,event_type,target_id,generation,payload) VALUES($1,'media.process',$2,$3,'{}') ON CONFLICT DO NOTHING",
      [c.opId, t.id, t.upload_generation],
    );
    return operation(c, 'media_commit', 'pending');
  },
  uploadRetry: async (c) => {
    await taskAccess(c, c.params.taskId, true);
    const t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [
      c.params.taskId,
    ]);
    demand(transferable.includes(t.state), 'TASK_NOT_TRANSFERABLE', 409);
    demand(t.fingerprint === c.body.sameFileFingerprint, 'FILE_CHANGED');
    const gid =
      t.cover_group_id ??
      (await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id;
    if (t.reserved_bytes === 0) {
      await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes+$2 WHERE id=$1', [
        gid,
        t.declared_bytes,
      ]);
    }
    const r = await one(
      c.db,
      "UPDATE upload_tasks SET state='queued',reserved_bytes=declared_bytes,upload_generation=upload_generation+1,transport_expires_at=now()+interval '24 hours',error_code=NULL,version=version+1 WHERE id=$1 RETURNING *",
      [t.id],
    );
    return taskDto(c, r);
  },
  uploadCancel: async (c) => {
    const initial = await taskAccess(c, c.params.taskId),
      t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [initial.id]);
    version(t, c.body.expectedVersion);
    demand(t.state !== 'complete', 'ALREADY_COMPLETE', 409);
    const gid =
      t.cover_group_id ??
      (await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id;
    await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
      gid,
      t.reserved_bytes,
    ]);
    const r = await one(
      c.db,
      "UPDATE upload_tasks SET state='cancelled',reserved_bytes=0,cancel_requested_at=now(),version=version+1 WHERE id=$1 RETURNING *",
      [t.id],
    );
    await cleanup(c, 'task', t.id, Number(r.version));
    return taskDto(c, r);
  },
  uploadLimits: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, false, true);
    const recordDate = c.query.recordDate;
    const visitId = c.query.visitId || null;
    await validVisit(c, s, recordDate, visitId);
    return { ...(await remaining(c, s.id, visitId, recordDate)), photoLimit: 5, videoLimit: 2 };
  },
  mediaList: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId);
    demand(!isExpired(s), 'EXPIRED', 410);
    let snapshot = new Date().toISOString();
    if (c.query.cursor) {
      try {
        snapshot = readCursor<any>(c.query.cursor).snapshotAt;
      } catch {
        throw new DomainError('INVALID_CURSOR');
      }
    }
    let all = await rows(
      c.db,
      `SELECT m.*,s.retention_last_date,s.expires_at,u.display_name,p.name visit_name FROM media m JOIN schedules s ON s.id=m.schedule_id JOIN users u ON u.id=m.author_user_id LEFT JOIN visits v ON v.id=m.visit_id LEFT JOIN places p ON p.id=v.place_id WHERE m.schedule_id=$1 AND m.access_state='available' AND m.completed_at<=$3 AND NOT EXISTS(SELECT 1 FROM personal_blocks b WHERE b.blocker_user_id=$2 AND b.blocked_user_id=m.author_user_id)`,
      [s.id, c.actor.id, snapshot],
    );
    all = all.filter(
      (m) =>
        (!c.query.recordDate || m.record_date === c.query.recordDate) &&
        (!c.query.visitId || m.visit_id === c.query.visitId) &&
        (!c.query.unassigned || !m.visit_id) &&
        (!c.query.outsideRange || m.record_date < s.start_date || m.record_date > s.end_date),
    );
    const authors = [...new Set(all.map((m) => m.author_user_id))]
      .map((id) => {
        const a = all.filter((m) => m.author_user_id === id);
        return {
          authorUserId: id,
          displayName: a[0].display_name,
          photos: a.filter((m) => m.kind === 'photo').length,
          videos: a.filter((m) => m.kind === 'video').length,
          firstCompletedAt: new Date(
            Math.min(...a.map((m) => new Date(m.completed_at).getTime())),
          ).toISOString(),
        };
      })
      .sort(
        (a, b) =>
          a.firstCompletedAt.localeCompare(b.firstCompletedAt) ||
          a.authorUserId.localeCompare(b.authorUserId),
      );
    const key = (m: any) =>
      `${c.query.view === 'by_author' ? `${authors.find((a) => a.authorUserId === m.author_user_id)!.firstCompletedAt}:${m.author_user_id}:` : ''}${String(c.query.order === 'desc' ? 9999999999999 - new Date(m.captured_at ?? m.completed_at).getTime() : new Date(m.captured_at ?? m.completed_at).getTime()).padStart(13, '0')}:${m.id}`;
    const p = page(all, c.query, c.actor.id, `media:${s.id}`, key, 60, snapshot);
    return {
      items: p.items.map(mediaDto),
      groups: authors,
      countsByDate: [...new Set(all.map((m) => m.record_date))].map((date) => ({ date, photos: all.filter((m) => m.record_date === date && m.kind === 'photo').length, videos: all.filter((m) => m.record_date === date && m.kind === 'video').length })),
      countsByVisit: [...new Set(all.map((m) => m.visit_id))].map((visitId) => ({ visitId, photos: all.filter((m) => m.visit_id === visitId && m.kind === 'photo').length, videos: all.filter((m) => m.visit_id === visitId && m.kind === 'video').length })),
      visibleCounts: {
        photos: all.filter((m) => m.kind === 'photo').length,
        videos: all.filter((m) => m.kind === 'video').length,
      },
      nextCursor: p.nextCursor,
    };
  },
  mediaGet: async (c) => {
    await fileAccess(c, c.params.mediaId, c.query.context);
    const m = await one(c.db, 'SELECT m.*,s.expires_at,s.retention_last_date,u.display_name,p.name visit_name FROM media m JOIN schedules s ON s.id=m.schedule_id JOIN users u ON u.id=m.author_user_id LEFT JOIN visits v ON v.id=m.visit_id LEFT JOIN places p ON p.id=v.place_id WHERE m.id=$1', [c.params.mediaId]);
    const active = await one(c.db, "SELECT 1 FROM memberships mem JOIN schedules s ON s.group_id=mem.group_id JOIN groups g ON g.id=s.group_id WHERE s.id=$1 AND mem.user_id=$2 AND mem.ended_at IS NULL AND g.status='active'", [m.schedule_id, c.actor.id]);
    return { media: mediaDto(m), canSave: !!active, canEdit: !!active && m.author_user_id === c.actor.id };
  },
  mediaStream: async (c) => {
    await fileAccess(c, c.params.mediaId, c.query.context);
    return assetReply(c, c.params.mediaId, c.query.variant ?? 'view');
  },
  metadataPatch: async (c) => {
    const targets = c.body.targets;
    demand(new Set(targets.map((t: any) => t.id)).size === targets.length, 'VALIDATION_ERROR');
    const all = await rows(
      c.db,
      'SELECT * FROM media WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [targets.map((t: any) => t.id)],
    );
    demand(
      all.length === targets.length && all.every((m) => m.author_user_id === c.actor.id),
      'FORBIDDEN',
      403,
    );
    demand(new Set(all.map((m) => m.schedule_id)).size === 1, 'MIXED_SCHEDULE');
    const s = await scheduleAccess(c, all[0].schedule_id);
    demand(!isExpired(s), 'EXPIRED', 410);
    const fields = c.body.fields;
    demand(
      Object.values(fields).some((f: any) => f.apply),
      'VALIDATION_ERROR',
    );
    for (const m of all) {
      demand(m.access_state === 'available', 'MODERATION_RESTRICTED', 403);
      version(m, targets.find((t: any) => t.id === m.id).expectedVersion);
      const d = fields.recordDate?.apply ? fields.recordDate.value : m.record_date,
        v = fields.visitId?.apply ? fields.visitId.value : m.visit_id;
      if (fields.recordDate?.apply || fields.visitId?.apply) await validVisit(c, s, d, v);
    }
    // Validate the final distribution before moving files. A single UPDATE keeps atomic failure semantics.
    const result = await rows(
      c.db,
      `UPDATE media SET description=CASE WHEN $2 THEN $3 ELSE description END,record_date=CASE WHEN $4 THEN $5::date ELSE record_date END,visit_id=CASE WHEN $6 THEN $7::uuid ELSE visit_id END,version=version+1 WHERE id=ANY($1::uuid[]) RETURNING id,version`,
      [
        all.map((m) => m.id),
        !!fields.description?.apply,
        fields.description?.apply ? text(fields.description.value, 1000, false, true) : '',
        !!fields.recordDate?.apply,
        fields.recordDate?.value ?? null,
        !!fields.visitId?.apply,
        fields.visitId?.value ?? null,
      ],
    );
    await activity(c, s.group_id);
    return operation(c, 'metadata_change', 'succeeded', {
      appliedIds: result.map((r) => r.id),
      versions: result.map((r) => ({ id: r.id, version: Number(r.version) })),
    });
  },
  mediaDelete: async (c) => {
    const all = await rows(
      c.db,
      'SELECT * FROM media WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [c.body.mediaIds],
    );
    demand(
      all.length === c.body.mediaIds.length && all.every((m) => m.author_user_id === c.actor.id),
      'FORBIDDEN',
      403,
    );
    const results = [];
    for (const m of all) {
      await c.db.query('SAVEPOINT deletion');
      try {
        results.push({ id: m.id, status: await deleteFile(c, m) });
        await c.db.query('RELEASE SAVEPOINT deletion');
      } catch (e) {
        await c.db.query('ROLLBACK TO SAVEPOINT deletion');
        await c.db.query('RELEASE SAVEPOINT deletion');
        results.push({ id: m.id, status: 'failed', reason: mapDbError(e).code });
      }
    }
    return { operationId: c.opId, results };
  },
  mineList: async (c) => {
    let all = await rows(
      c.db,
      `SELECT m.*,CASE WHEN s.expires_at<=now() THEN 'expired' ELSE m.access_state END access_state,s.expires_at,s.retention_last_date,g.id group_id,g.name group_name,g.status group_status,s.title schedule_title,EXISTS(SELECT 1 FROM memberships mem WHERE mem.group_id=g.id AND mem.user_id=$1 AND mem.ended_at IS NULL) active_member FROM media m JOIN schedules s ON s.id=m.schedule_id JOIN groups g ON g.id=s.group_id WHERE m.author_user_id=$1 AND m.access_state<>'deleted' AND (s.expires_at IS NULL OR s.expires_at>now()-interval '30 days')`,
      [c.actor.id],
    );
    all = all.filter(
      (m) =>
        (!c.query.groupId || m.group_id === c.query.groupId) &&
        (!c.query.status ||
          (c.query.status === 'expired'
            ? m.access_state === 'expired'
            : c.query.status === 'active_membership'
              ? m.active_member
              : !m.active_member)),
    );
    const p = page(
      all,
      c.query,
      c.actor.id,
      'mine',
      (m) =>
        `${String(9999999999999 - new Date(m.completed_at).getTime()).padStart(13, '0')}:${m.id}`,
    );
    return {
      items: p.items.map((m) => ({
        media: mediaDto(m),
        groupId: m.group_id,
        groupName: m.group_name,
        scheduleTitle: m.schedule_title,
        membershipState: m.active_member ? 'active' : 'ended',
        groupState: m.group_status,
      })),
      nextCursor: p.nextCursor,
    };
  },
  exportCreate: async (c) => {
    const results = [];
    for (const id of c.body.mediaIds) {
      try {
        await fileAccess(c, id);
        const a = await one(
          c.db,
          "SELECT variant FROM assets WHERE media_id=$1 AND variant IN ('sanitized_original','view') AND state='ready' AND location_verified_absent ORDER BY (variant='sanitized_original') DESC LIMIT 1",
          [id],
        );
        demand(a, 'FILE_NOT_READY', 409);
        results.push({
          mediaId: id,
          state: 'ready',
          converted: a.variant === 'view',
          variant: a.variant,
        });
      } catch (e) {
        results.push({ mediaId: id, state: 'failed', reason: mapDbError(e).code });
      }
    }
    const state = results.every((r) => r.state === 'ready')
      ? 'ready'
      : results.some((r) => r.state === 'ready')
        ? 'partial'
        : 'failed';
    const e = await one(
      c.db,
      "INSERT INTO export_jobs(user_id,purpose,state,targets,results,expires_at) VALUES($1,'save',$2,$3,$4,now()+interval '1 hour') RETURNING *",
      [c.actor.id, state, JSON.stringify(c.body.mediaIds), JSON.stringify(results)],
    );
    return { exportId: e.id, state, results };
  },
  exportGet: async (c) => {
    const e = await one(c.db, 'SELECT * FROM export_jobs WHERE id=$1 AND user_id=$2', [
      c.params.exportId,
      c.actor.id,
    ]);
    demand(e, 'FORBIDDEN', 403);
    return { export: { id: e.id, state: e.state, expiresAt: e.expires_at }, results: e.results };
  },
  exportFile: async (c) => {
    const e = await one(c.db, 'SELECT * FROM export_jobs WHERE id=$1 AND user_id=$2', [
      c.params.exportId,
      c.actor.id,
    ]);
    demand(e && e.targets.includes(c.params.mediaId), 'FORBIDDEN', 403);
    demand(new Date(e.expires_at) > new Date(), 'EXPIRED', 410);
    await fileAccess(c, c.params.mediaId);
    const r = e.results.find((r: any) => r.mediaId === c.params.mediaId && r.state === 'ready');
    demand(r, 'FILE_NOT_READY', 409);
    return assetReply(c, c.params.mediaId, r.variant);
  },
};
function checkTransfer(t: any, headers: Record<string, any>) {
  demand(headers['upload-generation'] !== undefined, 'HEADERS_REQUIRED', 428);
  demand(Number(headers['upload-generation']) === t.upload_generation, 'GENERATION_MISMATCH', 409);
  demand(t.state !== 'cancelled', 'CANCELLED', 410);
  demand(transferable.includes(t.state), 'TASK_NOT_TRANSFERABLE', 409);
  demand(new Date(t.transport_expires_at) > new Date(), 'TRANSPORT_EXPIRED', 410);
}
export function streamFile(file: FileReply['file'], range: string | undefined) {
  let start = 0,
    end = file.bytes - 1,
    status = 200;
  const headers: Record<string, string | number> = {
    'Content-Type': file.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    demand(match && Boolean(match[1] || match[2]), 'RANGE_NOT_SATISFIABLE', 416);
    if (!match[1]) start = Math.max(0, file.bytes - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    demand(start <= end && start < file.bytes, 'RANGE_NOT_SATISFIABLE', 416);
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${file.bytes}`;
  }
  headers['Content-Length'] = end - start + 1;
  return { status, headers, stream: createReadStream(file.path, { start, end }) };
}
