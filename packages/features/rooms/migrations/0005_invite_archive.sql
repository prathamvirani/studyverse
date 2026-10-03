-- Keep revoked-token and attribution linkage while removing the owner's management entry.
ALTER TABLE rooms.invites ADD COLUMN archived_at timestamptz;
ALTER TABLE rooms.invites ADD CONSTRAINT archived_invite_revoked CHECK (archived_at IS NULL OR revoked_at IS NOT NULL);
CREATE INDEX invites_visible_management ON rooms.invites(room_id, created_at DESC) WHERE archived_at IS NULL;
