CREATE SCHEMA rooms;
CREATE TABLE rooms.rooms (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES identity.users(id),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
 tags jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tags) = 'array' AND jsonb_array_length(tags) <= 8),
 privacy text NOT NULL CHECK (privacy IN ('public','private','unlisted')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE rooms.memberships (
 room_id uuid NOT NULL REFERENCES rooms.rooms(id),
 user_id uuid NOT NULL REFERENCES identity.users(id),
 role text NOT NULL CHECK (role IN ('owner','moderator','member')),
 joined_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_visited_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(room_id, user_id)
);
CREATE UNIQUE INDEX room_single_owner ON rooms.memberships(room_id) WHERE role = 'owner';
CREATE INDEX memberships_user ON rooms.memberships(user_id, room_id);
CREATE INDEX rooms_public ON rooms.rooms(id) WHERE privacy = 'public';
CREATE INDEX rooms_owner ON rooms.rooms(owner_id);
CREATE TABLE rooms.invites (
 id uuid PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES rooms.rooms(id),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at timestamptz NOT NULL,
 max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 100),
 uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
 revoked_at timestamptz,
 CHECK (expires_at > created_at)
);
CREATE INDEX invites_room ON rooms.invites(room_id, created_at);
REVOKE ALL ON SCHEMA rooms FROM PUBLIC;
GRANT USAGE ON SCHEMA rooms TO study_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rooms TO study_runtime;
