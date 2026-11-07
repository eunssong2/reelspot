SET search_path=atp,pg_catalog;
ALTER TABLE groups ADD COLUMN invite_rotation_paused boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN groups.invite_rotation_paused IS 'Last usable invite manually revoked: pause automatic replacement until an explicit new/current invitation request';
