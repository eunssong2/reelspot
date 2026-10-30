import { rememberKakaoCredential, queueKakaoUnlink } from './provider-unlink.js';
import { latestDocuments } from './documents.js';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../core/config.js';
import { hash, randomToken } from '../core/crypto.js';
import { one, rows, tx } from '../core/db.js';
import type { Actor, Context, Handler } from '../core/context.js';
import { demand } from '../core/errors.js';
import { text } from '../core/policy.js';
import { verifyIdentity } from '../adapters/auth.js';
import { cancelPending, profileDto, requireReauth } from './access.js';
const jwtKey = new TextEncoder().encode(config.tokenSecret);
async function accessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('at-that-place')
    .setAudience('mobile')
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwtKey);
}
export async function authenticate(token: string): Promise<Actor> {
  const { payload } = await jwtVerify(token, jwtKey, {
    issuer: 'at-that-place',
    audience: 'mobile',
    algorithms: ['HS256'],
  });
  return tx(async (db) => {
    const r = await one(
      db,
      `SELECT u.*,s.id session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>now() AND s.revoked_at IS NULL`,
      [payload.sid, payload.sub],
    );
    demand(r && !['deleting', 'deleted'].includes(r.status), 'AUTH_EXPIRED', 401);
    return {
      id: r.id,
      status: r.status,
      display_name: r.display_name,
      version: Number(r.version),
      sessionId: r.session_id,
    };
  });
}
export async function issueSession(c: Context, userId: string, deviceId: string) {
  const refresh = randomToken();
  const s = await one(
    c.db,
    `INSERT INTO sessions(user_id,device_id,refresh_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days') RETURNING id`,
    [userId, deviceId, hash(refresh)],
  );
  return {
    accessToken: await accessToken(userId, s.id),
    refreshToken: refresh,
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    userId,
  };
}
async function consentEvents(c: Context, items: any[], initial = false) {
  const docs = await latestDocuments(c.db);
  demand(docs.some((d) => d.kind === 'consent' && d.required), 'DOCUMENT_UNAVAILABLE', 503);
  if (initial)
    for (const d of docs.filter((d) => d.required))
      demand(
        items.some((i) => i.documentId === d.id && i.version === d.version && i.agreed),
        'CONSENT_REQUIRED',
      );
  demand(new Set(items.map((i) => i.documentId)).size === items.length, 'VALIDATION_ERROR');
  for (const item of items) {
    const doc = docs.find((d) => d.id === item.documentId && d.version === item.version);
    demand(doc && doc.kind === 'consent', 'CONSENT_VERSION_CHANGED', 409);
    demand(!doc.required || item.agreed, 'REQUIRED_WITHDRAWAL_REQUIRES_DELETION', 409);
    await c.db.query(
      'INSERT INTO consent_events(user_id,document_id,agreed,operation_id) VALUES($1,$2,$3,$4)',
      [c.actor.id, doc.id, item.agreed, c.opId],
    );
  }
  return rows(
    c.db,
    `SELECT DISTINCT ON(e.document_id) e.id,e.document_id "documentId",d.version,e.agreed,e.occurred_at "occurredAt" FROM consent_events e JOIN consent_documents d ON d.id=e.document_id WHERE e.user_id=$1 ORDER BY e.document_id,e.occurred_at DESC`,
    [c.actor.id],
  );
}
export const authHandlers: Record<string, Handler> = {
  authExchange: async (c) => {
    const attempt = await one(c.db, 'SELECT * FROM login_attempts WHERE id=$1 FOR UPDATE', [
      c.body.loginAttemptId,
    ]);
    demand(
      attempt &&
        !attempt.used_at &&
        new Date(attempt.expires_at) > new Date() &&
        attempt.nonce === c.body.nonce &&
        attempt.provider === c.body.provider,
      'AUTH_INVALID',
      401,
    );
    const identity = await verifyIdentity(c.body.provider, c.body.credential, c.body.nonce);
    await c.db.query('UPDATE login_attempts SET used_at=now() WHERE id=$1', [attempt.id]);
    await c.db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${c.body.provider}:${identity.subject}`,
    ]);
    let u = await one(
      c.db,
      'SELECT u.* FROM identities i JOIN users u ON u.id=i.user_id WHERE i.provider=$1 AND i.provider_subject=$2',
      [c.body.provider, identity.subject],
    );
    if (!u) {
      u = await one(c.db, 'INSERT INTO users(display_name) VALUES($1) RETURNING *', [
        text(
          [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(identity.name)]
            .slice(0, 20)
            .map((v) => v.segment)
            .join(''),
          20,
          false,
        ) || '새 사용자',
      ]);
      await c.db.query(
        'INSERT INTO identities(user_id,provider,provider_subject) VALUES($1,$2,$3)',
        [u.id, c.body.provider, identity.subject],
      );
    }
    demand(!['deleting', 'deleted'].includes(u.status), 'AUTH_INVALID', 401);
    await rememberKakaoCredential({ ...c, actor: { ...c.actor, id: u.id } }, c.body.provider, identity.subject, c.body.credential);
    return {
      session: await issueSession(c, u.id, attempt.device_id),
      user: profileDto(u),
      onboardingRequired: u.status === 'onboarding',
      development: c.body.credential.startsWith('dev:'),
    };
  },
  sessionRefresh: async (c) => {
    const s = await one(
      c.db,
      'SELECT s.*,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE refresh_hash=$1 FOR UPDATE OF s',
      [hash(c.body.refreshToken)],
    );
    demand(
      s &&
        !s.revoked_at &&
        new Date(s.expires_at) > new Date() &&
        !['deleted', 'deleting'].includes(s.status),
      'AUTH_EXPIRED',
      401,
    );
    const refresh = randomToken();
    await c.db.query('UPDATE sessions SET refresh_hash=$2 WHERE id=$1', [s.id, hash(refresh)]);
    return {
      accessToken: await accessToken(s.user_id, s.id),
      refreshToken: refresh,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      userId: s.user_id,
    };
  },
  consentDocs: async (c) => ({
    documents: (await latestDocuments(c.db)).map((d) => ({
      id: d.id,
      version: d.version,
      required: d.required,
      kind: d.kind,
      title: d.title || d.item_key,
      url: new URL(d.content_ref, config.publicUrl).href,
      itemKey: d.item_key,
      development: String(d.version).startsWith('dev-'),
    })),
  }),
  onboard: async (c) => {
    demand(c.actor.status === 'onboarding', 'ALREADY_ONBOARDED', 409);
    const receipts = await consentEvents(c, c.body.consents, true);
    const u = await one(
      c.db,
      "UPDATE users SET display_name=$2,status='active',version=version+1 WHERE id=$1 RETURNING *",
      [c.actor.id, text(c.body.displayName, 20)],
    );
    return { user: profileDto(u), consentReceipts: receipts };
  },
  profileGet: async (c) =>
    profileDto(await one(c.db, 'SELECT * FROM users WHERE id=$1', [c.actor.id])),
  profilePatch: async (c) => {
    const r = await one(
      c.db,
      'UPDATE users SET display_name=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING *',
      [c.actor.id, text(c.body.displayName, 20), c.body.expectedVersion],
    );
    demand(r, 'VERSION_CONFLICT', 409);
    return profileDto(r);
  },
  consentUpdate: async (c) => ({ consentReceipts: await consentEvents(c, c.body.items) }),
  consentsMine: async (c) => ({ consentReceipts: await consentEvents(c, []) }),
  identitiesList: async (c) => ({
    identities: await rows(
      c.db,
      'SELECT id,provider,linked_at "linkedAt",version FROM identities WHERE user_id=$1 ORDER BY linked_at',
      [c.actor.id],
    ),
  }),
  identityLink: async (c) => {
    await requireReauth(c, c.body.reauthProof);
    const i = await verifyIdentity(c.body.provider, c.body.credential);
    await c.db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${c.body.provider}:${i.subject}`]);
    const old = await one(
      c.db,
      'SELECT * FROM identities WHERE provider=$1 AND provider_subject=$2',
      [c.body.provider, i.subject],
    );
    demand(!old || old.user_id === c.actor.id, 'IDENTITY_IN_USE', 409);
    if (!old)
      await c.db.query(
        'INSERT INTO identities(user_id,provider,provider_subject) VALUES($1,$2,$3)',
        [c.actor.id, c.body.provider, i.subject],
      );
    await rememberKakaoCredential(c,c.body.provider,i.subject,c.body.credential);
    return authHandlers.identitiesList(c);
  },
  identityUnlink: async (c) => {
    const proof = c.headers['x-reauth-proof'];
    await requireReauth(c, proof);
    const all = await rows(c.db, 'SELECT * FROM identities WHERE user_id=$1 FOR UPDATE', [
      c.actor.id,
    ]);
    demand(all.length > 1, 'LAST_IDENTITY', 409);
    const i = all.find((i) => i.id === c.params.identityId);
    demand(i, 'FORBIDDEN', 403);
    demand(Number(i.version) === c.body.expectedVersion, 'VERSION_CONFLICT', 409);
    await queueKakaoUnlink(c,i);
    await c.db.query('DELETE FROM identities WHERE id=$1', [i.id]);
    return authHandlers.identitiesList(c);
  },
  reauthenticate: async (c) => {
    const i = await verifyIdentity(c.body.provider, c.body.credential, c.body.nonce);
    demand(
      await one(
        c.db,
        'SELECT 1 FROM identities WHERE user_id=$1 AND provider=$2 AND provider_subject=$3',
        [c.actor.id, c.body.provider, i.subject],
      ),
      'AUTH_INVALID',
      401,
    );
    await rememberKakaoCredential(c,c.body.provider,i.subject,c.body.credential);
    const proof = randomToken();
    await c.db.query(
      "INSERT INTO reauth_proofs(token_hash,user_id,session_id,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",
      [hash(proof), c.actor.id, c.actor.sessionId],
    );
    return { reauthProof: proof, expiresAt: new Date(Date.now() + 300000).toISOString() };
  },
  logout: async (c) => {
    const pending = await one(
      c.db,
      "SELECT count(*)::int n FROM upload_tasks WHERE author_user_id=$1 AND state NOT IN ('complete','failed','cancelled')",
      [c.actor.id],
    );
    demand(!pending.n || c.body.pendingAction === 'cancel', 'PENDING_UPLOADS', 409);
    if (c.body.pendingAction === 'cancel')
      await cancelPending(c, 'author_user_id=$1', [c.actor.id]);
    await c.db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [c.actor.sessionId]);
    return { sessionRevoked: true };
  },
};
export async function createAttempt(provider: string, deviceId: string) {
  demand(
    ['kakao', 'google'].includes(provider) &&
      typeof deviceId === 'string' &&
      deviceId.length <= 128,
    'VALIDATION_ERROR',
  );
  return tx(async (db) => {
    const nonce = randomUUID();
    const r = await one(
      db,
      "INSERT INTO login_attempts(provider,nonce,expires_at,device_id) VALUES($1,$2,now()+interval '10 minutes',$3) RETURNING id",
      [provider, nonce, deviceId],
    );
    return { loginAttemptId: r.id, nonce };
  });
}
