-- DBA용 권한 템플릿. 운영 접속계정/비밀번호를 생성하지 않는다.
-- 빈 개발 DB 검증 후 실제 서비스 로그인 역할에 아래 NOLOGIN 역할을 부여한다.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atp_api') THEN CREATE ROLE atp_api NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atp_worker') THEN CREATE ROLE atp_worker NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='atp_ops') THEN CREATE ROLE atp_ops NOLOGIN; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA atp FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atp FROM PUBLIC;
GRANT USAGE ON SCHEMA atp TO atp_api,atp_worker,atp_ops;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA atp TO atp_api,atp_worker,atp_ops;
GRANT SELECT,INSERT,UPDATE ON atp.users,atp.identities,atp.sessions,atp.operations,
 atp.consent_events,atp.groups,atp.memberships,atp.reentry_blocks,atp.invitations,
 atp.schedules,atp.places,
 atp.day_plans,atp.visits,atp.submissions,atp.upload_tasks,atp.media,
 atp.metadata_operations,atp.personal_blocks,atp.reports_and_cases,
 atp.recovery_requests,atp.account_notifications,atp.outbox_events,
 atp.cleanup_jobs,atp.export_jobs TO atp_api;
GRANT SELECT ON atp.consent_documents,atp.assets TO atp_api;
GRANT DELETE ON atp.identities,atp.personal_blocks TO atp_api;
GRANT SELECT ON atp.users,atp.groups,atp.memberships,atp.visits TO atp_worker;
GRANT SELECT,INSERT,UPDATE ON atp.schedules,atp.submissions,atp.upload_tasks,
 atp.media,atp.assets,atp.operations,atp.metadata_operations,atp.outbox_events,
 atp.cleanup_jobs,atp.reports_and_cases,atp.export_jobs TO atp_worker;
-- 원본 용량 갱신은 서비스 트랜잭션 책임이다.
GRANT UPDATE(completed_bytes,reserved_bytes,activity_at,version) ON atp.groups TO atp_worker;
GRANT SELECT ON atp.groups,atp.memberships,atp.schedules,atp.users,atp.media,
 atp.assets,atp.reports_and_cases,atp.recovery_requests,atp.operator_audit TO atp_ops;
GRANT UPDATE ON atp.groups,atp.users,atp.media,atp.reports_and_cases,atp.recovery_requests TO atp_ops;
GRANT INSERT ON atp.operator_audit,atp.account_notifications,atp.outbox_events,atp.cleanup_jobs TO atp_ops;
-- 모바일 사용자 계정을 서버 전용 DB 역할에 연결하지 않는다.
COMMIT;
