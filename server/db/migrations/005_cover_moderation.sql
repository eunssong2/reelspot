BEGIN;
SET LOCAL search_path=atp,pg_catalog;
ALTER TABLE assets ADD COLUMN moderation_state text NOT NULL DEFAULT 'passed' CHECK(moderation_state IN ('passed','restricted'));
COMMIT;
