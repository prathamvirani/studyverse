CREATE TABLE pomodoro.personal_timers(
 user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
 state jsonb NOT NULL CHECK(state->>'scope'='personal' AND NOT state ? 'roomId')
);
GRANT SELECT,INSERT,UPDATE,DELETE ON pomodoro.personal_timers TO study_runtime;
