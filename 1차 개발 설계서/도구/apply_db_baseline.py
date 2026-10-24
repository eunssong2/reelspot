"""초기 스키마+checksum 이력을 동일 트랜잭션에 적용. PG* 접속환경은 호출자가 제공."""
from pathlib import Path
import hashlib,subprocess,sys
def migration_script(root):
    source=Path(root)/'부록/DB/001_initial.sql';sql=source.read_text();sha=hashlib.sha256(source.read_bytes()).hexdigest()
    assert sql.rstrip().endswith('COMMIT;')
    # SQL 자신의 hash를 파일 안에 넣으면 자기참조가 되므로 runner가 커밋 직전 주입한다.
    sql=sql[:sql.rfind('COMMIT;')]+f"INSERT INTO atp_migrations.applied(version,sha256) VALUES(1,'{sha}');\nCOMMIT;\n"
    prefix=fr"""\set ON_ERROR_STOP on
SELECT pg_advisory_lock(74103102);
CREATE SCHEMA IF NOT EXISTS atp_migrations;
REVOKE ALL ON SCHEMA atp_migrations FROM PUBLIC;
CREATE TABLE IF NOT EXISTS atp_migrations.applied(
 version integer PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM atp_migrations.applied WHERE version=1 AND sha256<>'{sha}') THEN
   RAISE EXCEPTION 'APPLIED_MIGRATION_CHECKSUM_MISMATCH';
 END IF;
END $check$;
SELECT EXISTS(SELECT 1 FROM atp_migrations.applied WHERE version=1) AS atp_already_001 \gset
\if :atp_already_001
\echo 001_initial already applied with matching checksum
\else
"""
    return prefix+sql+'\n\\endif\nSELECT pg_advisory_unlock(74103102);\n'
if __name__=='__main__':
    root=Path(__file__).resolve().parents[1];text=migration_script(root)
    if '--print' in sys.argv:print(text)
    else:subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1'],input=text,text=True,check=True)
