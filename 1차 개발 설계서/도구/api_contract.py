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
 'Error':O({'code':S(),'message':S(),'requestId':S(),'retryable':B(),'operationId':UUID,'currentVersion':V,'details':O({},additionalProperties=True,description='OUTSIDE_RANGE_CONFIRMATION_REQUIRED: {visits,media}; MEDIA_LIMIT: {photosRemaining,videosRemaining}; VISIT_LIMIT: {limit:15}; SCHEDULE_DATE_TAKEN: {dates:[date],schedules:[{id,title}]}; DAY_CANCELLED: {date}; TARGET_NOT_EMPTY: {date}; DUPLICATE_FILE: {clientFileIds:[...]}'),'itemErrors':A(O({'id':UUID,'field':S(),'code':S(),'message':S()}))},['code','message','requestId','retryable']),
 'ScheduleInput':O({'title':S(),'startDate':DATE,'endDate':DATE,'timezone':S(enum=['Asia/Seoul'])},['title','startDate','endDate','timezone'],additionalProperties=False,description='제목1~100 graphemes. 날짜만 입력, 양끝 포함366일, 과거 허용. startDate~endDate의 각 날짜가 일차(ScheduleDay)가 된다. v3: 같은 모임의 활성 일정이 쓰는 활성 일차와 겹치는 날짜가 하나라도 있으면 409 SCHEDULE_DATE_TAKEN(취소된 날·취소된 일정의 날은 빈 날). 반복·종일/시각 필드는 없다(2026-10-20 회의). 시각은 Visit.plannedTime.'),
 'FileInput':O({'clientFileId':S(),'selectionIndex':I(minimum=0,maximum=9),'name':S(),'mime':S(),'declaredBytes':I(minimum=1),'checksum':S(),'fingerprint':S(),'kind':S(enum=['photo','video']),'durationMs':I(minimum=0),'width':I(minimum=1),'height':I(minimum=1),'recordDate':DATE,'visitId':{'type':['string','null'],'format':'uuid'},'description':S()},['clientFileId','selectionIndex','name','mime','declaredBytes','fingerprint','kind','recordDate'],description='미디어 규격은 기능명세서6.2. 서버 actualBytes/probe와 대조한다. v3: 장소 기록 화면에서 올리면 visitId=그 방문, recordDate=그 방문의 날짜. visitId=null(장소 미지정)은 기존 기능으로 유지. 설명은 업로드 시트에서 받지 않으며(빈값) 이후 metadataPatch로 수정한다.'),
 'Media':O({'id':UUID,'scheduleId':UUID,'authorUserId':UUID,'submissionId':UUID,'selectionIndex':I(),'recordDate':DATE,'visitId':{'type':['string','null'],'format':'uuid'},'description':S(),'kind':S(enum=['photo','video']),'durationMs':{'type':['integer','null'],'minimum':0,'description':'동영상 길이(사진은 null)'},'displayName':S(description='작성자 현재 표시명'),'completedAt':DT,'capturedAt':{'anyOf':[DT,{'type':'null'}],'description':'촬영 시각. 표시·필터용으로 보존하며 정렬에 쓰지 않는다'},'submissionCompletedAt':DT,'sortAt':DT,'sortBasis':S(enum=['submission'],description='v3: 정렬 기준은 게시 묶음(submission)의 첫 완료 시각(submissionCompletedAt=sortAt). 같은 묶음 안에서는 selectionIndex 순서 유지'),'retentionLastDate':DATE,'expiresAt':DT,'version':V,'accessState':S(enum=['available','deleted','expired','restricted'])},['id','scheduleId','authorUserId','submissionId','selectionIndex','recordDate','kind','completedAt','submissionCompletedAt','sortAt','sortBasis','version','accessState']),
 'UploadTask':O({'id':UUID,'submissionId':UUID,'state':S(enum=['queued','uploading','verifying','review','complete','failed','cancelled']),'transferredBytes':I(minimum=0),'actualBytes':I(minimum=0),'retryable':B(),'reason':S(),'version':V,'mediaId':UUID,'uploadEndpoint':S(),'resumeOffset':I(minimum=0)},['id','submissionId','state','retryable','version']),
 'Operation':O({'id':UUID,'state':S(enum=['pending','review','succeeded','failed']),'result':O({}),'itemErrors':A(O({'id':UUID,'code':S(),'message':S()}))},['id','state']),
 'Group':O({'id':UUID,'name':S(),'ownerUserId':UUID,'status':S(enum=['active','closed']),'activeCount':I(minimum=0,maximum=10),'capacity':I(const=10),'activityAt':DT,'version':V,'scheduleSummary':O({'id':UUID,'title':S(),'startDate':DATE,'endDate':DATE})},['id','name','ownerUserId','status','activeCount','capacity','activityAt','version']),
 'Schedule':O({'id':UUID,'groupId':UUID,'title':S(),'startDate':DATE,'endDate':DATE,'timezone':S(enum=['Asia/Seoul']),'status':S(enum=['active','cancelled','deleted']),'retentionFixedAt':DT,'retentionLastDate':DATE,'expiresAt':DT,'version':V,'days':A(R('ScheduleDay'),description='달력 응답에서 포함. 일정 상세는 최상위 days[]')},['id','groupId','title','startDate','endDate','timezone','status','version'],additionalProperties=False,description='v3: 일정은 날짜(일차)의 묶음. startDate/endDate는 남은 일차의 최소·최대 날짜(봉투)이며 보관 기한 계산은 endDate 기준을 유지한다. 모든 일차가 취소되면 status=cancelled.'),
 'ScheduleDay':O({'date':DATE,'dayNo':I(minimum=1),'title':{'type':['string','null'],'description':'일차 제목(최대30 graphemes). 없으면 null. 하루짜리 일정은 일정 제목을 쓴다'},'status':S(enum=['active','cancelled']),'visitCount':I(minimum=0,maximum=15)},['date','dayNo','title','status','visitCount'],additionalProperties=False,description='일정의 하루. dayNo는 날짜순 1부터(취소된 날 포함), 이동·삭제 시 다시 매긴다. 같은 모임에서 활성 일정의 활성 일차는 날짜마다 하나뿐이다. 앱 기본 표시 제목: 여러 날 `{dayNo}일차 · {일정명}`, 하루 `{일정명}`.'),
 'DayChangeResult':O({'schedule':{'anyOf':[R('Schedule'),{'type':'null'}]},'days':A(R('ScheduleDay'))},['schedule','days'],additionalProperties=False,description='하루 변경·취소·삭제 결과. 마지막 날 삭제로 일정이 삭제되면 schedule=null, days=[]'),
 'Visit':O({'id':UUID,'scheduleId':UUID,'placeId':UUID,'visitDate':DATE,'position':I(minimum=0),'plannedTime':{'type':['string','null'],'pattern':'^([01][0-9]|2[0-3]):[0-5][0-9]$','description':'00:00~23:59 1분 단위. null=시간 미정'},'version':V},['id','scheduleId','placeId','visitDate','position','version']),
 'Session':O({'accessToken':S(),'refreshToken':S(),'expiresAt':DT,'userId':UUID},['accessToken','refreshToken','expiresAt','userId']),
 'Profile':O({'id':UUID,'displayName':S(description='NFC 1~20 graphemes. 마이페이지 닉네임 변경 화면 입력은 12자(Q2)'),'status':S(),'avatarVersion':{'type':['integer','null'],'minimum':0,'description':'null이면 기본 아이콘. 바뀔 때마다 증가(캐시 키)'},'version':V},['id','displayName','status','avatarVersion','version']),
 'Invitation':O({'id':UUID,'link':S(),'code':S(pattern='^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$',description='8자, 0·O·1·I 제외 32문자. 입력 정규화(링크에서 추출·대문자·영숫자만)는 앱 책임'),'issuedAt':DT,'expiresAt':DT,'revokedAt':{'anyOf':[DT,{'type':'null'}]},'useCount':I(minimum=0,maximum=50),'maxUses':I(const=50),'state':S(enum=['active','exhausted','expired','revoked']),'version':V},['id','link','code','issuedAt','expiresAt','useCount','maxUses','state','version'])
}
TIME={'type':['string','null'],'pattern':'^([01][0-9]|2[0-3]):[0-5][0-9]$','description':'00:00~23:59 1분 단위 또는 null(시간 미정)'}
target=A(O({'id':UUID,'expectedVersion':V},['id','expectedVersion']),minItems=1,maxItems=120,uniqueItems=True)
def field_apply(t): return O({'apply':B(),'value':t},['apply','value'])
REQUESTS={
 'authExchange':O({'provider':S(enum=['kakao','google'],description='현재 Google 활성화 보류. enum 보존은 신규 로그인 허용을 뜻하지 않는다.'),'credential':S(),'nonce':S(),'loginAttemptId':S()},['provider','credential','nonce','loginAttemptId']),
 'sessionRefresh':O({'refreshToken':S()},['refreshToken']),
 'onboard':O({'displayName':S(description='NFC 1~20 graphemes. 초과 입력은 앱에서 보존·오류 표시'),'consents':A(O({'documentId':UUID,'version':S(),'agreed':B()},['documentId','version','agreed']),description='v3: 게시된 consent 문서 4종(서비스 이용약관·개인정보 수집 및 이용 동의 필수, 마케팅 정보 수신·위치정보 이용약관 선택) 각각의 문서 버전에 agreed true/false를 기록한다. 필수가 false/누락이면 409 CONSENT_REQUIRED. 약관 전체 동의는 앱 편의 기능이다.')},['displayName','consents']),
 'profilePatch':O({'displayName':S(),'avatarAssetId':UUID,'restoreDefaultAvatar':B(const=True),'expectedVersion':V},['expectedVersion'],additionalProperties=False,minProperties=2,description='displayName(NFC 1~20 graphemes), avatarAssetId(완료된 본인 프로필 사진 작업 결과) 또는 restoreDefaultAvatar=true 중 하나 이상. avatarAssetId와 restoreDefaultAvatar는 함께 보낼 수 없다. 이전 사진은 정리 대상이 된다.'),
 'consentUpdate':O({'items':A(O({'documentId':UUID,'version':S(),'agreed':B()},['documentId','version','agreed']))},['items']),
 'identityLink':O({'provider':S(enum=['kakao','google'],description='현재 Google 활성화 보류. enum 보존은 신규 로그인 허용을 뜻하지 않는다.'),'credential':S(),'reauthProof':S()},['provider','credential','reauthProof']),
 'identityUnlink':O({'expectedVersion':V},['expectedVersion']),
 'groupCreate':O({'name':S(),'firstSchedule':R('ScheduleInput')},['name','firstSchedule']),
 'groupUpdate':O({'name':S(),'coverAssetId':UUID,'restoreDefault':B(),'expectedVersion':V},['expectedVersion'],description='이름/대표사진/기본복원 중 하나 이상. 새 텍스트·이미지는 검사 후 적용. 대표사진은 4:3 자르기(v3, 이전 16:9) 결과이며 모임 카드·초대 화면 썸네일에 쓴다. 없으면 모임 이름 첫 글자.'),
 'coverPrepare':O({'file':O({'name':S(),'mime':S(),'declaredBytes':I(minimum=1,maximum=5000000),'fingerprint':S(),'width':I(minimum=1),'height':I(minimum=1)},['name','mime','declaredBytes','fingerprint'])},['file'],description='모임 대표사진: 앱에서 4:3으로 자른 JPEG/PNG/WebP, 긴 변 1600px 이하·5MB 이하. 위치 제거·검사 후 적용.'),
 'scheduleCreate':R('ScheduleInput'),
 'scheduleUpdate':O({'title':S(),'startDate':DATE,'endDate':DATE,'expectedVersion':V,'confirmOutsideRange':B(default=False)},['expectedVersion'],additionalProperties=False,description='제목·기간 중 하나 이상. 기간 밖이 되는 방문/기록이 있으면 confirmOutsideRange=true 없이는 409 OUTSIDE_RANGE_CONFIRMATION_REQUIRED. 기간을 바꾸면 일차를 새 기간 전체로 다시 만들고(남는 날짜의 제목·방문·취소 상태 유지), 새로 들어오는 날짜가 다른 활성 일정의 활성 일차면 409 SCHEDULE_DATE_TAKEN. v3 1차 화면은 일정 전체 기간 변경을 제공하지 않으며(하루 단위 dayUpdate 사용) 이 API는 서버 호환·운영용으로 유지한다.'),
 'dayUpdate':O({'expectedVersion':V,'title':{'type':['string','null']},'date':DATE},['expectedVersion'],additionalProperties=False,minProperties=2,description='expectedVersion은 일정 버전. title: 여러 날 일정은 일차 제목 최대30 graphemes(빈값/null=제목 없음), 하루짜리 일정은 일정 제목 1~100(null 불가). date: 그날 하나를 다른 날짜로 이동. 다른 활성 일정이 쓰는 날·같은 일정의 다른 날이면 409 SCHEDULE_DATE_TAKEN. 이동하면 방문 날짜·기록일·진행 작업이 함께 옮겨지고 일차 번호를 다시 매긴다.'),
 'dayCancel':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False,description='하루 취소. 기록은 남고 그날의 새 방문·파일은 409 DAY_CANCELLED. 모든 날이 취소되면 일정도 취소된다.'),
 'dayDelete':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False,description='하루 삭제. 활성 방문·기록(삭제/만료 정리 전 포함)·진행 중 업로드가 없을 때만(P05). 마지막 날이면 일정 삭제. 남은 날이 모두 취소 상태면 일정 취소.'),
 'scheduleCancel':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False),
 'scheduleDelete':O({'expectedVersion':V},['expectedVersion'],additionalProperties=False),
 'visitCreate':O({'visitDate':DATE,'providerPlaceId':S(),'manual':O({'name':S(),'address':S(),'lat':{'type':'number','minimum':-90,'maximum':90},'lng':{'type':'number','minimum':-180,'maximum':180}},['name'])},['visitDate'],description='providerPlaceId 또는 manual 중 정확히 하나. 좌표는 둘다 없거나 둘다 제공. v3: 시간 없이 그 날짜의 맨 뒤에 추가한다(plannedTime=null, 시간 미정). 시간은 planUpdate로 지정. 날짜별 활성 방문 15개 초과는 409 VISIT_LIMIT. 취소된 날은 409 DAY_CANCELLED.'),
 'planUpdate':O({'title':S(description='날짜 제목 0~30 graphemes'),'visits':A(O({'id':UUID,'order':I(minimum=0),'plannedTime':TIME},['id','order','plannedTime'])),'expectedVersion':V},['title','visits','expectedVersion'],description='순서 편집(▲▼)·날짜 제목·방문 시간을 `변경 저장` 한 번에 저장. 타임라인 `수정`의 시간 즉시 저장도 같은 요청을 쓴다. plannedTime은 1분 단위 또는 null(시간 미정으로 두기).'),
 'visitDelete':O({'expectedVersion':V},['expectedVersion']),
 'uploadPrepare':O({'files':A(R('FileInput'),minItems=1,maxItems=10)},['files'],description='v3: 한 제출은 1~10개 파일(사진·동영상 혼합). 같은 파일 중복 제외는 앱 책임이며, 서버는 한 제출 안에서 fingerprint·clientFileId·selectionIndex가 겹치면 전체를 400 DUPLICATE_FILE(details.clientFileIds)로 거부한다. 취소된 날 recordDate는 409 DAY_CANCELLED. 작성자별 방문당 사진5·영상2(P11)는 fileErrors MEDIA_LIMIT.'),
 'uploadCommit':O({'checksum':S(),'actualBytes':I(minimum=1)},['checksum','actualBytes']),
 'uploadRetry':O({'sameFileFingerprint':S()},['sameFileFingerprint']),
 'uploadCancel':O({'expectedVersion':V},['expectedVersion']),
 'metadataPatch':O({'targets':target,'fields':O({'description':field_apply(S()),'recordDate':field_apply(DATE),'visitId':field_apply({'type':['string','null'],'format':'uuid'})},minProperties=1)},['targets','fields']),
 'mediaDelete':O({'mediaIds':A(UUID,minItems=1,maxItems=120,uniqueItems=True)},['mediaIds']),
 'exportCreate':O({'mediaIds':A(UUID,minItems=1,maxItems=120,uniqueItems=True),'purpose':S(enum=['save'],description='외부 공유(share)는 2026-10-20 회의로 폐지')},['mediaIds','purpose'],additionalProperties=False),
 'inviteCreate':O({}),'inviteRevoke':O({'expectedVersion':V},['expectedVersion']),
 'inviteJoin':O({'tokenOrCode':S(description='링크 토큰 또는 8자 코드. 앱이 링크에서 코드 추출·대문자·영숫자만으로 정규화해 보낸다')},['tokenOrCode']),
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
 'placesSearch':{'groupId':UUID,'query':S(description='NFC 정규화 후 grapheme 최대100자. 키워드 검색은 카카오 15건/쪽, 서울특별시 영역 결과만 반환(밖은 제외 수만 응답)'),'category':S(enum=['all','tourism','restaurant','cafe','lodging'],description='all 외 카테고리는 지도 중심(center) 반경 2km, 거리순'),'bounds':S(description='west,south,east,north (`이 지역 다시 검색`)'),'sort':S(enum=['relevance','distance']),'center':S(description='lng,lat 지도 중심. 초기값 서울시청'),'page':I(minimum=1,maximum=45,default=1)},
 'mediaList':{'recordDate':DATE,'visitId':UUID,'unassigned':B(),'outsideRange':B(),'view':S(enum=['by_photo','by_author'],default='by_photo',description='by_photo: 파일 1개=카드 1장(사진별). by_author: 작성자별 묶음(사람별)'),'order':S(enum=['desc','asc'],default='desc',description='v3: 게시 묶음(업로드 완료) 시각 sortAt 기준, 기본 최신순(desc)·오래된순(asc) 선택. 묶음 안 순서는 selectionIndex 유지. by_author는 작성자 구역 순서(구역의 첫 게시 시각) 뒤 구역 내부 정렬'),'cursor':S(),'limit':I(minimum=1,maximum=60,default=60)},
 'mediaStream':{'variant':S(enum=['thumbnail','view']),'context':S(enum=['shared','mine'])},
 'mineList':{'groupId':UUID,'status':S(enum=['active_membership','ended_membership','expired']),'cursor':S(),'limit':I(minimum=1,maximum=60,default=60)},
 'invitesList':{'cursor':S()},'invitePreview':{'tokenOrCode':S()},'reportsMine':{'cursor':S()},'opsQueue':{'type':S(),'status':S(),'cursor':S()}}
def page(items):return O({'items':A(items),'nextCursor':{'type':['string','null']}},['items','nextCursor'])
RESPONSES={
 'authExchange':O({'session':R('Session'),'user':R('Profile'),'onboardingRequired':B()},['session','user','onboardingRequired']),
 'sessionRefresh':R('Session'),'onboard':O({'user':R('Profile'),'consentReceipts':A(O({'documentId':UUID,'version':S(),'agreed':B(),'occurredAt':DT}))},['user','consentReceipts']),
 'consentDocs':O({'documents':A(O({'id':UUID,'itemKey':S(),'title':S(),'version':S(),'kind':S(enum=['consent','notice']),'required':B(),'url':S(format='uri',pattern='^https://'),'development':B()},['id','itemKey','title','version','kind','required','url','development'],allOf=[{'if':{'properties':{'kind':{'const':'notice'}}},'then':{'properties':{'required':{'const':False}}}}],description='게시 문서만 반환. v3 가입 동의는 consent 4종: terms-service(서비스 이용약관, 필수)·privacy-collection(개인정보 수집 및 이용 동의, 필수)·marketing(마케팅 정보 수신 동의, 선택)·location-terms(위치정보 이용약관, 선택). 개인정보를 체크 불가 고지로 두던 v2.3 가정은 폐지. kind=notice는 향후 고지용으로만 남고 가입 화면에 쓰지 않는다. 빈 목록은 가입 완료 조건이 아니다.'))},['documents']),
 'profilePatch':{'oneOf':[R('Profile'),R('Operation')]},
 'groupsList':page(R('Group')),
 'groupCreate':{'oneOf':[O({'group':R('Group'),'membershipId':UUID,'firstSchedule':R('Schedule')},['group','membershipId','firstSchedule']),R('Operation')]},
 'groupUpdate':{'oneOf':[R('Group'),R('Operation')]},
 'calendar':O({'schedules':A({'allOf':[R('Schedule')],'required':['days']}),'dateCounts':O({})},['schedules','dateCounts'],description='from/to 범위에 일차가 있는 전체 일정(각 일정에 days[] 포함). 서버가 startDate/created_at/id 오름차순 정렬해 반환한다. v3 달력은 하루=한 줄(칸당 3줄+`+N`)로 활성 일정의 일차를 그리며 같은 모임 같은 날짜의 활성 일차는 하나뿐이다. 취소된 날·취소된 일정은 `취소된 일정` 칩으로 표시한다. 카드 → 날짜별 장소.'),
 'scheduleDetail':O({'schedule':R('Schedule'),'days':A(R('ScheduleDay')),'retention':O({'fixed':B(),'lastDate':DATE,'expiresAt':DT}),'plan':A(O({'date':DATE,'title':S(description='일차 제목 0~30'),'visits':A(R('Visit')),'visitCount':I(minimum=0,maximum=15),'visitLimit':I(const=15),'version':V},['date','title','visits','visitCount','visitLimit','version'],additionalProperties=False)),'version':V},['schedule','days','retention','plan','version']),
 'dayUpdate':R('DayChangeResult'),'dayCancel':R('DayChangeResult'),'dayDelete':R('DayChangeResult'),
 'scheduleCreate':R('Schedule'),
 'scheduleUpdate':R('Schedule'),
 'scheduleCancel':R('Schedule'),
 'scheduleDelete':O({'deletedId':UUID,'deletedVisitIds':A(UUID)},['deletedId','deletedVisitIds'],additionalProperties=False),
 'visitCreate':R('Visit'),'planUpdate':{'oneOf':[O({'title':S(),'date':DATE,'visits':A(R('Visit')),'version':V},['title','date','visits','version']),R('Operation')]},
 'visitDelete':O({'deletedId':UUID},['deletedId']),
 'coverPrepare':R('UploadTask'),
 'uploadPrepare':O({'submissionId':UUID,'tasks':A(R('UploadTask'),maxItems=10),'fileErrors':A(O({'clientFileId':S(),'code':S(enum=['FILE_INVALID','MEDIA_LIMIT','VISIT_MISMATCH','RECORD_DATE_OUT_OF_RANGE']),'message':S()},['clientFileId','code','message']),maxItems=10),'remaining':A(O({'visitId':{'type':['string','null'],'format':'uuid'},'recordDate':DATE,'photos':I(minimum=0,maximum=5),'videos':I(minimum=0,maximum=2)},['visitId','recordDate','photos','videos'],additionalProperties=False),description='접수 후 작성자별 남은 개수(방문 또는 미지정 묶음)')},['submissionId','tasks','fileErrors','remaining']),
 'uploadGet':R('UploadTask'),'uploadRetry':R('UploadTask'),'uploadCancel':R('UploadTask'),
 'uploadCommit':O({'task':R('UploadTask'),'operationId':UUID},['task','operationId']),
 'mediaList':O({'items':A(R('Media')),'groups':A(O({'authorUserId':UUID,'displayName':S(),'avatarVersion':{'type':['integer','null'],'minimum':0},'photos':I(minimum=0),'videos':I(minimum=0),'firstCompletedAt':DT,'latestCompletedAt':DT},['authorUserId','displayName','avatarVersion','photos','videos','firstCompletedAt'],additionalProperties=False),description='view=by_author일 때 작성자 카드 머리글(프로필 사진·이름·개수). 차단 작성자 제외. 카드 격자 1·2·3·4+ 와 `+N` 펼치기는 앱 표시'),'visibleCounts':O({'photos':I(),'videos':I()},['photos','videos']),'nextCursor':{'type':['string','null']}},['items','visibleCounts','nextCursor']),
 'mineList':page(O({'media':R('Media'),'groupName':S(),'scheduleTitle':S(),'membershipState':S(),'groupState':S()},['media','groupName','scheduleTitle','membershipState','groupState'])),
 'metadataPatch':R('Operation'),'mediaDelete':O({'operationId':UUID,'results':A(O({'id':UUID,'status':S(enum=['deleted','already_deleted','failed']),'reason':S()},['id','status']))},['operationId','results']),
 'exportCreate':O({'exportId':UUID,'state':S(),'results':A(R('ExportResult'))},['exportId','state','results']),
 'exportGet':O({'export':O({'id':UUID,'purpose':S(),'state':S()}),'results':A(R('ExportResult'))},['export','results']),
 'inviteCreate':R('Invitation'),'invitesList':O({'invites':A(R('Invitation'))},['invites']),
 'inviteRevoke':R('Invitation'),
 'invitePreview':O({'groupName':S(),'scheduleSummary':{'anyOf':[O({'title':S(),'startDate':DATE,'endDate':DATE}),{'type':'null'}]},'inviteState':S(enum=['active']),'usesRemaining':I(minimum=0,maximum=49,description='이번 응답을 포함해 50회에서 뺀 값. 이미 참여 중인 사용자의 확인도 포함해 성공 응답마다 1회 소모(v3, 프로토타입 동작)')},['groupName','scheduleSummary','inviteState','usesRemaining'],additionalProperties=False),
 'inviteJoin':O({'groupId':UUID,'membershipId':UUID,'alreadyMember':B()},['groupId','membershipId','alreadyMember']),
 'storageUsage':O({k:I(minimum=0) for k in ['completedOriginalBytes','reservedBytes','limitBytes','availableBytes']},['completedOriginalBytes','reservedBytes','limitBytes','availableBytes']),
 'accountDelete':O({'deletionOperationId':UUID,'accessRevoked':B(const=True)},['deletionOperationId','accessRevoked']),
 'operationGet':R('Operation'),
 'identityLink':O({'identities':A(O({'id':UUID,'provider':S(),'version':V},['id','provider','version']))},['identities']),
 'identityUnlink':O({'identities':A(O({'id':UUID,'provider':S(),'version':V},['id','provider','version']))},['identities']),
 'consentUpdate':O({'consentReceipts':A(O({'documentId':UUID,'version':S(),'agreed':B(),'occurredAt':DT},['documentId','version','agreed','occurredAt']))},['consentReceipts']),
 'membersList':O({'members':A(O({'id':UUID,'userId':UUID,'displayName':S(),'avatarVersion':{'type':['integer','null'],'minimum':0},'isOwner':B(),'isMe':B()},['id','userId','displayName','avatarVersion','isOwner'])),'reentryBlocks':A(O({'userId':UUID,'version':V}))},['members']),
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
 'reauthenticate':O({'provider':S(enum=['kakao','google'],description='현재 Google 활성화 보류. enum 보존은 신규 로그인 허용을 뜻하지 않는다.'),'credential':S(),'nonce':S()},['provider','credential','nonce']),
 'notificationRead':O({}),
 'recoveryConsent':O({'agreed':B(),'reauthProof':S()},['agreed','reauthProof']),
 'recoveryResponse':O({'response':S(enum=['agree','object','contacted']),'reason':S()},['response','reason'])})
SCHEMAS['UploadTask']['properties'].update({'targetType':S(enum=['record','cover']),'coverGroupId':UUID})
SCHEMAS['UploadTask']['required']=['id','targetType','state','retryable','version']
RESPONSES.update({
 'placesSearch':O({'places':A(O({'providerPlaceId':S(),'name':S(),'address':S(),'roadAddress':S(),'phone':S(),'lat':{'type':'number'},'lng':{'type':'number'},'distanceMeters':I(minimum=0),'category':S()}),maxItems=15),'provider':S(enum=['kakao']),'region':S(const='서울특별시'),'excludedOutsideSeoul':I(minimum=0,description='이번 쪽에서 서울특별시 밖이라 제외한 결과 수(키워드 검색)'),'page':I(minimum=1),'isEnd':B(),'searchContext':O({'query':S(),'bounds':S(),'center':S(),'radiusMeters':{'type':['integer','null'],'enum':[2000,None],'description':'카테고리 검색만 2000'},'requestSequence':I()})},['places','provider','region','excludedOutsideSeoul','page','isEnd','searchContext'],description='v3(Q5 확인 전): 카카오 키워드 15건/쪽·서울특별시 한정, 카테고리(관광지·맛집·카페·숙소)는 지도 중심 반경 2km 거리순. 결과 → 상세 패널 → visitCreate.'),
 'reauthenticate':O({'reauthProof':S(),'expiresAt':DT},['reauthProof','expiresAt']),
 'profileGet':R('Profile'), 'identitiesList':RESPONSES['identityLink'], 'consentsMine':RESPONSES['consentUpdate'],
 'blocksList':O({'blocks':A(O({'targetUserId':UUID,'displayName':S(),'createdAt':DT})),'nextCursor':{'type':['string','null']}},['blocks','nextCursor']),
 'notificationsList':O({'notifications':A(O({'id':UUID,'kind':S(),'message':S(),'referenceId':UUID,'createdAt':DT,'readAt':DT})),'nextCursor':{'type':['string','null']}},['notifications','nextCursor']),
 'notificationRead':O({'readAt':DT},['readAt']),
 'recoveryConsent':O({'state':S(),'candidateConsentAt':DT},['state','candidateConsentAt']),
 'recoveryResponse':O({'state':S(),'receivedAt':DT},['state','receivedAt']),
 'opsCaseGet':O({'case':O({'id':UUID,'type':S(),'state':S(),'targetId':UUID,'version':V,'reason':S()}),'evidenceRefs':A(S()),'history':A(O({'actorId':UUID,'action':S(),'reason':S(),'createdAt':DT}))},['case','evidenceRefs','history'])})
for key in ['blocksList','notificationsList']:QUERIES[key]={'cursor':S()}

SCHEMAS['ConsentDocument']=RESPONSES['consentDocs']['properties']['documents']['items']
RESPONSES['consentDocs']['properties']['documents']['items']=R('ConsentDocument')

# v3(2026-11-03): 하루 단위 일정·프로필 사진·업로드 10개·사진별/사람별 보기·서울 한정 검색.
SCHEMAS['ExportResult']=O({'mediaId':UUID,'kind':S(enum=['photo','video']),'state':S(enum=['ready','failed']),'converted':B(),'variant':{'type':['string','null'],'enum':['sanitized_original','view',None],'description':'위치 제거 원본 또는 호환 변환본. 동영상은 동영상 파일 자체를 내보내며 포스터·썸네일을 내보내지 않는다'},'mime':S(),'reason':{'type':['string','null']}},['mediaId','kind','state','converted','variant'],additionalProperties=False,allOf=[{'if':{'properties':{'kind':{'const':'video'},'state':{'const':'ready'}}},'then':{'properties':{'mime':S(pattern='^video/')}}}])
REQUESTS['profilePatch']['not']={'required':['avatarAssetId','restoreDefaultAvatar']}
REQUESTS['avatarPrepare']=O({'file':O({'name':S(),'mime':S(),'declaredBytes':I(minimum=1,maximum=5000000),'fingerprint':S(),'width':I(minimum=1),'height':I(minimum=1)},['name','mime','declaredBytes','fingerprint'])},['file'],description='프로필 사진: 앱에서 1:1로 자른 이미지. 모임 대표사진과 같은 위치 제거·검사 경로이며 모임 저장량에 넣지 않는다. 완료된 task.avatarAssetId를 profilePatch.avatarAssetId로 적용한다.')
RESPONSES.update({'avatarPrepare':R('UploadTask'),
 'uploadLimits':O({'visitId':{'type':['string','null'],'format':'uuid'},'recordDate':DATE,'photos':I(minimum=0,maximum=5),'videos':I(minimum=0,maximum=2),'photoLimit':I(const=5),'videoLimit':I(const=2),'maxFilesPerSubmission':I(const=10)},['visitId','recordDate','photos','videos','photoLimit','videoLimit','maxFilesPerSubmission'],additionalProperties=False,description='작성자의 완료·진행 파일을 반영한 남은 개수(P11). 업로드 시트의 선택 가능 개수는 min(10, 남은 개수)')})
QUERIES['uploadLimits']={'recordDate':DATE,'visitId':UUID}
QUERIES['avatarStream']={'v':S(maxLength=32,description='avatarVersion 캐시 키')}

def build_openapi():
    import re
    from contract_v02 import apply_revision,transport_responses
    apply_revision(globals())
    paths={}
    for a in APIS:
        p=[]
        for key in re.findall(r'\{([^}]+)\}',a['path']):p.append(dict(name=key,**{'in':'path'},required=True,schema=DATE if key=='date' else UUID))
        for key,schema in QUERIES.get(a['id'],{}).items():p.append(dict(name=key,**{'in':'query'},required=(a['id'],key) in {('calendar','from'),('calendar','to'),('placesSearch','groupId'),('uploadLimits','recordDate'),('invitePreview','tokenOrCode'),('mediaStream','variant'),('mediaStream','context')},schema=schema))
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
        elif a['id']=='avatarStream':
            op['responses']['200']={'description':'위치 제거·검사 통과 프로필 사진. 사진이 없으면 404','content':{'image/*':{'schema':S(format='binary')}}}
        elif a['id'] in ['mediaStream','exportFile']:
            op['responses']['200']={'description':'현재권한 재검증 후 위치검증된 파일'+(' (동영상은 동영상 파일 자체, 포스터 아님)' if a['id']=='exportFile' else ''),'content':{'application/octet-stream':{'schema':S(format='binary')}}}
            op['responses']['206']={'description':'인증된 부분 콘텐츠','headers':{'Content-Range':{'schema':S()}}}
            op['responses']['416']={'description':'유효하지 않은 Range'}
        else:
            assert a['id'] in RESPONSES,a['id']
            op['responses']['200']={'description':a['response'],'content':{'application/json':{'schema':RESPONSES[a['id']]}}}
            if a['id'] in ['groupCreate','groupUpdate','profilePatch','scheduleCreate','scheduleUpdate','dayUpdate','planUpdate','metadataPatch','uploadCommit']:
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
    return dict(openapi='3.1.0',info={'title':'At that place 1차 개발 API 설계안','version':'0.4.0-design','description':'기능명세서 v3(2026-11-03, 프로토타입 우선)과 09 구현계약 보완 기준. 일정=일차 묶음(같은 모임 같은 날짜에 활성 일정 하나), 하루 변경·취소·삭제, 방문 시간 1분 단위, 업로드 1회 10개, 사진별/사람별 최신순, 8자 초대 코드, 가입 동의 4종, 프로필 사진. 반복 일정·외부 공유 없음, 초대 50회·방문 15개·사진5/영상2 한도 포함. 실제 배포 서버가 아니다. NFC grapheme 검증과 권한/상태/한도 검사는 서버 책임.'},servers=[{'url':'https://api.example.invalid/v1','description':'문서용 가상 주소·실서비스 없음'}],paths=paths,components={'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}},'schemas':SCHEMAS})
