import { randomUUID } from 'node:crypto';
import { one, rows } from '../core/db.js';
import type { Context, Handler } from '../core/context.js';
import { demand, version } from '../core/errors.js';
import { text, businessDeadline } from '../core/policy.js';
import { page } from '../core/paging.js';
import { encrypt, decrypt } from '../core/crypto.js';
import { objects } from '../adapters/object-store.js';
import { activity, cancelPending, deleteFile, groupAccess, requireReauth } from './access.js';
export async function notify(
  c: Context,
  userId: string,
  kind: string,
  payload: any,
  caseId: string | null = null,
  recoveryId: string | null = null,
) {
  await c.db.query(
    'INSERT INTO account_notifications(user_id,kind,payload,case_id,recovery_request_id) VALUES($1,$2,$3,$4,$5)',
    [userId, kind, JSON.stringify(payload), caseId, recoveryId],
  );
}
export async function newCase(
  c: Context,
  type: string,
  targetType: string,
  targetId: string,
  reason: string,
  reporter: string | null = c.actor?.id,
) {
  const id = randomUUID(),
    snapshot: any = { targetType, targetId, receivedAt: new Date().toISOString() };
  if (targetType === 'operation') snapshot.proposedInput = c.body;
  if (targetType === 'media') {
    snapshot.media = await one(
      c.db,
      'SELECT id,description,kind,record_date,author_user_id FROM media WHERE id=$1',
      [targetId],
    );
    const asset = await one(
      c.db,
      "SELECT * FROM assets WHERE media_id=$1 AND variant='view' AND state='ready'",
      [targetId],
    );
    if (asset && (await objects.exists(asset.object_key))) {
      snapshot.file = (await objects.get(asset.object_key)).toString('base64');
      snapshot.mime = asset.probe_result.mime;
    }
  } else if (targetType === 'task') {
    const task = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1', [targetId]);
    snapshot.description = task.description;
    snapshot.kind = task.kind;
    for (const ext of ['jpg', 'png', 'mp4']) {
      const key = `assets/${task.id}/${task.upload_generation}/view.${ext}`;
      if (await objects.exists(key)) {
        snapshot.file = (await objects.get(key)).toString('base64');
        snapshot.mime = ext === 'mp4' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg';
        break;
      }
    }
  } else if (targetType === 'cover') {
    const asset = await one(c.db, "SELECT * FROM assets WHERE id=$1 AND state='ready'", [targetId]);
    if (asset && (await objects.exists(asset.object_key))) {
      snapshot.file = (await objects.get(asset.object_key)).toString('base64');
      snapshot.mime = asset.probe_result.mime;
    }
  } else if (targetType === 'member')
    snapshot.member = await one(
      c.db,
      'SELECT m.id,u.display_name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=$1',
      [targetId],
    );
  const evidenceRef = `evidence/${id}.encrypted`;
  await objects.put(evidenceRef, Buffer.from(encrypt(snapshot)));
  return one(
    c.db,
    'INSERT INTO reports_and_cases(id,reporter_user_id,type,target_type,target_id,reason,review_due_at,evidence_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [id, reporter, type, targetType, targetId, reason, type === 'appeal' ? businessDeadline(new Date(), 3, (process.env.OPS_HOLIDAYS ?? '').split(',').filter(Boolean)) : new Date(Date.now() + 86400000), evidenceRef],
  );
}
async function evidence(r: any) {
  demand(
    r.evidence_ref && (!r.evidence_delete_at || new Date(r.evidence_delete_at) > new Date()),
    'EVIDENCE_EXPIRED',
    410,
  );
  return decrypt(
    r.evidence_ref.startsWith('evidence/')
      ? (await objects.get(r.evidence_ref)).toString()
      : r.evidence_ref,
  );
}

function role(c: Context, name: string) {
  demand(c.operator?.roles.includes(name), 'OPS_FORBIDDEN', 403);
}
async function audit(
  c: Context,
  target: any,
  action: string,
  reason: string,
  before: any,
  after: any,
  recovery = false,
) {
  const id = randomUUID();
  await c.db.query(
    'INSERT INTO operator_audit(id,operator_id,case_id,recovery_request_id,target_type,target_id,action,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      id,
      c.operator!.subject,
      recovery ? null : target.id,
      recovery ? target.id : null,
      recovery ? 'group' : target.target_type,
      recovery ? target.group_id : target.target_id,
      action,
      reason,
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );
  return id;
}
export const operationHandlers: Record<string, Handler> = {
  opsEvidence: async (c) => {
    role(c, 'case_reviewer');
    const r = await one(c.db, 'SELECT * FROM reports_and_cases WHERE id=$1', [c.params.caseId]);
    demand(r, 'NOT_FOUND', 404);
    const e = await evidence(r);
    demand(e.file, 'EVIDENCE_NOT_AVAILABLE', 404);
    return { binary: { data: Buffer.from(e.file, 'base64'), mime: e.mime } };
  },
  opsRecoveryNotice: async (c) => notifyRecoveryOwner(c, c.params.requestId),
  operationGet: async (c) => {
    const o = await one(c.db, 'SELECT * FROM operations WHERE id=$1', [c.params.operationId]);
    demand(o && (o.actor_id === c.actor?.id || c.operator), 'FORBIDDEN', 403);
    return (
      o.response_snapshot ?? {
        operationId: o.id,
        kind: o.kind,
        state: o.state,
        result: null,
        itemErrors: [],
      }
    );
  },
  deletionPreconditions: async (c) => {
    const groups = await rows(
      c.db,
      "SELECT * FROM groups WHERE owner_user_id=$1 AND status='active' ORDER BY id",
      [c.actor.id],
    );
    const owned = [];
    for (const g of groups) {
      const members = await rows(
        c.db,
        'SELECT m.id,m.user_id,u.display_name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.ended_at IS NULL',
        [g.id],
      );
      owned.push({
        groupId: g.id,
        name: g.name,
        groupVersion: Number(g.version),
        activeCount: members.length,
        candidates: members
          .filter((m) => m.user_id !== c.actor.id)
          .map((m) => ({ membershipId: m.id, displayName: m.display_name })),
        allowedAction: members.length === 1 ? 'close' : 'transfer',
      });
    }
    return { ownedGroups: owned, reauthRequired: true };
  },
  accountDelete: async (c) => {
    await requireReauth(c, c.body.reauthProof);
    demand(
      !(await one(c.db, "SELECT 1 FROM groups WHERE owner_user_id=$1 AND status='active'", [
        c.actor.id,
      ])),
      'OWNER_ROLES_REMAIN',
      409,
    );
    await c.db.query("UPDATE users SET status='deleting',version=version+1 WHERE id=$1", [
      c.actor.id,
    ]);
    await c.db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [c.actor.id]);
    await cancelPending(c, 'author_user_id=$1', [c.actor.id]);
    const media = await rows(c.db, 'SELECT * FROM media WHERE author_user_id=$1 ORDER BY id', [
      c.actor.id,
    ]);
    for (const m of media) await deleteFile(c, m);
    await c.db.query(
      "UPDATE memberships SET ended_at=now(),end_reason='account_deleted',version=version+1 WHERE user_id=$1 AND ended_at IS NULL",
      [c.actor.id],
    );
    await c.db.query('DELETE FROM personal_blocks WHERE blocker_user_id=$1 OR blocked_user_id=$1', [
      c.actor.id,
    ]);
    await c.db.query('DELETE FROM reauth_proofs WHERE user_id=$1', [c.actor.id]);
    await c.db.query('DELETE FROM identities WHERE user_id=$1', [c.actor.id]);
    await c.db.query(
      "UPDATE users SET status='deleted',display_name='탈퇴한 사용자',deleted_at=now() WHERE id=$1",
      [c.actor.id],
    );
    return { deletionOperationId: c.opId, accessRevoked: true };
  },
  reportCreate: async (c) => {
    let gId: string | undefined;
    if (c.body.targetType === 'media') {
      const r = await one(
        c.db,
        'SELECT s.group_id FROM media m JOIN schedules s ON s.id=m.schedule_id WHERE m.id=$1',
        [c.body.targetId],
      );
      gId = r?.group_id;
    } else if (c.body.targetType === 'cover') {
      const r = await one(c.db, 'SELECT id FROM groups WHERE cover_asset_id=$1', [c.body.targetId]);
      gId = r?.id;
    } else {
      const r = await one(
        c.db,
        'SELECT group_id FROM memberships WHERE id=$1 AND ended_at IS NULL',
        [c.body.targetId],
      );
      gId = r?.group_id;
    }
    demand(gId, 'NOT_FOUND', 404);
    await groupAccess(c, gId);
    const r = await newCase(
      c,
      'report',
      c.body.targetType,
      c.body.targetId,
      text(c.body.reason, 2000, true, true),
    );
    return { reportId: r.id, state: r.status, reviewDueAt: r.review_due_at };
  },
  reportsMine: async (c) => {
    const data = await rows(
      c.db,
      `SELECT r.id,r.type,r.status state,r.reason,r.reference_id "referenceId",r.created_at "createdAt",r.review_due_at "reviewDueAt",a.action "decisionAction",a.reason "decisionReason" FROM reports_and_cases r LEFT JOIN LATERAL (SELECT action,reason FROM operator_audit WHERE case_id=r.id ORDER BY occurred_at DESC,id DESC LIMIT 1) a ON true WHERE r.reporter_user_id=$1 ORDER BY r.created_at DESC`,
      [c.actor.id],
    );
    const p = page(data, c.query, c.actor.id, 'reports', (r) => `${r.createdAt}:${r.id}`);
    return { reports: p.items, nextCursor: p.nextCursor };
  },
  blockCreate: async (c) => {
    demand(c.body.targetUserId !== c.actor.id, 'SELF_TARGET');
    demand(
      await one(c.db, 'SELECT 1 FROM users WHERE id=$1', [c.body.targetUserId]),
      'NOT_FOUND',
      404,
    );
    await c.db.query(
      'INSERT INTO personal_blocks(blocker_user_id,blocked_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [c.actor.id, c.body.targetUserId],
    );
    return { block: { targetUserId: c.body.targetUserId } };
  },
  blocksList: async (c) => ({
    blocks: await rows(
      c.db,
      'SELECT b.blocked_user_id "targetUserId",u.display_name "displayName",b.created_at "createdAt" FROM personal_blocks b JOIN users u ON u.id=b.blocked_user_id WHERE b.blocker_user_id=$1 ORDER BY b.created_at',
      [c.actor.id],
    ),
    nextCursor: null,
  }),
  blockDelete: async (c) => {
    await c.db.query(
      'DELETE FROM personal_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2',
      [c.actor.id, c.params.targetUserId],
    );
    return { unblocked: true };
  },
  inquiryCreate: async (c) => {
    const r = await newCase(
      c,
      c.body.category === 'report' ? 'appeal' : 'inquiry',
      'user',
      c.actor.id,
      text(c.body.reason, 2000, true, true),
    );
    if (c.body.referenceId) await c.db.query('UPDATE reports_and_cases SET reference_id=$2 WHERE id=$1', [r.id, text(c.body.referenceId, 200)]);
    return { inquiryId: r.id, state: r.status };
  },
  notificationsList: async (c) => {
    const data = await rows(
      c.db,
      'SELECT * FROM account_notifications WHERE user_id=$1 ORDER BY created_at DESC',
      [c.actor.id],
    );
    const p = page(
      data,
      c.query,
      c.actor.id,
      'notifications',
      (r) => `${r.created_at.toISOString()}:${r.id}`,
    );
    return {
      notifications: p.items.map((n) => ({
        id: n.id,
        kind: n.kind,
        message: n.payload.message ?? n.payload.reason ?? n.kind,
        referenceId: n.case_id ?? n.recovery_request_id ?? n.payload.groupId,
        createdAt: n.created_at,
        readAt: n.read_at,
        payload: n.payload,
      })),
      nextCursor: p.nextCursor,
    };
  },
  notificationRead: async (c) => {
    const r = await one(
      c.db,
      'UPDATE account_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING read_at',
      [c.params.notificationId, c.actor.id],
    );
    demand(r, 'FORBIDDEN', 403);
    return { readAt: r.read_at };
  },
  recoveryCreate: async (c) => {
    await requireReauth(c, c.body.reauthProof);
    const g = await groupAccess(c, c.params.groupId);
    const m = await one(
      c.db,
      "SELECT m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.group_id=$2 AND m.ended_at IS NULL AND u.status='active'",
      [c.body.candidateMembershipId, g.id],
    );
    demand(m && m.user_id !== g.owner_user_id, 'TARGET_INACTIVE', 409);
    const r = await one(
      c.db,
      'INSERT INTO recovery_requests(group_id,requester_id,candidate_membership_id,owner_snapshot,group_version,reason,evidence_refs) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [
        g.id,
        c.actor.id,
        m.id,
        g.owner_user_id,
        g.version,
        text(c.body.reason, 2000, true, true),
        JSON.stringify(c.body.evidenceRefs),
      ],
    );
    await notify(
      c,
      m.user_id,
      'recovery_consent_requested',
      { message: '방장 부재 복구의 후임 후보 동의를 확인해 주세요.' },
      null,
      r.id,
    );
    return { requestId: r.id, state: r.state };
  },
  recoveryGet: async (c) => {
    const r = await one(
      c.db,
      'SELECT r.*,m.user_id candidate_id FROM recovery_requests r JOIN memberships m ON m.id=r.candidate_membership_id WHERE r.id=$1',
      [c.params.requestId],
    );
    demand(
      r && [r.requester_id, r.owner_snapshot, r.candidate_id].includes(c.actor.id),
      'FORBIDDEN',
      403,
    );
    return {
      requestId: r.id,
      state: r.state,
      noticeAt: r.notified_at,
      responseDueAt: r.response_due_at,
      decisionSummary: r.decision_reason,
      candidateConsentAt: r.candidate_consent_at,
      canConsent: r.candidate_id === c.actor.id && ['received', 'verifying', 'held'].includes(r.state),
      canRespond: r.owner_snapshot === c.actor.id && ['waiting', 'notified', 'held'].includes(r.state),
    };
  },
  recoveryConsent: async (c) => {
    await requireReauth(c, c.body.reauthProof);
    const r = await one(
      c.db,
      'SELECT r.*,m.user_id,m.ended_at FROM recovery_requests r JOIN memberships m ON m.id=r.candidate_membership_id WHERE r.id=$1 FOR UPDATE OF r',
      [c.params.requestId],
    );
    demand(r && r.user_id === c.actor.id && !r.ended_at, 'FORBIDDEN', 403);
    demand(['received', 'verifying', 'held'].includes(r.state), 'VERSION_CONFLICT', 409);
    await groupAccess(c, r.group_id);
    const updated = await one(
      c.db,
      "UPDATE recovery_requests SET candidate_consent_at=CASE WHEN $2 THEN now() ELSE NULL END,state=CASE WHEN $2 THEN 'verifying' ELSE 'held' END,version=version+1 WHERE id=$1 RETURNING *",
      [r.id, c.body.agreed],
    );
    return { state: updated.state, candidateConsentAt: updated.candidate_consent_at };
  },
  recoveryResponse: async (c) => {
    const r = await one(c.db, 'SELECT * FROM recovery_requests WHERE id=$1 FOR UPDATE', [
      c.params.requestId,
    ]);
    demand(r, 'NOT_FOUND', 404);
    const g = await groupAccess(c, r.group_id, true);
    demand(g.owner_user_id === r.owner_snapshot, 'VERSION_CONFLICT', 409);
    demand(['waiting', 'notified', 'held'].includes(r.state), 'VERSION_CONFLICT', 409);
    const response = await one(
      c.db,
      'INSERT INTO recovery_responses(request_id,owner_id,response,reason) VALUES($1,$2,$3,$4) ON CONFLICT(request_id) DO UPDATE SET response=excluded.response,reason=excluded.reason,received_at=now() RETURNING received_at',
      [r.id, c.actor.id, c.body.response, text(c.body.reason, 2000, false, true)],
    );
    if (c.body.response === 'object')
      await c.db.query("UPDATE recovery_requests SET state='held',version=version+1 WHERE id=$1", [
        r.id,
      ]);
    return {
      state: c.body.response === 'object' ? 'held' : r.state,
      receivedAt: response.received_at,
    };
  },
  opsQueue: async (c) => {
    role(c, 'case_reviewer');
    const cases = await rows(
      c.db,
      'SELECT * FROM reports_and_cases WHERE ($1::text IS NULL OR type=$1) AND ($2::text IS NULL OR status=$2) ORDER BY review_due_at,id',
      [c.query.type ?? null, c.query.status ?? null],
    );
    const recoveries = await rows(
      c.db,
      "SELECT id,group_id,requester_id,state,reason,created_at,response_due_at,candidate_consent_at,notified_at,group_version FROM recovery_requests WHERE state NOT IN ('applied','rejected') ORDER BY created_at",
    );
    const maintenance = await one(c.db, "SELECT count(*)::int pending, count(*) FILTER (WHERE state='failed')::int failed, count(*) FILTER (WHERE state<>'complete' AND created_at<now()-interval '24 hours')::int overdue FROM cleanup_jobs WHERE state<>'complete'");
    return { cases, recoveries, maintenance, nextCursor: null };
  },
  opsCaseGet: async (c) => {
    role(c, 'case_reviewer');
    const r = await one(c.db, 'SELECT * FROM reports_and_cases WHERE id=$1', [c.params.caseId]);
    demand(r, 'NOT_FOUND', 404);
    const history = await rows(
      c.db,
      'SELECT operator_id,action,reason,occurred_at FROM operator_audit WHERE case_id=$1 ORDER BY occurred_at',
      [r.id],
    );
    return {
      case: { ...r, evidence_ref: undefined },
      evidenceRefs: r.evidence_ref ? [`/v1/ops/cases/${r.id}/evidence`] : [],
      evidenceSnapshot: r.evidence_ref ? { ...(await evidence(r)), file: undefined } : null,
      history,
    };
  },
  opsAction: async (c) => {
    role(c, 'content_moderator');
    const r = await one(c.db, 'SELECT * FROM reports_and_cases WHERE id=$1 FOR UPDATE', [
      c.params.caseId,
    ]);
    demand(r, 'NOT_FOUND', 404);
    version(r, c.body.expectedVersion);
    const reason = text(c.body.reason, 2000, true, true),
      action = c.body.action;
    let before: any = {},
      after: any = {};
    if (r.target_type === 'media') {
      const m = await one(c.db, 'SELECT * FROM media WHERE id=$1 FOR UPDATE', [r.target_id]);
      demand(m, 'NOT_FOUND', 404);
      before = { accessState: m.access_state };
      if (action === 'delete') await deleteFile(c, m);
      else if (['restrict', 'release'].includes(action)) {
        demand(!['deleted', 'expired'].includes(m.access_state), 'DELETED', 410);
        await c.db.query(
          'UPDATE media SET access_state=$2,moderation_state=$3,version=version+1 WHERE id=$1',
          [
            m.id,
            action === 'restrict' ? 'restricted' : 'available',
            action === 'restrict' ? 'restricted' : 'passed',
          ],
        );
      } else demand(action === 'no_action', 'VALIDATION_ERROR');
      after = { accessState: action };
      await notify(c, m.author_user_id, 'moderation_result', { message: reason }, r.id);
    } else if (r.target_type === 'cover') {
      const a = await one(c.db, 'SELECT * FROM assets WHERE id=$1 FOR UPDATE', [r.target_id]);
      demand(a, 'NOT_FOUND', 404);
      before = { state: a.moderation_state };
      const prefix = 'assets/' + a.object_key.split('/')[1] + '/%';
      if (action === 'delete') {
        await c.db.query(
          'UPDATE groups SET cover_asset_id=NULL,version=version+1 WHERE cover_asset_id=$1',
          [a.id],
        );
        await c.db.query(
          "UPDATE assets SET state='delete_pending' WHERE object_key LIKE $1 AND state<>'purged'",
          [prefix],
        );
        const { cleanupCover } = await import('./access.js');
        await cleanupCover(c, a.id);
      } else if (['restrict', 'release'].includes(action)) {
        demand(a.state === 'ready', 'DELETED', 410);
        await c.db.query('UPDATE assets SET moderation_state=$2 WHERE object_key LIKE $1', [
          prefix,
          action === 'restrict' ? 'restricted' : 'passed',
        ]);
      } else demand(action === 'no_action', 'VALIDATION_ERROR');
      after = { state: action };
    } else if (r.target_type === 'task') {
      const t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1 FOR UPDATE', [r.target_id]);
      demand(t && t.state === 'review', 'VERSION_CONFLICT', 409);
      before = { state: t.state };
      if (action === 'release') {
        await c.db.query(
          "UPDATE upload_tasks SET state='verifying',review_approved=true,version=version+1 WHERE id=$1",
          [t.id],
        );
        await c.db.query(
          "UPDATE outbox_events SET published_at=NULL,payload=payload||'{\"approved\":true}'::jsonb WHERE target_id=$1 AND event_type='media.process'",
          [t.id],
        );
      } else {
        demand(['delete', 'restrict'].includes(action), 'VALIDATION_ERROR');
        const gid =
          t.cover_group_id ??
          (await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id;
        await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
          gid,
          t.reserved_bytes,
        ]);
        await c.db.query(
          "UPDATE upload_tasks SET state='failed',error_code='MODERATION_REJECTED',reserved_bytes=0,version=version+1 WHERE id=$1",
          [t.id],
        );
      }
      after = { state: action };
      await notify(c, t.author_user_id, 'moderation_result', { message: reason }, r.id);
    } else if (r.target_type === 'operation') {
      demand(['release', 'restrict', 'delete'].includes(action), 'VALIDATION_ERROR');
      before = { state: 'review' };
      if (action === 'release')
        await c.db.query(
          "UPDATE outbox_events SET published_at=NULL,payload=payload||'{\"approved\":true}'::jsonb WHERE target_id=$1 AND event_type='text.apply'",
          [r.target_id],
        );
      else
        await c.db.query(
          'UPDATE operations SET state=\'failed\',response_snapshot=jsonb_set(jsonb_set(response_snapshot,\'{state}\',\'"failed"\'),\'{itemErrors}\',\'[{"code":"TEXT_REJECTED","message":"운영 검토에서 반려되었습니다."}]\') WHERE id=$1',
          [r.target_id],
        );
      after = { state: action };
    } else if (r.target_type === 'user' || r.target_type === 'member') {
      const uid =
        r.target_type === 'user'
          ? r.target_id
          : (await one(c.db, 'SELECT user_id FROM memberships WHERE id=$1', [r.target_id]))
              ?.user_id;
      demand(uid, 'NOT_FOUND', 404);
      const u = await one(c.db, 'SELECT * FROM users WHERE id=$1 FOR UPDATE', [uid]);
      before = { status: u.status };
      if (['restrict_account', 'release_account'].includes(action)) {
        demand(['active', 'restricted'].includes(u.status), 'ACCESS_REVOKED', 403);
        await c.db.query('UPDATE users SET status=$2,version=version+1 WHERE id=$1', [
          uid,
          action === 'restrict_account' ? 'restricted' : 'active',
        ]);
      } else demand(action === 'no_action', 'VALIDATION_ERROR');
      after = { status: action };
      await notify(c, uid, 'account_result', { message: reason }, r.id);
    } else demand(action === 'no_action', 'VALIDATION_ERROR');
    const auditId = await audit(c, r, action, reason, before, after);
    await c.db.query(
      "UPDATE reports_and_cases SET status='decided',closed_at=now(),evidence_delete_at=now()+interval '90 days',version=version+1 WHERE id=$1",
      [r.id],
    );
    if (r.reporter_user_id)
      await notify(c, r.reporter_user_id, 'report_result', { message: reason }, r.id);
    return { decision: action, auditId };
  },
  opsRecovery: async (c) => {
    role(c, 'recovery_approver');
    const r = await one(c.db, 'SELECT * FROM recovery_requests WHERE id=$1 FOR UPDATE', [
      c.params.requestId,
    ]);
    demand(r, 'NOT_FOUND', 404);
    const g = await one(c.db, 'SELECT * FROM groups WHERE id=$1 FOR UPDATE', [r.group_id]);
    demand(g.status === 'active', 'GROUP_CLOSED', 410);
    version(g, c.body.expectedGroupVersion);
    demand(
      g.owner_user_id === r.owner_snapshot && Number(g.version) === Number(r.group_version),
      'VERSION_CONFLICT',
      409,
    );
    const reason = text(c.body.reason, 2000, true, true);
    let state = c.body.decision === 'reject' ? 'rejected' : 'held';
    if (c.body.decision === 'approve') {
      demand(
        r.notified_at && new Date(r.response_due_at) <= new Date(),
        'WAIT_PERIOD_REQUIRED',
        409,
      );
      demand(
        r.candidate_consent_at && Object.values(c.body.evidenceChecklist).every(Boolean),
        'DISPUTED',
        409,
      );
      const objection = await one(
        c.db,
        "SELECT 1 FROM recovery_responses WHERE request_id=$1 AND response='object'",
        [r.id],
      );
      demand(!objection, 'DISPUTED', 409);
      const m = await one(
        c.db,
        "SELECT m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.ended_at IS NULL AND u.status='active'",
        [r.candidate_membership_id],
      );
      demand(m, 'TARGET_INACTIVE', 409);
      await c.db.query(
        'UPDATE groups SET owner_user_id=$2,version=version+1,activity_at=now() WHERE id=$1',
        [g.id, m.user_id],
      );
      state = 'applied';
    }
    await c.db.query(
      'UPDATE recovery_requests SET state=$2,decision_reason=$3,version=version+1 WHERE id=$1',
      [r.id, state, reason],
    );
    const auditId = await audit(
      c,
      r,
      c.body.decision,
      reason,
      { ownerUserId: g.owner_user_id },
      { state },
      true,
    );
    for (const uid of new Set([r.requester_id, r.owner_snapshot]))
      await notify(c, uid, 'recovery_result', { message: reason }, null, r.id);
    return { decision: state, auditId };
  },
};
export async function notifyRecoveryOwner(c: Context, id: string) {
  role(c, 'recovery_approver');
  const r = await one(c.db, 'SELECT * FROM recovery_requests WHERE id=$1 FOR UPDATE', [id]);
  demand(r && r.candidate_consent_at && !r.notified_at, 'VERSION_CONFLICT', 409);
  const g = await one(c.db, 'SELECT * FROM groups WHERE id=$1 FOR UPDATE', [r.group_id]);
  demand(g.status === 'active' && g.owner_user_id === r.owner_snapshot, 'VERSION_CONFLICT', 409);
  await notify(
    c,
    r.owner_snapshot,
    'recovery_owner_notice',
    { message: '방장 부재 복구 요청이 접수되었습니다. 7일 안에 의견을 남겨 주세요.' },
    null,
    r.id,
  );
  await c.db.query(
    "UPDATE recovery_requests SET notified_at=now(),response_due_at=now()+interval '168 hours',state='waiting',version=version+1 WHERE id=$1",
    [r.id],
  );
  const auditId = await audit(
    c,
    r,
    'notify',
    '기존 방장 계정 알림 전달 완료',
    { state: r.state },
    { state: 'waiting' },
    true,
  );
  return { notified: true, auditId };
}
