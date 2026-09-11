ALTER TABLE rooms.invites ADD COLUMN recipient_id uuid REFERENCES identity.users(id);
ALTER TABLE rooms.invites ADD COLUMN sender_id uuid REFERENCES identity.users(id);
ALTER TABLE rooms.invites ADD CONSTRAINT targeted_invite_sender CHECK ((recipient_id IS NULL) = (sender_id IS NULL));
CREATE INDEX invites_recipient ON rooms.invites(recipient_id) WHERE recipient_id IS NOT NULL;
