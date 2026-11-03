BEGIN;
SET LOCAL search_path=atp,pg_catalog;
CREATE TABLE login_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, device_id text NOT NULL);
CREATE TABLE reauth_proofs(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),session_id uuid NOT NULL REFERENCES sessions(id),expires_at timestamptz NOT NULL);
CREATE TABLE api_receipts(actor_key text NOT NULL,route text NOT NULL,key text NOT NULL,request_hash text NOT NULL,response_encrypted text NOT NULL,status integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_key,route,key));
CREATE TABLE recovery_responses(request_id uuid PRIMARY KEY REFERENCES recovery_requests(id),owner_id uuid NOT NULL REFERENCES users(id),response text NOT NULL CHECK(response IN ('agree','object','contacted')),reason text NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE upload_tasks ADD COLUMN declared_mime text NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE upload_tasks ADD COLUMN file_name text NOT NULL DEFAULT 'file';
ALTER TABLE upload_tasks ADD COLUMN processing_claim uuid, ADD COLUMN processing_until timestamptz, ADD COLUMN review_approved boolean NOT NULL DEFAULT false;
ALTER TABLE cleanup_jobs ADD COLUMN claimed_until timestamptz;
ALTER TABLE account_notifications DROP CONSTRAINT account_notifications_check;
ALTER TABLE account_notifications ADD CONSTRAINT notification_reference_check CHECK(num_nonnulls(case_id,recovery_request_id)<=1);
CREATE INDEX media_sort_idx ON media(schedule_id,COALESCE(captured_at,completed_at),id);
CREATE INDEX runtime_outbox_created_idx ON outbox_events(created_at) WHERE published_at IS NULL;
CREATE INDEX cleanup_due_idx ON cleanup_jobs(due_at) WHERE state<>'complete';
-- Restricted completed files keep their P11 slot; visibility and capacity are separate.
CREATE OR REPLACE FUNCTION media_bucket_count(p_author uuid,p_schedule uuid,p_visit uuid,p_record date,p_kind text,p_exclude_task uuid,p_exclude_media uuid)
RETURNS int LANGUAGE sql STABLE SET search_path=atp,pg_catalog AS $$
 SELECT (SELECT count(*) FROM media m WHERE m.author_user_id=p_author AND m.kind=p_kind AND m.access_state IN ('available','restricted')
 AND ((p_visit IS NOT NULL AND m.visit_id=p_visit) OR (p_visit IS NULL AND m.visit_id IS NULL AND m.schedule_id=p_schedule AND m.record_date=p_record))
 AND m.id IS DISTINCT FROM p_exclude_media AND m.task_id IS DISTINCT FROM p_exclude_task)
 +(SELECT count(*) FROM upload_tasks u WHERE u.author_user_id=p_author AND u.kind=p_kind AND u.cover_group_id IS NULL AND u.state NOT IN ('complete','failed','cancelled')
 AND ((p_visit IS NOT NULL AND u.visit_id=p_visit) OR (p_visit IS NULL AND u.visit_id IS NULL AND u.schedule_id=p_schedule AND u.record_date=p_record)) AND u.id IS DISTINCT FROM p_exclude_task)
$$;
COMMIT;
