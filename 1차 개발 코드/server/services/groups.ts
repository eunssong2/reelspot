import { randomUUID, randomBytes } from 'node:crypto';
import { one, rows } from '../core/db.js';
import type { Handler, Context } from '../core/context.js';
import { demand, version } from '../core/errors.js';
import { hash, encrypt, decrypt } from '../core/crypto.js';
import { date, period, plannedTime, rangeDate, text, retention } from '../core/policy.js';
import { page } from '../core/paging.js';
import {
  groupAccess,
  scheduleAccess,
  groupDto,
  scheduleDto,
  visitDto,
  activity,
  cancelPending,
  deleteFile,
  cleanupCover,
  requireReauth,
} from './access.js';
import { searchPlaces } from '../adapters/places.js';
function scheduleInput(b: any) {
  period(b.startDate, b.endDate);
  demand(!b.timezone || b.timezone === 'Asia/Seoul', 'VALIDATION_ERROR');
  return text(b.title, 100);
}
async function addSchedule(c: Context, groupId: string, b: any) {
  return one(
    c.db,
    'INSERT INTO schedules(group_id,title,start_date,end_date) VALUES($1,$2,$3,$4) RETURNING *',
    [groupId, scheduleInput(b), b.startDate, b.endDate],
  );
}
function invitationDto(i: any) {
  const state = i.revoked_at
    ? 'revoked'
    : new Date(i.expires_at) <= new Date()
      ? 'expired'
      : i.use_count >= 50
        ? 'exhausted'
        : 'active';
  return {
    id: i.id,
    link: `${process.env.INVITE_APP_URL ?? 'atthatplace://invite'}?token=${encodeURIComponent(decrypt(i.token_ciphertext))}`,
    code: decrypt(i.code_ciphertext),
    issuedAt: i.issued_at,
    expiresAt: i.expires_at,
    revokedAt: i.revoked_at,
    useCount: i.use_count,
    maxUses: 50,
    state,
    version: Number(i.version),
  };
}
function validInvite(i: any) {
  demand(!i.revoked_at, 'INVITE_REVOKED', 410);
  demand(new Date(i.expires_at) > new Date(), 'INVITE_EXPIRED', 410);
  demand(i.use_count < i.max_uses, 'INVITE_EXHAUSTED', 410);
}
async function findInvite(c: Context, token: string) {
  const i = await one(c.db, 'SELECT * FROM invitations WHERE token_hash=$1 OR code_hash=$1', [
    hash(token),
  ]);
  demand(i, 'INVITE_INVALID', 404);
  return i;
}
export const groupHandlers: Record<string, Handler> = {
  groupCreate: async (c) => {
    demand(c.actor.status === 'active', 'FORBIDDEN', 403);
    const g = await one(c.db, 'INSERT INTO groups(name,owner_user_id) VALUES($1,$2) RETURNING *', [
      text(c.body.name, 50),
      c.actor.id,
    ]);
    const m = await one(
      c.db,
      'INSERT INTO memberships(group_id,user_id) VALUES($1,$2) RETURNING *',
      [g.id, c.actor.id],
    );
    const s = await addSchedule(c, g.id, c.body.firstSchedule);
    return {
      group: await groupDto(c, { ...g, membership: m }),
      membershipId: m.id,
      firstSchedule: scheduleDto(s),
    };
  },
  groupsList: async (c) => {
    const all = await rows(
      c.db,
      `SELECT g.*,m.id membership_id,m.version membership_version FROM groups g JOIN memberships m ON m.group_id=g.id WHERE m.user_id=$1 AND m.ended_at IS NULL AND g.status='active' ORDER BY g.activity_at DESC,g.created_at DESC,g.id DESC`,
      [c.actor.id],
    );
    const p = page(
      all,
      c.query,
      c.actor.id,
      'groups',
      (g) =>
        `${String(9999999999999 - new Date(g.activity_at).getTime()).padStart(13, '0')}:${g.id}`,
      30,
    );
    return {
      ...p,
      items: await Promise.all(
        p.items.map((g) =>
          groupDto(c, { ...g, membership: { id: g.membership_id, version: g.membership_version } }),
        ),
      ),
    };
  },
  groupUpdate: async (c) => {
    const g = await groupAccess(c, c.params.groupId, true);
    version(g, c.body.expectedVersion);
    demand(
      c.body.name !== undefined || c.body.coverAssetId || c.body.restoreDefault,
      'VALIDATION_ERROR',
    );
    demand(!(c.body.restoreDefault && c.body.coverAssetId), 'VALIDATION_ERROR');
    if (c.body.coverAssetId)
      demand(
        await one(
          c.db,
          "SELECT 1 FROM assets WHERE id=$1 AND cover_group_id=$2 AND state='ready' AND location_verified_absent AND moderation_state='passed'",
          [c.body.coverAssetId, g.id],
        ),
        'FILE_INVALID',
      );
    const r = await one(
      c.db,
      'UPDATE groups SET name=$2,cover_asset_id=$3,version=version+1,activity_at=now() WHERE id=$1 RETURNING *',
      [
        g.id,
        c.body.name === undefined ? g.name : text(c.body.name, 50),
        c.body.restoreDefault ? null : (c.body.coverAssetId ?? g.cover_asset_id),
      ],
    );
    if (g.cover_asset_id && g.cover_asset_id !== r.cover_asset_id)
      await cleanupCover(c, g.cover_asset_id);
    if (g.cover_asset_id && g.cover_asset_id !== r.cover_asset_id)
      await c.db.query("UPDATE assets SET state='delete_pending' WHERE id=$1", [g.cover_asset_id]);
    return groupDto(c, r);
  },
  calendar: async (c) => {
    await groupAccess(c, c.params.groupId);
    period(c.query.from, c.query.to);
    const s = await rows(
      c.db,
      "SELECT * FROM schedules WHERE group_id=$1 AND status<>'deleted' AND start_date<=$3 AND end_date>=$2 ORDER BY start_date,id",
      [c.params.groupId, c.query.from, c.query.to],
    );
    const counts: Record<string, number> = {};
    for (let d = Date.parse(c.query.from); d <= Date.parse(c.query.to); d += 86400000) {
      const k = new Date(d).toISOString().slice(0, 10);
      counts[k] = s.filter((s) => s.start_date <= k && s.end_date >= k).length;
    }
    return { schedules: s.map(scheduleDto), dateCounts: counts };
  },
  scheduleCreate: async (c) => {
    await groupAccess(c, c.params.groupId, true);
    const s = await addSchedule(c, c.params.groupId, c.body);
    await activity(c, s.group_id);
    return scheduleDto(s);
  },
  scheduleDetail: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId);
    const plans = await rows(
      c.db,
      'SELECT * FROM day_plans WHERE schedule_id=$1 ORDER BY plan_date',
      [s.id],
    );
    const visits = await rows(
      c.db,
      'SELECT v.*,p.name,p.address,p.latitude,p.longitude FROM visits v JOIN places p ON p.id=v.place_id WHERE schedule_id=$1 AND deleted_at IS NULL ORDER BY visit_date,position',
      [s.id],
    );
    const dates = [
      ...new Set([...Array.from({ length: Math.floor((Date.parse(s.end_date) - Date.parse(s.start_date)) / 86400000) + 1 }, (_, i) => new Date(Date.parse(s.start_date) + i * 86400000).toISOString().slice(0, 10)), ...plans.map((p) => p.plan_date), ...visits.map((v) => v.visit_date)]),
    ].sort();
    const r = retention(s.end_date);
    return {
      schedule: scheduleDto(s),
      retention: {
        fixed: !!s.retention_fixed_at,
        lastDate: s.retention_last_date ?? r.lastDate,
        expiresAt: s.expires_at ?? r.expiresAt,
      },
      plan: dates.map((d) => ({
        date: d,
        title: plans.find((p) => p.plan_date === d)?.title ?? '',
        version: Number(plans.find((p) => p.plan_date === d)?.version ?? 1),
        visits: visits.filter((v) => v.visit_date === d).map(visitDto),
        visitCount: visits.filter((v) => v.visit_date === d).length,
        visitLimit: 15,
        outsideRange: d < s.start_date || d > s.end_date,
      })),
      version: Number(s.version),
    };
  },
  scheduleUpdate: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, true, true);
    version(s, c.body.expectedVersion);
    demand(
      ['title', 'startDate', 'endDate'].some((k) => c.body[k] !== undefined),
      'VALIDATION_ERROR',
    );
    const b = {
      title: c.body.title ?? s.title,
      startDate: c.body.startDate ?? s.start_date,
      endDate: c.body.endDate ?? s.end_date,
    };
    scheduleInput(b);
    const v = await one(
      c.db,
      'SELECT count(*)::int n FROM visits WHERE schedule_id=$1 AND deleted_at IS NULL AND (visit_date<$2 OR visit_date>$3)',
      [s.id, b.startDate, b.endDate],
    );
    const m = await one(
      c.db,
      "SELECT count(*)::int n FROM media WHERE schedule_id=$1 AND access_state NOT IN ('deleted','expired') AND (record_date<$2 OR record_date>$3)",
      [s.id, b.startDate, b.endDate],
    );
    demand(
      c.body.confirmOutsideRange || (!v.n && !m.n),
      'OUTSIDE_RANGE_CONFIRMATION_REQUIRED',
      409,
      { visits: v.n, media: m.n },
    );
    const r = await one(
      c.db,
      'UPDATE schedules SET title=$2,start_date=$3,end_date=$4,version=version+1 WHERE id=$1 RETURNING *',
      [s.id, b.title, b.startDate, b.endDate],
    );
    await activity(c, s.group_id);
    return scheduleDto(r);
  },
  scheduleCancel: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, true);
    version(s, c.body.expectedVersion);
    demand(s.status !== 'cancelled', 'ALREADY_CANCELLED', 409);
    const r = await one(
      c.db,
      "UPDATE schedules SET status='cancelled',version=version+1 WHERE id=$1 RETURNING *",
      [s.id],
    );
    await activity(c, s.group_id);
    return scheduleDto(r);
  },
  scheduleDelete: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, true);
    version(s, c.body.expectedVersion);
    await c.db.query("UPDATE schedules SET status='deleted',version=version+1 WHERE id=$1", [s.id]);
    const v = await rows(
      c.db,
      'UPDATE visits SET deleted_at=now(),position=NULL,version=version+1 WHERE schedule_id=$1 AND deleted_at IS NULL RETURNING id',
      [s.id],
    );
    await activity(c, s.group_id);
    return { deletedId: s.id, deletedVisitIds: v.map((v) => v.id) };
  },
  placesSearch: async (c) => {
    await groupAccess(c, c.query.groupId);
    text(c.query.query, 100);
    const result = await searchPlaces(c.query);
    for (const p of result.places) {
      const existing = await one(
        c.db,
        'SELECT id FROM places WHERE group_id=$1 AND provider=$2 AND provider_place_id=$3',
        [c.query.groupId, result.provider, p.id],
      );
      if (!existing)
        await c.db.query(
          'INSERT INTO places(group_id,provider,provider_place_id,name,address,latitude,longitude,normalized_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [c.query.groupId, result.provider, p.id, p.name, p.address, p.lat, p.lng, hash(result.provider + ':' + p.id)],
        );
    }
    return result;
  },
  visitCreate: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId, false, true);
    rangeDate(s, c.body.visitDate);
    demand(Boolean(c.body.manual) !== Boolean(c.body.providerPlaceId), 'VALIDATION_ERROR');
    let p: any;
    if (c.body.manual) {
      const m = c.body.manual;
      demand((m.lat == null) === (m.lng == null), 'VALIDATION_ERROR');
      const name = text(m.name, 100),
        address = m.address == null ? '' : text(m.address, 200, false);
      const lat = m.lat == null ? null : Number(Number(m.lat).toFixed(6)),
        lng = m.lng == null ? null : Number(Number(m.lng).toFixed(6));
      const key = hash(
        JSON.stringify([name.replace(/\s+/g, ' '), address.replace(/\s+/g, ' '), lat, lng]),
      );
      p = await one(
        c.db,
        "INSERT INTO places(group_id,provider,name,address,latitude,longitude,normalized_fingerprint) VALUES($1,'manual',$2,$3,$4,$5,$6) RETURNING *",
        [s.group_id, name, address, lat, lng, key],
      );
    } else {
      p = await one(
        c.db,
        "SELECT * FROM places WHERE group_id=$1 AND provider=$3 AND provider_place_id=$2",
        [s.group_id, c.body.providerPlaceId, process.env.PLACES_PROVIDER ?? 'google'],
      );
      demand(p, 'PLACE_SEARCH_REQUIRED', 409);
    }
    const key =
      p.provider !== 'manual'
        ? `${p.provider}:${p.provider_place_id}`
        : `manual:${p.normalized_fingerprint}`;
    demand(
      !(await one(
        c.db,
        'SELECT 1 FROM visits WHERE schedule_id=$1 AND visit_date=$2 AND dedupe_key=$3 AND deleted_at IS NULL',
        [s.id, c.body.visitDate, key],
      )),
      'DUPLICATE_VISIT',
      409,
    );
    await c.db.query(
      'INSERT INTO day_plans(schedule_id,plan_date) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [s.id, c.body.visitDate],
    );
    const n = await one(
      c.db,
      'SELECT COALESCE(max(position)+1,0)::int n FROM visits WHERE schedule_id=$1 AND visit_date=$2 AND deleted_at IS NULL',
      [s.id, c.body.visitDate],
    );
    const v = await one(
      c.db,
      'INSERT INTO visits(schedule_id,place_id,visit_date,position,planned_time,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [s.id, p.id, c.body.visitDate, n.n, plannedTime(c.body.plannedTime), key],
    );
    await c.db.query(
      'UPDATE day_plans SET version=version+1 WHERE schedule_id=$1 AND plan_date=$2',
      [s.id, c.body.visitDate],
    );
    await activity(c, s.group_id);
    return visitDto({
      ...v,
      ...{ name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude },
    });
  },
  planUpdate: async (c) => {
    const s = await scheduleAccess(c, c.params.scheduleId);
    rangeDate(s, c.params.date);
    await c.db.query('INSERT INTO day_plans(schedule_id,plan_date) VALUES($1,$2) ON CONFLICT DO NOTHING', [s.id, c.params.date]);
    const plan = await one(
      c.db,
      'SELECT * FROM day_plans WHERE schedule_id=$1 AND plan_date=$2 FOR UPDATE',
      [s.id, c.params.date],
    );
    demand(plan, 'NOT_FOUND', 404);
    version(plan, c.body.expectedVersion);
    const all = await rows(
      c.db,
      'SELECT * FROM visits WHERE schedule_id=$1 AND visit_date=$2 AND deleted_at IS NULL ORDER BY position',
      [s.id, c.params.date],
    );
    const submitted = c.body.visits;
    demand(
      all.length === submitted.length &&
        new Set(submitted.map((v: any) => v.id)).size === all.length &&
        all.every((v) => submitted.some((r: any) => r.id === v.id)) &&
        new Set(submitted.map((v: any) => v.order)).size === all.length &&
        submitted.every((v: any) => v.order >= 0 && v.order < all.length),
      'INVALID_VISIT_SET',
    );
    for (const v of submitted)
      await c.db.query(
        'UPDATE visits SET position=$2,planned_time=$3,version=version+1 WHERE id=$1',
        [v.id, v.order, plannedTime(v.plannedTime)],
      );
    const r = await one(
      c.db,
      'UPDATE day_plans SET title=$3,version=version+1 WHERE schedule_id=$1 AND plan_date=$2 RETURNING *',
      [s.id, c.params.date, text(c.body.title, 30, false)],
    );
    await activity(c, s.group_id);
    return {
      date: r.plan_date,
      title: r.title,
      version: Number(r.version),
      visits: (
        await rows(
          c.db,
          'SELECT * FROM visits WHERE schedule_id=$1 AND visit_date=$2 AND deleted_at IS NULL ORDER BY position',
          [s.id, c.params.date],
        )
      ).map(visitDto),
    };
  },
  visitDelete: async (c) => {
    const v = await one(c.db, 'SELECT * FROM visits WHERE id=$1', [c.params.visitId]);
    demand(v, 'NOT_FOUND', 404);
    const s = await scheduleAccess(c, v.schedule_id);
    version(v, c.body.expectedVersion);
    demand(!v.deleted_at, 'DELETED', 410);
    await c.db.query(
      'UPDATE visits SET deleted_at=now(),position=NULL,version=version+1 WHERE id=$1',
      [v.id],
    );
    const rest = await rows(
      c.db,
      'SELECT id FROM visits WHERE schedule_id=$1 AND visit_date=$2 AND deleted_at IS NULL ORDER BY position',
      [s.id, v.visit_date],
    );
    for (let i = 0; i < rest.length; i++)
      await c.db.query('UPDATE visits SET position=$2,version=version+1 WHERE id=$1', [
        rest[i].id,
        i,
      ]);
    await c.db.query(
      'UPDATE day_plans SET version=version+1 WHERE schedule_id=$1 AND plan_date=$2',
      [s.id, v.visit_date],
    );
    await activity(c, s.group_id);
    return { deletedId: v.id };
  },
  inviteCreate: async (c) => {
    await groupAccess(c, c.params.groupId, true);
    const code = randomBytes(6).toString('hex').toUpperCase(),
      token = randomBytes(32).toString('base64url');
    const i = await one(
      c.db,
      "INSERT INTO invitations(group_id,issuer_user_id,code_hash,token_hash,code_ciphertext,token_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '168 hours') RETURNING *",
      [
        c.params.groupId,
        c.actor.id,
        hash(code),
        hash(token),
        Buffer.from(encrypt(code)),
        Buffer.from(encrypt(token)),
      ],
    );
    return invitationDto(i);
  },
  invitesList: async (c) => {
    await groupAccess(c, c.params.groupId, true);
    return {
      invites: (
        await rows(c.db, 'SELECT * FROM invitations WHERE group_id=$1 ORDER BY issued_at DESC', [
          c.params.groupId,
        ])
      ).map(invitationDto),
    };
  },
  inviteRevoke: async (c) => {
    const i = await one(c.db, 'SELECT * FROM invitations WHERE id=$1', [c.params.inviteId]);
    demand(i, 'NOT_FOUND', 404);
    await groupAccess(c, i.group_id, true);
    version(i, c.body.expectedVersion);
    return invitationDto(
      await one(
        c.db,
        'UPDATE invitations SET revoked_at=COALESCE(revoked_at,now()),version=version+1 WHERE id=$1 RETURNING *',
        [i.id],
      ),
    );
  },
  invitePreview: async (c) => {
    const initial = await findInvite(c, c.query.tokenOrCode);
    const g = await one(c.db, 'SELECT * FROM groups WHERE id=$1 FOR UPDATE', [initial.group_id]);
    demand(g.status === 'active', 'GROUP_CLOSED', 410);
    const i = await one(c.db, 'SELECT * FROM invitations WHERE id=$1 FOR UPDATE', [initial.id]);
    validInvite(i);
    const next = await one(
      c.db,
      'UPDATE invitations SET use_count=use_count+1,version=version+1 WHERE id=$1 RETURNING *',
      [i.id],
    );
    const summary = (await groupDto(c, g)).scheduleSummary;
    return {
      groupName: g.name,
      scheduleSummary: summary
        ? { title: summary.title, startDate: summary.startDate, endDate: summary.endDate }
        : null,
      inviteState: 'active',
      usesRemaining: 50 - next.use_count,
    };
  },
  inviteJoin: async (c) => {
    const initial = await findInvite(c, c.body.tokenOrCode);
    const g = await one(c.db, 'SELECT * FROM groups WHERE id=$1 FOR UPDATE', [initial.group_id]);
    demand(g.status === 'active', 'GROUP_CLOSED', 410);
    const old = await one(
      c.db,
      'SELECT * FROM memberships WHERE group_id=$1 AND user_id=$2 AND ended_at IS NULL',
      [g.id, c.actor.id],
    );
    if (old) return { groupId: g.id, membershipId: old.id, alreadyMember: true };
    const i = await one(c.db, 'SELECT * FROM invitations WHERE id=$1 FOR UPDATE', [initial.id]);
    validInvite(i);
    demand(
      !(await one(
        c.db,
        'SELECT 1 FROM reentry_blocks WHERE group_id=$1 AND user_id=$2 AND cleared_at IS NULL',
        [g.id, c.actor.id],
      )),
      'REENTRY_BLOCKED',
      403,
    );
    const m = await one(
      c.db,
      'INSERT INTO memberships(group_id,user_id) VALUES($1,$2) RETURNING *',
      [g.id, c.actor.id],
    );
    await activity(c, g.id);
    return { groupId: g.id, membershipId: m.id, alreadyMember: false };
  },
  membersList: async (c) => {
    const g = await groupAccess(c, c.params.groupId);
    return {
      members: await rows(
        c.db,
        'SELECT m.id,m.user_id "userId",u.display_name "displayName",(m.user_id=$2) "isOwner",m.version FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.ended_at IS NULL ORDER BY joined_at',
        [g.id, g.owner_user_id],
      ),
      reentryBlocks:
        g.owner_user_id === c.actor.id
          ? await rows(
              c.db,
              'SELECT b.user_id "userId",u.display_name "displayName",b.version FROM reentry_blocks b JOIN users u ON u.id=b.user_id WHERE b.group_id=$1 AND b.cleared_at IS NULL',
              [g.id],
            )
          : [],
    };
  },
  ownerTransfer: async (c) => {
    const special = c.body.purpose === 'account_deletion';
    if (special) await requireReauth(c, c.body.reauthProof);
    const g = await groupAccess(c, c.params.groupId, true, special);
    version(g, c.body.expectedVersion);
    const m = await one(
      c.db,
      "SELECT m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.group_id=$2 AND m.ended_at IS NULL AND u.status='active'",
      [c.body.targetMembershipId, g.id],
    );
    demand(m && m.user_id !== c.actor.id, 'TARGET_INACTIVE', 409);
    const r = await one(
      c.db,
      'UPDATE groups SET owner_user_id=$2,version=version+1,activity_at=now() WHERE id=$1 RETURNING *',
      [g.id, m.user_id],
    );
    return { ownerUserId: r.owner_user_id, groupVersion: Number(r.version) };
  },
  memberRemove: async (c) => {
    const g = await groupAccess(c, c.params.groupId, true);
    version(g, c.body.expectedVersion);
    const m = await one(
      c.db,
      'SELECT * FROM memberships WHERE id=$1 AND group_id=$2 AND ended_at IS NULL FOR UPDATE',
      [c.body.targetMembershipId, g.id],
    );
    demand(m, 'TARGET_INACTIVE', 409);
    demand(m.user_id !== c.actor.id, 'SELF_TARGET');
    await c.db.query(
      "UPDATE memberships SET ended_at=now(),end_reason='removed',version=version+1 WHERE id=$1",
      [m.id],
    );
    const b = await one(
      c.db,
      'INSERT INTO reentry_blocks(group_id,user_id,created_by) VALUES($1,$2,$3) RETURNING *',
      [g.id, m.user_id, c.actor.id],
    );
    await cancelPending(
      c,
      'author_user_id=$1 AND schedule_id IN (SELECT id FROM schedules WHERE group_id=$2)',
      [m.user_id, g.id],
    );
    await activity(c, g.id);
    return {
      membership: { id: m.id, ended: true },
      reentryBlock: { userId: b.user_id, version: Number(b.version) },
    };
  },
  reentryUnblock: async (c) => {
    const g = await groupAccess(c, c.params.groupId, true);
    const b = await one(
      c.db,
      'SELECT * FROM reentry_blocks WHERE group_id=$1 AND user_id=$2 AND cleared_at IS NULL FOR UPDATE',
      [g.id, c.params.userId],
    );
    demand(b, 'NOT_FOUND', 404);
    version(b, c.body.expectedVersion);
    await c.db.query('UPDATE reentry_blocks SET cleared_at=now(),version=version+1 WHERE id=$1', [
      b.id,
    ]);
    return { unblocked: true };
  },
  groupLeave: async (c) => {
    const g = await groupAccess(c, c.params.groupId);
    demand(g.owner_user_id !== c.actor.id, 'OWNER_TRANSFER_REQUIRED', 409);
    demand(g.membership.id === c.body.membershipId, 'VERSION_CONFLICT', 409);
    version(g.membership, c.body.expectedVersion);
    await c.db.query(
      "UPDATE memberships SET ended_at=now(),end_reason='left',version=version+1 WHERE id=$1",
      [g.membership.id],
    );
    await cancelPending(
      c,
      'author_user_id=$1 AND schedule_id IN (SELECT id FROM schedules WHERE group_id=$2)',
      [c.actor.id, g.id],
    );
    await activity(c, g.id);
    return { left: true };
  },
  groupClose: async (c) => {
    const special = c.body.purpose === 'account_deletion';
    if (special) await requireReauth(c, c.body.reauthProof);
    const g = await groupAccess(c, c.params.groupId, true, special);
    version(g, c.body.expectedVersion);
    const n = await one(
      c.db,
      'SELECT count(*)::int n FROM memberships WHERE group_id=$1 AND ended_at IS NULL',
      [g.id],
    );
    demand(n.n === 1, 'MEMBERS_REMAIN', 409);
    await c.db.query(
      "UPDATE groups SET status='closed',closed_at=now(),cover_asset_id=NULL,version=version+1 WHERE id=$1",
      [g.id],
    );
    for (const asset of await rows(
      c.db,
      "SELECT id FROM assets WHERE cover_group_id=$1 AND variant='sanitized_original' AND state<>'purged'",
      [g.id],
    ))
      await cleanupCover(c, asset.id);
    await c.db.query(
      "UPDATE memberships SET ended_at=now(),end_reason='group_closed',version=version+1 WHERE group_id=$1 AND ended_at IS NULL",
      [g.id],
    );
    await c.db.query(
      'UPDATE invitations SET revoked_at=COALESCE(revoked_at,now()),version=version+1 WHERE group_id=$1',
      [g.id],
    );
    await cancelPending(
      c,
      'cover_group_id=$1 OR schedule_id IN (SELECT id FROM schedules WHERE group_id=$1)',
      [g.id],
    );
    await c.db.query(
      'UPDATE day_plans SET title=NULL WHERE schedule_id IN (SELECT id FROM schedules WHERE group_id=$1)',
      [g.id],
    );
    await c.db.query(
      "UPDATE visits SET planned_time=NULL,dedupe_key='closed:'||id::text WHERE schedule_id IN (SELECT id FROM schedules WHERE group_id=$1)",
      [g.id],
    );
    await c.db.query(
      "UPDATE places SET provider='manual',provider_place_id=NULL,name='정리된 장소',address=NULL,latitude=NULL,longitude=NULL,normalized_fingerprint=md5(id::text) WHERE group_id=$1",
      [g.id],
    );
    for (const m of await rows(
      c.db,
      'SELECT m.* FROM media m JOIN schedules s ON s.id=m.schedule_id WHERE s.group_id=$1 AND m.author_user_id=$2',
      [g.id, c.actor.id],
    ))
      await deleteFile(c, m);
    return { closed: true, deletionOperationId: c.opId };
  },
  storageUsage: async (c) => {
    const g = await groupAccess(c, c.params.groupId);
    return {
      completedOriginalBytes: g.completed_bytes,
      reservedBytes: g.reserved_bytes,
      limitBytes: 5000000000,
      availableBytes: 5000000000 - g.completed_bytes - g.reserved_bytes,
    };
  },
};
