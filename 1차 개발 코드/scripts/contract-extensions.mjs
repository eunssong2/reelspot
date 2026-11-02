import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../contracts/', import.meta.url),
  design = JSON.parse(await readFile(new URL('design.openapi.json', dir), 'utf8'));
const task = design.components.schemas.UploadTask;
design.components.schemas.Group.properties.retentionWarnings = {
  type: 'array', items: { type: 'object', properties: {
    scheduleId: { type: 'string', format: 'uuid' }, title: { type: 'string' },
    lastDate: { type: 'string', format: 'date' }, urgency: { enum: ['week', 'last_day'] },
  }, required: ['scheduleId', 'title', 'lastDate', 'urgency'] },
};
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
const doc = design.paths['/consent-documents'].get.responses['200'].content['application/json'].schema.properties.documents.items;
Object.assign(doc.properties, {kind: {enum:['consent','notice']}, title: {type:'string'}, itemKey: {type:'string'}, development:{type:'boolean'}});
doc.required.push('kind','title','itemKey','development');
design.info.version = '0.3.2-implementation.1';
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
const placeQuery = design.paths['/places'].get.parameters.find(p => p.name === 'query');
placeQuery.required = false;
placeQuery.schema = {type:'string',maxLength:100};
// 2026-11 UI 화면 정리 반영: 일정=일차 묶음, 8자리 초대 코드, 프로필 사진.
const schemas = design.components.schemas;
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const withErrors = (ok) => {
  const base = structuredClone(design.paths['/schedules/{scheduleId}/cancellation'].post.responses);
  delete base['200'];
  return { ...ok, ...base };
};
const idempotency = { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 128 } };
const uuidPath = (name) => ({ name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
const datePath = { name: 'date', in: 'path', required: true, schema: { type: 'string', format: 'date' } };
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } });
schemas.ScheduleDay = {
  type: 'object',
  description: '일정의 하루. dayNo는 날짜순 1부터(취소된 날 포함). 같은 모임에서 활성 일정의 활성 일차는 날짜마다 하나뿐이다.',
  properties: {
    date: { type: 'string', format: 'date' },
    dayNo: { type: 'integer', minimum: 1 },
    title: { type: ['string', 'null'], description: '일차 제목(최대 30 graphemes). 없으면 null' },
    status: { type: 'string', enum: ['active', 'cancelled'] },
    visitCount: { type: 'integer', minimum: 0, maximum: 15 },
  },
  required: ['date', 'dayNo', 'title', 'status', 'visitCount'],
  additionalProperties: false,
};
schemas.Schedule.properties.days = { type: 'array', items: ref('ScheduleDay'), description: '달력 응답에서만 포함' };
schemas.DayChangeResult = {
  type: 'object',
  properties: { schedule: { anyOf: [ref('Schedule'), { type: 'null' }] }, days: { type: 'array', items: ref('ScheduleDay') } },
  required: ['schedule', 'days'],
  additionalProperties: false,
};
schemas.Error.properties.details.description +=
  '; SCHEDULE_DATE_TAKEN: {dates:[date], schedules:[{id,title}]}; DAY_CANCELLED(upload): {date}; TARGET_NOT_EMPTY: {date}';
const detail = responseSchema('/schedules/{scheduleId}');
detail.properties.days = { type: 'array', items: ref('ScheduleDay') };
detail.required.push('days');
responseSchema('/groups/{groupId}/calendar').properties.schedules.items = { allOf: [ref('Schedule')], required: ['days'] };
for (const [path, method, code] of [
  ['/groups', 'post', 'SCHEDULE_DATE_TAKEN'],
  ['/groups/{groupId}/schedules', 'post', 'SCHEDULE_DATE_TAKEN'],
  ['/schedules/{scheduleId}', 'patch', 'SCHEDULE_DATE_TAKEN'],
  ['/schedules/{scheduleId}/visits', 'post', 'DAY_CANCELLED'],
  ['/schedules/{scheduleId}/submissions', 'post', 'DAY_CANCELLED'],
])
  design.paths[path][method].description = design.paths[path][method].description.replace('도메인 오류:', `도메인 오류: ${code}`);
design.paths['/schedules/{scheduleId}'].patch.description +=
  ' 기간을 바꾸면 일차를 새 기간 전체로 다시 만든다(남는 날짜의 제목·방문·취소 상태 유지). 새로 들어오는 날짜가 다른 활성 일정의 활성 일차면 409 SCHEDULE_DATE_TAKEN.';
const dayOp = (operationId, summary, description, body, extra = {}) => ({
  operationId, summary, tags: ['F08'], description, security: [{ bearerAuth: [] }],
  parameters: [uuidPath('scheduleId'), datePath, idempotency],
  requestBody: jsonBody(body),
  responses: withErrors({ 200: { description: summary, content: { 'application/json': { schema: ref('DayChangeResult') } } }, ...extra }),
});
const versionOnly = { type: 'object', properties: { expectedVersion: { type: 'integer', minimum: 1 } }, required: ['expectedVersion'], additionalProperties: false };
design.paths['/schedules/{scheduleId}/days/{date}'] = {
  patch: dayOp(
    'dayUpdate',
    'expectedVersion(일정), title?, date? → schedule, days',
    '권한: owner. 일차 제목 변경(여러 날 일정은 최대 30, 빈값/null은 제목 없음; 하루짜리 일정은 일정 제목 1~100) 또는 다른 날짜로 이동. 이동하면 방문·기록 날짜가 함께 옮겨지고 일차 번호가 다시 매겨진다. 도메인 오류: SCHEDULE_DATE_TAKEN(대상 날짜를 다른 일정이 쓰거나 이미 이 일정의 날) DAY_BUSY(그 날짜 파일 전송 진행 중) TARGET_NOT_EMPTY(대상 날짜에 기간 밖 방문/기록 잔존) SCHEDULE_CANCELLED VERSION_CONFLICT NOT_FOUND FORBIDDEN TEXT_REJECTED.',
    { type: 'object', properties: { expectedVersion: { type: 'integer', minimum: 1 }, title: { type: ['string', 'null'] }, date: { type: 'string', format: 'date' } }, required: ['expectedVersion'], additionalProperties: false },
    { 202: { description: '공개전검사 접수', content: { 'application/json': { schema: ref('Operation') } } } },
  ),
};
design.paths['/schedules/{scheduleId}/days/{date}/cancellation'] = {
  post: dayOp('dayCancel', 'expectedVersion(일정) → schedule, days', '권한: owner. 하루 취소: 기록은 남고 그 날짜의 새 방문·파일은 409 DAY_CANCELLED. 모든 날이 취소되면 일정도 취소. 도메인 오류: ALREADY_CANCELLED VERSION_CONFLICT NOT_FOUND FORBIDDEN.', versionOnly),
};
design.paths['/schedules/{scheduleId}/days/{date}/deletion'] = {
  post: dayOp('dayDelete', 'expectedVersion(일정) → schedule|null, days', '권한: owner. 장소·방문·기록·진행 파일이 없는 날만 삭제(아니면 409 NOT_EMPTY). 마지막 날이면 일정 삭제(schedule=null). 남은 날이 모두 취소 상태면 일정 취소. 도메인 오류: NOT_EMPTY VERSION_CONFLICT NOT_FOUND FORBIDDEN.', versionOnly),
};
schemas.Operation.properties.kind.enum.push('day_update');
schemas.Operation.properties.result.anyOf[0].anyOf.push(ref('DayChangeResult'));
// 초대: 8자리 영문 대문자+숫자 코드(기존 12자리 16진 코드도 계속 유효).
const preview = design.paths['/invite-preview'].get;
preview.description += ' 코드는 8자리 A-Z0-9(이전 12자리 16진 코드도 허용, 대소문자 무관). 로그인한 현재 참여자(발급자 포함)가 확인하면 사용 횟수를 쓰지 않고 alreadyMember=true. Authorization은 선택.';
preview.security = [{}, { bearerAuth: [] }];
const previewBody = responseSchema('/invite-preview');
previewBody.properties.alreadyMember = { type: 'boolean' };
previewBody.properties.usesRemaining.maximum = 50;
previewBody.required.push('alreadyMember');
schemas.Invitation.properties.code = { type: 'string', pattern: '^[A-Z0-9]{8}$|^[0-9A-F]{12}$', description: '새 코드는 8자리 A-Z0-9' };
// 프로필 사진: 모임 대표 사진과 같은 업로드·검사 경로.
schemas.Profile.properties.avatarVersion = { type: ['integer', 'null'], minimum: 0, description: 'null이면 기본 아이콘. 바뀔 때마다 증가(캐시 키)' };
schemas.Profile.required.push('avatarVersion');
const member = responseSchema('/groups/{groupId}/members').properties.members.items;
Object.assign(member.properties, { userId: { type: 'string', format: 'uuid' }, avatarVersion: { type: ['integer', 'null'], minimum: 0 } });
member.required.push('userId', 'avatarVersion');
responseSchema('/schedules/{scheduleId}/media').properties.groups.items.properties.avatarVersion = { type: ['integer', 'null'], minimum: 0 };
task.properties.targetType.enum.push('avatar');
task.properties.avatarUserId = { type: 'string', format: 'uuid' };
task.properties.avatarAssetId = { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] };
task.oneOf[0].not = { anyOf: [{ required: ['coverGroupId'] }, { required: ['avatarUserId'] }] };
task.oneOf[1].not = { anyOf: [{ required: ['submissionId'] }, { required: ['avatarUserId'] }] };
task.oneOf.push({ properties: { targetType: { const: 'avatar' } }, required: ['avatarUserId'], not: { anyOf: [{ required: ['submissionId'] }, { required: ['coverGroupId'] }] } });
task.allOf.push({ if: { properties: { state: { const: 'complete' }, targetType: { const: 'avatar' } } }, then: { properties: { avatarAssetId: { type: 'string', format: 'uuid' }, mediaId: { type: 'null' }, coverAssetId: { type: 'null' } } } });
schemas.MediaCommitResult.properties.avatarAssetId = { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] };
const coverBody = design.paths['/groups/{groupId}/cover-uploads'].post.requestBody.content['application/json'].schema;
design.paths['/me/avatar-uploads'] = {
  post: {
    operationId: 'avatarPrepare', tags: ['F02'], security: [{ bearerAuth: [] }],
    summary: 'file:FileInput → UploadTask {targetType:avatar,avatarUserId,transport}',
    description: '권한: self(active). 완료되면 task.avatarAssetId를 PATCH /me/profile avatarAssetId로 적용. 위치 제거·검사는 대표 사진과 같다. 도메인 오류: FILE_INVALID ACCESS_REVOKED.',
    parameters: [idempotency],
    requestBody: jsonBody(structuredClone(coverBody)),
    responses: withErrors({ 200: { description: 'UploadTask', content: { 'application/json': { schema: ref('UploadTask') } } } }),
  },
};
design.paths['/users/{userId}/avatar'] = {
  get: {
    operationId: 'avatarStream', tags: ['F02', 'F22'], security: [{ bearerAuth: [] }],
    description: '권한: 본인 또는 활성 모임을 함께하는 참여자. 사진이 없으면 404 NOT_FOUND, 비참여자는 403 FORBIDDEN.',
    parameters: [uuidPath('userId'), { name: 'v', in: 'query', required: false, schema: { type: 'string', maxLength: 32 }, description: '캐시 키(avatarVersion)' }],
    responses: { 200: { description: '위치 제거된 프로필 사진', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } },
  },
};
const profileBody = design.paths['/me/profile'].patch.requestBody.content['application/json'].schema;
Object.assign(profileBody.properties, { avatarAssetId: { type: 'string', format: 'uuid' }, restoreDefaultAvatar: { const: true } });
profileBody.required = ['expectedVersion'];
profileBody.additionalProperties = false;
design.paths['/me/profile'].patch.description = '권한: self. displayName(NFC 1~20 graphemes), avatarAssetId(완료된 본인 프로필 사진 작업의 결과) 또는 restoreDefaultAvatar=true 중 하나 이상. 이전 사진은 정리된다. 도메인 오류: VALIDATION_ERROR FILE_INVALID TEXT_REJECTED VERSION_CONFLICT.';
await writeFile(new URL('openapi.json', dir), JSON.stringify(design, null, 2) + '\n');
