import Fastify from 'fastify';
import { registerDocuments } from '../services/documents.js';
import { registerPublicPages } from './public-pages.js';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from '../core/config.js';
import { tx, one } from '../core/db.js';
import { demand, DomainError, mapDbError } from '../core/errors.js';
import { decrypt, encrypt, hash } from '../core/crypto.js';
import type { Context } from '../core/context.js';
import { authenticate, createAttempt } from '../services/auth.js';
import { verifyOperator } from '../adapters/auth.js';
import { moderate } from '../adapters/moderation.js';
import { dispatch, handlers, operationKinds } from './dispatch.js';
import { newCase } from '../services/operations.js';
import { operation, streamFile } from '../services/records.js';
import { groupAccess } from '../services/access.js';
import { registerKakaoLogin, kakaoLoginReady, googleLoginReady } from '../services/kakao-login.js';
export const contract = JSON.parse(
  await readFile(new URL('../../contracts/openapi.json', import.meta.url), 'utf8'),
);
const publicIds = new Set(['authExchange', 'sessionRefresh', 'consentDocs', 'invitePreview']);
const restrictedIds = new Set([
  'profileGet',
  'identitiesList',
  'reauthenticate',
  'consentsMine',
  'consentDocs',
  'consentUpdate',
  'mineList',
  'mediaStream',
  'mediaGet',
  'mediaDelete',
  'deletionPreconditions',
  'ownerTransfer',
  'groupClose',
  'accountDelete',
  'inquiryCreate',
  'reportsMine',
  'notificationsList',
  'notificationRead',
  'operationGet',
  'logout',
]);
const onboardingIds = new Set(['onboard', 'consentDocs', 'profileGet', 'logout', 'operationGet']);
const consentWriteIds = new Set([
  'groupCreate',
  'groupUpdate',
  'scheduleCreate',
  'scheduleUpdate',
  'planUpdate',
  'visitCreate',
  'uploadPrepare',
  'coverPrepare',
  'uploadCommit',
  'metadataPatch',
  'profilePatch',
  'inviteJoin',
]);
function texts(value: any, key = ''): string[] {
  if (value == null) return [];
  if (typeof value === 'string')
    return ['displayName', 'name', 'title', 'address', 'description'].includes(key) ? [value] : [];
  if (typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) =>
      k === 'description' && v && typeof v === 'object'
        ? [(v as any).apply ? (v as any).value : '']
        : texts(v, k),
    );
  return [];
}
export async function buildApp(opts: { logging?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logging
      ? { redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'req.url'] }
      : false,
    // Nginx is the sole trusted proxy; never trust arbitrary forwarded addresses.
    trustProxy: ['127.0.0.1', '::1'],
    bodyLimit: 4194304,
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
    exposeHeadRoutes: false,
  });
  await app.register(cors, {
    origin: config.cors,
    exposedHeaders: [
      'Upload-Offset',
      'Upload-Length',
      'Upload-Generation',
      'Upload-Expires',
      'X-Error-Code',
      'X-Request-Id',
      'Content-Range',
    ],
  });
  await app.register(rateLimit, { max: 1200, timeWindow: '1 minute' });
  app.addContentTypeParser(
    'application/offset+octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );
  app.setErrorHandler((e, req, reply) => {
    const err = mapDbError(e);
    if (err.status === 500)
      app.log.error({ requestId: req.id, errorCode: (e as any).code }, 'Request failed');
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Request-Id', req.id)
      .header('X-Error-Code', err.code);
    reply.code((e as any).statusCode === 429 ? 429 : err.status);
    return reply.send(
      req.method === 'HEAD'
        ? undefined
        : {
            code: err.code,
            message: err.code,
            requestId: req.id,
            retryable: err.status >= 500,
            ...(err.details
              ? {
                  details: err.details,
                  ...(err.details.currentVersion
                    ? { currentVersion: err.details.currentVersion }
                    : {}),
                }
              : {}),
          },
    );
  });
  app.get('/health', async () => ({
    status: 'ok',
    mode: config.mode,
    auth: config.authMode,
    moderation: config.moderationMode,
  }));
  app.get('/openapi.json', async () => contract);
  app.post('/v1/auth/attempts', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const b = req.body as any;
    return createAttempt(b?.provider, b?.deviceId);
  });
  registerKakaoLogin(app);
  registerPublicPages(app);
  registerDocuments(app);
  app.get('/v1/app-config', async () => ({
    development: !config.production,
    authMode: config.authMode,
    providers: { kakao: kakaoLoginReady(), google: googleLoginReady() },
    supportEmail: process.env.SUPPORT_EMAIL || null,
    timezone: 'Asia/Seoul',
  }));
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    coerceTypes: true,
    removeAdditional: false,
  });
  (addFormats as any)(ajv);
  ajv.addSchema({ $id: 'atp', components: contract.components });
  const rewrite = (v: any): any =>
    Array.isArray(v)
      ? v.map(rewrite)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v).map(([k, x]) => [
              k,
              k === '$ref' && typeof x === 'string' && x.startsWith('#/') ? `atp${x}` : rewrite(x),
            ]),
          )
        : v;
  for (const [path, methods] of Object.entries<any>(contract.paths))
    for (const [method, definition] of Object.entries<any>(methods)) {
      const id = definition.operationId;
      if (!id) continue;
      demand(handlers[id], `MISSING_HANDLER_${id}`);
      const schema = definition.requestBody?.content?.['application/json']?.schema,
        validate = schema ? ajv.compile(rewrite(schema)) : null;
      const queryProps = Object.fromEntries(
        (definition.parameters ?? [])
          .filter((p: any) => p.in === 'query')
          .map((p: any) => [p.name, p.schema]),
      );
      const queryValidate = ajv.compile(
        rewrite({
          type: 'object',
          properties: queryProps,
          required: (definition.parameters ?? [])
            .filter((p: any) => p.in === 'query' && p.required)
            .map((p: any) => p.name),
          additionalProperties: false,
        }),
      );
      const paramValidate = ajv.compile({
        type: 'object',
        properties: Object.fromEntries(
          (definition.parameters ?? [])
            .filter((p: any) => p.in === 'path')
            .map((p: any) => [p.name, p.schema]),
        ),
        required: (definition.parameters ?? [])
          .filter((p: any) => p.in === 'path')
          .map((p: any) => p.name),
      });
      app.route({
        method: method.toUpperCase() as any,
        url: `/v1${path.replace(/\{([^}]+)\}/g, ':$1')}`,
        handler: async (req, reply) => {
          const body: any = req.body ?? {},
            query = req.query as Record<string, any>,
            params = req.params as Record<string, string>;
          demand(
            (!validate || validate(body)) && queryValidate(query) && paramValidate(params),
            'VALIDATION_ERROR',
            400,
            { errors: validate?.errors ?? queryValidate.errors ?? paramValidate.errors ?? [] },
          );
          const bearer = req.headers.authorization?.replace(/^Bearer /, '');
          const isOps = id.startsWith('ops');
          let actor: any, operator: any;
          if (isOps) {
            demand(bearer, 'OPS_FORBIDDEN', 403);
            try {
              operator = await verifyOperator(bearer);
            } catch {
              throw new DomainError('OPS_FORBIDDEN', 403);
            }
          } else if (!publicIds.has(id)) {
            demand(bearer, 'AUTH_EXPIRED', 401);
            try {
              actor = await authenticate(bearer);
            } catch (e) {
              if (e instanceof DomainError) throw e;
              throw new DomainError('AUTH_EXPIRED', 401);
            }
            demand(actor.status !== 'restricted' || restrictedIds.has(id), 'ACCESS_REVOKED', 403);
            demand(actor.status !== 'onboarding' || onboardingIds.has(id), 'CONSENT_REQUIRED', 403);
          }
          const mutation = !['get', 'head'].includes(method) && id !== 'uploadChunk',
            key = req.headers['idempotency-key'];
          if (mutation)
            demand(
              typeof key === 'string' && key.length >= 16 && key.length <= 128,
              'IDEMPOTENCY_KEY_REQUIRED',
              428,
            );
          const requestHash = hash(JSON.stringify({ params, body })),
            actorKey = operator
              ? `ops:${operator.subject}`
              : (actor?.id ??
                `public:${id === 'authExchange' ? body.loginAttemptId : hash(body.refreshToken ?? '')}`);
          let verdict = 'passed';
          const candidates = texts(body).filter(Boolean);
          if (candidates.length && operationKinds[id])
            verdict = await moderate({ text: candidates.join('\n') });
          demand(verdict !== 'rejected', 'TEXT_REJECTED');
          const result = await tx(async (db) => {
            if (actor) {
              const current = await one(db, 'SELECT * FROM users WHERE id=$1 FOR UPDATE', [
                actor.id,
              ]);
              demand(
                current && !['deleting', 'deleted'].includes(current.status),
                'ACCESS_REVOKED',
                403,
              );
              actor = { ...actor, ...current };
              demand(actor.status !== 'restricted' || restrictedIds.has(id), 'ACCESS_REVOKED', 403);
              demand(
                actor.status !== 'onboarding' || onboardingIds.has(id),
                'CONSENT_REQUIRED',
                403,
              );
            }
            // Cached mutation responses must not restore invitation access after leaving/kicking.
            if (['inviteCreate', 'invitesList', 'inviteRevoke'].includes(id)) {
              let groupId = params.groupId;
              if (id === 'inviteRevoke') {
                const invitation = await one(db, 'SELECT group_id FROM invitations WHERE id=$1', [
                  params.inviteId,
                ]);
                demand(invitation, 'NOT_FOUND', 404);
                groupId = invitation.group_id;
              }
              await groupAccess({ db, actor } as Context, groupId);
            }
            if (mutation) {
              await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                `${actorKey}:${id}:${key}`,
              ]);
              const old = await one(
                db,
                'SELECT * FROM api_receipts WHERE actor_key=$1 AND route=$2 AND key=$3',
                [actorKey, `${id}:${JSON.stringify(params)}`, key],
              );
              if (old) {
                demand(old.request_hash === requestHash, 'IDEMPOTENCY_CONFLICT', 409);
                const previous = decrypt(old.response_encrypted);
                if (previous?.operationId && previous.kind) {
                  const current = await one(
                    db,
                    'SELECT state,response_snapshot FROM operations WHERE id=$1',
                    [previous.operationId],
                  );
                  if (current?.response_snapshot)
                    return {
                      status: ['pending', 'review'].includes(current.state) ? 202 : 200,
                      value: current.response_snapshot,
                    };
                }
                return { status: old.status, value: previous };
              }
            }
            if (actor?.status === 'active' && mutation && consentWriteIds.has(id)) {
              const missing = await one(
                db,
                `WITH latest AS (
                SELECT DISTINCT ON(item_key) * FROM consent_documents
                WHERE effective_at<=now() AND ($2=false OR version NOT LIKE 'dev-%') ORDER BY item_key,effective_at DESC,created_at DESC
              ) SELECT d.id FROM latest d WHERE d.required AND NOT COALESCE((
                SELECT e.agreed FROM consent_events e WHERE e.user_id=$1 AND e.document_id=d.id
                ORDER BY e.occurred_at DESC LIMIT 1
              ),false) LIMIT 1`,
                [actor.id, config.production],
              );
              demand(!missing, 'CONSENT_REQUIRED', 409);
            }
            const opId = randomUUID(),
              c: Context = { db, actor, operator, body, query, params, headers: req.headers, opId };
            if (actor && mutation)
              await db.query(
                'INSERT INTO operations(id,actor_id,idempotency_key,route,request_hash,kind) VALUES($1,$2,$3,$4,$5,$6)',
                [
                  opId,
                  actor.id,
                  key,
                  `${id}:${JSON.stringify(params)}`,
                  requestHash,
                  operationKinds[id] ?? id,
                ],
              );
            let value: any,
              status = 200;
            if (verdict === 'review' && actor && mutation && operationKinds[id]) {
              value = operation(c, operationKinds[id], 'review');
              status = 202;
              await newCase(c, 'scan', 'operation', opId, '공개 전 텍스트 검토');
              await db.query(
                "INSERT INTO outbox_events(operation_id,event_type,target_id,generation,payload,published_at) VALUES($1,'text.apply',$1,1,$2,now())",
                [
                  opId,
                  JSON.stringify({
                    command: encrypt({
                      id,
                      body,
                      params,
                      query,
                      actorId: actor.id,
                      sessionId: actor.sessionId,
                    }),
                    approved: false,
                  }),
                ],
              );
            } else {
              value = await dispatch(id, c);
              if (value?.state === 'pending' || value?.state === 'review') status = 202;
            }
            if (actor && mutation) {
              const snapshot =
                value?.operationId && value.kind
                  ? value
                  : {
                      operationId: opId,
                      kind: operationKinds[id] ?? id,
                      state: 'succeeded',
                      result: id === 'reauthenticate' ? { completed: true } : value,
                      itemErrors: [],
                    };
              await db.query(
                "UPDATE operations SET state=$2,response_snapshot=$3,finished_at=CASE WHEN $2 IN ('succeeded','failed') THEN now() END WHERE id=$1",
                [opId, snapshot.state, JSON.stringify(snapshot)],
              );
            }
            if (mutation)
              await db.query(
                'INSERT INTO api_receipts(actor_key,route,key,request_hash,response_encrypted,status) VALUES($1,$2,$3,$4,$5,$6)',
                [
                  actorKey,
                  `${id}:${JSON.stringify(params)}`,
                  key,
                  requestHash,
                  encrypt(value),
                  status,
                ],
              );
            return { status, value };
          });
          reply.header('Cache-Control', 'private, no-store').header('X-Request-Id', req.id);
          if (result.value?.uploadHeaders) {
            const t = result.value.uploadHeaders;
            return reply
              .code(204)
              .headers({
                'Upload-Offset': t.upload_offset,
                'Upload-Length': t.declared_bytes,
                'Upload-Generation': t.upload_generation,
                'Upload-Expires': new Date(t.transport_expires_at).toISOString(),
              })
              .send();
          }
          if (result.value?.file) {
            const f = streamFile(result.value.file, req.headers.range);
            return reply.code(f.status).headers(f.headers).send(f.stream);
          }
          if (result.value?.binary)
            return reply.type(result.value.binary.mime).send(result.value.binary.data);
          return reply.code(result.status).send(result.value);
        },
      });
    }
  return app;
}
