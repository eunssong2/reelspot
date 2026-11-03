"""생성 OpenAPI에 정상/잘못된 실제 JSON 예제를 적용한다. 서버 동작 테스트 아님."""
import json,copy,hashlib
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker
from api_contract import build_openapi
ROOT=Path(__file__).resolve().parents[1]
U='00000000-0000-0000-0000-000000000001'
T='2026-10-17T15:00:00+09:00'
def main():
    schema=build_openapi();examples=[]
    def add(name,component,value,valid=True):examples.append({'name':name,'component':component,'expected_valid':valid,'value':value})
    pending={'operationId':U,'kind':'metadata_change','state':'pending','result':None,'itemErrors':[]}
    add('일괄수정 대기','Operation',pending)
    success={**pending,'state':'succeeded','result':{'appliedIds':[U],'versions':[{'id':U,'version':2}]}}
    add('일괄수정 전체 성공','Operation',success)
    failure={**pending,'state':'failed','itemErrors':[{'id':U,'code':'VERSION_CONFLICT','message':'전체 미적용'}]}
    add('일괄수정 전체 미적용','Operation',failure)
    old=copy.deepcopy(pending);old['id']=old.pop('operationId');add('구형 id 필드 거부','Operation',old,False)
    bad=copy.deepcopy(pending);bad['result']=success['result'];add('대기 중 결과 노출 거부','Operation',bad,False)
    add('성공 결과 누락 거부','Operation',{**pending,'state':'succeeded'},False)
    add('실패 사유 누락 거부','Operation',{**pending,'state':'failed'},False)
    add('kind와 결과 타입 불일치 거부','Operation',{**success,'kind':'media_commit'},False)
    add('파일 완료 결과','Operation',{'operationId':U,'kind':'media_commit','state':'succeeded','result':{'taskId':U,'mediaId':U,'coverAssetId':None},'itemErrors':[]})
    transport={'protocol':'ATP-Upload/1','uploadEndpoint':f'/v1/upload-tasks/{U}/content','generation':1,'resumeOffset':0,'length':1048577,'expiresAt':T,'alignmentBytes':1048576,'maxChunkBytes':4194304}
    task={'id':U,'targetType':'record','submissionId':U,'state':'queued','transferredBytes':0,'actualBytes':None,'retryable':True,'reason':None,'version':1,'mediaId':None,'coverAssetId':None,'avatarAssetId':None,'transport':transport}
    add('기록 전송 작업','UploadTask',task)
    cover=copy.deepcopy(task);cover.pop('submissionId');cover['targetType']='cover';cover['coverGroupId']=U;add('대표사진 전송 작업','UploadTask',cover)
    bad=copy.deepcopy(task);bad['transport'].pop('resumeOffset');add('재개 offset 누락 거부','UploadTask',bad,False)
    bad=copy.deepcopy(task);bad['coverGroupId']=U;add('기록과 대표사진 혼합 대상 거부','UploadTask',bad,False)
    add('완료 뒤 전송 권한 제거','UploadTask',{**task,'state':'complete','transport':None,'mediaId':U,'retryable':False})
    add('완료 뒤 전송 권한 잔존 거부','UploadTask',{**task,'state':'complete'},False)
    add('일괄삭제 부분 결과','DeleteResult',{'results':[{'id':U,'status':'deleted','reason':None},{'id':U,'status':'failed','reason':'DELETE_RETRYABLE'}]})
    add('삭제 결과에 잘못된 상태 거부','DeleteResult',{'results':[{'id':U,'status':'pending','reason':None}]},False)
    file={'clientFileId':'f1','selectionIndex':0,'name':'one.jpg','mime':'image/jpeg','declaredBytes':100,'fingerprint':'a'*64,'checksum':'a'*64,'kind':'photo','recordDate':'2026-10-17'}
    add('원본 SHA256 후보','FileInput',file)
    bad=copy.deepcopy(file);bad['checksum']='filename:size';add('가짜 파일 해시 거부','FileInput',bad,False)
    document={'id':U,'itemKey':'notice-sample','title':'향후 고지 문서','version':'1','kind':'notice','required':False,'url':'https://example.invalid/documents/notice','development':False}
    add('향후 고지 문서(가입 화면 미사용) 체크 제외','ConsentDocument',document)
    add('고지를 필수 동의로 표시 거부','ConsentDocument',{**document,'required':True},False)
    for key,title,required in [('terms-service','서비스 이용약관',True),('privacy-collection','개인정보 수집 및 이용 동의',True),('marketing','마케팅 정보 수신 동의',False),('location-terms','위치정보 이용약관',False)]:
        add(f'v3 가입 동의 {title} ({"필수" if required else "선택"})','ConsentDocument',{**document,'itemKey':key,'title':title,'kind':'consent','required':required})
    add('문서 종류 누락 거부','ConsentDocument',{k:v for k,v in document.items() if k!='kind'},False)
    add('HTTP 문서 URL 거부','ConsentDocument',{**document,'url':'http://example.invalid/documents/privacy'},False)
    # v3: 하루 단위 일정·방문 1분 단위·업로드 10개·8자 초대·프로필 사진·동영상 내보내기
    day={'date':'2027-01-31','dayNo':1,'title':None,'status':'active','visitCount':0}
    add('일차 제목 없음','ScheduleDay',day)
    add('일차 번호 0 거부','ScheduleDay',{**day,'dayNo':0},False)
    add('일차 상태 deleted 거부','ScheduleDay',{**day,'status':'deleted'},False)
    sched={'id':U,'groupId':U,'title':'서울 여행','startDate':'2027-01-31','endDate':'2027-02-01','timezone':'Asia/Seoul','status':'active','version':3,'days':[day,{**day,'date':'2027-02-01','dayNo':2,'title':'둘째 날','status':'cancelled'}]}
    add('하루 취소 결과','DayChangeResult',{'schedule':sched,'days':sched['days']})
    add('마지막 날 삭제로 일정 삭제','DayChangeResult',{'schedule':None,'days':[]})
    add('하루 변경 결과 days 누락 거부','DayChangeResult',{'schedule':None},False)
    visit={'id':U,'scheduleId':U,'placeId':U,'visitDate':'2027-01-31','position':0,'plannedTime':None,'version':1}
    add('시간 미정 방문','Visit',visit)
    add('1분 단위 방문 시간 23:59','Visit',{**visit,'plannedTime':'23:59'})
    add('1분 단위 방문 시간 10:01','Visit',{**visit,'plannedTime':'10:01'})
    add('24:00 방문 시간 거부','Visit',{**visit,'plannedTime':'24:00'},False)
    add('초 단위 방문 시간 거부','Visit',{**visit,'plannedTime':'10:01:30'},False)
    add('선택 순서 10 거부(한 제출 최대10개)','FileInput',{**file,'selectionIndex':10},False)
    add('선택 순서 9 허용','FileInput',{**file,'selectionIndex':9})
    invite={'id':U,'link':'https://example.invalid/i/abc','code':'ABCD2345','issuedAt':T,'expiresAt':T,'useCount':0,'maxUses':50,'state':'active','version':1}
    add('8자 초대 코드','Invitation',invite)
    add('0·O·1·I 포함 초대 코드 거부','Invitation',{**invite,'code':'ABCD0O1I'},False)
    add('7자 초대 코드 거부','Invitation',{**invite,'code':'ABCD234'},False)
    add('소문자 초대 코드 거부(정규화는 앱)','Invitation',{**invite,'code':'abcd2345'},False)
    profile={'id':U,'displayName':'지민','status':'active','avatarVersion':None,'version':1}
    add('기본 아이콘 프로필','Profile',profile)
    add('프로필 사진 버전','Profile',{**profile,'avatarVersion':2})
    add('avatarVersion 누락 거부','Profile',{k:v for k,v in profile.items() if k!='avatarVersion'},False)
    avatar=copy.deepcopy(task);avatar.pop('submissionId');avatar['targetType']='avatar';avatar['avatarUserId']=U;add('프로필 사진 전송 작업','UploadTask',avatar)
    add('프로필 사진 완료','UploadTask',{**avatar,'state':'complete','transport':None,'avatarAssetId':U,'retryable':False})
    add('프로필 사진 완료에 mediaId 거부','UploadTask',{**avatar,'state':'complete','transport':None,'avatarAssetId':U,'mediaId':U,'retryable':False},False)
    bad={**avatar,'state':'complete','transport':None,'retryable':False};bad.pop('avatarAssetId');add('프로필 사진 완료 결과 누락 거부','UploadTask',bad,False)
    bad=copy.deepcopy(avatar);bad['coverGroupId']=U;add('대표사진과 프로필 사진 혼합 대상 거부','UploadTask',bad,False)
    add('프로필 사진 커밋 결과','Operation',{'operationId':U,'kind':'media_commit','state':'succeeded','result':{'taskId':U,'mediaId':None,'coverAssetId':None,'avatarAssetId':U},'itemErrors':[]})
    add('하루 변경 검사 후 결과','Operation',{'operationId':U,'kind':'day_update','state':'succeeded','result':{'schedule':sched,'days':sched['days']},'itemErrors':[]})
    export={'mediaId':U,'kind':'video','state':'ready','converted':False,'variant':'sanitized_original','mime':'video/mp4'}
    add('동영상 내보내기는 동영상 파일','ExportResult',export)
    add('동영상 내보내기에 포스터 이미지 거부','ExportResult',{**export,'mime':'image/jpeg'},False)
    add('썸네일 variant 내보내기 거부','ExportResult',{**export,'variant':'thumbnail'},False)
    checks=[]
    for ex in examples:
        wrapper={'$ref':'#/components/schemas/'+ex['component'],'components':schema['components']}
        errors=list(Draft202012Validator(wrapper,format_checker=FormatChecker()).iter_errors(ex['value']))
        valid=not errors;checks.append({'name':ex['name'],'passed':valid==ex['expected_valid'],'expected_valid':ex['expected_valid'],'actual_valid':valid,'validation_errors':[e.message for e in errors][:3]})
    dest=ROOT/'부록/계약예제';dest.mkdir(exist_ok=True)
    (dest/'examples.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2))
    spec_hash=hashlib.sha256(json.dumps(schema,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    (dest/'검증결과.json').write_text(json.dumps({'scope':'OpenAPI 3.1 JSON Schema 예제 검증. 서버의 권한·경쟁·파일 실제 전송 검수는 별도.','openapi_canonical_sha256':spec_hash,'passed':all(c['passed'] for c in checks),'checks':checks},ensure_ascii=False,indent=2))
    print(json.dumps({'passed':all(c['passed'] for c in checks),'examples':len(checks)},ensure_ascii=False))
    assert all(c['passed'] for c in checks),[c for c in checks if not c['passed']]
if __name__=='__main__':main()
