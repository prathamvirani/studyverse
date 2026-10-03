ALTER TABLE rooms.rooms ADD COLUMN public_id text;
ALTER TABLE rooms.rooms ADD COLUMN slug text;
DO $$
DECLARE item record; candidate text;
BEGIN
  FOR item IN SELECT id FROM rooms.rooms LOOP
    LOOP
      candidate := left(replace(gen_random_uuid()::text, '-', ''), 12);
      EXIT WHEN NOT EXISTS(SELECT 1 FROM rooms.rooms WHERE public_id=candidate);
    END LOOP;
    UPDATE rooms.rooms SET public_id=candidate WHERE id=item.id;
  END LOOP;
END $$;
ALTER TABLE rooms.rooms ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE rooms.rooms ALTER COLUMN public_id SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''),12);
ALTER TABLE rooms.rooms ADD CONSTRAINT room_public_id_format CHECK(public_id ~ '^[a-f0-9]{12}$');
CREATE UNIQUE INDEX room_public_id_unique ON rooms.rooms(public_id);
ALTER TABLE rooms.rooms ADD CONSTRAINT room_slug_format CHECK(slug IS NULL OR (slug ~ '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 40 AND slug !~ '^[a-f0-9]{12}$' AND slug NOT IN ('new','configure','invite','admin','api','account','settings','support','studyspace','study-space','home','discover','friends','login','logout')));
CREATE UNIQUE INDEX room_slug_unique ON rooms.rooms(slug) WHERE slug IS NOT NULL;
ALTER TABLE rooms.invites ADD COLUMN token_cipher text;
ALTER TABLE rooms.invites ADD COLUMN creator_id uuid REFERENCES identity.users(id) ON DELETE SET NULL;
UPDATE rooms.invites i SET creator_id=COALESCE(i.sender_id,r.owner_id) FROM rooms.rooms r WHERE r.id=i.room_id;
-- Hash-only legacy tokens cannot be recovered. Preserve historical usage; replace active links explicitly.
CREATE TABLE rooms.invite_joins (
 invite_id uuid NOT NULL REFERENCES rooms.invites(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(invite_id,user_id)
);
CREATE TABLE rooms.referral_links (
 id uuid PRIMARY KEY,
 identifier_hash text NOT NULL UNIQUE CHECK(identifier_hash ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('room-invite','generic')),
 creator_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
 source text NOT NULL DEFAULT '' CHECK(length(source)<=80),
 campaign text NOT NULL DEFAULT '' CHECK(length(campaign)<=80),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE rooms.referral_events (
 id uuid PRIMARY KEY,
 link_id uuid NOT NULL REFERENCES rooms.referral_links(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('landing','free-signup','future-conversion')),
 subject_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
 dedupe_key text NOT NULL CHECK(length(dedupe_key)<=100),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(link_id,kind,dedupe_key)
);
CREATE UNIQUE INDEX referral_first_signup ON rooms.referral_events(subject_id) WHERE kind='free-signup' AND subject_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON rooms.invite_joins,rooms.referral_links,rooms.referral_events TO study_runtime;
