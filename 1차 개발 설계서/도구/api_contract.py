"""OpenAPI 3.1 계약 생성. 배포 서버가 아닌 구현용 설계안이다."""
from design_model import APIS
S=lambda **kw:dict(type='string',**kw)
I=lambda **kw:dict(type='integer',**kw)
B=lambda **kw:dict(type='boolean',**kw)
R=lambda name:{'$ref':'#/components/schemas/'+name}
A=lambda item,**kw:dict(type='array',items=item,**kw)
def O(props,required=(),**kw):return dict(type='object',properties=props,required=list(required),**kw)
UUID=S(format='uuid'); DT=S(format='date-time'); DATE=S(format='date'); V=I(minimum=1)
SCHEMAS={
 'Error':O({'code':S(),'message':S(),'requestId':S(),'retryable':B(),'operationId':UUID,'currentVersion':V,'details':O({},additionalProperties=True,description='OUTSIDE_RANGE_CONFIRMATION_REQUIRED: {visits,media}; MEDIA_LIMIT: {photosRemaining,videosRemaining}; VISIT_LIMIT: {limit:15}'),'itemErrors':A(O({'id':UUID,'field':S(),'code':S(),'message':S()}))},['code','message','requestId','retryable']),
 'ScheduleInput':O({'title':S(),'startDate':DATE,'endDate':DATE,'timezone':S(enum=['Asia/Seoul'])},['title','startDate','endDate','timezone'],additionalProperties=False,description='제목1~100 graphemes. 날짜만 입력, 양끝 포함366일, 과거 허용. 반복·종일/시각 필드는 없다(2026-10-20 회의). 시각은 Visit.plannedTime.'),
 'FileInput':O({'clientFileId':S(),'selectionIndex':I(minimum=0,maximum=119),'name':S(),'mime':S(),'declaredBytes':I(minimum=1),'checksum':S(),'fingerprint':S(),'kind':S(enum=['photo','video']),'durationMs':I(minimum=0),'width':I(minimum=1),'height':I(minimum=1),'recordDate':DATE,'visitId':{'type':['string','null'],'format':'uuid'},'description':S()},['clientFileId','selectionIndex','name','mime','declaredBytes','fingerprint','kind','recordDate'],description='미디어 규격은 기능명세서6.2. 서버 actualBytes/probe와 대조한다.'),
 'Media':O({'id':UUID,'scheduleId':UUID,'authorUserId':UUID,'submissionId':UUID,'selectionIndex':I(),'recordDate':DATE,'visitId':{'type':['string','null'],'format':'uuid'},'description':S(),'kind':S(enum=['photo','video']),'completedAt':DT,'capturedAt':{'anyOf':[DT,{'type':'null'}]},'sortAt':DT,'sortBasis':S(enum=['captured','completed'],description='시간순 정렬 기준. 촬영 시각이 없으면 completed'),'retentionLastDate':DATE,'expiresAt':DT,'version':V,'accessState':S(enum=['available','deleted','expired','restricted'])},['id','scheduleId','authorUserId','submissionId','selectionIndex','recordDate','kind','completedAt','sortAt','sortBasis','version','accessState']),
 'UploadTask':O({'id':UUID,'submissionId':UUID,'state':S(enum=['queued','uploading','verifying','review','complete','failed','cancelled']),'transferredBytes':I(minimum=0),'actualBytes':I(minimum=0),'retryable':B(),'reason':S(),'version':V,'mediaId':UUID,'uploadEndpoint':S(),'resumeOffset':I(minimum=0)},['id','submissionId','state','retryable','version']),
 'Operation':O({'id':UUID,'state':S(enum=['pending','review','succeeded','failed']),'result':O({}),'itemErrors':A(O({'id':UUID,'code':S(),'message':S()}))},['id','state']),
 'Group':O({'id':UUID,'name':S(),'ownerUserId':UUID,'status':S(enum=['active','closed']),'activeCount':I(minimum=0,maximum=10),'capacity':I(const=10),'activityAt':DT,'version':V,'scheduleSummary':O({'id':UUID,'title':S(),'startDate':DATE,'endDate':DATE})},['id','name','ownerUserId','status','activeCount','capacity','activityAt','version']),
 'Schedule':O({'id':UUID,'groupId':UUID,'title':S(),'startDate':DATE,'endDate':DATE,'timezone':S(enum=['Asia/Seoul']),'status':S(enum=['active','cancelled','deleted']),'retentionFixedAt':DT,'retentionLastDate':DATE,'expiresAt':DT,'version':V},['id','groupId','title','startDate','endDate','timezone','status','version'],additionalProperties=False),
 'Visit':O({'id':UUID,'scheduleId':UUID,'placeId':UUID,'visitDate':DATE,'position':I(minimum=0),'plannedTime':{'type':['string','null'],'pattern':'^([01][0-9]|2[0-3]):[0-5][05]$'},'version':V},['id','scheduleId','placeId','visitDate','position','version']),
 'Session':O({'accessToken':S(),'refreshToken':S(),'expiresAt':DT,'userId':UUID},['accessToken','refreshToken','expiresAt','userId']),
 'Profile':O({'id':UUID,'displayName':S(),'status':S(),'version':V},['id','displayName','status','version']),
 'Invitation':O({'id':UUID,'link':S(),'code':S(),'issuedAt':DT,'expiresAt':DT,'revokedAt':{'anyOf':[DT,{'type':'null'}]},'useCount':I(minimum=0,maximum=50),'maxUses':I(const=50),'state':S(enum=['active','exhausted','expired','revoked']),'version':V},['id','link','code','issuedAt','expiresAt','useCount','maxUses','state','version'])
}
TIME={'type':['string','null'],'pattern':'^([01][0-9]|2[0-3]):[0-5][05]$'}
target=A(O({'id':UUID,'expectedVersion':V},['id','expectedVersion']),minItems=1,maxItems=120,uniqueItems=True)
def field_apply(t): return O({'apply':B(),'value':t},['apply','value'])
REQUESTS={
 'authExchange':O({'provider':S(enum=['kakao','google']),'credential':S(),'nonce':S(),'loginAttemptId':S()},['provider','credential','nonce','loginAttemptId']),
 'sessionRefresh':O({'refreshToken':S()},['refreshToken']),
 'onboard':O({'displayName':S(),'consents':A(O({'documentId':UUID,'version':S(),'agreed':B()},['documentId','version','agreed']))},['displayName','consents']),
 'profilePatch':O({'displayName':S(),'expectedVersion':V},['displayName','expectedVersion']),
 'consentUpdate':O({'items':A(O({'documentId':UUID,'version':S(),'agreed':B()},['documentId','version','agreed']))},['items']),
 'identityLink':O({'provider':S(enum=['kakao','google']),'credential':S(),'reauthProof':S()},['provider','credential','reauthProof']),
 'identityUnlink':O({'expectedVersion':V},['expectedVersion']),
 'groupCreate':O({'name':S(),'firstSchedule':R('ScheduleInput')},['name','firstSchedule']),
 'groupUpdate':O({'name':S(),'coverAssetId':UUID,'restoreDefault':B(),'expectedVersion':V},['expectedVersion'],description='이름/대표사진/기본복원 중 하나 이상. 새 텍스트·이미지는 검사 후 적용.'),
 'coverPrepare':O({'file':O({'name':S(),'mime':S(),'declaredBytes':I(minimum=1),'fingerprint':S()},['name','mime','declaredBytes','fingerprint'])},['file']),
 'scheduleCreate':R('ScheduleInput'),
 'scheduleUpdate':O({'title':S(),'startDate':DATE,'endDate':DATE,'expectedVersion':V,'confirmOutsideRange':B(default=False)},['expectedVersion'],additionalProperties=False,description='제목·기간 중 하나 이상. 기간 밖이 되는 방문/기록이 있으면 confirmOutsideRange=true 없이는 409 OUTSIDE_RANGE_CONFIRMATION_REQUIRED.'),
 'scheduleCancel':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False),
 'scheduleDelete':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False),
 'visitCreate':O({'visitDate':DATE,'plannedTime':TIME,'providerPlaceId':S(),'manual':O({'name':S(),'address':S(),'lat':{'type':'number','minimum':-90,'maximum':90},'lng':{'type':'number','minimum':-180,'maximum':180}},['name'])},['visitDate'],description='providerPlaceId 또는 manual 중 정확히 하나. 좌표는 둘다 없거나 둘다 제공. plannedTime은 00:00~23:55 5분 단위 또는 null(시간 미정). 날짜별 활성 방문 15개 초과는 409 VISIT_LIMIT.'),
 'planUpdate':O({'title':S(),'visits':A(O({'id':UUID,'order':I(minimum=0),'plannedTime':{'type':['string','null']}},['id','order','plannedTime'])),'expectedVersion':V},['title','visits','expectedVersion']),
 'visitDelete':O({'expectedVersion':V},['expectedVersion']),
 'uploadPrepare':O({'files':A(R('FileInput'),minItems=1,maxItems=120)},['files']),
 'uploadCommit':O({'checksum':S(),'actualBytes':I(minimum=1)},['checksum','actualBytes']),
 'uploadRetry':O({'sameFileFingerprint':S()},['sameFileFingerprint']),
 'uploadCancel':O({'expectedVersion':V},['expectedVersion']),
 'metadataPatch':O({'targets':target,'fields':O({'description':field_apply(S()),'recordDate':field_apply(DATE),'visitId':field_apply({'type':['string','null'],'format':'uuid'})},minProperties=1)},['targets','fields']),
 'mediaDelete':O({'mediaIds':A(UUID,minItems=1,maxItems=120,uniqueItems=True)},['mediaIds']),
 'exportCreate':O({'mediaIds':A(UUID,minItems=1,maxItems=120,uniqueItems=True),'purpose':S(enum=['save'],description='외부 공유(share)는 2026-10-20 회의로 폐지')},['mediaIds','purpose'],additionalProperties=False),
 'inviteCreate':O({}),'inviteRevoke':O({'expectedVersion':V},['expectedVersion']),
 'inviteJoin':O({'tokenOrCode':S()},['tokenOrCode']),
 'ownerTransfer':O({'targetMembershipId':UUID,'expectedVersion':V},['targetMembershipId','expectedVersion']),
 'memberRemove':O({'targetMembershipId':UUID,'expectedVersion':V},['targetMembershipId','expectedVersion']),
 'reentryUnblock':O({'expectedVersion':V},['expectedVersion']),
 'groupLeave':O({'membershipId':UUID,'expectedVersion':V},['membershipId','expectedVersion']),
 'groupClose':O({'confirmOwnMediaDeletion':B(const=True),'expectedVersion':V},['confirmOwnMediaDeletion','expectedVersion']),
 'accountDelete':O({'reauthProof':S(),'confirmAllOwnMediaDeletion':B(const=True)},['reauthProof','confirmAllOwnMediaDeletion']),
 'reportCreate':O({'targetType':S(enum=['media','cover','member']),'targetId':UUID,'reason':S()},['targetType','targetId','reason']),
 'blockCreate':O({'targetUserId':UUID},['targetUserId']),
 'recoveryCreate':O({'candidateMembershipId':UUID,'reason':S(),'evidenceRefs':A(S()),'reauthProof':S()},['candidateMembershipId','reason','evidenceRefs','reauthProof']),
 'logout':O({'deviceId':S(),'pendingAction':S(enum=['cancel','none'])},['deviceId','pendingAction']),
 'inquiryCreate':O({'category':S(enum=['report','recovery','consent','deletion','upload','other']),'reason':S(),'referenceId':S()},['category','reason']),
 'opsAction':O({'action':S(enum=['restrict','delete','release','restrict_account','release_account','no_action']),'reason':S(),'expectedVersion':V},['action','reason','expectedVersion']),
 'opsRecovery':O({'decision':S(enum=['approve','reject','hold']),'reason':S(),'evidenceChecklist':O({'requesterVerified':B(),'candidateAgreed':B(),'ownerNotified':B(),'waitCompleted':B(),'disputeResolved':B()},['requesterVerified','candidateAgreed','ownerNotified','waitCompleted','disputeResolved']),'expectedGroupVersion':V},['decision','reason','evidenceChecklist','expectedGroupVersion'])
}
QUERIES={
 'consentDocs':{'locale':S(enum=['ko'])},'groupsList':{'cursor':S(),'limit':I(minimum=1,maximum=30,default=30)},
 'calendar':{'from':DATE,'to':DATE},
 'placesSearch':{'groupId':UUID,'query':S(description='NFC 정규화 후 grapheme 최대100자'),'category':S(enum=['all','tourism','restaurant','cafe','lodging']),'bounds':S(description='west,south,east,north'),'sort':S(enum=['relevance','distance']),'center':S(description='lng,lat')},
 'mediaList':{'recordDate':DATE,'visitId':UUID,'unassigned':B(),'outsideRange':B(),'view':S(enum=['by_time','by_author'],default='by_time'),'order':S(enum=['asc','desc'],default='asc',description='sortAt 기준. by_author는 작성자 구역 순서(첫 완료순) 뒤 구역 내부 정렬'),'cursor':S(),'limit':I(minimum=1,maximum=60,default=60)},
 'mediaStream':{'variant':S(enum=['thumbnail','view']),'context':S(enum=['shared','mine'])},
 'mineList':{'groupId':UUID,'status':S(enum=['active_membership','ended_membership','expired']),'cursor':S(),'limit':I(minimum=1,maximum=60,default=60)},
 'invitesList':{'cursor':S()},'invitePreview':{'tokenOrCode':S()},'reportsMine':{'cursor':S()},'opsQueue':{'type':S(),'status':S(),'cursor':S()}}
def page(items):return O({'items':A(items),'nextCursor':{'type':['string','null']}},['items','nextCursor'])
RESPONSES={
 'authExchange':O({'session':R('Session'),'user':R('Profile'),'onboardingRequired':B()},['session','user','onboardingRequired']),
 'sessionRefresh':R('Session'),'onboard':O({'user':R('Profile'),'consentReceipts':A(O({'documentId':UUID,'version':S(),'agreed':B(),'occurredAt':DT}))},['user','consentReceipts']),
 'consentDocs':O({'documents':A(O({'id':UUID,'version':S(),'required':B(),'url':S()},['id','version','required','url']))},['documents']),
 'profilePatch':{'oneOf':[R('Profile'),R('Operation')]},
 'groupsList':page(R('Group')),
 'groupCreate':{'oneOf':[O({'group':R('Group'),'membershipId':UUID,'firstSchedule':R('Schedule')},['group','membershipId','firstSchedule']),R('Operation')]},
 'groupUpdate':{'oneOf':[R('Group'),R('Operation')]},
 'calendar':O({'schedules':A(R('Schedule')),'dateCounts':O({})},['schedules','dateCounts']),
 'scheduleDetail':O({'schedule':R('Schedule'),'retention':O({'fixed':B(),'lastDate':DATE,'expiresAt':DT}),'plan':A(O({'date':DATE,'title':S(),'visits':A(R('Visit')),'visitCount':I(minimum=0,maximum=15),'visitLimit':I(const=15),'version':V},['date','title','visits','visitCount','visitLimit','version'],additionalProperties=False)),'version':V},['schedule','retention','plan','version']),
 'scheduleCreate':R('Schedule'),
 'scheduleUpdate':R('Schedule'),
 'scheduleCancel':R('Schedule'),
 'scheduleDelete':O({'deletedId':UUID,'deletedVisitIds':A(UUID)},['deletedId','deletedVisitIds'],additionalProperties=False),
 'visitCreate':R('Visit'),'planUpdate':{'oneOf':[O({'title':S(),'date':DATE,'visits':A(R('Visit')),'version':V},['title','date','visits','version']),R('Operation')]},
 'visitDelete':O({'deletedId':UUID},['deletedId']),
 'coverPrepare':R('UploadTask'),
 'uploadPrepare':O({'submissionId':UUID,'tasks':A(R('UploadTask')),'fileErrors':A(O({'clientFileId':S(),'code':S(enum=['FILE_INVALID','MEDIA_LIMIT','VISIT_MISMATCH','RECORD_DATE_OUT_OF_RANGE']),'message':S()},['clientFileId','code','message'])),'remaining':A(O({'visitId':{'type':['string','null'],'format':'uuid'},'recordDate':DATE,'photos':I(minimum=0,maximum=5),'videos':I(minimum=0,maximum=2)},['visitId','recordDate','photos','videos'],additionalProperties=False),description='접수 후 작성자별 남은 개수(방문 또는 미지정 묶음)')},['submissionId','tasks','fileErrors','remaining']),
 'uploadGet':R('UploadTask'),'uploadRetry':R('UploadTask'),'uploadCancel':R('UploadTask'),
 'uploadCommit':O({'task':R('UploadTask'),'operationId':UUID},['task','operationId']),
 'mediaList':O({'items':A(R('Media')),'groups':A(O({'authorUserId':UUID,'displayName':S(),'photos':I(minimum=0),'videos':I(minimum=0),'firstCompletedAt':DT},['authorUserId','displayName','photos','videos','firstCompletedAt'],additionalProperties=False),description='view=by_author일 때 작성자 구역 머리글. 차단 작성자 제외'),'visibleCounts':O({'photos':I(),'videos':I()},['photos','videos']),'nextCursor':{'type':['string','null']}},['items','visibleCounts','nextCursor']),
 'mineList':page(O({'media':R('Media'),'groupName':S(),'scheduleTitle':S(),'membershipState':S(),'groupState':S()},['media','groupName','scheduleTitle','membershipState','groupState'])),
 'metadataPatch':R('Operation'),'mediaDelete':O({'operationId':UUID,'results':A(O({'id':UUID,'status':S(enum=['deleted','already_deleted','failed']),'reason':S()},['id','status']))},['operationId','results']),
 'exportCreate':O({'exportId':UUID,'state':S(),'results':A(O({'mediaId':UUID,'state':S(),'converted':B(),'variant':S()}))},['exportId','state','results']),
 'exportGet':O({'export':O({'id':UUID,'purpose':S(),'state':S()}),'results':A(O({'mediaId':UUID,'state':S(),'converted':B(),'variant':S()}))},['export','results']),
 'inviteCreate':R('Invitation'),'invitesList':O({'invites':A(R('Invitation'))},['invites']),
 'inviteRevoke':R('Invitation'),
 'invitePreview':O({'groupName':S(),'scheduleSummary':{'anyOf':[O({'title':S(),'startDate':DATE,'endDate':DATE}),{'type':'null'}]},'inviteState':S(enum=['active']),'usesRemaining':I(minimum=0,maximum=49,description='이번 응답을 포함해 50회에서 뺀 값')},['groupName','scheduleSummary','inviteState','usesRemaining'],additionalProperties=False),
 'inviteJoin':O({'groupId':UUID,'membershipId':UUID,'alreadyMember':B()},['groupId','membershipId','alreadyMember']),
 'storageUsage':O({k:I(minimum=0) for k in ['completedOriginalBytes','reservedBytes','limitBytes','availableBytes']},['completedOriginalBytes','reservedBytes','limitBytes','availableBytes']),
 'accountDelete':O({'deletionOperationId':UUID,'accessRevoked':B(const=True)},['deletionOperationId','accessRevoked']),
 'operationGet':R('Operation'),
 'identityLink':O({'identities':A(O({'id':UUID,'provider':S(),'version':V},['id','provider','version']))},['identities']),
 'identityUnlink':O({'identities':A(O({'id':UUID,'provider':S(),'version':V},['id','provider','version']))},['identities']),
 'consentUpdate':O({'consentReceipts':A(O({'documentId':UUID,'version':S(),'agreed':B(),'occurredAt':DT},['documentId','version','agreed','occurredAt']))},['consentReceipts']),
 'membersList':O({'members':A(O({'id':UUID,'displayName':S(),'isOwner':B()},['id','displayName','isOwner'])),'reentryBlocks':A(O({'userId':UUID,'version':V}))},['members']),
 'ownerTransfer':O({'ownerUserId':UUID,'groupVersion':V},['ownerUserId','groupVersion']),
 'memberRemove':O({'membership':O({'id':UUID,'endedAt':DT}),'reentryBlock':O({'userId':UUID,'version':V})},['membership','reentryBlock']),
 'reentryUnblock':O({'unblocked':B(const=True)},['unblocked']),
 'groupLeave':O({'left':B(const=True)},['left']),
 'groupClose':O({'closed':B(const=True),'deletionOperationId':UUID},['closed','deletionOperationId']),
 'reportCreate':O({'reportId':UUID,'state':S(),'reviewDueAt':DT},['reportId','state','reviewDueAt']),
 'reportsMine':O({'reports':A(O({'id':UUID,'state':S(),'decisionSummary':S(),'reviewDueAt':DT})),'nextCursor':{'type':['string','null']}},['reports','nextCursor']),
 'blockCreate':O({'block':O({'targetUserId':UUID,'createdAt':DT},['targetUserId','createdAt'])},['block']),
 'blockDelete':O({'unblocked':B(const=True)},['unblocked']),
 'recoveryCreate':O({'requestId':UUID,'state':S()},['requestId','state']),
 'recoveryGet':O({'state':S(),'noticeAt':DT,'responseDueAt':DT,'decisionSummary':S()},['state']),
 'logout':O({'sessionRevoked':B(const=True)},['sessionRevoked']),
 'inquiryCreate':O({'inquiryId':UUID,'state':S()},['inquiryId','state']),
 'opsQueue':O({'cases':A(O({'id':UUID,'type':S(),'state':S(),'dueAt':DT,'version':V})),'nextCursor':{'type':['string','null']}},['cases','nextCursor']),
 'opsAction':O({'decision':O({'action':S(),'reason':S(),'decidedAt':DT}),'auditId':UUID},['decision','auditId']),
 'opsRecovery':O({'decision':O({'state':S(),'reason':S(),'decidedAt':DT}),'auditId':UUID},['decision','auditId'])
}

REQUESTS.update({
 'blockDelete':O({}),
 'reauthenticate':O({'provider':S(enum=['kakao','google']),'credential':S(),'nonce':S()},['provider','credential','nonce']),
 'notificationRead':O({}),
 'recoveryConsent':O({'agreed':B(),'reauthProof':S()},['agreed','reauthProof']),
 'recoveryResponse':O({'response':S(enum=['agree','object','contacted']),'reason':S()},['response','reason'])})
SCHEMAS['UploadTask']['properties'].update({'targetType':S(enum=['record','cover']),'coverGroupId':UUID})
SCHEMAS['UploadTask']['required']=['id','targetType','state','retryable','version']
RESPONSES.update({
 'placesSearch':O({'places':A(O({'providerPlaceId':S(),'name':S(),'address':S(),'lat':{'type':'number'},'lng':{'type':'number'},'distanceMeters':I(minimum=0),'category':S()})),'provider':S(enum=['kakao']),'searchContext':O({'query':S(),'bounds':S(),'center':S(),'requestSequence':I()})},['places','provider','searchContext']),
 'reauthenticate':O({'reauthProof':S(),'expiresAt':DT},['reauthProof','expiresAt']),
 'profileGet':R('Profile'), 'identitiesList':RESPONSES['identityLink'], 'consentsMine':RESPONSES['consentUpdate'],
 'blocksList':O({'blocks':A(O({'targetUserId':UUID,'displayName':S(),'createdAt':DT})),'nextCursor':{'type':['string','null']}},['blocks','nextCursor']),
 'notificationsList':O({'notifications':A(O({'id':UUID,'kind':S(),'message':S(),'referenceId':UUID,'createdAt':DT,'readAt':DT})),'nextCursor':{'type':['string','null']}},['notifications','nextCursor']),
 'notificationRead':O({'readAt':DT},['readAt']),
 'recoveryConsent':O({'state':S(),'candidateConsentAt':DT},['state','candidateConsentAt']),
 'recoveryResponse':O({'state':S(),'receivedAt':DT},['state','receivedAt']),
 'opsCaseGet':O({'case':O({'id':UUID,'type':S(),'state':S(),'targetId':UUID,'version':V,'reason':S()}),'evidenceRefs':A(S()),'history':A(O({'actorId':UUID,'action':S(),'reason':S(),'createdAt':DT}))},['case','evidenceRefs','history'])})
for key in ['blocksList','notificationsList']:QUERIES[key]={'cursor':S()}

def build_openapi():
    import re
    from contract_v02 import apply_revision,transport_responses
    apply_revision(globals())
    paths={}
    for a in APIS:
        p=[]
        for key in re.findall(r'\{([^}]+)\}',a['path']):p.append(dict(name=key,**{'in':'path'},required=True,schema=DATE if key=='date' else UUID))
        for key,schema in QUERIES.get(a['id'],{}).items():p.append(dict(name=key,**{'in':'query'},required=(a['id'],key) in {('calendar','from'),('calendar','to'),('placesSearch','groupId'),('placesSearch','query'),('invitePreview','tokenOrCode'),('mediaStream','variant'),('mediaStream','context')},schema=schema))
        if a['method'] not in ['GET','HEAD'] and a['id']!='uploadChunk':
            p.append(dict(name='Idempotency-Key',**{'in':'header'},required=True,schema=S(minLength=16,maxLength=128)))
        if a['id'] in ['mediaStream','exportFile']:p.append(dict(name='Range',**{'in':'header'},required=False,schema=S()))
        op=dict(operationId=a['id'],summary=a['request']+' → '+a['response'],tags=a['features'],description='권한: '+a['auth']+'. 도메인 오류: '+a['errors']+'. 요청/응답의 실제 처리 규칙은 03 API 연동 설계.docx와 04 업무 흐름 상태 설계.docx를 함께 적용한다.',security=[] if a['auth'] in ['public','refresh-session'] else [{'bearerAuth':[]}],parameters=p,responses={})
        if a['id'] in ['invitesList','inviteCreate','inviteRevoke']:
            op['x-required-role']='member'
            op['description']+=' F05 v2.1: 방장을 포함한 모든 현재 참여자가 같은 모임의 초대를 관리한다. 다른 참여자가 발급한 초대도 조회·공유·취소할 수 있다. 발급자 ID는 이력용이다. 탈퇴·퇴장·서비스 이용 제한·모임 종료 시 거부하며 멱등 재시도에서도 현재 권한을 재검증한다.'
        if a['id'] in ['uploadHead','uploadChunk']:
            op['parameters'].append(dict(name='Upload-Generation',**{'in':'header'},required=True,schema=I(minimum=1)))
            if a['id']=='uploadChunk':
                for name,schema in [('Upload-Offset',I(minimum=0)),('Upload-Checksum',S(pattern='^sha256 [0-9a-f]{64}$')),('Content-Length',I(minimum=1,maximum=4194304))]:
                    op['parameters'].append(dict(name=name,**{'in':'header'},required=True,schema=schema))
            op['responses'].update(transport_responses(S,I))
        elif a['id'] in ['mediaStream','exportFile']:
            op['responses']['200']={'description':'현재권한 재검증 후 위치검증된 파일','content':{'application/octet-stream':{'schema':S(format='binary')}}}
            op['responses']['206']={'description':'인증된 부분 콘텐츠','headers':{'Content-Range':{'schema':S()}}}
            op['responses']['416']={'description':'유효하지 않은 Range'}
        else:
            assert a['id'] in RESPONSES,a['id']
            op['responses']['200']={'description':a['response'],'content':{'application/json':{'schema':RESPONSES[a['id']]}}}
            if a['id'] in ['groupCreate','groupUpdate','profilePatch','scheduleCreate','scheduleUpdate','planUpdate','metadataPatch','uploadCommit']:
                op['responses']['202']={'description':'공개전검사/비동기처리 접수. operation을 조회하며 완료로 표시하지 않는다.','content':{'application/json':{'schema':R('Operation')}}}
            if a['id'] in ['metadataPatch','uploadCommit']:
                op['responses']['200']['description']='이미 확정된 동일 멱등 요청 결과. 신규 접수는202.'
        for code,label in [('400','입력/규격 오류'),('401','인증 만료/재인증 필요'),('403','권한/참여/차단/운영 제한'),('404','대상 없음'),('409','버전/상태/멱등본문 충돌'),('410','삭제/만료/종료'),('413','파일 크기 초과'),('429','요청률 제한'),('503','공급자/서비스 일시 장애')]:
            op['responses'][code]={'description':label,'content':{'application/json':{'schema':R('Error')}}}
        if a['id'] in ['uploadHead','uploadChunk']:
            op['responses']['428']={'description':'필수 전송 헤더 누락','content':{'application/json':{'schema':R('Error')}}}
        if a['method']=='HEAD':
            for response in op['responses'].values():
                response.pop('content',None)
                response.setdefault('headers',{}).update({'X-Error-Code':{'schema':S()},'X-Request-Id':{'schema':S()}})
        if a['id']=='uploadChunk':
            op['requestBody']={'required':True,'content':{'application/offset+octet-stream':{'schema':S(format='binary')}}}
        elif a['method'] not in ['GET','HEAD']:
            assert a['id'] in REQUESTS,a['id']
            op['requestBody']={'required':True,'content':{'application/json':{'schema':REQUESTS[a['id']]}}}
        paths.setdefault(a['path'],{})[a['method'].lower()]=op
    return dict(openapi='3.1.0',info={'title':'At that place 1차 개발 API 설계안','version':'0.3.2-design','description':'패키지 기준/기능명세서.md(v2.2, 2026-10-30)와09 구현계약 보완 기준. 반복 일정·외부 공유 없음, 초대 50회·방문 15개·사진5/영상2 한도 포함. 실제 배포 서버가 아니다. NFC grapheme 검증과 권한/상태/한도 검사는 서버 책임.'},servers=[{'url':'https://api.example.invalid/v1','description':'문서용 가상 주소·실서비스 없음'}],paths=paths,components={'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}},'schemas':SCHEMAS})
