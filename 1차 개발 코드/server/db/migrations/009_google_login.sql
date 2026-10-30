-- Same one-time, verifier-bound handoff as Kakao. Provider attempts remain isolated.
CREATE TABLE google_login_flows (LIKE kakao_login_flows INCLUDING ALL);
ALTER TABLE google_login_flows ADD FOREIGN KEY (attempt_id) REFERENCES login_attempts(id);
