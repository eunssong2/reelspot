import { randomUUID } from 'node:crypto';
import { tx, one } from '../core/db.js';
import { groupHandlers } from '../services/groups.js';
/** Rotate expired/exhausted codes even while no participant has the app open. */
export async function rotateInvitation() {
  return tx(async (db) => {
    const g = await one(db, `SELECT g.* FROM groups g JOIN users u ON u.id=g.owner_user_id
      WHERE g.status='active' AND u.status='active' AND NOT g.invite_rotation_paused
      AND EXISTS(SELECT 1 FROM invitations i WHERE i.group_id=g.id AND i.revoked_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM invitations i WHERE i.group_id=g.id AND i.revoked_at IS NULL AND i.expires_at>now() AND i.use_count<i.max_uses)
      ORDER BY g.id LIMIT 1 FOR UPDATE OF g SKIP LOCKED`);
    if (!g) return false;
    const actor = await one(db, 'SELECT * FROM users WHERE id=$1', [g.owner_user_id]);
    await groupHandlers.inviteCurrent({ db, actor: { ...actor, sessionId: '' } as any, body: {}, query: {}, headers: {}, params: { groupId: g.id }, opId: randomUUID() });
    return true;
  });
}
