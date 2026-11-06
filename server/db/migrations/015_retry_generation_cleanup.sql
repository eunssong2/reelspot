BEGIN;
SET LOCAL search_path=atp,pg_catalog;
-- Earlier cleanup could finish while a retry was queued, leaving the failed
-- generation behind even after success. Revisit retried tasks; the new worker
-- preserves active generations, published assets and resumable chunks.
INSERT INTO cleanup_jobs(target_type,target_id,generation,due_at)
SELECT 'task',id,(extract(epoch FROM now())*1000)::bigint,now()
FROM upload_tasks WHERE upload_generation > 1
ON CONFLICT DO NOTHING;
COMMIT;
