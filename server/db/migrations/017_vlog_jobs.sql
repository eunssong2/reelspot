SET search_path=atp,pg_catalog;
CREATE TABLE vlog_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id),
 group_id uuid NOT NULL REFERENCES groups(id),
 title text NOT NULL,
 timeline jsonb NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','rendering','complete','failed','cancelled','expired')),
 progress double precision NOT NULL DEFAULT 0 CHECK(progress>=0 AND progress<=1),
 error_code text,
 cleaned_at timestamptz,
 object_key text,
 duration_sec double precision NOT NULL,
 lease uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE INDEX vlog_jobs_pending ON vlog_jobs(created_at) WHERE state='queued';
CREATE INDEX vlog_jobs_user ON vlog_jobs(user_id,created_at);
