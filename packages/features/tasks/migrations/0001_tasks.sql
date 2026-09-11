CREATE SCHEMA tasks;
CREATE TABLE tasks.items(id uuid PRIMARY KEY,owner_id uuid REFERENCES identity.users(id) ON DELETE CASCADE,room_id uuid REFERENCES rooms.rooms(id) ON DELETE CASCADE,created_by uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),completed boolean NOT NULL DEFAULT false,position integer NOT NULL CHECK(position BETWEEN 0 AND 1000000),version integer NOT NULL DEFAULT 1,deleted boolean NOT NULL DEFAULT false,CHECK((owner_id IS NULL) <> (room_id IS NULL)),UNIQUE(created_by,request_id));
CREATE INDEX tasks_personal ON tasks.items(owner_id,position,id) WHERE NOT deleted;
CREATE INDEX tasks_shared ON tasks.items(room_id,position,id) WHERE NOT deleted;
GRANT USAGE ON SCHEMA tasks TO study_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA tasks TO study_runtime;
