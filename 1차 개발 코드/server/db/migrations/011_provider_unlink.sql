-- Short-lived encrypted Kakao token, used only for connection removal after account deletion.
CREATE TABLE provider_credentials (
  identity_id uuid PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  credential_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE provider_unlink_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL UNIQUE,
  payload_encrypted text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','superseded','attention')),
  attempts integer NOT NULL DEFAULT 0,
  error_code text,
  due_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX provider_unlink_due ON provider_unlink_jobs(due_at) WHERE state='pending';
