ALTER TABLE admin_users
  ADD COLUMN username text,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;

UPDATE admin_users SET username = email WHERE username IS NULL;

ALTER TABLE admin_users
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT admin_users_username_not_blank CHECK (btrim(username) <> ''),
  ADD CONSTRAINT admin_users_failed_login_count_nonnegative CHECK (failed_login_count >= 0);

CREATE UNIQUE INDEX admin_users_username_unique_idx ON admin_users (lower(username));
CREATE UNIQUE INDEX admin_users_singleton_idx ON admin_users ((true));

ALTER TABLE admin_sessions ADD COLUMN csrf_secret_hash text;

UPDATE admin_sessions
SET
  csrf_secret_hash = encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  revoked_at = COALESCE(revoked_at, clock_timestamp())
WHERE csrf_secret_hash IS NULL;

ALTER TABLE admin_sessions
  ALTER COLUMN csrf_secret_hash SET NOT NULL,
  ADD CONSTRAINT admin_sessions_csrf_secret_hash_not_blank
    CHECK (btrim(csrf_secret_hash) <> '');
