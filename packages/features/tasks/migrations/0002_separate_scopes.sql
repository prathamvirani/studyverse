-- Preserve all existing records and tombstones while separating durable ownership.
CREATE TABLE tasks.personal_items(id uuid PRIMARY KEY,owner_id uuid,room_id uuid,created_by uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),completed boolean NOT NULL DEFAULT false,position integer NOT NULL CHECK(position BETWEEN 0 AND 1000000),version integer NOT NULL DEFAULT 1,deleted boolean NOT NULL DEFAULT false,UNIQUE(created_by,request_id),CHECK(owner_id IS NOT NULL AND room_id IS NULL),FOREIGN KEY(owner_id) REFERENCES identity.users(id) ON DELETE CASCADE);
CREATE TABLE tasks.shared_items(id uuid PRIMARY KEY,owner_id uuid,room_id uuid,created_by uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),completed boolean NOT NULL DEFAULT false,position integer NOT NULL CHECK(position BETWEEN 0 AND 1000000),version integer NOT NULL DEFAULT 1,deleted boolean NOT NULL DEFAULT false,UNIQUE(created_by,request_id),CHECK(room_id IS NOT NULL AND owner_id IS NULL),FOREIGN KEY(room_id) REFERENCES rooms.rooms(id) ON DELETE CASCADE);
INSERT INTO tasks.personal_items SELECT * FROM tasks.items WHERE owner_id IS NOT NULL;
INSERT INTO tasks.shared_items SELECT * FROM tasks.items WHERE room_id IS NOT NULL;
DO $$ BEGIN
 IF (SELECT count(*) FROM tasks.items) <> (SELECT count(*) FROM tasks.personal_items)+(SELECT count(*) FROM tasks.shared_items) THEN
  RAISE EXCEPTION 'Task scope migration must preserve every record';
 END IF;
END $$;
DROP TABLE tasks.items;
CREATE INDEX personal_task_order ON tasks.personal_items(owner_id,position,id) WHERE NOT deleted;
CREATE INDEX shared_task_order ON tasks.shared_items(room_id,position,id) WHERE NOT deleted;
GRANT SELECT,INSERT,UPDATE,DELETE ON tasks.personal_items,tasks.shared_items TO study_runtime;
