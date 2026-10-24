-- All functions are INVOKER. No mobile client has direct DB privileges.
CREATE FUNCTION retention_last_day(end_date date) RETURNS date
LANGUAGE sql IMMUTABLE STRICT SET search_path=atp,pg_catalog
AS $$ SELECT (end_date + interval '3 months')::date $$;
CREATE FUNCTION retention_expires(end_date date) RETURNS timestamptz
LANGUAGE sql IMMUTABLE STRICT SET search_path=atp,pg_catalog
AS $$ SELECT ((retention_last_day(end_date)+1)::timestamp AT TIME ZONE 'Asia/Seoul') $$;

CREATE FUNCTION guard_schedule_retention() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE basis date;
BEGIN
 IF TG_OP='UPDATE' AND OLD.retention_fixed_at IS NOT NULL THEN
   IF ROW(NEW.retention_fixed_at,NEW.retention_last_date,NEW.expires_at)
      IS DISTINCT FROM ROW(OLD.retention_fixed_at,OLD.retention_last_date,OLD.expires_at) THEN
     RAISE EXCEPTION 'RETENTION_IMMUTABLE' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='active' AND NEW.status='cancelled' THEN
   NEW.cancelled_at:=statement_timestamp(); NEW.cancelled_end_date:=OLD.end_date;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('cancelled','deleted') AND NEW.status='active' THEN
   RAISE EXCEPTION 'SCHEDULE_REOPEN_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 IF NEW.retention_fixed_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.retention_fixed_at IS NULL) THEN
   basis:=CASE WHEN NEW.status='cancelled' THEN NEW.cancelled_end_date ELSE NEW.end_date END;
   IF basis IS NULL OR NEW.retention_last_date<>retention_last_day(basis)
      OR NEW.expires_at<>retention_expires(basis) THEN
     RAISE EXCEPTION 'RETENTION_CALCULATION_INVALID' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER schedule_retention_guard BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION guard_schedule_retention();

CREATE FUNCTION guard_membership_capacity() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE active_count int; group_state text; user_state text;
BEGIN
 IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT status INTO user_state FROM users WHERE id=NEW.user_id FOR UPDATE;
 SELECT status INTO group_state FROM groups WHERE id=NEW.group_id FOR UPDATE;
 IF TG_OP='UPDATE' AND OLD.ended_at IS NULL THEN RETURN NEW; END IF;
 IF user_state<>'active' OR group_state<>'active' THEN
   RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE' USING ERRCODE='23514';
 END IF;
 SELECT count(*) INTO active_count FROM memberships WHERE group_id=NEW.group_id AND ended_at IS NULL AND id<>NEW.id;
 IF active_count>=10 THEN RAISE EXCEPTION 'CAPACITY_FULL' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO active_count FROM memberships WHERE user_id=NEW.user_id AND ended_at IS NULL AND id<>NEW.id;
 IF active_count>=100 THEN RAISE EXCEPTION 'GROUP_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_capacity_guard BEFORE INSERT OR UPDATE ON memberships
FOR EACH ROW EXECUTE FUNCTION guard_membership_capacity();

CREATE FUNCTION check_active_owner() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE gid uuid; g groups%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='groups' THEN gid:=COALESCE(NEW.id,OLD.id);
 ELSE gid:=COALESCE(NEW.group_id,OLD.group_id); END IF;
 SELECT * INTO g FROM groups WHERE id=gid;
 IF FOUND AND g.status='active' AND NOT EXISTS(
   SELECT 1 FROM memberships WHERE group_id=gid AND user_id=g.owner_user_id AND ended_at IS NULL
 ) THEN RAISE EXCEPTION 'ACTIVE_OWNER_REQUIRED' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER groups_owner_check AFTER INSERT OR UPDATE ON groups
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_owner();
CREATE CONSTRAINT TRIGGER memberships_owner_check AFTER INSERT OR UPDATE OR DELETE ON memberships
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_owner();

CREATE FUNCTION guard_group_state() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE owned int; candidate assets%ROWTYPE;
BEGIN
 IF TG_OP='INSERT' THEN
   PERFORM 1 FROM users WHERE id=NEW.owner_user_id FOR UPDATE;
   SELECT count(*) INTO owned FROM groups WHERE owner_user_id=NEW.owner_user_id AND status='active';
   IF owned>=20 THEN RAISE EXCEPTION 'OWNER_CREATE_LIMIT' USING ERRCODE='23514'; END IF;
 ELSIF OLD.status='closed' AND NEW.status<>'closed' THEN
   RAISE EXCEPTION 'GROUP_REOPEN_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER group_state_guard BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION guard_group_state();

CREATE FUNCTION check_group_cover() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE actual_owner uuid;
BEGIN
 IF NEW.cover_asset_id IS NOT NULL THEN
   SELECT cover_group_id INTO actual_owner FROM assets WHERE id=NEW.cover_asset_id;
   IF actual_owner IS DISTINCT FROM NEW.id THEN
     RAISE EXCEPTION 'COVER_GROUP_MISMATCH' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER group_cover_guard AFTER INSERT OR UPDATE ON groups
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_group_cover();

CREATE FUNCTION guard_empty_delete() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE sid uuid; vid uuid; has_work boolean;
BEGIN
 IF TG_TABLE_NAME='schedules' THEN
   IF TG_OP='UPDATE' AND (NEW.status<>'deleted' OR OLD.status='deleted') THEN RETURN NEW; END IF;
   sid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE schedule_id=sid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE schedule_id=sid AND state NOT IN ('complete','cancelled')) INTO has_work;
 ELSE
   IF TG_OP='UPDATE' AND (NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL) THEN RETURN NEW; END IF;
   vid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE visit_id=vid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE visit_id=vid AND state NOT IN ('complete','cancelled')) INTO has_work;
 END IF;
 IF has_work THEN RAISE EXCEPTION 'NOT_EMPTY' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER empty_schedule_guard BEFORE UPDATE OR DELETE ON schedules
FOR EACH ROW EXECUTE FUNCTION guard_empty_delete();
CREATE TRIGGER empty_visit_guard BEFORE UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION guard_empty_delete();

CREATE FUNCTION guard_append_only() RETURNS trigger LANGUAGE plpgsql
AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE='23514'; END $$;
CREATE TRIGGER operator_audit_append_only BEFORE UPDATE OR DELETE ON operator_audit
FOR EACH ROW EXECUTE FUNCTION guard_append_only();


-- P12: 일정×방문일별 활성 방문 최대 15개. 일정 행 잠금으로 동시 추가를 직렬화한다.
CREATE FUNCTION guard_visit_limit() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE active_count int;
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL AND OLD.schedule_id=NEW.schedule_id AND OLD.visit_date=NEW.visit_date THEN RETURN NEW; END IF;
 PERFORM 1 FROM schedules WHERE id=NEW.schedule_id FOR UPDATE;
 SELECT count(*) INTO active_count FROM visits
  WHERE schedule_id=NEW.schedule_id AND visit_date=NEW.visit_date AND deleted_at IS NULL AND id<>NEW.id;
 IF active_count>=15 THEN RAISE EXCEPTION 'VISIT_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER visit_limit_guard BEFORE INSERT OR UPDATE ON visits
FOR EACH ROW EXECUTE FUNCTION guard_visit_limit();

-- P11: 작성자×방문(미지정은 작성자×일정×기록일) 사진 5·영상 2.
-- 완료 media(available)와 진행 중 upload_tasks를 합산한다. advisory lock으로 같은 묶음의 동시 접수를 직렬화한다.
CREATE FUNCTION media_bucket_count(p_author uuid,p_schedule uuid,p_visit uuid,p_record date,p_kind text,p_exclude_task uuid,p_exclude_media uuid)
RETURNS int LANGUAGE sql STABLE SET search_path=atp,pg_catalog AS $$
 SELECT (SELECT count(*) FROM media m WHERE m.author_user_id=p_author AND m.kind=p_kind AND m.access_state='available'
          AND ((p_visit IS NOT NULL AND m.visit_id=p_visit) OR (p_visit IS NULL AND m.visit_id IS NULL AND m.schedule_id=p_schedule AND m.record_date=p_record))
          AND m.id IS DISTINCT FROM p_exclude_media AND m.task_id IS DISTINCT FROM p_exclude_task)
      + (SELECT count(*) FROM upload_tasks u WHERE u.author_user_id=p_author AND u.kind=p_kind AND u.cover_group_id IS NULL
          AND u.state NOT IN ('complete','failed','cancelled')
          AND ((p_visit IS NOT NULL AND u.visit_id=p_visit) OR (p_visit IS NULL AND u.visit_id IS NULL AND u.schedule_id=p_schedule AND u.record_date=p_record))
          AND u.id IS DISTINCT FROM p_exclude_task)
$$;
CREATE FUNCTION guard_media_limit() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE n int; lim int; bucket text; ex_task uuid; ex_media uuid;
BEGIN
 IF TG_TABLE_NAME='upload_tasks' THEN
   IF NEW.cover_group_id IS NOT NULL OR NEW.state IN ('complete','failed','cancelled') THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND OLD.state NOT IN ('complete','failed','cancelled') AND OLD.visit_id IS NOT DISTINCT FROM NEW.visit_id AND OLD.record_date=NEW.record_date THEN RETURN NEW; END IF;
   ex_task:=NEW.id; ex_media:=NULL;
 ELSE
   IF NEW.access_state<>'available' THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND OLD.access_state='available' AND OLD.visit_id IS NOT DISTINCT FROM NEW.visit_id AND OLD.record_date=NEW.record_date THEN RETURN NEW; END IF;
   ex_task:=NEW.task_id; ex_media:=NEW.id;
 END IF;
 bucket:=NEW.author_user_id::text||':'||COALESCE(NEW.visit_id::text,NEW.schedule_id::text||':'||NEW.record_date::text);
 PERFORM pg_advisory_xact_lock(hashtext('atp.media_limit'),hashtext(bucket));
 lim:=CASE WHEN NEW.kind='video' THEN 2 ELSE 5 END;
 n:=media_bucket_count(NEW.author_user_id,NEW.schedule_id,NEW.visit_id,NEW.record_date,NEW.kind,ex_task,ex_media);
 IF n>=lim THEN RAISE EXCEPTION 'MEDIA_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER upload_task_media_limit_guard BEFORE INSERT OR UPDATE ON upload_tasks
FOR EACH ROW EXECUTE FUNCTION guard_media_limit();
CREATE TRIGGER media_media_limit_guard BEFORE INSERT OR UPDATE ON media
FOR EACH ROW EXECUTE FUNCTION guard_media_limit();

-- F05: 초대 확인 횟수 50회 소진. use_count는 증가만 허용하고 50 도달 시 exhausted_at을 고정한다.
CREATE FUNCTION guard_invitation_uses() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.use_count<OLD.use_count THEN RAISE EXCEPTION 'INVITE_USE_COUNT_DECREASE' USING ERRCODE='23514'; END IF;
   IF NEW.use_count>OLD.use_count AND (OLD.use_count>=OLD.max_uses OR OLD.revoked_at IS NOT NULL OR OLD.expires_at<=statement_timestamp()) THEN
     RAISE EXCEPTION 'INVITE_EXHAUSTED' USING ERRCODE='23514';
   END IF;
 END IF;
 IF NEW.use_count>=NEW.max_uses AND NEW.exhausted_at IS NULL THEN NEW.exhausted_at:=statement_timestamp(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invitation_uses_guard BEFORE INSERT OR UPDATE ON invitations
FOR EACH ROW EXECUTE FUNCTION guard_invitation_uses();

-- API service still owns permission checks, recurrence, grapheme validation,
-- moderation, exact file probe, atomic accounting and final completion gates.
-- These DDL guards do not claim that the full F01-F28 implementation exists.
