CREATE SCHEMA chat;
CREATE TABLE chat.messages(id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,room_id uuid NOT NULL REFERENCES rooms.rooms(id) ON DELETE CASCADE,author_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,text text NOT NULL CHECK(length(text)<=2000),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),deleted boolean NOT NULL DEFAULT false,UNIQUE(author_id,request_id));
CREATE INDEX chat_history ON chat.messages(room_id,sequence DESC);
GRANT USAGE ON SCHEMA chat TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA chat TO study_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA chat TO study_runtime;
