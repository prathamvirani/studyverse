ALTER TABLE core.sessions ADD COLUMN device_name text NOT NULL DEFAULT '' CHECK(length(device_name) <= 60);
