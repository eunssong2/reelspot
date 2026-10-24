BEGIN;
SET LOCAL search_path=atp,pg_catalog;
-- Failed uploads hold no active slot. Deleted targets reject later retries.
CREATE OR REPLACE FUNCTION guard_empty_delete() RETURNS trigger LANGUAGE plpgsql
SET search_path=atp,pg_catalog AS $$
DECLARE sid uuid; vid uuid; has_work boolean;
BEGIN
 IF TG_TABLE_NAME='schedules' THEN
   IF TG_OP='UPDATE' AND (NEW.status<>'deleted' OR OLD.status='deleted') THEN RETURN NEW; END IF;
   sid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE schedule_id=sid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE schedule_id=sid AND state NOT IN ('complete','failed','cancelled')) INTO has_work;
 ELSE
   IF TG_OP='UPDATE' AND (NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL) THEN RETURN NEW; END IF;
   vid:=OLD.id;
   SELECT EXISTS(SELECT 1 FROM media WHERE visit_id=vid AND (purged_at IS NULL OR access_state NOT IN ('deleted','expired')))
     OR EXISTS(SELECT 1 FROM upload_tasks WHERE visit_id=vid AND state NOT IN ('complete','failed','cancelled')) INTO has_work;
 END IF;
 IF has_work THEN RAISE EXCEPTION 'NOT_EMPTY' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
COMMIT;
