ALTER TABLE core.sessions ADD COLUMN device_label text NOT NULL DEFAULT 'Browser' CHECK (length(device_label) <= 120);
ALTER TABLE core.sessions ADD COLUMN last_active_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE core.sessions ADD COLUMN reauthenticated_at timestamptz;
