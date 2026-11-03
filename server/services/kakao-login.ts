import type { FastifyInstance } from 'fastify';
import { config } from '../core/config.js';
import { demand } from '../core/errors.js';
import { encrypt, decrypt, hash, randomToken } from '../core/crypto.js';
import { one, tx } from '../core/db.js';
import { createAttempt } from './auth.js';

type Provider = 'kakao' | 'google';
// Fixed app return URI: accepting an arbitrary redirect would leak handoff credentials.
export const KAKAO_APP_RETURN = 'atthatplace://oauth/kakao';
export function kakaoRedirectUri() {
  return (
    process.env.KAKAO_REDIRECT_URI || new URL('/v1/auth/kakao/callback', config.publicUrl).href
  );
}
export function kakaoLoginReady() {
  return Boolean(process.env.KAKAO_APP_ID && process.env.KAKAO_REST_KEY);
}
export function googleLoginReady() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function registerKakaoLogin(app: FastifyInstance) {
  registerBrowserLogin(app, 'kakao');
  registerBrowserLogin(app, 'google');
}
function registerBrowserLogin(app: FastifyInstance, provider: Provider) {
  const table = provider === 'kakao' ? 'kakao_login_flows' : 'google_login_flows';
  const appReturn = `atthatplace://oauth/${provider}`;
  const redirect = () => provider === 'kakao' ? kakaoRedirectUri() :
    (process.env.GOOGLE_REDIRECT_URI || new URL('/v1/auth/google/callback', config.publicUrl).href);
  const clientId = () => provider === 'kakao' ? process.env.KAKAO_REST_KEY! : process.env.GOOGLE_CLIENT_ID!;
  const limit = { rateLimit: { max: 20, timeWindow: '1 minute' } };
  app.post(`/v1/auth/${provider}/start`, { config: limit }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    demand(provider === 'kakao' ? kakaoLoginReady() : googleLoginReady(), 'PROVIDER_NOT_CONFIGURED', 503);
    const b = req.body as any;
    demand(
      typeof b?.verifierHash === 'string' && /^[a-f0-9]{64}$/.test(b.verifierHash),
      'VALIDATION_ERROR',
    );
    const redirectUri = redirect();
    demand(new URL(redirectUri).protocol === 'https:', 'KAKAO_NOT_CONFIGURED', 503);
    const attempt = await createAttempt(provider, b.deviceId);
    const state = randomToken();
    await tx(async (db) => {
      await db.query(`DELETE FROM ${table} WHERE expires_at <= now()`);
      await db.query(
        `INSERT INTO ${table}(state_hash,attempt_id,verifier_hash) VALUES($1,$2,$3)`,
        [hash(state), attempt.loginAttemptId, b.verifierHash],
      );
    });
    const url = new URL(provider === 'kakao' ? 'https://kauth.kakao.com/oauth/authorize' : 'https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    if (provider === 'google') {
      url.searchParams.set('scope', 'openid profile');
      url.searchParams.set('nonce', attempt.nonce);
      url.searchParams.set('prompt', 'select_account');
    } else if (b.reauthenticate === true) url.searchParams.set('prompt', 'login');
    // Do not request email or photo permissions for Kakao.
    return { authorizationUrl: url.href, state, returnUri: appReturn };
  });
  app.get(`/v1/auth/${provider}/callback`, { config: limit }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    const q = req.query as any;
    demand(typeof q.state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(q.state), 'AUTH_INVALID', 401);
    await tx(async (db) => {
      const f = await one(db, `SELECT * FROM ${table} WHERE state_hash=$1 FOR UPDATE`, [
        hash(q.state),
      ]);
      demand(
        f && !f.callback_at && !f.consumed_at && new Date(f.expires_at) > new Date(),
        'AUTH_INVALID',
        401,
      );
      let credential: string | null = null,
        failure: string | null = null;
      if (q.error) failure = q.error === 'access_denied' ? 'AUTH_CANCELLED' : 'AUTH_INVALID';
      else {
        try {
          demand(typeof q.code === 'string' && q.code.length <= 2048, 'AUTH_INVALID', 401);
          const form = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId(),
            redirect_uri: redirect(),
            code: q.code,
          });
          const secret = provider === 'kakao' ? process.env.KAKAO_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;
          if (secret) form.set('client_secret', secret);
          const r = await fetch(provider === 'kakao' ? 'https://kauth.kakao.com/oauth/token' : 'https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
            body: form.toString(),
            signal: AbortSignal.timeout(10000),
          });
          demand(r.ok, 'AUTH_INVALID', 401);
          const tokens = (await r.json()) as any;
          demand(
            typeof tokens[provider === 'kakao' ? 'access_token' : 'id_token'] === 'string' && tokens[provider === 'kakao' ? 'access_token' : 'id_token'].length > 0,
            'AUTH_INVALID',
            401,
          );
          credential = encrypt(tokens[provider === 'kakao' ? 'access_token' : 'id_token']);
        } catch {
          failure = 'AUTH_INVALID';
        }
      }
      await db.query(
        `UPDATE ${table} SET callback_at=now(),credential_encrypted=$2,failure=$3 WHERE state_hash=$1`,
        [hash(q.state), credential, failure],
      );
    });
    const target = new URL(appReturn);
    target.searchParams.set('state', q.state);
    return reply.redirect(target.href);
  });
  app.post(`/v1/auth/${provider}/finish`, { config: limit }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const b = req.body as any;
    demand(
      typeof b?.state === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(b.state) &&
        typeof b.verifier === 'string' &&
        /^[A-Za-z0-9_-]{43,128}$/.test(b.verifier),
      'VALIDATION_ERROR',
    );
    const result = await tx(async (db) => {
      const f = await one(db, `SELECT * FROM ${table} WHERE state_hash=$1 FOR UPDATE`, [
        hash(b.state),
      ]);
      demand(
        f &&
          f.callback_at &&
          !f.consumed_at &&
          new Date(f.expires_at) > new Date() &&
          f.verifier_hash === hash(b.verifier),
        'AUTH_INVALID',
        401,
      );
      const attempt = await one(db, 'SELECT * FROM login_attempts WHERE id=$1', [f.attempt_id]);
      demand(
        attempt && attempt.provider === provider && !attempt.used_at && new Date(attempt.expires_at) > new Date(),
        'AUTH_INVALID',
        401,
      );
      const credential = f.credential_encrypted ? decrypt<string>(f.credential_encrypted) : null;
      await db.query(
        `UPDATE ${table} SET consumed_at=now(),credential_encrypted=NULL WHERE state_hash=$1`,
        [hash(b.state)],
      );
      return { credential, failure: f.failure, loginAttemptId: attempt.id, nonce: attempt.nonce };
    });
    demand(!result.failure && result.credential, result.failure || 'AUTH_INVALID', 401);
    return {
      credential: result.credential,
      loginAttemptId: result.loginAttemptId,
      nonce: result.nonce,
    };
  });
}
