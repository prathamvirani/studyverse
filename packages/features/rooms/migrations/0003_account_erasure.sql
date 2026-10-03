-- Product erasure policy: owned rooms are deleted, never silently transferred.
-- Their dependent feature data already follows room deletion via owned FKs.
ALTER TABLE rooms.rooms DROP CONSTRAINT rooms_owner_id_fkey;
ALTER TABLE rooms.rooms ADD FOREIGN KEY(owner_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE rooms.memberships DROP CONSTRAINT memberships_room_id_fkey;
ALTER TABLE rooms.memberships ADD FOREIGN KEY(room_id) REFERENCES rooms.rooms(id) ON DELETE CASCADE;
ALTER TABLE rooms.memberships DROP CONSTRAINT memberships_user_id_fkey;
ALTER TABLE rooms.memberships ADD FOREIGN KEY(user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE rooms.invites DROP CONSTRAINT invites_room_id_fkey;
ALTER TABLE rooms.invites ADD FOREIGN KEY(room_id) REFERENCES rooms.rooms(id) ON DELETE CASCADE;
ALTER TABLE rooms.invites DROP CONSTRAINT invites_recipient_id_fkey;
ALTER TABLE rooms.invites ADD FOREIGN KEY(recipient_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE rooms.invites DROP CONSTRAINT invites_sender_id_fkey;
ALTER TABLE rooms.invites ADD FOREIGN KEY(sender_id) REFERENCES identity.users(id) ON DELETE CASCADE;
