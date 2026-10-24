TABLES=[]
def table(name,purpose,features,fields,indexes,rules):
    # 모든 엔티티는 별도 명시가 없으면 UUID id PK, created_at timestamptz를 갖는다.
    TABLES.append(dict(name=name,purpose=purpose,features=features.split(),fields=fields,indexes=indexes,rules=rules))
table('users','내부 사용자와 계정 생명주기','F01 F02 F24',[
 ('id','uuid','PK','공급자와 독립인 영속 사용자 ID'),('display_name','text','NOT NULL','NFC·grapheme 1~20'),('status','enum','NOT NULL','onboarding/active/restricted/deleting/deleted'),('version','bigint','NOT NULL','낙관적 잠금·초기1'),('created_at,deleted_at','timestamptz','후자 NULL','계정삭제 전 상태차단 우선')],
 ['PK(id)','INDEX(status)'],['삭제는 tombstone 후 개인정보 정리. 타인 파일로의 연쇄삭제 금지.','계정별 생성·방장수신·탈퇴는 users 행 잠금으로 직렬화한다.'])
table('identities','명시적으로 연결한 로그인 수단','F01',[
 ('id,user_id','uuid','PK, FK users','공급자별 내부 연결'),('provider','enum','NOT NULL','kakao/google'),('provider_subject','text','NOT NULL','서버 검증 공급자 식별값'),('linked_at','timestamptz','NOT NULL','연결 시각'),('version','bigint','NOT NULL','연결 해제 충돌 보호')],
 ['UNIQUE(provider,provider_subject)','INDEX(user_id)'],['이메일 일치로 자동 연결하지 않는다.','연결/해제는 user 잠금과 최근 재인증 필요. 마지막 수단은 유지한다.'])
table('sessions','기기 세션과 회전 토큰','F01 F24 F28',[
 ('id,user_id','uuid','PK, FK users','기기별 세션'),('device_id','text','NOT NULL','설치 식별자·개인 단말식별자 미수집'),('refresh_hash','text','NOT NULL','원문 refresh token 저장 금지'),('expires_at,revoked_at','timestamptz','후자 NULL','세션 회전·폐기'),('reauthenticated_at','timestamptz','NULL','고위험 본인 작업 증명')],
 ['UNIQUE(refresh_hash)','INDEX(user_id,revoked_at)'],['계정삭제/로그아웃에서 세션 폐기. API는 최신 계정 상태도 확인한다.'])
table('consent_documents','동의 문서와 항목 버전','F02',[
 ('id','uuid','PK','문서 버전 ID'),('item_key,version','text','NOT NULL','항목 및 불변 버전'),('required','boolean','NOT NULL','필수/선택'),('content_ref,content_hash','text','NOT NULL','열람 문서와 무결성'),('effective_at','timestamptz','NOT NULL','적용 시각')],
 ['UNIQUE(item_key,version)'],['새 버전은 새 행. 기존 동의가 가리키는 내용을 덮어쓰지 않는다.'])
table('consent_events','사용자 동의·변경·철회 이력','F02',[
 ('id,user_id,document_id','uuid','PK, FK','동의 당사자/버전'),('agreed','boolean','NOT NULL','선택/철회'),('occurred_at','timestamptz','NOT NULL','서버 수신 기준'),('operation_id','uuid','NOT NULL','중복 변경 방지')],
 ['UNIQUE(operation_id,document_id)','INDEX(user_id,document_id,occurred_at DESC)'],['append-only. 실제 수집/처리와 연결한 문서·항목을 운영 배포 전에 확정한다.'])
table('groups','모임과 저장량·방장','F03 F04 F22 F23 F28',[
 ('id','uuid','PK','모임ID'),('name','text','NOT NULL','1~50 graphemes'),('owner_user_id','uuid','FK users','단일 방장 원천'),('status','enum','NOT NULL','active/closed'),('cover_asset_id','uuid','NULL, FK assets','검사 통과 대표 사진'),('activity_at','timestamptz','NOT NULL','공동 활동 확정시 갱신'),('completed_bytes,reserved_bytes','bigint','NOT NULL >=0','완료 원본/미완료 예약'),('version','bigint','NOT NULL','모임 역할/상태 변경 버전'),('closed_at','timestamptz','NULL','종료 시각')],
 ['INDEX(activity_at DESC,created_at DESC,id DESC)','CHECK(completed_bytes+reserved_bytes<=5000000000)'],['owner는 활성 membership 사용자여야 함(지연 제약트리거/서비스 트랜잭션). 별도 role 컬럼으로 중복 원천을 만들지 않는다.','모임행 잠금으로 정원10명·종료·초대참여·저장량예약·역할변경을 직렬화한다.','삭제 대기 원본은 실제 정리 전 completed_bytes에 남는다.'])
table('memberships','참여 세대별 이력','F03 F05 F22 F23',[
 ('id,group_id,user_id','uuid','PK, FK','재가입마다 새 id'),('joined_at','timestamptz','NOT NULL','참여시각'),('ended_at','timestamptz','NULL','활성은 NULL'),('end_reason','enum','NULL','left/removed/group_closed/account_deleted'),('version','bigint','NOT NULL','참여세대 보호')],
 ['UNIQUE(group_id,user_id) WHERE ended_at IS NULL','INDEX(user_id,ended_at)'],['강제퇴장은 재참여차단을 같은 트랜잭션에 생성한다.','오래된 퇴장 요청은 target membershipId로 고정하여 새 참여를 종료하지 못한다.'])
table('reentry_blocks','모임별 재참여 차단','F05 F22',[
 ('id,group_id,user_id','uuid','PK, FK','모임/차단된 사용자'),('created_by','uuid','FK users','당시 방장'),('cleared_at','timestamptz','NULL','해제시각'),('version','bigint','NOT NULL','오래된 해제 방지')],
 ['UNIQUE(group_id,user_id) WHERE cleared_at IS NULL'],['개인 차단과 독립. 방장만 해제하고 자동 재가입 없음.'])
table('invitations','초대별 링크·코드·만료·확인 횟수','F05',[
 ('id,group_id,issuer_user_id','uuid','PK, FK','발급 주체'),('code_hash,token_hash','text','NOT NULL','검색용 hash; 공유용 원문은 암호화 저장'),('code_ciphertext,token_ciphertext','bytea','NOT NULL','방장의 재조회/복사용 키 관리 암호문'),('issued_at,expires_at','timestamptz','NOT NULL','expires=issued+168h'),('revoked_at','timestamptz','NULL','개별 취소'),('version','bigint','NOT NULL','취소 충돌 보호')],
 ['UNIQUE(code_hash)','UNIQUE(token_hash)','INDEX(group_id,issued_at DESC)'],['유효 범위 issued_at<=now<expires_at AND use_count<50. 반복 공유/참여로 갱신하지 않는다.','초대 확인(미리보기) 응답마다 행 잠금 후 use_count+1. 50 도달 시 exhausted_at 기록, 이후 확인·참여 거부. 참여 확정은 횟수를 소모하지 않는다.','8자리32문자 코드는 기술안. 링크는 별도128bit 이상 난수안, 발급 충돌 재추첨·조회 시도율 제한.'])
table('schedules','기간 일정(수동 추가)과 고정 보관','F06 F07 F08 F11 F21',[
 ('id,group_id,series_id','uuid','series NULL','독립 발생ID'),('original_occurrence_key','text','NULL','최초 반복 위치 불변 식별'),('title','text','NOT NULL','1~100 graphemes'),('all_day','boolean','NOT NULL','종일/시각'),('start_date,end_date','date','NOT NULL','KST 양끝 포함·최대366일'),('start_at,end_at','timestamptz','시간형 필수','시간형 종료>시작·5분단위'),('status','enum','NOT NULL','active/cancelled/deleted'),('cancelled_end_date','date','NULL','취소 전 종료일 스냅샷'),('retention_fixed_at,expires_at','timestamptz','NULL','첫완료 트랜잭션에서 동시에 고정'),('retention_last_date','date','NULL','표시용 마지막날'),('version','bigint','NOT NULL','기간·취소 경쟁 제어')],
 ['INDEX(group_id,start_date,end_date)','INDEX(expires_at)'],['반복·시각 컬럼 없음(2026-10-20 회의). 일정은 방장이 수동 추가·변경·취소·삭제한다.','기록·작업 있으면 삭제 금지(취소로 전환). 고정 필드는 null→값만 허용하는 트리거·갱신 권한으로 보호한다.','최초완료·일정변경·삭제·신규접수·방문추가는 일정행 잠금. 계산 기한이 이미 지났으면 완료 거부.'])
table('places','모임 내 장소 정보','F09',[
 ('id,group_id','uuid','PK, FK','모임별 장소 원장'),('provider,provider_place_id','text','NULL','kakao 또는 manual'),('name,address','text','주소 NULL','이름100자·주소200자'),('latitude,longitude','numeric(9,6)','둘다NULL/둘다값','좌표 선택'),('normalized_fingerprint','text','NOT NULL','공급자ID 또는 수기정규화 정보')],
 ['INDEX(group_id,provider,provider_place_id)'],['이름만으로 병합하지 않는다. 공급자 보관·표시 조건은 실제 연동 전 확인한다.'])
table('visits','일정·날짜별 장소 계획','F09 F10 F11 F14',[
 ('id,schedule_id,place_id','uuid','PK, FK','같은 장소 다른날/일정 허용'),('visit_date','date','NOT NULL','추가시 일정 범위'),('position','integer','NOT NULL >=0','날짜 안 저장 순서'),('planned_time','time','NULL','00:00~23:55·5분'),('dedupe_key','text','NOT NULL','공급자 장소/수기정보 키'),('deleted_at','timestamptz','NULL','빈방문 삭제 tombstone')],
 ['UNIQUE(schedule_id,visit_date,dedupe_key) WHERE deleted_at IS NULL','UNIQUE(schedule_id,visit_date,position) DEFERRABLE INITIALLY DEFERRED'],['기록/작업 있는 방문 삭제 불가. 기간 축소 시 기존 방문은 기간 밖으로 유지.','일정×방문일별 활성 방문 최대 15개(P12). 트리거가 일정행 잠금 후 count를 검사해 VISIT_LIMIT를 올린다.','예정 시각은 추가 시 입력(선택)하며 일정에는 시각이 없다.'])
table('day_plans','방문일 제목과 계획 버전','F10',[
 ('schedule_id','uuid','PK 일부, FK','일정'),('plan_date','date','PK 일부','정리 속성·별도 날짜 공간 아님'),('title','text','NULL','0~30자·비우면 날짜'),('version','bigint','NOT NULL','계획 전체 원자 변경')],
 ['PRIMARY KEY(schedule_id,plan_date)'],['날짜 전체 공통 메모 없음. 순서·시각·제목은 같은 버전으로 저장.'])
table('submissions','한 번에 제출한 파일 묶음','F14 F15 F16',[
 ('id,schedule_id,author_user_id','uuid','PK, FK','최대120개'),('first_completed_at','timestamptz','NULL','첫 파일 완료에서 고정'),('created_at','timestamptz','NOT NULL','접수시각')],
 ['INDEX(schedule_id,first_completed_at DESC,id DESC)'],['완료0개 묶음은 공동 목록에 표시하지 않는다. 묶음순서는 후속완료로 바뀌지 않는다.'])
table('upload_tasks','파일별 접수·전송·검사·완료','F14 F15 F20 F26',[
 ('id,submission_id,author_user_id','uuid','PK, FK','파일 작업 주체'),('selection_index','integer','NOT NULL 0..119','최초선택순서'),('fingerprint,checksum','text','checksum NULL','고정파일 증명·서버 재계산'),('record_date,visit_id,description','date/uuid/text','visit NULL','초기 파일정보'),('accepted_at','timestamptz','NOT NULL','취소 이전 서버접수 판정'),('state','enum','NOT NULL','queued/uploading/verifying/review/complete/failed/cancelled'),('reserved_bytes,actual_bytes','bigint','actual NULL','원본 저장량 예약'),('quarantine_key','text','NOT NULL','비공개 임시객체'),('version,error_code','bigint/text','error NULL','경쟁과 재시도'),('cancel_requested_at','timestamptz','NULL','완료 경쟁 보호')],
 ['UNIQUE(submission_id,selection_index)','INDEX(author_user_id,state)'],['파일교체/신규추가로 취소일정 예외를 우회할 수 없다.','결과확인필요는 로컬 관찰 상태로 서버 영속 enum에 포함하지 않는다. 상태를 확인해 복원한다.','작성자×방문(미지정은 작성자×일정×기록일) 사진5·영상2(P11). 트리거가 advisory lock 후 활성 task+available media를 합산해 MEDIA_LIMIT를 올린다. 실패/취소 task는 즉시 제외.'])
table('media','완료 파일의 소유·정보·접근상태','F16 F17 F18 F19 F21',[
 ('id,task_id,submission_id,schedule_id,author_user_id','uuid','PK, FK','task_id UNIQUE'),('record_date,visit_id,description','date/uuid/text','visit NULL','기록일·방문·설명'),('kind,mime,original_bytes','text/text/bigint','NOT NULL','실제 probe 결과'),('captured_at,completed_at','timestamptz','captured NULL','촬영/완료 시각 분리'),('selection_index','integer','NOT NULL','묶음 내부순서'),('access_state','enum','NOT NULL','available/deleted/expired/restricted'),('moderation_state','enum','NOT NULL','passed/review/restricted'),('deleted_at,purged_at','timestamptz','NULL','접근차단/물리정리'),('version','bigint','NOT NULL','정보수정 충돌')],
 ['UNIQUE(task_id)','INDEX(author_user_id,completed_at DESC,id DESC)','INDEX(schedule_id,record_date,visit_id)'],['기간 축소로 범위 밖 파일을 제거하지 않는다. 신규 정보 지정만 범위를 검증한다.','사용자별 visible count는 차단/상태를 반영한 동일 predicate로 산출한다.','visit_id/record_date 변경(F17)은 대상 묶음의 P11 한도를 같은 트리거로 재검증한다. 시간순 정렬키는 COALESCE(captured_at,completed_at).'])
table('assets','원본·위치제거·호환본·썸네일','F04 F20',[
 ('id,media_id,cover_group_id','uuid','media/cover 선택','하나의 소유대상만 연결'),('variant','enum','NOT NULL','original_private/sanitized_original/view/thumbnail'),('object_key','text','NOT NULL','private bucket key'),('bytes,checksum','bigint/text','NOT NULL','크기·무결성'),('location_verified_absent','boolean','NOT NULL','타인제공 variant는 true 필수'),('probe_result','jsonb','NOT NULL','형식·회전·길이·음성 검사'),('state','enum','NOT NULL','staged/ready/delete_pending/purged')],
 ['UNIQUE(object_key)','INDEX(media_id,variant)'],['original_private는 API로 전달 금지. 접근은 인증 프록시를 통해 현재 상태 재검증.','대표사진과 media 순환참조는 지연 FK 또는 완성 뒤 연결로 처리한다.'])
table('metadata_operations','검사 후 일괄 정보수정','F17',[
 ('id,author_user_id,schedule_id','uuid','PK, FK','업무단위'),('targets,fields','jsonb','NOT NULL','대상ID+읽은버전·필드별apply/value'),('state','enum','NOT NULL','pending_check/review/applying/succeeded/failed'),('item_errors,result','jsonb','NULL','전체 미적용 사유 또는 결과'),('created_at','timestamptz','NOT NULL','진행 문의')],
 ['INDEX(author_user_id,state)'],['외부 검사 중 DB잠금을 잡지 않는다. 통과 후 모든 대상 재잠금·버전 재검증·단일 커밋.'])
table('personal_blocks','개인 공동 감상 숨김','F25',[
 ('blocker_user_id,blocked_user_id','uuid','복합PK, FK','방향 있는 개인차단'),('created_at','timestamptz','NOT NULL','차단시각')],
 ['PRIMARY KEY(blocker_user_id,blocked_user_id)'],['자기차단 금지. 방장역할·모임 재참여차단·타인 화면과 독립.'])
table('reports_and_cases','신고·검사·이의·문의 공통 케이스','F25 F26 F28',[
 ('id,reporter_user_id','uuid','reporter NULL','자동검사 케이스는 신고자 없음'),('type,target_type,target_id','text/text/uuid','NOT NULL','report/scan/appeal/inquiry'),('reason,status','text/enum','NOT NULL','접수/검토/결정/종료'),('evidence_ref','text','NULL','최소증거 암호화저장'),('review_due_at,closed_at,evidence_delete_at','timestamptz','closed 등 NULL','24h·3영업일·종료후<=90일'),('version','bigint','NOT NULL','운영충돌')],
 ['INDEX(status,review_due_at)'],['신고자 신원·증거는 운영권한 외 노출 금지. 접수만으로 자동삭제 없음.'])
table('recovery_requests','방장 부재 검토·수동 이전','F27',[
 ('id,group_id,requester_id,candidate_membership_id','uuid','PK, FK','당사자 확인'),('owner_snapshot,group_version','uuid/bigint','NOT NULL','신청 당시 방장과 버전'),('candidate_consent_at,notified_at,response_due_at','timestamptz','NULL','후임 별도 동의·통지+7일'),('reason,evidence_refs','text/jsonb','NOT NULL','최소 자료'),('state','enum','NOT NULL','received/verifying/notified/waiting/held/approved/rejected/applied'),('decision_reason','text','NULL','수동 근거')],
 ['INDEX(group_id,state)'],['7일 자동승인 금지. 종료모임 재개 불가. 조치 직전 최신 상태 재검증.'])
table('account_notifications','복구 통지와 결과 안내','F25 F26 F27',[
 ('id,user_id,case_id','uuid','PK, FK','계정별 앱내 알림'),('kind,payload','text/jsonb','NOT NULL','최소 안내·해당 권한 링크'),('created_at,read_at','timestamptz','read NULL','발송/열람 이력')],
 ['INDEX(user_id,created_at DESC)'],['일정 알림/외부 캘린더 동기화/만료 푸시 기능으로 확장하지 않는다.'])
table('operations_and_outbox','멱등 결과와 비동기 이벤트','F03 F05 F08 F15 F17 F18 F24',[
 ('id,actor_id','uuid','PK, FK','업무 요청'),('idempotency_key,route,request_hash','text','NOT NULL','같은 키 다른본문은409'),('state,response_snapshot','text/jsonb','snapshot NULL','pending/review/succeeded/failed'),('event_type,event_payload,published_at','text/jsonb/timestamptz','NULL','도메인 커밋과 outbox 원자저장'),('created_at','timestamptz','NOT NULL','키 보존 정책 기술안')],
 ['UNIQUE(actor_id,route,idempotency_key)','INDEX(published_at)'],['작업 ID는 대상 수명 동안 보존하고, 네트워크 멱등키 캐시는 완료후7일 기술안. 장기업무 고유키 별도 유지.','작업발행 중복은 worker 소비 고유키로 방지한다.'])
table('cleanup_jobs_and_audit','정리 재시도와 운영 감사','F18 F21 F23 F24 F26 F27',[
 ('id,target_type,target_id','uuid/text/uuid','PK','정리 또는 조치 대상'),('kind,state,attempts','text/text/integer','NOT NULL','cleanup/audit 유형별 분리물리화 권장'),('due_at,finished_at','timestamptz','후자 NULL','정리24h SLA'),('actor_id,reason,result','uuid/text/jsonb','NULL','운영 감사 추적'),('generation','bigint','NOT NULL','오래된 정리 이벤트 보호')],
 ['INDEX(state,due_at)','UNIQUE(target_type,target_id,kind,generation)'],['실구현은 cleanup_jobs와 append-only operator_audit로 분리한다. 논리정의 묶음이다.','삭제/만료 상태 재검증 뒤 객체정리·바이트 차감은 한번만 확정. 백업 복원 전 tombstone 먼저 반영.'])

RELATIONS=[
 ('users','identities','1:N'),('users','memberships','1:N'),('groups','memberships','1:N'),('groups','invitations','1:N'),
 ('groups','schedules','1:N'),('schedules','visits','1:N'),('places','visits','1:N'),
 ('schedules','day_plans','1:N'),('schedules','submissions','1:N'),('submissions','upload_tasks','1:N'),
 ('upload_tasks','media','1:0..1'),('media','assets','1:N'),('visits','media','1:N optional'),
 ('users','media','author 1:N'),('groups','reentry_blocks','1:N'),('users','personal_blocks','1:N')]

# 구현에서 별도 물리 테이블로 나누는 공통 업무와 이벤트/감사.
TABLES[:] = [t for t in TABLES if t['name'] not in ['operations_and_outbox','cleanup_jobs_and_audit']]
table('operations','멱등 업무 요청과 결과','F03 F05 F08 F15 F17 F18 F24',[
 ('id,actor_id','uuid','PK, FK','업무 요청과 주체'),('idempotency_key,route,request_hash','text','NOT NULL','같은키 다른본문409'),('state,response_snapshot','text/jsonb','snapshot NULL','pending/review/succeeded/failed'),('created_at,finished_at','timestamptz','후자 NULL','업무 결과 복구')],
 ['UNIQUE(actor_id,route,idempotency_key)','INDEX(actor_id,created_at DESC)'],['단기업무 멱등캐시 완료후7일은 기술안. 장기작업 고유ID/대상 고유제약은 수명동안 유지.'])
table('outbox_events','업무 커밋과 원자 발행','F15 F17 F18 F21 F24',[
 ('id,operation_id','uuid','PK, FK','도메인 이벤트'),('event_type,target_id,generation','text/uuid/bigint','NOT NULL','유형·대상·세대'),('payload','jsonb','NOT NULL','민감 원문 최소화'),('published_at,created_at','timestamptz','published NULL','미발행 재전달')],
 ['INDEX(published_at)','UNIQUE(event_type,target_id,generation)'],['중복전달 전제. worker 소비자는 eventId/generation/taskId로 멱등 처리.'])
table('cleanup_jobs','삭제·만료 원본과 파생본 정리','F18 F21 F23 F24',[
 ('id,target_type,target_id','uuid/text/uuid','PK','정리 대상'),('state,attempts,generation','text/integer/bigint','NOT NULL','대기/진행/실패/완료·세대'),('due_at,finished_at','timestamptz','후자 NULL','24시간 SLA'),('error_code','text','NULL','재시도·운영경보')],
 ['INDEX(state,due_at)','UNIQUE(target_type,target_id,generation)'],['현재 삭제/만료 상태와 세대를 다시 확인하고 물리정리/바이트차감을 한번만 확정.'])
table('operator_audit','운영 조치 감사 이력','F26 F27',[
 ('id,operator_id,case_id','uuid','PK','운영주체와 근거'),('target_type,target_id,action,reason','text/uuid/text/text','NOT NULL','대상·조치·사유'),('before_state,after_state','jsonb','NOT NULL','최소 상태 전후'),('occurred_at','timestamptz','NOT NULL','서버시각')],
 ['INDEX(target_id,occurred_at)','INDEX(operator_id,occurred_at)'],['append-only. 앱 일반사용자 토큰으로 접근 불가. 보존기간은 운영 문서에서 실제 값으로 확정.'])
table('export_jobs','휴대폰 저장 파일별 준비 상태','F19 F20',[
 ('id,user_id','uuid','PK, FK','요청 작성자'),('purpose,state','text/text','NOT NULL','save만·preparing/ready/partial/failed'),('targets,results','jsonb','NOT NULL','최대120개·파일별변환/실패/완료'),('created_at,expires_at','timestamptz','NOT NULL','임시준비 결과 수명')],
 ['INDEX(user_id,created_at DESC)'],['파일GET은 매번 원본대상 현재참여·기한·차단·상태 재검증. 준비결과가 접근권을 부여하지 않는다.'])
for t in TABLES:
 if t['name']=='upload_tasks':
  t['fields'][0]=('id,submission_id,author_user_id','uuid','submission NULL','기록작업 또는 대표사진작업')
  t['fields'].append(('cover_group_id','uuid','NULL, FK groups','대표사진 작업일 때만 지정'))
  t['rules'].append('submission_id 또는 cover_group_id 중 정확히 하나. 대표사진 완료는 현재방장·그룹버전·규격·위치제거·검사 재검증 후 asset 생성하며 media/submission은 생성하지 않는다.')

# v0.2: 문서 사전도 실행 DDL의 컬럼·타입·기본값을 그대로 사용한다.
from physical_model import TABLES as PHYSICAL_TABLES
for _t in TABLES:
 _p=PHYSICAL_TABLES[_t['name']]
 _t['fields']=[(name,sql,'DDL 참조',description) for name,sql,description in _p['columns']]
 _t['indexes']=_p['constraints']+_p['indexes']
