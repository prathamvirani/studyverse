CREATE SCHEMA identity;
CREATE TABLE identity.users (
 id uuid PRIMARY KEY,
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE identity.identities (
 provider text NOT NULL CHECK (provider IN ('google','microsoft','discord')),
 issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 255),
 subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
 user_id uuid NOT NULL REFERENCES identity.users(id),
 linked_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (provider, issuer, subject),
 UNIQUE(user_id, provider)
);
CREATE TABLE identity.oauth_flows (
 state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
 browser_hash text NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
 provider text NOT NULL CHECK (provider IN ('google','microsoft','discord')),
 verifier text NOT NULL,
 nonce text NOT NULL,
 mode text NOT NULL CHECK (mode IN ('login','link','reauthenticate')),
 actor_id uuid REFERENCES identity.users(id),
 session_id uuid,
 expires_at timestamptz NOT NULL,
 CHECK ((mode = 'login' AND actor_id IS NULL AND session_id IS NULL) OR (mode <> 'login' AND actor_id IS NOT NULL AND session_id IS NOT NULL))
);
CREATE INDEX oauth_flows_expiry ON identity.oauth_flows(expires_at);
CREATE INDEX oauth_flows_browser ON identity.oauth_flows(browser_hash);
REVOKE ALL ON SCHEMA identity FROM PUBLIC;
GRANT USAGE ON SCHEMA identity TO study_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO study_runtime;
