import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../contracts/', import.meta.url),
  design = JSON.parse(await readFile(new URL('design.openapi.json', dir), 'utf8'));
const mine = design.paths['/me/media'].get;
mine.parameters.push({ name: 'order', in: 'query', schema: { type: 'string', enum: ['newest', 'expires_first'], default: 'newest' } });
const mineResponse = mine.responses['200'].content['application/json'].schema;
mineResponse.properties.groups = { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' } }, required: ['id', 'name'] } };
mineResponse.properties.items.items.properties.groupId = { type: 'string', format: 'uuid' };
mineResponse.required.push('groups');
design.paths['/groups/{groupId}/invites/current'] = { post: {
  ...structuredClone(design.paths['/groups/{groupId}/invites'].post),
  operationId: 'inviteCurrent', summary: '현재 유효한 초대 코드 조회 또는 자동 교체',
} };
const renderJob = { type:'object', properties:{ id:{type:'string',format:'uuid'},state:{enum:['queued','rendering','complete','failed','cancelled','expired']},progress:{type:'number'},durationSec:{type:'number'},expiresAt:{type:'string'},reason:{type:['string','null']},contentUrl:{type:['string','null']} }, required:['id','state','progress','durationSec','expiresAt'] };
for (const [path,method,id,param] of [
 ['/groups/{groupId}/vlogs','post','vlogCreate','groupId'], ['/vlogs/{jobId}','get','vlogGet','jobId'],
 ['/vlogs/{jobId}/cancellation','post','vlogCancel','jobId'], ['/vlogs/{jobId}/content','get','vlogContent','jobId'],
]) {
 design.paths[path] ??= {};
 design.paths[path][method] = { operationId:id,tags:['F30'],security:[{bearerAuth:[]}],
 parameters:[{name:param,in:'path',required:true,schema:{type:'string',format:'uuid'}}, ...(method==='post'?[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:16,maxLength:128}}]:[])],
 ...(method==='post'?{requestBody:{required:true,content:{'application/json':{schema:id==='vlogCreate'?{type:'object',additionalProperties:false,properties:{title:{type:'string',minLength:1,maxLength:100},timeline:{type:'object'}},required:['title','timeline']}:{type:'object',additionalProperties:false}}}}}:{}),
 responses:{200:{description:'본인 브이로그 작업; 현재 참여·원본 권한 재확인',content:{[id==='vlogContent'?'video/mp4':'application/json']:{schema:id==='vlogContent'?{type:'string',format:'binary'}:renderJob}}}} };
}
design.components.schemas.Group.properties.capacity.const = 15;
const task = design.components.schemas.UploadTask;
design.components.schemas.Group.properties.retentionWarnings = {
  type: 'array', items: { type: 'object', properties: {
    scheduleId: { type: 'string', format: 'uuid' }, title: { type: 'string' },
    lastDate: { type: 'string', format: 'date' }, urgency: { enum: ['week', 'last_day'] },
    daysLeft: { type: 'integer', minimum: 0, maximum: 7, description: '보관 마지막 날까지 남은 날. 0=오늘이 마지막 날' },
  }, required: ['scheduleId', 'title', 'lastDate', 'urgency', 'daysLeft'] },
};
design.components.schemas.Group.properties.retentionExpired = {
  type: 'array', description: '만료 뒤 30일 동안 카드에 표시할 만료 일정(F21)', items: { type: 'object', properties: {
    scheduleId: { type: 'string', format: 'uuid' }, title: { type: 'string' }, lastDate: { type: 'string', format: 'date' },
  }, required: ['scheduleId', 'title', 'lastDate'] },
};
task.properties.clientFileId = { type: 'string' };
task.properties.selectionIndex = { type: ['integer', 'null'], minimum: 0, maximum: 119 };
task.required.push('clientFileId', 'selectionIndex');
// UI50 장소 수정(Q23): 방문 식별자·날짜·순서·기록 연결을 유지하는 전용 변경 계약.
Object.assign(design.components.schemas.Visit.properties, {
  name: { type: 'string' }, address: { type: ['string', 'null'] },
  lat: { type: ['number', 'null'] }, lng: { type: ['number', 'null'] },
});
design.components.schemas.VisitDetail = {
  type: 'object',
  properties: {
    visit: { $ref: '#/components/schemas/Visit' },
    replaceable: { type: 'boolean', description: '숨김·검토·보존 기록과 미완료 업로드가 없어 다른 장소로 교체할 수 있음' },
    editable: { type: 'boolean', description: '취소·만료가 아니어서 수정할 수 있음' },
    planVersion: { type: 'integer', minimum: 1 },
  },
  required: ['visit', 'replaceable', 'editable', 'planVersion'],
};
{
  const base = design.paths['/visits/{visitId}'].delete;
  const visitId = base.parameters.find((p) => p.name === 'visitId');
  const errors = Object.fromEntries(Object.entries(base.responses).filter(([status]) => status !== '200'));
  const ok = { 200: { description: '방문과 교체 가능 여부·날짜 계획 버전', content: { 'application/json': { schema: { $ref: '#/components/schemas/VisitDetail' } } } } };
  design.paths['/visits/{visitId}'].get = {
    operationId: 'visitGet', summary: '장소 수정에 쓰는 방문 현재 값', tags: ['F10'],
    description: '권한: member. 취소·만료 방문은 editable=false로 조회만 한다.',
    security: [{ bearerAuth: [] }], parameters: [visitId], responses: { ...ok, ...errors },
  };
  design.paths['/visits/{visitId}'].patch = {
    operationId: 'visitUpdate', summary: 'expectedVersion + 이름·주소·위치·방문 시간 또는 providerPlaceId(교체) → VisitDetail', tags: ['F09', 'F10'],
    description: '권한: member. 생략한 값은 유지하고 null은 주소·위치·시간을 지운다. 정보 수정은 방문별 수기 사본에 저장해 다른 방문과 공급자 원본을 바꾸지 않는다. providerPlaceId는 이름·주소·위치와 함께 보낼 수 없고 기록·미완료 업로드가 있으면 거부한다. 도메인 오류: VERSION_CONFLICT VISIT_HAS_RECORDS DUPLICATE_VISIT PLACE_SEARCH_REQUIRED VALIDATION_ERROR TEXT_REJECTED SCHEDULE_CANCELLED DAY_CANCELLED EXPIRED DELETED.',
    security: [{ bearerAuth: [] }], parameters: base.parameters,
    requestBody: { required: true, content: { 'application/json': { schema: {
      type: 'object', additionalProperties: false,
      properties: {
        expectedVersion: { type: 'integer', minimum: 1 },
        name: { type: 'string', minLength: 1, maxLength: 400 },
        address: { type: ['string', 'null'], maxLength: 800 },
        location: { type: ['object', 'null'], additionalProperties: false, properties: { lat: { type: 'number', minimum: -90, maximum: 90 }, lng: { type: 'number', minimum: -180, maximum: 180 } }, required: ['lat', 'lng'] },
        plannedTime: { type: ['string', 'null'], pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
        providerPlaceId: { type: 'string', minLength: 1, maxLength: 200 },
      },
      required: ['expectedVersion'],
    } } } },
    responses: { ...ok, ...errors },
  };
}
design.components.schemas.Operation.properties.kind.enum.push('onboarding', 'visit_create', 'visit_update');
for (const [kind, schema] of [
  ['onboarding', { type: 'object' }],
  ['visit_create', { $ref: '#/components/schemas/Visit' }],
  ['visit_update', { $ref: '#/components/schemas/VisitDetail' }],
])
  design.components.schemas.Operation.properties.result.anyOf[0].anyOf.push(schema);
design.paths['/me/identities/{identityId}'].delete.parameters.push({
  name: 'X-Reauth-Proof',
  in: 'header',
  required: true,
  schema: { type: 'string' },
});
const doc = design.components.schemas.ConsentDocument;
Object.assign(doc.properties, {kind: {enum:['consent','notice']}, title: {type:'string'}, itemKey: {type:'string'}, development:{type:'boolean'}});
doc.required.push('kind','title','itemKey','development');
design.info.version = '0.5.0-implementation.1';
for (const path of Object.values(design.paths)) for (const op of Object.values(path)) {
  if (['inviteCreate','invitesList','inviteRevoke'].includes(op.operationId)) {
    op['x-required-role'] = 'member';
    op.description = '모든 현재 참여자. 발급자와 관계없이 같은 모임 초대 관리. 재시도 시 현재 권한 재검증.';
  }
}
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
      visitId: { type: ['string', 'null'] }, recordDate: { type: 'string', format: 'date' }, photos: { type: 'integer', minimum: 0, maximum: 5 }, videos: { type: 'integer', minimum: 0, maximum: 2 }, photoLimit: { const: 5 }, videoLimit: { const: 2 }, maxFilesPerSubmission: { const: 10 },
    }, required: ['recordDate', 'photos', 'videos', 'photoLimit', 'videoLimit', 'maxFilesPerSubmission'] } } } } },
  },
};
design.paths['/places'].get.responses['200'].content['application/json'].schema.properties.provider.enum = ['kakao'];
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
const placeQuery = design.paths['/places'].get.parameters.find(p => p.name === 'query');
placeQuery.required = false;
placeQuery.schema = {type:'string',maxLength:100};
// Runtime additions preserve the current design policies. Historical accepted tasks may
// have selectionIndex > 9; only new FileInput is limited to 0..9.
const preview = responseSchema('/invite-preview');
preview.properties.alreadyMember = { type: 'boolean' };
preview.required.push('alreadyMember');
design.paths['/invite-preview'].get.security = [{}, { bearerAuth: [] }];
// Preserve valid issued legacy codes while all newly issued codes use D19's alphabet.
design.components.schemas.Invitation.properties.code = { type: 'string', pattern: '^[A-Z0-9]{8}$|^[0-9A-F]{12}$', description: '신규: 0/O/1/I 제외 8자. 기존 발급 코드는 만료까지 허용' };
design.paths['/groups/{groupId}/vlog-sources'] = { get: {
  operationId: 'vlogSources', tags: ['F30'], security: [{ bearerAuth: [] }],
  description: '현재 참여자만. 취소 일정의 보존 기록도 브이로그에서 조회하기 위한 일정 식별자 목록. 실제 미디어 조회마다 기존 권한·만료·차단을 다시 검사한다.',
  parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
  responses: jsonResponse('모임의 삭제되지 않은 일정 식별자', { type: 'object', properties: { scheduleIds: { type: 'array', items: { type: 'string', format: 'uuid' } } }, required: ['scheduleIds'], additionalProperties: false }),
} };
function uniqueRequired(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.required)) value.required = [...new Set(value.required)];
  Object.values(value).forEach(uniqueRequired);
}
uniqueRequired(design);
const mediaView = design.paths['/schedules/{scheduleId}/media'].get.parameters.find(p => p.name === 'view');
mediaView.schema.enum = ['by_photo', 'by_author', 'by_time'];
mediaView.description = '새 앱은 by_photo/by_author. by_time은 기존 APK 호환용 별칭이며 by_photo와 같은 게시 묶음 정렬을 사용한다. 기존 APK 지원 종료 전 제거하지 않는다.';
await writeFile(new URL('openapi.json', dir), JSON.stringify(design, null, 2) + '\n');
