BEGIN;
SET LOCAL search_path=atp,pg_catalog;
ALTER TABLE upload_tasks ADD COLUMN storage_released_at timestamptz;
COMMIT;
