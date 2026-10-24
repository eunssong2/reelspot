import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../core/config.js';
import { demand, DomainError } from '../core/errors.js';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyIdentity(
  provider: string,
  credential: string,
  nonce?: string,
): Promise<{ subject: string; name: string }> {
  if (config.authMode === 'development') {
    demand(!config.production && /^dev:[a-zA-Z0-9_-]{1,64}$/.test(credential), 'AUTH_INVALID', 401);
    return { subject: credential.slice(4), name: credential.slice(4) };
  }
  try {
    if (provider === 'google') {
      demand(process.env.GOOGLE_CLIENT_ID, 'PROVIDER_UNAVAILABLE', 503);
      const { payload } = await jwtVerify(credential, googleKeys, {
        audience: process.env.GOOGLE_CLIENT_ID,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      });
      demand(payload.sub && (!nonce || payload.nonce === nonce), 'AUTH_INVALID', 401);
      return {
        subject: payload.sub,
        name: typeof payload.name === 'string' ? payload.name : '새 사용자',
      };
    }
    demand(provider === 'kakao' && process.env.KAKAO_APP_ID, 'PROVIDER_UNAVAILABLE', 503);
    const call = async (path: string) => {
      const r = await fetch(`https://kapi.kakao.com${path}`, {
        headers: { Authorization: `Bearer ${credential}` },
        signal: AbortSignal.timeout(10000),
      });
      demand(r.ok, 'AUTH_INVALID', 401);
      return (await r.json()) as any;
    };
    const info = await call('/v1/user/access_token_info');
    demand(String(info.app_id) === process.env.KAKAO_APP_ID, 'AUTH_INVALID', 401);
    const user = await call('/v2/user/me');
    demand(String(user.id) === String(info.id), 'AUTH_INVALID', 401);
    return { subject: String(user.id), name: user.properties?.nickname ?? '새 사용자' };
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError('AUTH_INVALID', 401);
  }
}
const opsKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyOperator(token: string) {
  if (config.opsMode === 'development') {
    demand(!config.production && token === config.devOpsToken, 'OPS_FORBIDDEN', 403);
    return {
      subject: 'development:operator',
      roles: ['case_reviewer', 'content_moderator', 'recovery_approver'],
    };
  }
  const issuer = process.env.OPS_ISSUER,
    audience = process.env.OPS_AUDIENCE;
  demand(issuer && audience, 'OPS_FORBIDDEN', 403);
  if (!opsKeys.has(issuer)) {
    const r = await fetch(
      new URL('.well-known/openid-configuration', `${issuer.replace(/\/$/, '')}/`),
      { signal: AbortSignal.timeout(10000) },
    );
    demand(r.ok, 'OPS_FORBIDDEN', 403);
    const meta = (await r.json()) as any;
    demand(meta.issuer === issuer, 'OPS_FORBIDDEN', 403);
    opsKeys.set(issuer, createRemoteJWKSet(new URL(meta.jwks_uri)));
  }
  const { payload } = await jwtVerify(token, opsKeys.get(issuer)!, { issuer, audience });
  demand(
    payload.sub && Array.isArray(payload.amr) && payload.amr.includes('mfa'),
    'OPS_FORBIDDEN',
    403,
  );
  return {
    subject: `${issuer}|${payload.sub}`,
    roles: Array.isArray(payload.roles)
      ? payload.roles.filter((x): x is string => typeof x === 'string')
      : [],
  };
}
