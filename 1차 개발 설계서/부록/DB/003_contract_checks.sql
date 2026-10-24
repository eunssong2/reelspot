-- 빈 검증 DB에서만 실행. 테스트 데이터는 전체 ROLLBACK한다.
BEGIN;
SET LOCAL search_path=atp,pg_catalog;
CREATE FUNCTION pg_temp.expect_failure(command text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 BEGIN
  EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected_state THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'EXPECTED_ERROR_NOT_RAISED: %',command;
END $$;
DO $$ BEGIN
 IF retention_last_day('2027-01-31')<>'2027-04-30'::date THEN RAISE EXCEPTION 'month_end'; END IF;
 IF retention_last_day('2026-11-30')<>'2027-02-28'::date THEN RAISE EXCEPTION 'feb_end'; END IF;
 IF retention_expires('2027-01-31')<>'2027-05-01T00:00:00+09:00'::timestamptz THEN RAISE EXCEPTION 'kst_expiry'; END IF;
END $$;
INSERT INTO users(id,display_name,status)
SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'사용자'||i,'active' FROM generate_series(1,12)i;
INSERT INTO groups(id,name,owner_user_id) VALUES('10000000-0000-0000-0000-000000000001','검증 모임','00000000-0000-0000-0000-000000000001');
INSERT INTO memberships(group_id,user_id)
SELECT '10000000-0000-0000-0000-000000000001',id FROM users ORDER BY id LIMIT 10;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.expect_failure($q$INSERT INTO memberships(group_id,user_id) VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011')$q$,'23514');
SELECT pg_temp.expect_failure($q$INSERT INTO groups(name,owner_user_id) VALUES('방장 참여 없음','00000000-0000-0000-0000-000000000012')$q$,'23514');
SELECT pg_temp.expect_failure($q$UPDATE groups SET reserved_bytes=5000000001$q$,'23514');
SELECT pg_temp.expect_failure($q$INSERT INTO personal_blocks(blocker_user_id,blocked_user_id) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')$q$,'23514');
INSERT INTO identities(user_id,provider,provider_subject) VALUES('00000000-0000-0000-0000-000000000001','google','subject-1');
SELECT pg_temp.expect_failure($q$INSERT INTO identities(user_id,provider,provider_subject) VALUES('00000000-0000-0000-0000-000000000002','google','subject-1')$q$,'23505');
INSERT INTO schedules(id,group_id,title,start_date,end_date)
 VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','일정','2027-01-31','2027-01-31');
UPDATE schedules SET retention_fixed_at=now(),retention_last_date='2027-04-30',expires_at='2027-05-01T00:00:00+09:00';
SELECT pg_temp.expect_failure($q$UPDATE schedules SET expires_at='2027-06-01T00:00:00+09:00'$q$,'23514');
SELECT pg_temp.expect_failure($q$UPDATE schedules SET retention_fixed_at=NULL,retention_last_date=NULL,expires_at=NULL$q$,'23514');
UPDATE schedules SET end_date='2027-02-02';
DO $$ BEGIN IF (SELECT retention_last_date FROM schedules LIMIT 1)<>'2027-04-30'::date THEN RAISE EXCEPTION 'date_change_reset_expiry'; END IF; END $$;
SELECT pg_temp.expect_failure($q$INSERT INTO schedules(group_id,title,start_date,end_date) VALUES('10000000-0000-0000-0000-000000000001','367일','2027-01-01','2028-01-02')$q$,'23514');
INSERT INTO places(id,group_id,provider,name,normalized_fingerprint)
 VALUES('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','manual','수기','manual-1');
SELECT pg_temp.expect_failure($q$INSERT INTO places(group_id,provider,name,normalized_fingerprint,latitude) VALUES('10000000-0000-0000-0000-000000000001','manual','좌표 한쪽','manual-2',37.1)$q$,'23514');
INSERT INTO visits(id,schedule_id,place_id,visit_date,position,dedupe_key)
 VALUES('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2027-01-31',0,'manual-1');
SELECT pg_temp.expect_failure($q$UPDATE visits SET planned_time='10:01'$q$,'23514');
INSERT INTO submissions(id,schedule_id,author_user_id)
 VALUES('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
INSERT INTO upload_tasks(id,submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at)
 VALUES('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','file-1',0,'photo',repeat('a',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/task-1',now()+interval '24 hours');
-- P11: 같은 작성자·같은 방문에 사진 5개까지. 6번째 접수는 거부, 영상은 2개까지.
INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at)
 SELECT '50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','file-'||i,i,'photo',repeat('b',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/task-'||i,now()+interval '24 hours' FROM generate_series(1,4)i;
SELECT pg_temp.expect_failure($q$INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at) VALUES('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','file-6',6,'photo',repeat('c',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/task-6',now()+interval '24 hours')$q$,'23514');
INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at)
 SELECT '50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','video-'||i,10+i,'video',repeat('d',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/video-'||i,now()+interval '24 hours' FROM generate_series(1,2)i;
SELECT pg_temp.expect_failure($q$INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at) VALUES('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','video-3',13,'video',repeat('e',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/video-3',now()+interval '24 hours')$q$,'23514');
-- 실패한 작업은 자리를 돌려준다. 다른 작성자는 별도 한도다.
UPDATE upload_tasks SET state='failed' WHERE client_file_id='file-4';
INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at)
 VALUES('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','file-7',7,'photo',repeat('f',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/task-7',now()+interval '24 hours');
INSERT INTO submissions(id,schedule_id,author_user_id) VALUES('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
INSERT INTO upload_tasks(submission_id,schedule_id,author_user_id,client_file_id,selection_index,kind,fingerprint,record_date,visit_id,reserved_bytes,declared_bytes,quarantine_key,transport_expires_at)
 VALUES('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','other-1',0,'photo',repeat('a',64),'2027-01-31','40000000-0000-0000-0000-000000000001',100,100,'private/other-1',now()+interval '24 hours');
-- P12: 같은 일정·방문일에 활성 방문 15개까지. 16번째는 거부, 삭제 후 자리 복귀.
INSERT INTO places(id,group_id,provider,name,normalized_fingerprint)
 SELECT ('31000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000001','manual','수기'||i,'manual-p'||i FROM generate_series(1,15)i;
INSERT INTO visits(schedule_id,place_id,visit_date,position,dedupe_key)
 SELECT '20000000-0000-0000-0000-000000000001',('31000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'2027-01-31',i,'manual-p'||i FROM generate_series(1,14)i;
SELECT pg_temp.expect_failure($q$INSERT INTO visits(schedule_id,place_id,visit_date,position,dedupe_key) VALUES('20000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000015','2027-01-31',15,'manual-p15')$q$,'23514');
UPDATE visits SET deleted_at=now(),position=NULL WHERE dedupe_key='manual-p14';
INSERT INTO visits(schedule_id,place_id,visit_date,position,dedupe_key) VALUES('20000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000015','2027-01-31',15,'manual-p15');
-- 일정에 시각·반복 컬럼이 없어야 한다.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='atp' AND table_name='schedules' AND column_name IN ('all_day','start_at','end_at','series_id','original_occurrence_key')) THEN RAISE EXCEPTION 'schedule_time_columns_present'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='atp' AND table_name LIKE 'recurrence%') THEN RAISE EXCEPTION 'recurrence_tables_present'; END IF;
END $$;
-- F05: 초대 확인 50회 소진.
INSERT INTO invitations(id,group_id,issuer_user_id,code_hash,token_hash,code_ciphertext,token_ciphertext,issued_at,expires_at,use_count)
 VALUES('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','c1','t1','\x00','\x00',now(),now()+interval '168 hours',49);
UPDATE invitations SET use_count=use_count+1 WHERE id='80000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT exhausted_at FROM invitations WHERE id='80000000-0000-0000-0000-000000000001') IS NULL THEN RAISE EXCEPTION 'exhausted_not_set'; END IF; END $$;
SELECT pg_temp.expect_failure($q$UPDATE invitations SET use_count=use_count+1 WHERE id='80000000-0000-0000-0000-000000000001'$q$,'23514');
SELECT pg_temp.expect_failure($q$UPDATE invitations SET use_count=3 WHERE id='80000000-0000-0000-0000-000000000001'$q$,'23514');
SELECT pg_temp.expect_failure($q$INSERT INTO export_jobs(user_id,purpose,targets,expires_at) VALUES('00000000-0000-0000-0000-000000000001','share','[]',now()+interval '24 hours')$q$,'23514');
SELECT pg_temp.expect_failure($q$UPDATE upload_tasks SET record_date='2027-02-01'$q$,'23503');
SELECT pg_temp.expect_failure($q$UPDATE visits SET deleted_at=now(),position=NULL$q$,'23514');
SELECT pg_temp.expect_failure($q$UPDATE schedules SET status='deleted'$q$,'23514');
SELECT pg_temp.expect_failure($q$INSERT INTO assets(cover_group_id,variant,object_key,bytes,checksum,location_verified_absent,probe_result,state) VALUES('10000000-0000-0000-0000-000000000001','view','unsafe',10,'x',false,'{}','ready')$q$,'23514');
INSERT INTO reports_and_cases(id,type,target_type,target_id,reason,review_due_at)
 VALUES('70000000-0000-0000-0000-000000000001','scan','media','60000000-0000-0000-0000-000000000001','검증',now()+interval '24 hours');
INSERT INTO operator_audit(operator_id,case_id,target_type,target_id,action,reason,before_state,after_state)
 VALUES('oidc:operator-1','70000000-0000-0000-0000-000000000001','media','60000000-0000-0000-0000-000000000001','review','검증','{}','{}');
SELECT pg_temp.expect_failure($q$UPDATE operator_audit SET reason='변경'$q$,'23514');
SELECT pg_temp.expect_failure($q$DELETE FROM operator_audit$q$,'23514');
ROLLBACK;
