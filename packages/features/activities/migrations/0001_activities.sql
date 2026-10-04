CREATE SCHEMA activities;
CREATE TABLE activities.settings (
  room_id uuid PRIMARY KEY REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  settings jsonb NOT NULL CHECK(jsonb_typeof(settings) = 'object')
);
GRANT USAGE ON SCHEMA activities TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA activities TO study_runtime;
