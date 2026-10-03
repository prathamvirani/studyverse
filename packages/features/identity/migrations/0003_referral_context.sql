-- An opaque attribution reference; it never participates in authorization or session identity.
ALTER TABLE identity.oauth_flows ADD COLUMN referral_id uuid;
