BEGIN;
SET LOCAL search_path=atp,pg_catalog;
-- Requeue historical failures/cancellations that previously had no cleanup, or
-- whose earlier job finished without removing prepared private originals.
-- The worker rechecks task state under a row lock, so a resumed upload is retained.
INSERT INTO cleanup_jobs(target_type,target_id,generation,due_at)
SELECT 'task',id,(extract(epoch FROM now())*1000)::bigint,now()
FROM upload_tasks WHERE state IN ('failed','cancelled')
ON CONFLICT DO NOTHING;

-- Earlier group-close SQL changed complete covers to cancelled; their assets
-- and completed-byte charge must still be released, unless currently in use.
INSERT INTO cleanup_jobs(target_type,target_id,generation,due_at)
SELECT 'cover_task',t.id,(extract(epoch FROM now())*1000)::bigint,now()
FROM upload_tasks t
WHERE t.cover_group_id IS NOT NULL AND t.state='cancelled' AND t.storage_released_at IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.object_key LIKE 'assets/'||t.id::text||'/%')
ON CONFLICT DO NOTHING;
COMMIT;
