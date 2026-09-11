CREATE SCHEMA backgrounds;
CREATE TABLE backgrounds.room_defaults (
  room_id uuid PRIMARY KEY REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  asset_id text NOT NULL CHECK(length(asset_id) <= 100),
  version integer NOT NULL CHECK(version >= 1)
);
GRANT USAGE ON SCHEMA backgrounds TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA backgrounds TO study_runtime;
