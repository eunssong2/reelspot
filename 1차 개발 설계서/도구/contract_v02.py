"""v0.2 명시적 업무 결과와 업로드 transport 계약."""
def apply_revision(ns):
    if ns.get('_V02_APPLIED'):return
    ns['_V02_APPLIED']=True
    S,I,B,R,A,O=[ns[n] for n in ['S','I','B','R','A','O']]
    UUID,DT,V=ns['UUID'],ns['DT'],ns['V'];schemas=ns['SCHEMAS'];responses=ns['RESPONSES'];requests=ns['REQUESTS']
    nullable=lambda x:{'anyOf':[x,{'type':'null'}]}
    schemas['ItemError']=O({'id':UUID,'code':S(),'message':S(),'field':S()},['id','code','message'],additionalProperties=False)
    schemas['MetadataChangeResult']=O({'appliedIds':A(UUID,minItems=1,maxItems=120),'versions':A(O({'id':UUID,'version':V},['id','version'],additionalProperties=False))},['appliedIds','versions'],additionalProperties=False)
    schemas['MediaCommitResult']=O({'taskId':UUID,'mediaId':nullable(UUID),'coverAssetId':nullable(UUID)},['taskId','mediaId','coverAssetId'],additionalProperties=False)
    schemas['PlanResult']=O({'title':S(),'date':ns['DATE'],'visits':A(R('Visit')),'version':V},['title','date','visits','version'],additionalProperties=False)
    schemas['GroupCreateResult']=O({'group':R('Group'),'membershipId':UUID,'firstSchedule':R('Schedule')},['group','membershipId','firstSchedule'],additionalProperties=False)
    schemas['DeleteResult']=O({'results':A(O({'id':UUID,'status':S(enum=['deleted','already_deleted','failed']),'reason':nullable(S())},['id','status','reason'],additionalProperties=False),maxItems=120)},['results'],additionalProperties=False)
    schemas['AccountDeleteResult']=O({'accessRevoked':B(const=True)},['accessRevoked'],additionalProperties=False)
    schemas['GroupCloseResult']=O({'groupId':UUID,'closed':B(const=True),'ownMediaAccessRevoked':B(const=True)},['groupId','closed','ownMediaAccessRevoked'],additionalProperties=False)
    kinds={'group_create':'GroupCreateResult','group_update':'Group','profile_patch':'Profile','schedule_create':'Schedule','schedule_update':'Schedule','plan_update':'PlanResult','metadata_change':'MetadataChangeResult','media_commit':'MediaCommitResult','media_delete':'DeleteResult','account_delete':'AccountDeleteResult','group_close':'GroupCloseResult'}
    op=O({'operationId':UUID,'kind':S(enum=list(kinds)),'state':S(enum=['pending','review','succeeded','failed']),'result':nullable({'oneOf':[R(x) for x in kinds.values()]}),'itemErrors':A(R('ItemError'))},['operationId','kind','state','result','itemErrors'],additionalProperties=False)
    # 결과의 실제 타입은 kind와 state로 판정한다. 타 종류 결과를 넣을 수 없다.
    op['properties']['result']=nullable({'anyOf':[R(x) for x in kinds.values()]})
    op['allOf']=[{'if':{'properties':{'state':{'enum':['pending','review','failed']}}},'then':{'properties':{'result':{'type':'null'}}}},
                 {'if':{'properties':{'state':{'const':'succeeded'}}},'then':{'properties':{'result':{'not':{'type':'null'}},'itemErrors':{'maxItems':0}}}},
                 {'if':{'properties':{'state':{'const':'failed'}}},'then':{'properties':{'itemErrors':{'minItems':1}}}}]
    for k,r in kinds.items():op['allOf'].append({'if':{'properties':{'kind':{'const':k},'state':{'const':'succeeded'}}},'then':{'properties':{'result':R(r)}}})
    schemas['Operation']=op
    schemas['UploadTransport']=O({'protocol':S(const='ATP-Upload/1'),'uploadEndpoint':S(format='uri-reference'),'generation':I(minimum=1),'resumeOffset':I(minimum=0),'length':I(minimum=1,maximum=200000000),'expiresAt':DT,'alignmentBytes':I(const=1048576),'maxChunkBytes':I(const=4194304)},['protocol','uploadEndpoint','generation','resumeOffset','length','expiresAt','alignmentBytes','maxChunkBytes'],additionalProperties=False)
    schemas['UploadTask']=O({'id':UUID,'targetType':S(enum=['record','cover']),'submissionId':UUID,'coverGroupId':UUID,'state':S(enum=['queued','uploading','verifying','review','complete','failed','cancelled']),'transferredBytes':I(minimum=0),'actualBytes':nullable(I(minimum=0)),'retryable':B(),'reason':nullable(S()),'version':V,'mediaId':nullable(UUID),'transport':nullable(R('UploadTransport'))},['id','targetType','state','transferredBytes','actualBytes','retryable','reason','version','mediaId','transport'],additionalProperties=False)
    schemas['UploadTask']['oneOf']=[{'properties':{'targetType':{'const':'record'}},'required':['submissionId'],'not':{'required':['coverGroupId']}},{'properties':{'targetType':{'const':'cover'}},'required':['coverGroupId'],'not':{'required':['submissionId']}}]
    schemas['UploadTask']['allOf']=[{'if':{'properties':{'state':{'enum':['complete','cancelled','verifying','review']}}},'then':{'properties':{'transport':{'type':'null'}}}}]
    schemas['UploadTask']['properties']['coverAssetId']=nullable(UUID)
    schemas['UploadTask']['required'].append('coverAssetId')
    schemas['UploadTask']['allOf'].extend([
      {'if':{'properties':{'state':{'const':'complete'},'targetType':{'const':'record'}}},'then':{'properties':{'mediaId':UUID,'coverAssetId':{'type':'null'}}}},
      {'if':{'properties':{'state':{'const':'complete'},'targetType':{'const':'cover'}}},'then':{'properties':{'coverAssetId':UUID,'mediaId':{'type':'null'}}}}])
    schemas['FileInput']['properties']['checksum']=S(pattern='^[0-9a-f]{64}$',description='원본 전체 SHA256, fingerprint와 동일')
    schemas['FileInput']['properties']['fingerprint']=S(pattern='^[0-9a-f]{64}$')
    schemas['FileInput']['required'].append('checksum')
    requests['uploadRetry']['properties']['sameFileFingerprint']=S(pattern='^[0-9a-f]{64}$')
    requests['uploadCommit']['properties']['checksum']=S(pattern='^[0-9a-f]{64}$')
    # 200은 업무 확정 결과, 202는 언제나 Operation. 200 oneOf로 pending을 섞지 않는다.
    for op_id,result in {'groupCreate':'GroupCreateResult','groupUpdate':'Group','profilePatch':'Profile','scheduleCreate':'Schedule','scheduleUpdate':'Schedule','planUpdate':'PlanResult'}.items():responses[op_id]=R(result)
    for op_id in ['metadataPatch','uploadCommit','operationGet']:responses[op_id]=R('Operation')
    responses['mediaDelete']=O({'operationId':UUID,**schemas['DeleteResult']['properties']},['operationId','results'],additionalProperties=False)
    # 모호했던 동적 맵은 값 타입을 지정한다.
    responses['calendar']['properties']['dateCounts']=O({},additionalProperties=I(minimum=0))
    responses['opsCaseGet']['properties']['case']['required']=['id','type','state','targetId','version','reason']
    responses['opsCaseGet']['properties']['history']['items']['required']=['actorId','action','reason','createdAt']
    responses['opsCaseGet']['properties']['history']['items']['properties']['actorId']=S(description='별도 운영 OIDC issuer/subject 식별값. 앱 사용자 UUID가 아님.')
    responses['deletionPreconditions']=O({'ownedGroups':A(O({'groupId':UUID,'name':S(),'groupVersion':V,'activeCount':I(minimum=1,maximum=10),'candidates':A(O({'membershipId':UUID,'displayName':S()},['membershipId','displayName'],additionalProperties=False)),'allowedAction':S(enum=['transfer','close'])},['groupId','name','groupVersion','activeCount','candidates','allowedAction'],additionalProperties=False)),'reauthRequired':B(const=True)},['ownedGroups','reauthRequired'],additionalProperties=False)
    for op_id in ['ownerTransfer','groupClose']:
        requests[op_id]['properties'].update({'purpose':S(enum=['normal','account_deletion'],default='normal'),'reauthProof':S()})
        requests[op_id]['allOf']=[{'if':{'properties':{'purpose':{'const':'account_deletion'}},'required':['purpose']},'then':{'required':['reauthProof']}}]
    for a in ns['APIS']:
        if a['id'] in ['ownerTransfer','groupClose']:a['request']+='; purpose:normal|account_deletion, latter requires reauthProof'
    updates={'metadataPatch':'Operation {operationId,kind:metadata_change,state,result:MetadataChangeResult|null,itemErrors[]}',
             'uploadCommit':'Operation {operationId,kind:media_commit,state,result:MediaCommitResult|null,itemErrors[]}',
             'operationGet':'Operation {operationId,kind,state,typed result|null,itemErrors[]}',
             'uploadPrepare':'submissionId, tasks:UploadTask[], fileErrors[]; 전송은 task.transport 참조',
             'uploadGet':'UploadTask {transport:UploadTransport|null}',
             'uploadRetry':'UploadTask {transport:{protocol,generation,resumeOffset,uploadEndpoint,length,expiresAt,...}|null}',
             'coverPrepare':'UploadTask {targetType:cover,coverGroupId,transport:UploadTransport|null}'}
    for a in ns['APIS']:
        if a['id'] in updates:a['response']=updates[a['id']]
    for id,method,req,res in [
      ('uploadHead','HEAD','Upload-Generation, Authorization','204; Upload-Offset/Length/Generation/Expires'),
      ('uploadChunk','PATCH','application/offset+octet-stream; Upload-Offset/Generation/Checksum, Content-Length','204; 확정 Upload-Offset/Generation')]:
        if any(a['id']==id for a in ns['APIS']):continue
        ns['APIS'].append({'id':id,'method':method,'path':'/upload-tasks/{taskId}/content','features':['F15'],'auth':'self-current-membership-or-cover-owner','request':req,'response':res,'errors':'OFFSET_MISMATCH GENERATION_MISMATCH CHUNK_CHECKSUM_INVALID TRANSPORT_EXPIRED ACCESS_REVOKED'})

def transport_responses(S,I):
    headers={'Upload-Offset':{'required':True,'schema':I(minimum=0)},'Upload-Length':{'required':True,'schema':I(minimum=1)},'Upload-Generation':{'required':True,'schema':I(minimum=1)},'Upload-Expires':{'required':True,'schema':S(format='date-time')},'Cache-Control':{'required':True,'schema':S(const='no-store')}}
    return {'204':{'description':'본문 없음. 저장 확정된 오프셋. PATCH 실패/응답유실 뒤 HEAD로 확인.','headers':headers}}
