CREATE SCHEMA room_media;
CREATE TABLE room_media.baselines (
  room_id uuid PRIMARY KEY REFERENCES rooms.rooms(id) ON DELETE CASCADE,
  baseline jsonb NOT NULL CHECK(jsonb_typeof(baseline) = 'object'),
  settings jsonb NOT NULL CHECK(jsonb_typeof(settings) = 'object')
);
GRANT USAGE ON SCHEMA room_media TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA room_media TO study_runtime;
