CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE property_status AS ENUM ('draft', 'published', 'inactive');
CREATE TYPE publication_status AS ENUM ('queued', 'running', 'succeeded', 'failed');

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT admin_users_password_hash_not_blank CHECK (btrim(password_hash) <> ''),
  CONSTRAINT admin_users_display_name_not_blank CHECK (btrim(display_name) <> '')
);

CREATE UNIQUE INDEX admin_users_email_unique_idx ON admin_users (lower(email));

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_sessions_token_hash_not_blank CHECK (btrim(token_hash) <> ''),
  CONSTRAINT admin_sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX admin_sessions_admin_user_id_idx ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_active_expiry_idx
  ON admin_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  commercial_reference text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status property_status NOT NULL DEFAULT 'draft',
  draft_revision_id bigint,
  published_revision_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  inactivated_at timestamptz,
  CONSTRAINT properties_public_id_not_blank CHECK (btrim(public_id) <> ''),
  CONSTRAINT properties_commercial_reference_not_blank CHECK (btrim(commercial_reference) <> ''),
  CONSTRAINT properties_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT properties_inactive_timestamp_consistency CHECK (
    (status = 'inactive' AND inactivated_at IS NOT NULL)
    OR (status <> 'inactive' AND inactivated_at IS NULL)
  )
);

CREATE INDEX properties_status_updated_idx ON properties (status, updated_at DESC);
CREATE INDEX properties_search_idx ON properties USING gin (
  to_tsvector('simple', public_id || ' ' || commercial_reference || ' ' || slug)
);

CREATE TABLE property_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  revision_number bigint NOT NULL,
  payload jsonb NOT NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_revisions_revision_number_positive CHECK (revision_number > 0),
  CONSTRAINT property_revisions_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT property_revisions_property_number_unique UNIQUE (property_id, revision_number),
  CONSTRAINT property_revisions_property_id_unique UNIQUE (property_id, id)
);

CREATE INDEX property_revisions_created_by_idx ON property_revisions (created_by)
  WHERE created_by IS NOT NULL;

ALTER TABLE properties
  ADD CONSTRAINT properties_draft_revision_fk
  FOREIGN KEY (id, draft_revision_id)
  REFERENCES property_revisions(property_id, id)
  ON DELETE RESTRICT;

ALTER TABLE properties
  ADD CONSTRAINT properties_published_revision_fk
  FOREIGN KEY (id, published_revision_id)
  REFERENCES property_revisions(property_id, id)
  ON DELETE RESTRICT;

CREATE INDEX properties_draft_revision_fk_idx ON properties (id, draft_revision_id)
  WHERE draft_revision_id IS NOT NULL;
CREATE INDEX properties_published_revision_fk_idx ON properties (id, published_revision_id)
  WHERE published_revision_id IS NOT NULL;

CREATE FUNCTION prevent_property_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'property revisions are append-only';
END;
$$;

CREATE TRIGGER property_revisions_append_only
  BEFORE UPDATE OR DELETE ON property_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_property_revision_mutation();

CREATE TABLE property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  revision_id bigint NOT NULL,
  photo_id text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  width integer,
  height integer,
  checksum_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_media_revision_fk
    FOREIGN KEY (property_id, revision_id)
    REFERENCES property_revisions(property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT property_media_photo_id_not_blank CHECK (btrim(photo_id) <> ''),
  CONSTRAINT property_media_storage_key_not_blank CHECK (btrim(storage_key) <> ''),
  CONSTRAINT property_media_mime_type_not_blank CHECK (btrim(mime_type) <> ''),
  CONSTRAINT property_media_byte_size_nonnegative CHECK (byte_size >= 0),
  CONSTRAINT property_media_width_positive CHECK (width IS NULL OR width > 0),
  CONSTRAINT property_media_height_positive CHECK (height IS NULL OR height > 0),
  CONSTRAINT property_media_checksum_not_blank CHECK (btrim(checksum_sha256) <> ''),
  CONSTRAINT property_media_property_photo_unique UNIQUE (property_id, photo_id)
);

CREATE INDEX property_media_property_id_idx ON property_media (property_id);
CREATE INDEX property_media_revision_id_idx ON property_media (revision_id);
CREATE INDEX property_media_revision_fk_idx ON property_media (property_id, revision_id);

CREATE TABLE publication_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  revision_id bigint NOT NULL,
  status publication_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  requested_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT publication_jobs_revision_fk
    FOREIGN KEY (property_id, revision_id)
    REFERENCES property_revisions(property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT publication_jobs_attempts_nonnegative CHECK (attempts >= 0),
  CONSTRAINT publication_jobs_terminal_timestamp CHECK (
    (status IN ('succeeded', 'failed') AND finished_at IS NOT NULL)
    OR (status NOT IN ('succeeded', 'failed') AND finished_at IS NULL)
  )
);

CREATE INDEX publication_jobs_property_id_idx ON publication_jobs (property_id);
CREATE INDEX publication_jobs_revision_id_idx ON publication_jobs (revision_id);
CREATE INDEX publication_jobs_revision_fk_idx ON publication_jobs (property_id, revision_id);
CREATE INDEX publication_jobs_requested_by_idx ON publication_jobs (requested_by)
  WHERE requested_by IS NOT NULL;
CREATE INDEX publication_jobs_queue_idx ON publication_jobs (queued_at, id)
  WHERE status = 'queued';
CREATE UNIQUE INDEX publication_jobs_one_active_per_property_idx
  ON publication_jobs (property_id)
  WHERE status IN ('queued', 'running');

CREATE TABLE site_releases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  publication_job_id bigint NOT NULL UNIQUE REFERENCES publication_jobs(id) ON DELETE RESTRICT,
  manifest jsonb NOT NULL,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_releases_manifest_object CHECK (jsonb_typeof(manifest) = 'object')
);

CREATE INDEX site_releases_created_by_idx ON site_releases (created_by)
  WHERE created_by IS NOT NULL;

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE RESTRICT,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_action_not_blank CHECK (btrim(action) <> ''),
  CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_events_actor_id_idx ON audit_events (actor_id)
  WHERE actor_id IS NOT NULL;
CREATE INDEX audit_events_property_id_idx ON audit_events (property_id)
  WHERE property_id IS NOT NULL;
CREATE INDEX audit_events_action_created_idx ON audit_events (action, created_at DESC);
