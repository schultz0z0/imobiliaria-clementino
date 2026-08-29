-- 005 also upgrades databases where the original 004 was already recorded.
ALTER TABLE property_media
  ADD COLUMN IF NOT EXISTS alt_text text NOT NULL DEFAULT 'Foto do imóvel',
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_storage_key text,
  ADD COLUMN IF NOT EXISTS gallery_storage_key text,
  ADD COLUMN IF NOT EXISTS thumb_storage_key text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gc_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS retained_for_publication boolean NOT NULL DEFAULT false;

ALTER TABLE site_releases ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE TABLE IF NOT EXISTS release_media_refs (
  release_id bigint NOT NULL REFERENCES site_releases(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES property_media(id) ON DELETE RESTRICT,
  PRIMARY KEY (release_id, media_id)
);

CREATE TABLE IF NOT EXISTS media_cleanup_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  media_id uuid NOT NULL,
  paths jsonb NOT NULL,
  failure_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  CONSTRAINT media_cleanup_queue_paths_array CHECK (jsonb_typeof(paths) = 'array'),
  CONSTRAINT media_cleanup_queue_failure_not_blank CHECK (btrim(failure_reason) <> '')
);

CREATE INDEX IF NOT EXISTS release_media_refs_media_id_idx
  ON release_media_refs (media_id, release_id);

-- A retained row is eligible again as soon as the current publication pointer
-- and all non-expired concrete releases stop referring to that exact media id.
CREATE OR REPLACE FUNCTION refresh_property_media_gc(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE media_record record;
DECLARE is_retained boolean;
BEGIN
  FOR media_record IN
    SELECT id FROM property_media
    WHERE property_id = p_property_id AND removed_at IS NOT NULL
  LOOP
    SELECT
      EXISTS (
        SELECT 1
        FROM properties property
        JOIN property_revisions revision ON revision.id = property.published_revision_id
        WHERE property.id = p_property_id
          AND (revision.payload #> '{media,orderedPhotoIds}') ? media_record.id::text
      )
      OR EXISTS (
        SELECT 1
        FROM release_media_refs ref
        JOIN site_releases release ON release.id = ref.release_id
        WHERE ref.media_id = media_record.id
          AND (release.expires_at IS NULL OR release.expires_at > clock_timestamp())
      ) INTO is_retained;
    UPDATE property_media
    SET retained_for_publication = is_retained,
        gc_eligible_at = CASE
          WHEN is_retained THEN NULL
          ELSE clock_timestamp() + interval '30 days'
        END
    WHERE id = media_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_property_media_gc_from_release_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE property_uuid uuid;
BEGIN
  SELECT job.property_id INTO property_uuid
  FROM site_releases release
  JOIN publication_jobs job ON job.id = release.publication_job_id
  WHERE release.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.release_id ELSE NEW.release_id END;
  IF property_uuid IS NOT NULL THEN
    PERFORM refresh_property_media_gc(property_uuid);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_property_media_gc_from_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_property_media_gc(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_property_media_gc_from_release()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE property_uuid uuid;
BEGIN
  SELECT property_id INTO property_uuid
  FROM publication_jobs WHERE id = NEW.publication_job_id;
  IF property_uuid IS NOT NULL THEN
    PERFORM refresh_property_media_gc(property_uuid);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_media_gc_on_published_revision ON properties;
CREATE TRIGGER properties_media_gc_on_published_revision
AFTER UPDATE OF published_revision_id ON properties
FOR EACH ROW WHEN (OLD.published_revision_id IS DISTINCT FROM NEW.published_revision_id)
EXECUTE FUNCTION refresh_property_media_gc_from_property();

DROP TRIGGER IF EXISTS release_media_refs_gc_refresh ON release_media_refs;
CREATE TRIGGER release_media_refs_gc_refresh
AFTER INSERT OR UPDATE OR DELETE ON release_media_refs
FOR EACH ROW EXECUTE FUNCTION refresh_property_media_gc_from_release_ref();

DROP TRIGGER IF EXISTS site_releases_media_gc_refresh ON site_releases;
CREATE TRIGGER site_releases_media_gc_refresh
AFTER UPDATE OF expires_at ON site_releases
FOR EACH ROW WHEN (OLD.expires_at IS DISTINCT FROM NEW.expires_at)
EXECUTE FUNCTION refresh_property_media_gc_from_release();

CREATE INDEX IF NOT EXISTS property_media_active_content_unique_idx
  ON property_media (property_id, checksum_sha256)
  WHERE removed_at IS NULL;
