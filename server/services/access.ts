import { one, rows, type DBRow } from '../core/db.js';
import type { Context } from '../core/context.js';
import { demand } from '../core/errors.js';
import { date, isExpired } from '../core/policy.js';
export async function groupAccess(
  c: Context,
  id: string,
  owner = false,
  allowRestricted = false,
): Promise<DBRow & { membership: DBRow }> {
  const g = await one(c.db, 'SELECT * FROM groups WHERE id=$1 FOR UPDATE', [id]);
  demand(g, 'NOT_FOUND', 404);
  demand(g.status === 'active', 'GROUP_CLOSED', 410);
  demand(
    c.actor.status === 'active' || (allowRestricted && c.actor.status === 'restricted'),
    'ACCESS_REVOKED',
    403,
  );
  const m = await one(
    c.db,
    'SELECT * FROM memberships WHERE group_id=$1 AND user_id=$2 AND ended_at IS NULL',
    [id, c.actor.id],
  );
  demand(m, 'FORBIDDEN', 403);
  if (owner) demand(g.owner_user_id === c.actor.id, 'FORBIDDEN', 403);
  return { ...g, membership: m };
}
export async function scheduleAccess(
  c: Context,
  id: string,
  owner = false,
  newWrite = false,
): Promise<DBRow & { group: DBRow & { membership: DBRow } }> {
  const initial = await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [id]);
  demand(initial, 'NOT_FOUND', 404);
  const g = await groupAccess(c, initial.group_id, owner),
    s = await one(c.db, 'SELECT * FROM schedules WHERE id=$1 FOR UPDATE', [id]);
  demand(s.status !== 'deleted', 'DELETED', 410);
  if (newWrite) demand(s.status === 'active', 'SCHEDULE_CANCELLED', 409);
  return { ...s, group: g };
}
export async function fileAccess(c: Context, id: string, context = 'shared') {
  const m = await one(
    c.db,
    `SELECT m.*,s.group_id,s.expires_at,s.end_date,s.cancelled_end_date,g.status group_status FROM media m JOIN schedules s ON s.id=m.schedule_id JOIN groups g ON g.id=s.group_id WHERE m.id=$1`,
    [id],
  );
  demand(m, 'NOT_FOUND', 404);
  demand(m.access_state !== 'deleted', 'DELETED', 410);
  demand(!isExpired(m) && m.access_state !== 'expired', 'EXPIRED', 410);
  demand(m.access_state === 'available', 'MODERATION_RESTRICTED', 403);
  if (context === 'mine') {
    demand(m.author_user_id === c.actor.id, 'FORBIDDEN', 403);
    return m;
  }
  await groupAccess(c, m.group_id);
  const b = await one(
    c.db,
    'SELECT 1 FROM personal_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2',
    [c.actor.id, m.author_user_id],
  );
  demand(!b, 'BLOCKED', 403);
  return m;
}
export async function taskAccess(c: Context, id: string, transfer = false) {
  const t = await one(c.db, 'SELECT * FROM upload_tasks WHERE id=$1', [id]);
  demand(t && t.author_user_id === c.actor.id, 'FORBIDDEN', 403);
  if (transfer) {
    if (t.visit_id)
      demand(
        await one(c.db, 'SELECT 1 FROM visits WHERE id=$1 AND deleted_at IS NULL', [t.visit_id]),
        'DELETED',
        410,
      );
    if (t.cover_group_id) await groupAccess(c, t.cover_group_id, true);
    else if (t.avatar_user_id)
      demand(t.avatar_user_id === c.actor.id && c.actor.status === 'active', 'ACCESS_REVOKED', 403);
    else {
      const s = await scheduleAccess(c, t.schedule_id);
      demand(!isExpired(s), 'EXPIRED', 410);
      demand(
        s.status !== 'cancelled' || new Date(t.accepted_at) <= new Date(s.cancelled_at),
        'SCHEDULE_CANCELLED',
        409,
      );
    }
  }
  return t;
}
export async function activity(c: Context, groupId: string) {
  await c.db.query('UPDATE groups SET activity_at=now(),version=version+1 WHERE id=$1', [groupId]);
}
export function profileDto(r: any) {
  return {
    id: r.id,
    displayName: r.display_name,
    status: r.status,
    version: Number(r.version),
    avatarVersion: avatarVersion(r),
  };
}
export function avatarVersion(r: any): number | null {
  return r.avatar_asset_id ? Number(r.avatar_version) : null;
}
export function scheduleDto(r: any) {
  return {
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    timezone: 'Asia/Seoul',
    status: r.status,
    version: Number(r.version),
    ...(r.retention_fixed_at
      ? {
          retentionFixedAt: r.retention_fixed_at,
          retentionLastDate: r.retention_last_date,
          expiresAt: r.expires_at,
        }
      : {}),
  };
}
export function visitDto(r: any) {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    placeId: r.place_id,
    visitDate: r.visit_date,
    position: r.position,
    plannedTime: r.planned_time?.slice(0, 5) ?? null,
    version: Number(r.version),
    name: r.name,
    address: r.address,
    lat: r.latitude == null ? null : Number(r.latitude),
    lng: r.longitude == null ? null : Number(r.longitude),
  };
}
export async function groupDto(c: Context, g: any) {
  const warnings = await rows(
    c.db,
    `SELECT id,title,retention_last_date,expires_at,
       CASE WHEN expires_at <= now() + interval '1 day' THEN 'last_day' ELSE 'week' END urgency
     FROM schedules WHERE group_id=$1 AND status<>'deleted' AND retention_fixed_at IS NOT NULL
       AND expires_at>now() AND expires_at<=now()+interval '7 days'
     ORDER BY expires_at,id`,
    [g.id],
  );
  const n = await one(
    c.db,
    'SELECT count(*)::int n FROM memberships WHERE group_id=$1 AND ended_at IS NULL',
    [g.id],
  );
  const s = await one(
    c.db,
    `SELECT * FROM schedules WHERE group_id=$1 AND status='active' ORDER BY CASE WHEN start_date<=current_date AND end_date>=current_date THEN 0 WHEN start_date>current_date THEN 1 ELSE 2 END, CASE WHEN start_date>current_date THEN start_date END ASC, end_date DESC,id DESC LIMIT 1`,
    [g.id],
  );
  return {
    id: g.id,
    name: g.name,
    ownerUserId: g.owner_user_id,
    status: g.status,
    activeCount: n.n,
    capacity: 10,
    activityAt: g.activity_at,
    version: Number(g.version),
    ...(s ? { scheduleSummary: scheduleDto(s) } : {}),
    membershipId: g.membership?.id,
    coverAssetId: g.cover_asset_id,
    retentionWarnings: warnings.map((s) => ({ scheduleId: s.id, title: s.title, lastDate: s.retention_last_date, urgency: s.urgency })),
  };
}
export async function requireReauth(c: Context, proof: string) {
  demand(typeof proof === 'string', 'REAUTH_REQUIRED', 401);
  const { hash } = await import('../core/crypto.js');
  demand(
    await one(
      c.db,
      'SELECT 1 FROM reauth_proofs WHERE token_hash=$1 AND user_id=$2 AND session_id=$3 AND expires_at>now()',
      [hash(proof), c.actor.id, c.actor.sessionId],
    ),
    'REAUTH_REQUIRED',
    401,
  );
}
export async function cancelPending(c: Context, where: string, args: unknown[]) {
  const tasks = await rows(
    c.db,
    `SELECT * FROM upload_tasks WHERE ${where} AND state NOT IN ('complete','cancelled') FOR UPDATE`,
    args,
  );
  for (const t of tasks) {
    const gid = await taskGroupId(c, t);
    if (gid)
      await c.db.query('UPDATE groups SET reserved_bytes=reserved_bytes-$2 WHERE id=$1', [
        gid,
        t.reserved_bytes,
      ]);
    await c.db.query(
      "UPDATE upload_tasks SET state='cancelled',reserved_bytes=0,version=version+1 WHERE id=$1",
      [t.id],
    );
    await cleanup(c, 'task', t.id, Number(t.version) + 1);
  }
}
export async function cleanup(c: Context, type: string, id: string, generation: number) {
  await c.db.query(
    'INSERT INTO cleanup_jobs(target_type,target_id,generation,due_at) VALUES($1,$2,$3,now()) ON CONFLICT DO NOTHING',
    [type, id, generation],
  );
}
/** Group whose storage pays for the task. Profile photos are not counted against a group. */
export async function taskGroupId(c: Context, t: any): Promise<string | null> {
  if (t.avatar_user_id) return null;
  return (
    t.cover_group_id ??
    (await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [t.schedule_id])).group_id
  );
}
export async function cleanupAvatar(c: Context, assetId: string) {
  const a = await one(c.db, 'SELECT object_key FROM assets WHERE id=$1', [assetId]);
  if (a) await cleanup(c, 'avatar_task', a.object_key.split('/')[1], Date.now());
}
export async function cleanupCover(c: Context, assetId: string) {
  const a = await one(c.db, 'SELECT object_key FROM assets WHERE id=$1', [assetId]);
  if (a) {
    const taskId = a.object_key.split('/')[1];
    await cleanup(c, 'cover_task', taskId, Date.now());
  }
}
export async function deleteFile(c: Context, m: any) {
  if (m.access_state === 'deleted') return 'already_deleted';
  await c.db.query(
    "UPDATE media SET access_state='deleted',deleted_at=now(),description='',version=version+1 WHERE id=$1",
    [m.id],
  );
  await c.db.query(
    "UPDATE assets SET state='delete_pending' WHERE media_id=$1 AND state<>'purged'",
    [m.id],
  );
  await cleanup(c, 'media', m.id, Number(m.version) + 1);
  const s = await one(c.db, 'SELECT group_id FROM schedules WHERE id=$1', [m.schedule_id]);
  await activity(c, s.group_id);
  return 'deleted';
}
export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = Date.parse(start); d <= Date.parse(end); d += 86400000)
    out.push(new Date(d).toISOString().slice(0, 10));
  return out;
}
export type DayDto = {
  date: string;
  dayNo: number;
  title: string | null;
  status: 'active' | 'cancelled';
  visitCount: number;
};
export async function scheduleDays(c: Context, ids: string[]) {
  const all = await rows(
    c.db,
    `SELECT d.schedule_id,d.day_date,row_number() OVER (PARTITION BY d.schedule_id ORDER BY d.day_date)::int day_no,NULLIF(p.title,'') title,d.status,
       (SELECT count(*)::int FROM visits v WHERE v.schedule_id=d.schedule_id AND v.visit_date=d.day_date AND v.deleted_at IS NULL) visit_count
     FROM schedule_days d LEFT JOIN day_plans p ON p.schedule_id=d.schedule_id AND p.plan_date=d.day_date
     WHERE d.schedule_id=ANY($1::uuid[]) ORDER BY d.schedule_id,d.day_date`,
    [ids],
  );
  const map = new Map<string, DayDto[]>(ids.map((id) => [id, []]));
  for (const d of all)
    map.get(d.schedule_id)!.push({
      date: d.day_date,
      dayNo: d.day_no,
      title: d.title,
      status: d.status,
      visitCount: d.visit_count,
    });
  return map;
}
/** A date accepts new visits/files only when it is an active day of the schedule. */
export async function scheduleDay(c: Context, s: { id: string }, d: string, allowCancelled = false) {
  date(d);
  const day = await one(c.db, 'SELECT * FROM schedule_days WHERE schedule_id=$1 AND day_date=$2', [
    s.id,
    d,
  ]);
  demand(day, 'DATE_OUTSIDE_SCHEDULE');
  demand(allowCancelled || day.status === 'active', 'DAY_CANCELLED', 409);
  return day;
}
/** Rejects dates already used by an active day of another active schedule in the group. */
export async function requireFreeDates(
  c: Context,
  groupId: string,
  dates: string[],
  exceptScheduleId: string | null = null,
) {
  if (!dates.length) return;
  const taken = await rows(
    c.db,
    `SELECT d.day_date,s.id,s.title FROM schedule_days d JOIN schedules s ON s.id=d.schedule_id
     WHERE d.group_id=$1 AND d.day_date=ANY($2::date[]) AND d.status='active' AND s.status='active'
       AND s.id IS DISTINCT FROM $3::uuid ORDER BY d.day_date,s.id`,
    [groupId, dates, exceptScheduleId],
  );
  demand(!taken.length, 'SCHEDULE_DATE_TAKEN', 409, {
    dates: [...new Set(taken.map((t) => t.day_date))],
    schedules: [...new Map(taken.map((t) => [t.id, { id: t.id, title: t.title }])).values()],
  });
}
/** Keeps schedules.start_date/end_date as the envelope of the schedule's days. */
export async function syncEnvelope(c: Context, scheduleId: string) {
  const r = await one(
    c.db,
    'SELECT min(day_date) s,max(day_date) e FROM schedule_days WHERE schedule_id=$1',
    [scheduleId],
  );
  if (!r?.s) return;
  demand(Date.parse(r.e) - Date.parse(r.s) <= 365 * 86400000, 'VALIDATION_ERROR');
  await c.db.query('UPDATE schedules SET start_date=$2,end_date=$3 WHERE id=$1', [
    scheduleId,
    r.s,
    r.e,
  ]);
}
