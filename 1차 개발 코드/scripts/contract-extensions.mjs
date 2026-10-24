import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../contracts/', import.meta.url),
  design = JSON.parse(await readFile(new URL('design.openapi.json', dir), 'utf8'));
const task = design.components.schemas.UploadTask;
task.properties.clientFileId = { type: 'string' };
task.properties.selectionIndex = { type: ['integer', 'null'], minimum: 0, maximum: 119 };
task.required.push('clientFileId', 'selectionIndex');
design.components.schemas.Operation.properties.kind.enum.push('onboarding', 'visit_create');
for (const [kind, schema] of [
  ['onboarding', { type: 'object' }],
  ['visit_create', { $ref: '#/components/schemas/Visit' }],
])
  design.components.schemas.Operation.properties.result.anyOf[0].anyOf.push(schema);
design.paths['/me/identities/{identityId}'].delete.parameters.push({
  name: 'X-Reauth-Proof',
  in: 'header',
  required: true,
  schema: { type: 'string' },
});
design.info.version = '0.3.0-implementation.1';
design.paths['/groups/{groupId}/cover'] = {
  get: {
    operationId: 'coverStream',
    tags: ['F04', 'F20'],
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'groupId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      200: {
        description: '참여자에게 제공하는 위치 제거 대표 사진',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
    },
  },
};
design.paths['/ops/cases/{caseId}/evidence'] = {
  get: {
    operationId: 'opsEvidence',
    tags: ['F25', 'F26'],
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'caseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      200: {
        description: '운영자 전용 접수 시점의 위치 제거 증거',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
    },
  },
};
design.paths['/ops/recovery-requests/{requestId}/notice'] = {
  post: {
    operationId: 'opsRecoveryNotice',
    tags: ['F27'],
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
      },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object', additionalProperties: false } } },
    },
    responses: {
      200: {
        description: '기존 방장 계정 알림 전달과 감사 기록',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                notified: { const: true },
                auditId: { type: 'string', format: 'uuid' },
              },
              required: ['notified', 'auditId'],
            },
          },
        },
      },
    },
  },
};
design.paths['/schedules/{scheduleId}'].get.responses['200'].content[
  'application/json'
].schema.properties.plan.items.properties.outsideRange = { type: 'boolean' };
design.paths['/schedules/{scheduleId}/submissions'].post.responses['200'].content[
  'application/json'
].schema.properties.submissionId.type = ['string', 'null'];
design.paths['/schedules/{scheduleId}/upload-limits'] = {
  get: {
    operationId: 'uploadLimits', tags: ['F13', 'F14'], security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'scheduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'recordDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
      { name: 'visitId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: { 200: { description: '작성자의 완료·진행 파일을 반영한 남은 업로드 개수', content: { 'application/json': { schema: { type: 'object', properties: {
      visitId: { type: ['string', 'null'] }, recordDate: { type: 'string', format: 'date' }, photos: { type: 'integer', minimum: 0, maximum: 5 }, videos: { type: 'integer', minimum: 0, maximum: 2 }, photoLimit: { const: 5 }, videoLimit: { const: 2 },
    }, required: ['recordDate', 'photos', 'videos', 'photoLimit', 'videoLimit'] } } } } },
  },
};
design.paths['/places'].get.responses['200'].content['application/json'].schema.properties.provider.enum = ['google', 'kakao'];
function jsonResponse(description, schema) {
  return { 200: { description, content: { 'application/json': { schema } } } };
}
design.paths['/media/{mediaId}'] = {
  get: {
    operationId: 'mediaGet', tags: ['F16','F18'], security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'mediaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'context', in: 'query', required: true, schema: { type: 'string', enum: ['shared','mine'] } },
    ],
    responses: jsonResponse('현재 접근 권한을 확인한 기록 상세', {
      type: 'object', properties: { media: { $ref: '#/components/schemas/Media' }, canSave: { type: 'boolean' }, canEdit: { type: 'boolean' } }, required: ['media','canSave','canEdit'],
    }),
  },
};
for (const name of ['cacheScope','cacheVersion']) design.paths['/media/{mediaId}/content'].get.parameters.push({ name, in: 'query', required: false, schema: { type: 'string', maxLength: 64 } });
design.paths['/me/upload-tasks'] = {
  get: {
    operationId: 'uploadTasksList', tags: ['F15'], security: [{ bearerAuth: [] }],
    parameters: [{ name: 'ids', in: 'query', required: false, schema: { type: 'string', maxLength: 4500, pattern: '^[0-9a-fA-F,-]+$' } }],
    responses: jsonResponse('본인 파일 전송 상태 묶음 조회', { type: 'object', properties: { tasks: { type: 'array', items: { $ref: '#/components/schemas/UploadTask' } } }, required: ['tasks'] }),
  },
};
const placesResponse = design.paths['/places'].get.responses['200'].content['application/json'].schema;
Object.assign(placesResponse.properties.places.items.properties, { id: { type: 'string' }, distance: { type: ['number','null'] }, attributions: { type: 'array', items: { type: 'object' } } });
placesResponse.properties.searchContext.properties.center.type = ['string','null'];
Object.assign(design.components.schemas.Media.properties, { displayName: { type: 'string' }, visitName: { type: ['string','null'] }, durationMs: { type: ['number','null'] } });
const responseSchema = (path, method = 'get') => design.paths[path][method].responses['200'].content['application/json'].schema;
Object.assign(responseSchema('/recovery-requests/{requestId}').properties, {
  requestId: { type: 'string', format: 'uuid' }, canConsent: { type: 'boolean' }, canRespond: { type: 'boolean' }, candidateConsentAt: { type: ['string','null'], format: 'date-time' },
});
for (const key of ['noticeAt','responseDueAt','decisionSummary']) responseSchema('/recovery-requests/{requestId}').properties[key].type = ['string','null'];
Object.assign(responseSchema('/me/reports').properties.reports.items.properties, {
  type: { type: 'string' }, referenceId: { type: ['string','null'] }, decisionAction: { type: ['string','null'] }, decisionReason: { type: ['string','null'] },
});
responseSchema('/ops/cases').properties.maintenance = { type: 'object', properties: Object.fromEntries(['pending','failed','overdue'].map((key) => [key,{ type: 'integer', minimum: 0 }])), required: ['pending','failed','overdue'] };
for (const key of ['countsByDate','countsByVisit']) responseSchema('/schedules/{scheduleId}/media').properties[key] = { type: 'array', items: { type: 'object' } };
await writeFile(new URL('openapi.json', dir), JSON.stringify(design, null, 2) + '\n');
