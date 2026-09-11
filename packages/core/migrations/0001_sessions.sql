CREATE SCHEMA core;
CREATE TABLE core.sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  subject_id uuid NOT NULL,
  csrf_token text NOT NULL CHECK (csrf_token ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (idle_expires_at > created_at AND idle_expires_at <= expires_at)
);
CREATE INDEX sessions_subject_idx ON core.sessions(subject_id);
CREATE INDEX sessions_expiry_idx ON core.sessions(expires_at);
REVOKE ALL ON SCHEMA core FROM PUBLIC;
GRANT USAGE ON SCHEMA core TO study_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.sessions TO study_runtime;
