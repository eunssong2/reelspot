BEGIN;
SET LOCAL search_path=atp,pg_catalog;
-- UI 화면 정리(2026-11): 일정은 날짜(일차)의 묶음이다. 한 모임에서 같은 날짜에는 활성 일정 하루만 둔다.
CREATE TABLE schedule_days (
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE NO ACTION,
  day_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(schedule_id,day_date),
  CHECK((status='cancelled')=(cancelled_at IS NOT NULL))
);
COMMENT ON TABLE schedule_days IS '일정의 일차. 일차 번호는 날짜순 1부터. 제목은 day_plans.title';
CREATE INDEX schedule_days_group_date_idx ON schedule_days(group_id,day_date) WHERE status='active';
INSERT INTO schedule_days(schedule_id,group_id,day_date,status,cancelled_at)
SELECT s.id,s.group_id,d::date,CASE WHEN s.status='cancelled' THEN 'cancelled' ELSE 'active' END,
       CASE WHEN s.status='cancelled' THEN COALESCE(s.cancelled_at,now()) END
FROM schedules s CROSS JOIN LATERAL generate_series(s.start_date,s.end_date,interval '1 day') d
WHERE s.status<>'deleted';
-- 기존 겹침 자료는 그대로 두고, 이후 추가·이동·재활성만 검사한다.
CREATE FUNCTION guard_schedule_day() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
BEGIN
 IF NEW.status<>'active' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='active' AND OLD.day_date=NEW.day_date AND OLD.group_id=NEW.group_id THEN RETURN NEW; END IF;
 PERFORM 1 FROM groups WHERE id=NEW.group_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM schedule_days d JOIN schedules s ON s.id=d.schedule_id
   WHERE d.group_id=NEW.group_id AND d.day_date=NEW.day_date AND d.status='active'
     AND s.status='active' AND d.schedule_id<>NEW.schedule_id) THEN
   RAISE EXCEPTION 'SCHEDULE_DATE_TAKEN' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER schedule_day_guard BEFORE INSERT OR UPDATE ON schedule_days
FOR EACH ROW EXECUTE FUNCTION guard_schedule_day();
-- 일차 이동은 방문일과 기록일을 같은 트랜잭션에서 함께 옮긴다.
ALTER TABLE media ALTER CONSTRAINT media_visit_id_schedule_id_record_date_fkey DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE upload_tasks ALTER CONSTRAINT upload_tasks_visit_id_schedule_id_record_date_fkey DEFERRABLE INITIALLY IMMEDIATE;

-- 프로필 사진: 모임 대표 사진과 같은 업로드·위치 제거·검사 경로를 쓴다. 모임 용량에는 넣지 않는다.
ALTER TABLE upload_tasks ADD COLUMN avatar_user_id uuid REFERENCES users(id) ON DELETE NO ACTION;
ALTER TABLE upload_tasks DROP CONSTRAINT upload_tasks_check;
ALTER TABLE upload_tasks ADD CONSTRAINT upload_tasks_target_check CHECK(
  (cover_group_id IS NULL AND avatar_user_id IS NULL AND submission_id IS NOT NULL AND schedule_id IS NOT NULL AND record_date IS NOT NULL AND selection_index IS NOT NULL)
  OR (num_nonnulls(cover_group_id,avatar_user_id)=1 AND submission_id IS NULL AND schedule_id IS NULL AND record_date IS NULL AND selection_index IS NULL AND visit_id IS NULL));
ALTER TABLE assets ADD COLUMN avatar_user_id uuid REFERENCES users(id) ON DELETE NO ACTION;
ALTER TABLE assets DROP CONSTRAINT assets_check;
ALTER TABLE assets ADD CONSTRAINT assets_owner_check CHECK(num_nonnulls(media_id,cover_group_id,avatar_user_id)=1);
CREATE INDEX assets_avatar_idx ON assets(avatar_user_id) WHERE avatar_user_id IS NOT NULL;
ALTER TABLE users ADD COLUMN avatar_asset_id uuid,
  ADD COLUMN avatar_version integer NOT NULL DEFAULT 0 CHECK(avatar_version>=0);
ALTER TABLE users ADD CONSTRAINT users_avatar_asset_fk FOREIGN KEY(avatar_asset_id) REFERENCES assets(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION check_user_avatar() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE actual_owner uuid;
BEGIN
 IF NEW.avatar_asset_id IS NOT NULL THEN
   SELECT avatar_user_id INTO actual_owner FROM assets WHERE id=NEW.avatar_asset_id;
   IF actual_owner IS DISTINCT FROM NEW.id THEN
     RAISE EXCEPTION 'AVATAR_USER_MISMATCH' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER user_avatar_guard AFTER INSERT OR UPDATE ON users
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_user_avatar();
-- 프로필 사진 작업은 기록 한도 대상이 아니다.
CREATE OR REPLACE FUNCTION guard_media_limit() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE n int; lim int; bucket text; ex_task uuid; ex_media uuid;
BEGIN
 IF TG_TABLE_NAME='upload_tasks' THEN
   IF NEW.cover_group_id IS NOT NULL OR NEW.avatar_user_id IS NOT NULL OR NEW.state IN ('complete','failed','cancelled') THEN RETURN NEW; END IF;
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
CREATE INDEX upload_tasks_avatar_idx ON upload_tasks(avatar_user_id) WHERE avatar_user_id IS NOT NULL;
COMMIT;
