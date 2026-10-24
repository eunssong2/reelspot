"""사용자가 지정한 임시 Docker PostgreSQL에만 계약 스키마를 검증한다."""
import subprocess,json,hashlib,sys,concurrent.futures,uuid
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from apply_db_baseline import migration_script
ROOT=Path(__file__).resolve().parents[1]
CONTAINER='atp-design-v02-pg';DB='atp_revision_'+uuid.uuid4().hex[:8]
def sql(text,db=DB):
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-At'],input=text,text=True,capture_output=True)
def run():
    # 기존 사용자 DB는 건드리지 않고 전용 컨테이너 안에 새 검증 DB를 만든다.
    exists=sql(f"SELECT 1 FROM pg_database WHERE datname='{DB}';",'postgres')
    if not exists.stdout.strip():
        r=sql('CREATE DATABASE '+DB+';','postgres');assert r.returncode==0,r.stderr
    results=[]
    def record(name,result):
        results.append({'check':name,'passed':result.returncode==0,'detail':result.stderr[-1200:] if result.returncode else result.stdout[-300:]})
        if result.returncode:raise RuntimeError(name+': '+result.stderr)
    record('초기 SQL+마이그레이션 hash 원자 적용',sql(migration_script(ROOT)))
    record('동일 hash 재실행은 변경 없이 건너뜀',sql(migration_script(ROOT)))
    changed=migration_script(ROOT).replace("sha256<>'", "sha256<>'different-")
    mismatch=sql(changed);results.append({'check':'이미 적용된 migration hash 변경 거부','passed':mismatch.returncode!=0 and 'CHECKSUM_MISMATCH' in mismatch.stderr})
    record('컬럼/FK/보관/정원/위치/감사 제약 회귀',sql((ROOT/'부록/DB/003_contract_checks.sql').read_text()))
    record('서버 역할 템플릿 적용',sql((ROOT/'부록/DB/002_service_roles.sql').read_text()))
    acl=sql("SELECT NOT has_table_privilege('atp_api','atp.operator_audit','UPDATE') AND NOT has_table_privilege('atp_ops','atp.operator_audit','DELETE');")
    results.append({'check':'API/운영 역할에 감사 수정·삭제 권한 없음','passed':acl.returncode==0 and acl.stdout.strip()=='t'})
    # Capacity race: 9 existing members, two distinct joiners. Exactly one wins.
    setup="""BEGIN; SET LOCAL search_path=atp,pg_catalog;
INSERT INTO users(id,display_name,status) SELECT ('90000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'경쟁'||i,'active' FROM generate_series(1,11)i;
INSERT INTO groups(id,name,owner_user_id) VALUES('91000000-0000-0000-0000-000000000001','경쟁검증','90000000-0000-0000-0000-000000000001');
INSERT INTO memberships(group_id,user_id) SELECT '91000000-0000-0000-0000-000000000001',id FROM users WHERE id::text LIKE '90000000%' ORDER BY id LIMIT 9;
COMMIT;"""
    record('정원 경쟁 전용 fixture 9명',sql(setup))
    def join(i):return sql(f"BEGIN; INSERT INTO atp.memberships(group_id,user_id) VALUES('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-{i:012}'); SELECT pg_sleep(0.2); COMMIT;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:race=list(pool.map(join,[10,11]))
    count=sql("SELECT count(*) FROM atp.memberships WHERE group_id='91000000-0000-0000-0000-000000000001' AND ended_at IS NULL;")
    results.append({'check':'9명에서 동시2참여 → 성공1·거부1·최종10명','passed':sum(r.returncode==0 for r in race)==1 and count.stdout.strip()=='10','detail':[r.stderr[-250:] for r in race]})
    query="""SELECT json_agg(row_to_json(c)) FROM (SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='atp' ORDER BY table_name,ordinal_position)c;"""
    catalog=sql(query);assert catalog.returncode==0,catalog.stderr
    (ROOT/'부록/DB/실제 컬럼 사전.json').write_text(json.dumps(json.loads(catalog.stdout),ensure_ascii=False,indent=2))
    version=sql('SELECT version();').stdout.strip()
    result={'scope':'초기 DDL·DB 제약·단일 정원 경쟁 검증. F01~F28 서버 구현 검수 아님. 데이터는 전용 임시 컨테이너에만 생성.','time':datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),'database':version,'ddl_sha256':hashlib.sha256((ROOT/'부록/DB/001_initial.sql').read_bytes()).hexdigest(),'passed':all(x['passed'] for x in results),'checks':results}
    (ROOT/'부록/DB/검증결과.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'passed':result['passed'],'checks':len(results),'database':version},ensure_ascii=False))
    if not result['passed']:sys.exit(1)
if __name__=='__main__':run()
