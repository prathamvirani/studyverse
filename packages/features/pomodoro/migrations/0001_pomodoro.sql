CREATE SCHEMA pomodoro;
CREATE TABLE pomodoro.timers(room_id uuid PRIMARY KEY REFERENCES rooms.rooms(id) ON DELETE CASCADE,state jsonb NOT NULL);
GRANT USAGE ON SCHEMA pomodoro TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA pomodoro TO study_runtime;
