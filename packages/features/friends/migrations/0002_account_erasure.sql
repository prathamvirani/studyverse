-- Remove relationships, blocks and privacy settings involving a deleted account.
ALTER TABLE friends.relationships DROP CONSTRAINT relationships_low_id_fkey;
ALTER TABLE friends.relationships ADD FOREIGN KEY(low_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE friends.relationships DROP CONSTRAINT relationships_high_id_fkey;
ALTER TABLE friends.relationships ADD FOREIGN KEY(high_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE friends.relationships DROP CONSTRAINT relationships_sender_id_fkey;
ALTER TABLE friends.relationships ADD FOREIGN KEY(sender_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE friends.blocks DROP CONSTRAINT blocks_actor_id_fkey;
ALTER TABLE friends.blocks ADD FOREIGN KEY(actor_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE friends.blocks DROP CONSTRAINT blocks_target_id_fkey;
ALTER TABLE friends.blocks ADD FOREIGN KEY(target_id) REFERENCES identity.users(id) ON DELETE CASCADE;
ALTER TABLE friends.privacy DROP CONSTRAINT privacy_user_id_fkey;
ALTER TABLE friends.privacy ADD FOREIGN KEY(user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
