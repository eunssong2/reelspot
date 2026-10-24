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
    task={'id':U,'targetType':'record','submissionId':U,'state':'queued','transferredBytes':0,'actualBytes':None,'retryable':True,'reason':None,'version':1,'mediaId':None,'coverAssetId':None,'transport':transport}
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
