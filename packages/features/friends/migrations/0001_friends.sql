CREATE SCHEMA friends;
CREATE TABLE friends.relationships (
 low_id uuid NOT NULL REFERENCES identity.users(id),
 high_id uuid NOT NULL REFERENCES identity.users(id),
 sender_id uuid NOT NULL REFERENCES identity.users(id),
 state text NOT NULL CHECK (state IN ('pending','accepted')),
 PRIMARY KEY(low_id,high_id),
 CHECK(low_id < high_id),
 CHECK(sender_id IN (low_id,high_id))
);
CREATE TABLE friends.blocks (
 actor_id uuid NOT NULL REFERENCES identity.users(id),
 target_id uuid NOT NULL REFERENCES identity.users(id),
 PRIMARY KEY(actor_id,target_id), CHECK(actor_id <> target_id)
);
CREATE TABLE friends.privacy (
 user_id uuid PRIMARY KEY REFERENCES identity.users(id),
 online boolean NOT NULL DEFAULT true,
 room boolean NOT NULL DEFAULT false,
 study boolean NOT NULL DEFAULT true,
 join_visible boolean NOT NULL DEFAULT false,
 invites boolean NOT NULL DEFAULT true
);
REVOKE ALL ON SCHEMA friends FROM PUBLIC;
GRANT USAGE ON SCHEMA friends TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA friends TO study_runtime;
