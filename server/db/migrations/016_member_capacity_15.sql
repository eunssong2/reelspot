-- C09: apply the agreed capacity to existing and new groups without rewriting data.
CREATE OR REPLACE FUNCTION guard_membership_capacity() RETURNS trigger LANGUAGE plpgsql
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
 IF active_count>=15 THEN RAISE EXCEPTION 'CAPACITY_FULL' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO active_count FROM memberships WHERE user_id=NEW.user_id AND ended_at IS NULL AND id<>NEW.id;
 IF active_count>=100 THEN RAISE EXCEPTION 'GROUP_LIMIT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
