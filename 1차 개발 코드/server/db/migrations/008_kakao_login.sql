-- Short-lived browser-to-app login handoff; no credentials in redirect URLs.
CREATE TABLE kakao_login_flows (
  state_hash text PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES login_attempts(id),
  verifier_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  callback_at timestamptz,
  consumed_at timestamptz,
  credential_encrypted text,
  failure text
);
CREATE INDEX kakao_login_flows_expiry ON kakao_login_flows(expires_at);
