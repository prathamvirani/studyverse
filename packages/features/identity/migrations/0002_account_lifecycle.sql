-- Existing accounts need only identity setup; new accounts receive the full flow.
ALTER TABLE identity.users ADD COLUMN username text;
ALTER TABLE identity.users ADD COLUMN username_changed_at timestamptz;
ALTER TABLE identity.users ADD COLUMN onboarding_return_to text NOT NULL DEFAULT '/home';
ALTER TABLE identity.users ADD COLUMN onboarding jsonb NOT NULL DEFAULT '{"version":1,"identity":false,"appearance":true,"layout":true}';
ALTER TABLE identity.users ALTER COLUMN onboarding SET DEFAULT '{"version":1,"identity":false,"appearance":false,"layout":false}';
ALTER TABLE identity.users ADD CONSTRAINT username_format CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{2,23}$');
CREATE UNIQUE INDEX users_username_unique ON identity.users(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE identity.oauth_flows ADD COLUMN return_to text NOT NULL DEFAULT '/home';
ALTER TABLE identity.identities DROP CONSTRAINT identities_user_id_fkey;
ALTER TABLE identity.identities ADD FOREIGN KEY(user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE identity.oauth_flows DROP CONSTRAINT oauth_flows_actor_id_fkey;
ALTER TABLE identity.oauth_flows ADD FOREIGN KEY(actor_id) REFERENCES identity.users(id) ON DELETE CASCADE;
-- Dedicated proof: only a completed deletion-purpose reauthentication can create it.
CREATE TABLE identity.deletion_proofs (
 session_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
GRANT SELECT,INSERT,UPDATE,DELETE ON identity.deletion_proofs TO study_runtime;
